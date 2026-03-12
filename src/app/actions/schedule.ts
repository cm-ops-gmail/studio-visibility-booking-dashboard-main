
'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isValid, setHours, setMinutes, addMinutes, differenceInMinutes } from 'date-fns';
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

function normalizeStudio(name: string): string {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('green room')) return 'Green Room';
  const match = ALLOWED_STUDIOS.find(allowed => 
    allowed.toLowerCase() === s || allowed.toLowerCase().startsWith(s + ' -')
  );
  return match || name;
}

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const monthDay = parts[1];
    const year = parts[2] || new Date().getFullYear().toString();
    const d = parse(`${monthDay} ${year}`, 'MMMM d yyyy', new Date());
    if (isValid(d)) return d;
  }
  const d = new Date(dateStr);
  return isValid(d) ? d : null;
}

function parseTime(timeStr: string, referenceDay: Date): Date | null {
    if (!timeStr) return null;
    const cleanTime = timeStr.trim().toUpperCase();
    const formats = ['h:mm a', 'h:mma', 'h a', 'ha', 'HH:mm'];
    for (const fmt of formats) {
        const t = parse(cleanTime, fmt, referenceDay);
        if (isValid(t)) return t;
    }
    try {
        const d = new Date(`${format(referenceDay, 'yyyy-MM-dd')} ${cleanTime}`);
        if (isValid(d)) return d;
    } catch (e) {}
    return null;
}

export async function fetchDaySchedule(targetDateStr: string): Promise<DaySchedule> {
  const allRows = await getSheetData();
  const referenceDay = parse(targetDateStr, 'yyyy-MM-dd', new Date());

  let studioKey = 'Studio', timeKey = 'Scheduled Time', dateKey = 'Date', 
      teacherKey = 'Teacher 1', courseKey = 'Course', subjectKey = 'Subject', topicKey = 'Topic',
      productTypeKey = 'Product Type', entryTimeKey = 'Entry Time [T-45min/T-30min]';

  if (allRows.length > 0) {
    const keys = Object.keys(allRows[0]);
    const findKey = (candidates: string[]) => 
      keys.find(k => candidates.some(c => k.trim().toLowerCase() === c.toLowerCase())) || 
      keys.find(k => candidates.some(c => k.trim().toLowerCase().includes(c.toLowerCase().split(' ')[0]))) ||
      candidates[0];

    studioKey = findKey(['Studio', 'Studio Name']);
    timeKey = findKey(['Scheduled Time', 'Time', 'Start Time']);
    dateKey = findKey(['Date', 'Class Date']);
    teacherKey = findKey(['Teacher 1', 'Teacher Name', 'Teacher']);
    courseKey = findKey(['Course', 'Course Name']);
    subjectKey = findKey(['Subject', 'Subject Name']);
    topicKey = findKey(['Topic', 'Lesson Topic']);
    productTypeKey = findKey(['Product Type', 'Type']);
    entryTimeKey = findKey(['Entry Time [T-45min/T-30min]', 'Entry Time']);
  }

  const bookings: ClassBooking[] = allRows
    .map((row, index) => {
      const dateVal = String(row[dateKey] || '').trim();
      const timeVal = String(row[timeKey] || '').trim();
      const studioRaw = String(row[studioKey] || '').trim();
      const productType = String(row[productTypeKey] || '').trim();
      const entryTimeVal = String(row[entryTimeKey] || '').trim();
      
      if (!dateVal || !timeVal || !studioRaw) return null;

      const parsedDay = parseSheetDate(dateVal);
      if (!parsedDay) return null;

      const rowDateStr = format(parsedDay, 'yyyy-MM-dd');
      if (rowDateStr !== targetDateStr) return null;

      const studioMatch = normalizeStudio(studioRaw);
      if (!ALLOWED_STUDIOS.includes(studioMatch)) return null;

      const startTime = parseTime(timeVal, referenceDay);
      if (!startTime) return null;

      let endTime: Date | null = null;
      if (productType.toLowerCase().includes('studio booking') && entryTimeVal) {
          const parsedEndTime = parseTime(entryTimeVal, referenceDay);
          if (parsedEndTime) {
            endTime = parsedEndTime;
          }
      }
      
      if (!endTime) {
          endTime = addHours(startTime, CLASS_DURATION_HOURS);
      }

      const durationMinutes = Math.abs(differenceInMinutes(endTime, startTime));
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      
      let durationLabel = '';
      if (hours > 0) durationLabel += `${hours}H`;
      if (mins > 0) durationLabel += `${hours > 0 ? ' ' : ''}${mins}M`;
      if (!durationLabel) durationLabel = '0M';

      return {
        id: `row-${index}`, 
        studio: studioMatch,
        date: dateVal,
        scheduledTime: timeVal,
        course: String(row[courseKey] || '').trim(),
        subject: String(row[subjectKey] || '').trim(),
        topic: String(row[topicKey] || '').trim(),
        teacher: String(row[teacherKey] || '').trim(),
        productType: productType,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeLabel: format(startTime, 'h:mm a'),
        endTimeLabel: format(endTime, 'h:mm a'),
        durationLabel: durationLabel,
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

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
        const actualStart = bStart < bEnd ? bStart : bEnd;
        const actualEnd = bStart < bEnd ? bEnd : bStart;
        return midPoint >= actualStart && midPoint < actualEnd;
      });

      if (activeBooking) {
        const bStart = new Date(activeBooking.startTime);
        const bEnd = new Date(activeBooking.endTime);
        const actualStart = bStart < bEnd ? bStart : bEnd;
        const actualEnd = bStart < bEnd ? bEnd : bStart;
        
        const prevIntervalStart = addMinutes(intervalStart, -INTERVAL_MINUTES);
        const prevMidPoint = addMinutes(prevIntervalStart, 1);
        const isFirst = !(prevMidPoint >= actualStart && prevMidPoint < actualEnd && prevIntervalStart >= dayStart);

        let rowSpan = 1;
        if (isFirst) {
            let scan = addMinutes(intervalStart, INTERVAL_MINUTES);
            while (scan <= dayEnd) {
                const scanMid = addMinutes(scan, 1);
                if (scanMid >= actualStart && scanMid < actualEnd) {
                    rowSpan++;
                } else {
                    break;
                }
                scan = addMinutes(scan, INTERVAL_MINUTES);
            }
        }

        grid[interval.start][studio] = {
          ...activeBooking,
          isFirst,
          rowSpan
        };
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
          productType: '',
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
