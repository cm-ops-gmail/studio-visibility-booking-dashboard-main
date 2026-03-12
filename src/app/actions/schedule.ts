'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isSameDay, isValid, setHours, setMinutes, isWithinInterval, addMinutes } from 'date-fns';
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
];

export async function fetchDaySchedule(targetDate: Date): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  const dayStart = setMinutes(setHours(new Date(targetDate), DAY_START_HOUR), 0);
  const dayEnd = setMinutes(setHours(new Date(targetDate), DAY_END_HOUR), 0);

  // 1. Identify key columns dynamically
  let studioKey = 'Studio';
  let timeKey = 'Scheduled Time';
  let dateKey = 'Date';

  if (allRows.length > 0) {
    const sampleRow = allRows[0];
    const keys = Object.keys(sampleRow);
    studioKey = keys.find(k => k.toLowerCase().trim() === 'studio') || 'Studio';
    timeKey = keys.find(k => k.toLowerCase().includes('time')) || 'Scheduled Time';
    dateKey = keys.find(k => k.toLowerCase().includes('date')) || 'Date';
  }

  // 2. Parse all bookings for the target date
  const bookings: ClassBooking[] = allRows
    .filter((row) => {
        const studioVal = String(row[studioKey] || '').trim();
        return ALLOWED_STUDIOS.includes(studioVal);
    })
    .map((row) => {
      const dateStr = String(row[dateKey] || '').trim();
      const timeStr = String(row[timeKey] || '').trim();
      const studioValue = String(row[studioKey] || '').trim();
      
      if (!dateStr || !timeStr) return null;

      let parsedDay = parse(dateStr, 'EEEE, MMMM d, yyyy', new Date());
      if (!isValid(parsedDay)) {
        parsedDay = new Date(dateStr);
      }
      
      if (!isValid(parsedDay)) return null;

      let startTime = parse(timeStr, 'h:mm a', parsedDay);
      if (!isValid(startTime)) {
        startTime = parsedDay;
      }

      const endTime = addHours(startTime, CLASS_DURATION_HOURS);

      return {
        id: row.id,
        studio: studioValue,
        date: dateStr,
        scheduledTime: timeStr,
        course: row['Course'] || row['COURSE'] || '',
        subject: row['Subject'] || row['SUBJECT'] || '',
        topic: row['Topic'] || row['TOPIC'] || '',
        teacher: row['Teacher 1'] || row['TEACHER 1'] || row['Teacher'] || '',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => {
      if (!b) return false;
      const start = new Date(b.startTime);
      return isValid(start) && isSameDay(start, targetDate);
    });

  // 3. Generate fixed 30-minute intervals
  const intervals: TimeInterval[] = [];
  let current = new Date(dayStart);
  while (current < dayEnd) {
    const next = addMinutes(current, INTERVAL_MINUTES);
    intervals.push({
      start: current.toISOString(),
      end: next.toISOString(),
      label: format(current, 'h:mm a')
    });
    current = next;
  }

  // 4. Construct the grid
  const grid: Record<string, Record<string, ClassBooking>> = {};

  intervals.forEach((interval) => {
    const intervalKey = interval.start;
    grid[intervalKey] = {};
    
    const intervalStart = new Date(interval.start);
    const intervalEnd = new Date(interval.end);
    const midPoint = addMinutes(intervalStart, 1); // Check a point inside the interval

    ALLOWED_STUDIOS.forEach((studio) => {
      const activeBooking = bookings.find(b => {
        if (b.studio !== studio) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        // Interval is covered if the midpoint of the 30-min slot is within the booking
        return isWithinInterval(midPoint, { start: bStart, end: bEnd });
      });

      if (activeBooking) {
        grid[intervalKey][studio] = activeBooking;
      } else {
        grid[intervalKey][studio] = {
          id: `free-${studio}-${interval.start}`,
          studio,
          date: format(targetDate, 'EEEE, MMMM d, yyyy'),
          scheduledTime: format(intervalStart, 'h:mm a'),
          course: '',
          subject: '',
          topic: '',
          teacher: '',
          startTime: interval.start,
          endTime: interval.end,
          isBooked: false,
        };
      }
    });
  });

  return {
    date: format(targetDate, 'yyyy-MM-dd'),
    studios: ALLOWED_STUDIOS,
    intervals,
    grid,
  };
}

export async function getSmartSuggestion(booking: ClassBooking, existingBookings: any[]) {
    return await suggestSmartSlotDescription({
        studioName: booking.studio,
        date: booking.date,
        availableSlotStartTime: format(new Date(booking.startTime), 'h:mm a'),
        availableSlotEndTime: format(new Date(booking.endTime), 'h:mm a'),
        existingBookings: existingBookings.map(b => ({
            subject: b.subject,
            teacher: b.teacher,
            startTime: format(new Date(b.startTime), 'h:mm a'),
            endTime: format(new Date(b.endTime), 'h:mm a')
        }))
    });
}
