
'use server';

import { getSheetData, getBulkBookingData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isValid, setHours, setMinutes, addMinutes, isWithinInterval, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';
import { getActiveRequestsOverlay } from './booking';

const CLASS_DURATION_HOURS = 2;
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 22;
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

  // List of common date formats to try
  const formatsToTry = [
    'MMMM d, yyyy', // "April 1, 2024"
    'MMM d, yyyy',  // "Apr 1, 2024"
    'M/d/yyyy',     // "4/1/2024"
    'MM/dd/yyyy',   // "04/01/2024"
    'yyyy-MM-dd',   // "2024-04-01"
  ];

  for (const fmt of formatsToTry) {
    const d = parse(dateStr, fmt, new Date());
    if (isValid(d)) {
      return d;
    }
  }
  
  // Fallback for any other format that `new Date` can handle
  const fallbackDate = new Date(dateStr);
  if (isValid(fallbackDate)) {
    return fallbackDate;
  }

  return null;
}

function parseTime(timeStr: string, referenceDay: Date): Date | null {
    if (!timeStr) return null;
    const cleanTime = timeStr.trim().toUpperCase();
    const formats = ['h:mm a', 'h:mma', 'h a', 'ha', 'HH:mm'];
    for (const fmt of formats) {
        const t = parse(cleanTime, fmt, referenceDay);
        if (isValid(t)) return t;
    }
    return null;
}

function getProp(obj: any, candidates: string[]): any {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    const foundKey = keys.find(k => k.toLowerCase().trim() === cand.toLowerCase());
    if (foundKey) return obj[foundKey];
  }
  return null;
}

