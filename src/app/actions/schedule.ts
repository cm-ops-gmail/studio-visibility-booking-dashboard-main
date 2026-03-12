'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isValid, setHours, setMinutes, isWithinInterval, addMinutes, startOfDay } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION_HOURS = 2;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;
const INTERVAL_MINUTES = 30;

// Strictly defined allowed studios in the required sequence
const ALLOWED_STUDIOS = [
  'Studio 1 - HQ1',
  'Studio 2 - HQ1',
  'Studio 3 - HQ1',
  'Studio 4 - HQ1',
  'Studio 5 - HQ5',
  'Studio 6 - HQ5',
  'Studio 7 - HQ5',
  'Studio 8 - HQ5',
  'Studio 9 - NB2',
  'Studio 10 - NB2',
  'Studio 11 - NB2',
  'POD 1 - HQ1',
  'POD 2 - HQ1',
  'Green Room',
  'Rescheduled',
];

/**
 * Normalizes studio names for matching. 
 */
function normalizeStudio(name: string): string {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return '';
  
  if (s.includes('green room')) return 'Green Room';
  if (s.includes('rescheduled')) return 'Rescheduled';
  
  const match = ALLOWED_STUDIOS.find(allowed => 
    allowed.toLowerCase() === s || allowed.toLowerCase().startsWith(s + ' -')
  );
  return match || name;
}

/**
 * Robust date parser for the "Friday, March 13, 2026" format.
 */
function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try splitting by comma: "Friday, March 13, 2026" -> ["Friday", " March 13", " 2026"]
  const parts = dateStr.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const monthDay = parts[1]; // "March 13"
    const year = parts[2] || new Date().getFullYear().toString(); // "2026"
    const d = parse(`${monthDay} ${year}`, 'MMMM d yyyy', new Date());
    if (isValid(d)) return d;
  }
  const d = new Date(dateStr);
  return isValid(d) ? d : null;
}

/**
 * Fetches the schedule for a specific date.
 * targetDateStr is expected as "yyyy-MM-dd"
 */
export async function fetchDaySchedule(targetDateStr: string): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  // Use a fixed reference day for time calculations
  const referenceDay = parse(targetDateStr, 'yyyy-MM-dd', new Date());

  // 1. Column Mapping Logic
  let studioKey = 'Studio';
  let timeKey = 'Scheduled Time';
  let dateKey = 'Date';
  let teacherKey = 'Teacher 1';
  let courseKey = 'Course';
  let subjectKey = 'Subject';
  let topicKey = 'Topic';

  if (allRows.length > 0) {
    const keys = Object.keys(allRows[0]);
    const findKey = (candidates: string[]) => 
      keys.find(k => candidates.some(c => k.trim().toLowerCase() === c.toLowerCase())) || candidates[0];

    studioKey = findKey(['Studio', 'Studio Name']);
    timeKey = findKey(['Scheduled Time', 'Time', 'Start Time']);
    dateKey = findKey(['Date', 'Class Date']);
    teacherKey = findKey(['Teacher 1', 'Teacher Name', 'Teacher']);
    courseKey = findKey(['Course', 'Course Name']);
    subjectKey = findKey(['Subject', 'Subject Name']);
    topicKey = findKey(['Topic', 'Lesson Topic']);
  }

  // 2. Filter and Parse Bookings
  const bookings: ClassBooking[] = allRows
    .map((row) => {
      const dateVal = String(row[dateKey] || '').trim();
      const timeVal = String(row[timeKey] || '').trim();
      const studioRaw = String(row[studioKey] || '').trim();
      
      if (!dateVal || !timeVal || !studioRaw) return null;

      const parsedDay = parseSheetDate(dateVal);
      if (!parsedDay) return null;

      const rowDateStr = format(parsedDay, 'yyyy-MM-dd');
      // STRICT DATE FILTERING
      if (rowDateStr !== targetDateStr) return null;

      const studioMatch = normalizeStudio(studioRaw);
      if (!ALLOWED_STUDIOS.includes(studioMatch)) return null;

      let startTime = parse(timeVal, 'h:mm a', referenceDay);
      if (!isValid(startTime)) {
        startTime = parse(timeVal, 'HH:mm', referenceDay);
      }
      if (!isValid(startTime)) return null;

      const endTime = addHours(startTime, CLASS_DURATION_HOURS);

      return {
        id: row.id || `row-${Math.random()}`,
        studio: studioMatch,
        date: dateVal,
        scheduledTime: timeVal,
        course: String(row[courseKey] || '').trim(),
        subject: String(row[subjectKey] || '').trim(),
        topic: String(row[topicKey] || '').trim(),
        teacher: String(row[teacherKey] || '').trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeLabel: format(startTime, 'h:mm a'),
        endTimeLabel: format(endTime, 'h:mm a'),
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  // 3. Generate fixed 30-minute intervals (8 AM - 11 PM)
  const intervals: TimeInterval[] = [];
  const dayStart = setMinutes(setHours(referenceDay, DAY_START_HOUR), 0);
  const dayEnd = setMinutes(setHours(referenceDay, DAY_END_HOUR), 0);

  let current = new Date(dayStart);
  while (current <= dayEnd) {
    const next = addMinutes(current, INTERVAL_MINUTES);
    intervals.push({
      start: current.toISOString(),
      end: next.toISOString(),
      label: format(current, 'h:mm a')
    });
    current = next;
  }

  // 4. Construct the Grid
  const grid: Record<string, Record<string, ClassBooking>> = {};

  intervals.forEach((interval) => {
    grid[interval.start] = {};
    const intervalStart = new Date(interval.start);
    const midPoint = addMinutes(intervalStart, 1);

    ALLOWED_STUDIOS.forEach((studio) => {
      const activeBooking = bookings.find(b => {
        if (b.studio !== studio) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return isWithinInterval(midPoint, { start: bStart, end: bEnd });
      });

      if (activeBooking) {
        grid[interval.start][studio] = activeBooking;
      } else {
        grid[interval.start][studio] = {
          id: `free-${studio}-${interval.start}`,
          studio,
          date: targetDateStr,
          scheduledTime: format(intervalStart, 'h:mm a'),
          course: '',
          subject: '',
          topic: '',
          teacher: '',
          startTime: interval.start,
          endTime: interval.end,
          startTimeLabel: format(intervalStart, 'h:mm a'),
          endTimeLabel: format(addMinutes(intervalStart, 30), 'h:mm a'),
          isBooked: false,
        };
      }
    });
  });

  return {
    date: targetDateStr,
    studios: ALLOWED_STUDIOS,
    intervals,
    grid,
  };
}

export async function getSmartSuggestion(booking: ClassBooking, existingBookings: any[]) {
    return await suggestSmartSlotDescription({
        studioName: booking.studio,
        date: booking.date,
        availableSlotStartTime: booking.startTimeLabel || format(new Date(booking.startTime), 'h:mm a'),
        availableSlotEndTime: booking.endTimeLabel || format(new Date(booking.endTime), 'h:mm a'),
        existingBookings: existingBookings.map(b => ({
            subject: b.subject,
            teacher: b.teacher,
            startTime: b.startTimeLabel || format(new Date(b.startTime), 'h:mm a'),
            endTime: b.endTimeLabel || format(new Date(b.endTime), 'h:mm a')
        }))
    });
}
