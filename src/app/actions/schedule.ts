'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isValid, setHours, setMinutes, isWithinInterval, addMinutes, startOfDay } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION_HOURS = 2;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;
const INTERVAL_MINUTES = 30;

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
 * "Studio 1" in sheet should match "Studio 1 - HQ1" in our allowed list.
 */
function normalizeStudio(name: string): string {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return '';
  // Special case for Green Room and Rescheduled
  if (s.includes('green room')) return 'Green Room';
  if (s.includes('rescheduled')) return 'Rescheduled';
  // Standard studio match: find the first allowed studio that contains this name as a prefix
  const match = ALLOWED_STUDIOS.find(allowed => 
    allowed.toLowerCase() === s || allowed.toLowerCase().startsWith(s + ' -')
  );
  return match || name;
}

export async function fetchDaySchedule(targetDate: Date): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  // Use YYYY-MM-DD string for all comparisons to avoid timezone issues
  // We use the date as a "logical" date, ignoring the time part of the incoming object
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');
  
  // Create a local reference date for this day at 00:00:00
  // This helps in consistent time parsing
  const referenceDay = startOfDay(targetDate);

  // 1. Precise Column Mapping
  let studioKey = 'Studio';
  let timeKey = 'Scheduled Time';
  let dateKey = 'Date';
  let teacherKey = 'Teacher 1';
  let courseKey = 'Course';
  let subjectKey = 'Subject';
  let topicKey = 'Topic';

  if (allRows.length > 0) {
    const sampleRow = allRows[0];
    const keys = Object.keys(sampleRow);
    
    const findExactOrClose = (searches: string[], fallback: string) => {
      for (const s of searches) {
        const exact = keys.find(k => k.trim().toLowerCase() === s.toLowerCase());
        if (exact) return exact;
      }
      for (const s of searches) {
        const partial = keys.find(k => k.trim().toLowerCase().includes(s.toLowerCase()));
        if (partial) return partial;
      }
      return fallback;
    };

    studioKey = findExactOrClose(['Studio'], 'Studio');
    timeKey = findExactOrClose(['Scheduled Time', 'Time'], 'Scheduled Time');
    dateKey = findExactOrClose(['Date'], 'Date');
    teacherKey = findExactOrClose(['Teacher 1', 'Teacher'], 'Teacher 1');
    courseKey = findExactOrClose(['Course'], 'Course');
    subjectKey = findExactOrClose(['Subject'], 'Subject');
    topicKey = findExactOrClose(['Topic'], 'Topic');
  }

  // 2. Parse Bookings with high accuracy
  const bookings: ClassBooking[] = allRows
    .map((row) => {
      const dateVal = String(row[dateKey] || '').trim();
      const timeVal = String(row[timeKey] || '').trim();
      const studioRaw = String(row[studioKey] || '').trim();
      
      if (!dateVal || !timeVal || !studioRaw) return null;

      // Filter by Date String immediately
      // Dates usually look like "Friday, March 13, 2026"
      let parsedDay = parse(dateVal, 'EEEE, MMMM d, yyyy', new Date());
      if (!isValid(parsedDay)) {
        parsedDay = new Date(dateVal);
      }
      if (!isValid(parsedDay)) return null;

      const rowDateStr = format(parsedDay, 'yyyy-MM-dd');
      if (rowDateStr !== targetDateStr) return null;

      // Normalize Studio Name
      const studioMatch = normalizeStudio(studioRaw);
      if (!ALLOWED_STUDIOS.includes(studioMatch)) return null;

      // Parse Time relative to our reference day to keep it "logical" (floating)
      let startTime = parse(timeVal, 'h:mm a', referenceDay);
      if (!isValid(startTime)) {
        startTime = referenceDay;
      }

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

  // 3. Generate 30-minute intervals for the grid
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
      // Find a booking that covers this interval for this studio
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
          date: format(referenceDay, 'EEEE, MMMM d, yyyy'),
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
