'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule } from '@/app/lib/types';
import { parse, format, addHours, isSameDay, isValid, compareAsc } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION = 2; // Hours

// Strictly defined studios in the requested sequence
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
  
  if (allRows.length === 0) {
    return {
      date: format(targetDate, 'yyyy-MM-dd'),
      studios: ALLOWED_STUDIOS,
      timeSlots: [],
      grid: {},
    };
  }

  // 1. Identify key columns dynamically to handle variations in naming or spacing
  const sampleRow = allRows[0];
  const keys = Object.keys(sampleRow);
  const studioKey = keys.find(k => k.toLowerCase().trim() === 'studio') || 'Studio';
  const timeKey = keys.find(k => k.toLowerCase().includes('time')) || 'Scheduled Time';
  const dateKey = keys.find(k => k.toLowerCase().includes('date')) || 'Date';

  // 2. Extract ALL unique time slots from the entire spreadsheet to keep the grid consistent
  const allTimeSlotStrings = Array.from(new Set(
    allRows
      .map(row => String(row[timeKey] || '').trim())
      .filter(time => {
        if (!time || time.toLowerCase().includes('time')) return false;
        // Simple regex to check if it's a time format like "5:45 AM"
        return /\d{1,2}:\d{2}\s+(AM|PM)/i.test(time);
      })
  )).sort((a, b) => {
    try {
      const dateA = parse(a, 'h:mm a', new Date());
      const dateB = parse(b, 'h:mm a', new Date());
      if (!isValid(dateA) || !isValid(dateB)) return 0;
      return compareAsc(dateA, dateB);
    } catch (e) {
      return 0;
    }
  });

  // 3. Parse bookings for the specific target date
  const bookings: ClassBooking[] = allRows
    .filter((row) => {
        const dateStr = String(row[dateKey] || '').trim();
        const timeStr = String(row[timeKey] || '').trim();
        const studioVal = String(row[studioKey] || '').trim();
        return dateStr !== '' && timeStr !== '' && ALLOWED_STUDIOS.includes(studioVal);
    })
    .map((row) => {
      const dateStr = String(row[dateKey]).trim();
      const timeStr = String(row[timeKey]).trim();
      const studioValue = String(row[studioKey]).trim();
      
      // Expected format: "Thursday, March 12, 2026"
      let parsedDay = parse(dateStr, 'EEEE, MMMM d, yyyy', new Date());
      if (!isValid(parsedDay)) {
        parsedDay = new Date(dateStr);
      }

      let startTime = parse(timeStr, 'h:mm a', parsedDay);
      if (!isValid(startTime)) {
         startTime = parsedDay;
      }

      const endTime = addHours(startTime, CLASS_DURATION);

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
    .filter((b) => isValid(new Date(b.startTime)) && isSameDay(new Date(b.startTime), targetDate));

  const grid: Record<string, Record<string, ClassBooking>> = {};

  allTimeSlotStrings.forEach((time) => {
    grid[time] = {};
    ALLOWED_STUDIOS.forEach((studio) => {
      const booking = bookings.find(b => b.studio === studio && b.scheduledTime === time);
      if (booking) {
        grid[time][studio] = booking;
      } else {
        // Create an "available" slot for this studio at this time
        const slotStart = parse(time, 'h:mm a', targetDate);
        const slotEnd = addHours(slotStart, CLASS_DURATION);
        grid[time][studio] = {
          id: `free-${studio}-${time}`,
          studio,
          date: format(targetDate, 'EEEE, MMMM d, yyyy'),
          scheduledTime: time,
          course: '',
          subject: '',
          topic: '',
          teacher: '',
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          isBooked: false,
        };
      }
    });
  });

  return {
    date: format(targetDate, 'yyyy-MM-dd'),
    studios: ALLOWED_STUDIOS,
    timeSlots: allTimeSlotStrings,
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