export async function fetchDaySchedule(targetDateStr: string): Promise<DaySchedule> {
  const [allRows, bulkRows, requestsOverlay] = await Promise.all([
    getSheetData(),
    getBulkBookingData(),
    getActiveRequestsOverlay()
  ]);
  
  const referenceDay = parse(targetDateStr, 'yyyy-MM-dd', new Date());

  const sheetBookings: ClassBooking[] = allRows
    .map((row, index) => {
      const dateVal = String(row.Date || row.date || '').trim();
      const timeVal = String(row['Scheduled Time'] || row.Time || row['Start Time'] || '').trim();
      const endTimeVal = String(row['End Time'] || row['Scheduled End Time'] || '').trim();
      const studioRaw = String(row.Studio || row['Studio Name'] || '').trim();
      
      const parsedDay = parseSheetDate(dateVal);
      if (!parsedDay) return null;

      const rowDateStr = format(parsedDay, 'yyyy-MM-dd');
      if (rowDateStr !== targetDateStr) return null;

      const studioMatch = normalizeStudio(studioRaw);
      if (!ALLOWED_STUDIOS.includes(studioMatch)) return null;

      const startTime = parseTime(timeVal, parsedDay);
      if (!startTime) return null;
      
      let endTime = addHours(startTime, CLASS_DURATION_HOURS);
      if (endTimeVal) {
        const parsedEnd = parseTime(endTimeVal, parsedDay);
        if (parsedEnd && parsedEnd > startTime) endTime = parsedEnd;
      }

      return {
        id: `row-${index}`, 
        studio: studioMatch,
        date: rowDateStr,
        scheduledTime: timeVal,
        course: String(row.Course || row.course || '').trim(),
        subject: String(row.Subject || row.subject || '').trim(),
        topic: String(row.Topic || row.topic || '').trim(),
        teacher: String(row['Teacher 1'] || row.Teacher || row.teacher || '').trim(),
        productType: String(row['Product Type'] || row.productType || '').trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeLabel: format(startTime, 'h:mm a'),
        endTimeLabel: format(endTime, 'h:mm a'),
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  const bulkBookings: ClassBooking[] = bulkRows
    .map((row) => {
      const dateVal = String(getProp(row, ['Date']) || '').trim();
      const parsedDay = parseSheetDate(dateVal);
      if (!parsedDay) return null;

      const rowDateStr = format(parsedDay, 'yyyy-MM-dd');
      if (rowDateStr !== targetDateStr) return null;

      const startTimeISO = getProp(row, ['StartTimeISO', 'startTimeISO', 'startTime']);
      const endTimeISO = getProp(row, ['EndTimeISO', 'endTimeISO', 'endTime']);
      
      let startD: Date | null = null;
      let endD: Date | null = null;

      if (startTimeISO) {
        startD = new Date(startTimeISO);
      } else {
        const timeStr = String(getProp(row, ['Scheduled Time', 'time', 'start time']) || '').trim();
        startD = parseTime(timeStr, parsedDay);
      }

      if (!startD || !isValid(startD)) return null;

      if (endTimeISO) {
        endD = new Date(endTimeISO);
      } else {
        const endTimeStr = String(getProp(row, ['End Time', 'scheduled end time']) || '').trim();
        endD = parseTime(endTimeStr, parsedDay) || addHours(startD, CLASS_DURATION_HOURS);
      }

      if (!endD || !isValid(endD)) return null;

      const studioRaw = String(getProp(row, ['Studio', 'studio name']) || '');
      const studioMatch = normalizeStudio(studioRaw);
      if (!ALLOWED_STUDIOS.includes(studioMatch)) return null;

      return {
        id: row.id || `bulk-${Math.random()}`,
        studio: studioMatch,
        date: rowDateStr,
        scheduledTime: String(getProp(row, ['Scheduled Time']) || format(startD, 'h:mm a')),
        course: String(getProp(row, ['Course']) || ''),
        subject: String(getProp(row, ['Subject']) || ''),
        topic: String(getProp(row, ['Topic']) || ''),
        teacher: String(getProp(row, ['Teacher 1', 'Teacher']) || ''),
        productType: String(getProp(row, ['Product Type']) || ''),
        startTime: startD.toISOString(),
        endTime: endD.toISOString(),
        startTimeLabel: format(startD, 'h:mm a'),
        endTimeLabel: format(endD, 'h:mm a'),
        isBooked: true,
        isBulk: true
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  const combinedBookings = [...sheetBookings, ...bulkBookings];

  const intervals: TimeInterval[] = [];
  const dayStart = setMinutes(setHours(startOfDay(referenceDay), DAY_START_HOUR), 0);
  const dayEnd = setMinutes(setHours(startOfDay(referenceDay), DAY_END_HOUR), 0);

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

  const prepSlots: Record<string, Set<string>> = {};
  combinedBookings.forEach(b => {
    const isStudioBooking = (b.productType || '').toLowerCase().includes('studio booking');
    if (!isStudioBooking) {
      const bStartISO = b.startTime;
      const prepInterval = intervals.find(inv => inv.end === bStartISO);
      if (prepInterval) {
        if (!prepSlots[prepInterval.start]) prepSlots[prepInterval.start] = new Set();
        prepSlots[prepInterval.start].add(b.studio);
      }
    }
  });

  const grid: Record<string, Record<string, ClassBooking>> = {};

  intervals.forEach((interval) => {
    grid[interval.start] = {};
    const intervalStart = new Date(interval.start);
    const midPoint = addMinutes(intervalStart, 1);

    ALLOWED_STUDIOS.forEach((studio) => {
      const activeSheetBooking = combinedBookings.find(b => {
        if (b.studio !== studio) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        if (!isValid(bStart) || !isValid(bEnd)) return false;
        return midPoint >= bStart && midPoint < bEnd;
      });

      const activeRequest = requestsOverlay.find(req => {
        if (req.studio !== studio || req.date !== targetDateStr) return false;
        const reqStart = new Date(req.startTime);
        if (!isValid(reqStart)) return false;
        let durationHrs = req.duration === '30 mins' ? 0.5 : (req.duration === '1 hr 30 mins' ? 1.5 : (req.duration === '2 hrs' ? 2 : 1));
        const reqEnd = addHours(reqStart, durationHrs);
        return midPoint >= reqStart && midPoint < reqEnd;
      });

      const activeBooking = activeSheetBooking || (activeRequest ? {
        id: `req-${activeRequest.id}`,
        studio: activeRequest.studio,
        date: activeRequest.date,
        scheduledTime: format(new Date(activeRequest.startTime), 'h:mm a'),
        course: 'USER REQUEST',
        subject: activeRequest.status === 'pending' ? 'PENDING APPROVAL' : 'APPROVED BOOKING',
        topic: `Duration: ${activeRequest.duration}`,
        teacher: 'Pending',
        productType: 'STUDIO BOOKING',
        startTime: activeRequest.startTime,
        endTime: addHours(new Date(activeRequest.startTime), 1).toISOString(),
        isBooked: true,
        requestStatus: activeRequest.status,
      } as ClassBooking : null);

      const isPrepSlot = !activeBooking && prepSlots[interval.start]?.has(studio);

      const finalBooking = activeBooking || (isPrepSlot ? {
        id: `prep-${studio}-${interval.start}`,
        studio,
        date: targetDateStr,
        scheduledTime: format(intervalStart, 'h:mm a'),
        course: 'SYSTEM',
        subject: 'NOT AVAILABLE',
        topic: 'Need to prepare studio for next class',
        teacher: 'Ops Team',
        productType: 'PREPARATION',
        startTime: interval.start,
        endTime: interval.end,
        isBooked: true,
        isPrepSlot: true,
      } as ClassBooking : null);

      if (finalBooking) {
        const bStart = new Date(finalBooking.startTime);
        const bEnd = new Date(finalBooking.endTime);
        const prevIntervalStart = addMinutes(intervalStart, -INTERVAL_MINUTES);
        const prevMidPoint = addMinutes(prevIntervalStart, 1);
        const isFirst = !(prevMidPoint >= bStart && prevMidPoint < bEnd && prevIntervalStart >= dayStart);

        let rowSpan = 1;
        if (isFirst) {
            let scan = addMinutes(intervalStart, INTERVAL_MINUTES);
            while (scan <= dayEnd) {
                const scanMid = addMinutes(scan, 1);
                if (scanMid >= bStart && scanMid < bEnd) rowSpan++;
                else break;
                scan = addMinutes(scan, INTERVAL_MINUTES);
            }
        }

        grid[interval.start][studio] = { ...finalBooking, isFirst, rowSpan };
      } else {
        grid[interval.start][studio] = {
          id: `free-${studio}-${interval.start}`,
          studio,
          date: targetDateStr,
          scheduledTime: format(intervalStart, 'h:mm a'),
          startTimeLabel: format(intervalStart, 'h:mm a'),
          course: '', subject: '', topic: '', teacher: '', productType: '',
          startTime: interval.start, endTime: interval.end,
          isBooked: false,
        };
      }
    });
  });

  return { date: targetDateStr, studios: ALLOWED_STUDIOS, intervals, grid };
}

export async function fetchRangeData(startStr: string, endStr: string): Promise<ClassBooking[]> {
  const [allRows, bulkRows, requestsOverlay] = await Promise.all([
    getSheetData(),
    getBulkBookingData(),
    getActiveRequestsOverlay()
  ]);

  const sheetBookings: ClassBooking[] = allRows
    .map((row, index) => {
      const parsedDay = parseSheetDate(String(row.Date || row.date || ''));
      if (!parsedDay) return null;
      
      const dayStr = format(parsedDay, 'yyyy-MM-dd');
      if (dayStr < startStr || dayStr > endStr) return null;

      const timeVal = String(row['Scheduled Time'] || row.Time || row['Start Time'] || '').trim();
      const studioMatch = normalizeStudio(String(row.Studio || row['Studio Name'] || ''));
      const startTime = parseTime(timeVal, parsedDay);
      if (!startTime) return null;
      
      const endTime = addHours(startTime, 2);

      return {
        id: `range-row-${index}`,
        studio: studioMatch,
        date: dayStr,
        scheduledTime: timeVal,
        course: String(row.Course || row.course || '').trim(),
        subject: String(row.Subject || row.subject || '').trim(),
        topic: String(row.Topic || row.topic || '').trim(),
        teacher: String(row['Teacher 1'] || row.Teacher || row.teacher || '').trim(),
        productType: String(row['Product Type'] || row.productType || '').trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeLabel: format(startTime, 'h:mm a'),
        endTimeLabel: format(endTime, 'h:mm a'),
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  const bulkBookings: ClassBooking[] = bulkRows
    .map((row) => {
      const dateVal = String(getProp(row, ['Date']) || '').trim();
      const parsedDay = parseSheetDate(dateVal);
      if (!parsedDay) return null;

      const dayStr = format(parsedDay, 'yyyy-MM-dd');
      if (dayStr < startStr || dayStr > endStr) return null;

      const startTimeISO = getProp(row, ['StartTimeISO', 'startTimeISO', 'startTime']);
      if (!startTimeISO) {
          const timeStr = String(getProp(row, ['Scheduled Time', 'time', 'start time']) || '').trim();
          const startD = parseTime(timeStr, parsedDay);
          if (!startD) return null;
          const endD = addHours(startD, 2);
          const studioMatch = normalizeStudio(getProp(row, ['Studio', 'studio name']) || '');
          return {
            id: row.id || `range-bulk-${Math.random()}`,
            studio: studioMatch,
            date: dayStr,
            scheduledTime: timeStr,
            course: String(getProp(row, ['Course']) || ''),
            subject: String(getProp(row, ['Subject']) || ''),
            topic: String(getProp(row, ['Topic']) || ''),
            teacher: String(getProp(row, ['Teacher 1', 'Teacher']) || ''),
            productType: String(getProp(row, ['Product Type']) || ''),
            startTime: startD.toISOString(),
            endTime: endD.toISOString(),
            isBooked: true,
          };
      }

      const startD = new Date(startTimeISO);
      if (!isValid(startD)) return null;

      const endTimeISO = getProp(row, ['EndTimeISO', 'endTimeISO', 'endTime']);
      const endD = endTimeISO ? new Date(endTimeISO) : addHours(startD, 2);
      const studioMatch = normalizeStudio(getProp(row, ['Studio', 'studio name']) || '');

      return {
        id: row.id || `range-bulk-${Math.random()}`,
        studio: studioMatch,
        date: dayStr,
        scheduledTime: String(getProp(row, ['Scheduled Time']) || format(startD, 'h:mm a')),
        course: String(getProp(row, ['Course']) || ''),
        subject: String(getProp(row, ['Subject']) || ''),
        topic: String(getProp(row, ['Topic']) || ''),
        teacher: String(getProp(row, ['Teacher 1', 'Teacher']) || ''),
        productType: String(getProp(row, ['Product Type']) || ''),
        startTime: startD.toISOString(),
        endTime: endD.toISOString(),
        startTimeLabel: format(startD, 'h:mm a'),
        endTimeLabel: format(endD, 'h:mm a'),
        isBooked: true,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  const requestBookings: ClassBooking[] = requestsOverlay
    .map((req) => {
      const startD = new Date(req.startTime);
      if (!isValid(startD)) return null;

      const dayStr = format(startD, 'yyyy-MM-dd');
      if (dayStr < startStr || dayStr > endStr) return null;

      return {
        id: `range-req-${req.id}`,
        studio: req.studio,
        date: dayStr,
        scheduledTime: format(startD, 'h:mm a'),
        course: 'USER REQUEST',
        subject: req.status === 'pending' ? 'PENDING APPROVAL' : 'APPROVED BOOKING',
        topic: `Duration: ${req.duration}`,
        teacher: 'Pending',
        productType: 'STUDIO BOOKING',
        startTime: req.startTime,
        endTime: addHours(startD, 1).toISOString(),
        isBooked: true,
        requestStatus: req.status,
      };
    })
    .filter((b): b is ClassBooking => b !== null);

  return [...sheetBookings, ...bulkBookings, ...requestBookings];
}
