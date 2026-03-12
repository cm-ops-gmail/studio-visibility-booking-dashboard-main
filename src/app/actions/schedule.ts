
'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule } from '@/app/lib/types';
import { parse, format, addHours, isSameDay, isValid } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';

const CLASS_DURATION = 2; // Hours
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;

export async function fetchDaySchedule(targetDate: Date): Promise<DaySchedule> {
  const allRows = await getSheetData();
  
  // Columns: Studio, Scheduled Time, Date, Course, Subject, Topic, Teacher 1
  const bookings: ClassBooking[] = allRows.map((row) => {
    const dateStr = row['Date'];
    const timeStr = row['Scheduled Time'];
    
    // Explicitly parse the date format: "Thursday, March 12, 2026"
    let parsedDay = parse(dateStr, 'EEEE, MMMM d, yyyy', new Date());
    
    // Fallback if the format doesn't match exactly
    if (!isValid(parsedDay)) {
      parsedDay = new Date(dateStr);
    }

    // Explicitly parse the time format: "5:45 AM"
    let startTime = parse(timeStr, 'h:mm a', parsedDay);
    
    // Fallback for time
    if (!isValid(startTime)) {
       startTime = parsedDay;
    }

    const endTime = addHours(startTime, CLASS_DURATION);

    return {
      id: row.id,
      studio: row['Studio'] || 'Unknown',
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
  });

  // Filter by target date
  const filteredBookings = bookings.filter((b) => isSameDay(new Date(b.startTime), targetDate));

  // Get unique studios
  const uniqueStudios = Array.from(new Set(filteredBookings.map((b) => b.studio))).sort();
  if (uniqueStudios.length === 0) {
      // Return defaults if no bookings
      return { date: format(targetDate, 'yyyy-MM-dd'), studios: [], slots: {} };
  }

  const schedule: Record<string, ClassBooking[]> = {};

  uniqueStudios.forEach((studio) => {
    const studioBookings = filteredBookings.filter((b) => b.studio === studio);
    const studioSlots: ClassBooking[] = [];
    
    // Create slots from DAY_START to DAY_END
    let current = parse(`${DAY_START_HOUR}:00 AM`, 'h:mm a', targetDate);
    const end = parse(`${DAY_END_HOUR}:00 PM`, 'h:mm a', targetDate);

    while (current < end) {
      const slotStartTimeStr = format(current, 'h:mm a');
      // Look for a booking that starts exactly at this time
      const existing = studioBookings.find((b) => format(new Date(b.startTime), 'h:mm a') === slotStartTimeStr);

      if (existing) {
        studioSlots.push(existing);
        current = new Date(existing.endTime);
      } else {
        const slotEnd = addHours(current, CLASS_DURATION);
        studioSlots.push({
          id: `free-${studio}-${slotStartTimeStr}`,
          studio,
          date: format(targetDate, 'EEEE, MMMM d, yyyy'),
          scheduledTime: slotStartTimeStr,
          course: '',
          subject: '',
          topic: '',
          teacher: '',
          startTime: current.toISOString(),
          endTime: slotEnd.toISOString(),
          isBooked: false,
        });
        current = slotEnd;
      }
    }
    schedule[studio] = studioSlots;
  });

  return {
    date: format(targetDate, 'yyyy-MM-dd'),
    studios: uniqueStudios,
    slots: schedule,
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
