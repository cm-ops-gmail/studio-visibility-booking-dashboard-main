'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule } from '@/app/lib/types';
import { parse, format, addHours, isSameDay, isValid, compareAsc } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION = 2; // Hours

export async function fetchDaySchedule(targetDate: Date): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  // 1. Extract ALL unique studios from the entire spreadsheet to ensure they always show up
  // We scan the entire dataset for any value in a column that might be 'Studio'
  const studiosInOrder: string[] = [];
  allRows.forEach(row => {
    // Try to find the studio value, handling potential key variations
    const sValue = row['Studio'] || row['STUDIO'] || row['studio'];
    const s = String(sValue || '').trim();
    if (s && s !== '' && !studiosInOrder.includes(s)) {
      studiosInOrder.push(s);
    }
  });
  const allStudios = studiosInOrder;

  // 2. Extract ALL unique time slots from the entire spreadsheet to keep the grid consistent
  const allTimeSlotStrings = Array.from(new Set(
    allRows
      .map(row => {
        const tValue = row['Scheduled Time'] || row['Time'] || row['TIME'];
        return String(tValue || '').trim();
      })
      .filter(time => time !== '' && time !== 'Scheduled Time' && time !== 'Time')
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
        const dateStr = String(row['Date'] || '').trim();
        const timeStr = String(row['Scheduled Time'] || row['Time'] || '').trim();
        return dateStr !== '' && timeStr !== '';
    })
    .map((row) => {
      const dateStr = String(row['Date']).trim();
      const timeStr = String(row['Scheduled Time'] || row['Time']).trim();
      const studioValue = String(row['Studio'] || row['STUDIO'] || 'Unknown').trim();
      
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
    allStudios.forEach((studio) => {
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
    studios: allStudios,
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
