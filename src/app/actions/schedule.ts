
'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule } from '@/app/lib/types';
import { parse, format, addHours, isSameDay, isValid, compareAsc } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION = 2; // Hours

export async function fetchDaySchedule(targetDate: Date): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  const bookings: ClassBooking[] = allRows
    .filter((row) => row['Date'] && row['Scheduled Time'])
    .map((row) => {
      const dateStr = String(row['Date']).trim();
      const timeStr = String(row['Scheduled Time']).trim();
      
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
        studio: (row['Studio'] || 'Unknown').trim(),
        date: dateStr,
        scheduledTime: timeStr,
        course: row['Course'] || '',
        subject: row['Subject'] || '',
        topic: row['Topic'] || '',
        teacher: row['Teacher 1'] || '',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isBooked: true,
      };
    })
    .filter((b) => isValid(new Date(b.startTime)) && isSameDay(new Date(b.startTime), targetDate));

  const uniqueStudios = Array.from(new Set(bookings.map((b) => b.studio))).sort();
  
  // Extract and sort unique time slots from the data
  const timeSlotStrings = Array.from(new Set(bookings.map(b => b.scheduledTime)));
  const sortedTimeSlots = timeSlotStrings.sort((a, b) => {
    const dateA = parse(a, 'h:mm a', targetDate);
    const dateB = parse(b, 'h:mm a', targetDate);
    return compareAsc(dateA, dateB);
  });

  const grid: Record<string, Record<string, ClassBooking>> = {};

  sortedTimeSlots.forEach((time) => {
    grid[time] = {};
    uniqueStudios.forEach((studio) => {
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
    studios: uniqueStudios,
    timeSlots: sortedTimeSlots,
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
