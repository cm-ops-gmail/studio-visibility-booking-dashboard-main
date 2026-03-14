
'use server';

import { getSheetData } from '@/app/lib/google-sheets';
import { ClassBooking, DaySchedule, TimeInterval } from '@/app/lib/types';
import { parse, format, addHours, isValid, setHours, setMinutes, addMinutes, differenceInMinutes } from 'date-fns';
import { suggestSmartSlotDescription } from '@/ai/flows/smart-slot-description-flow';
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
  
  // Fetch overlay for pending/approved requests from the "Requests" tab
  const requestsOverlay = await getActiveRequestsOverlay();

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

  const sheetBookings: ClassBooking[] = allRows
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

  // Pre-calculate Prep Slots: For each non-Studio Booking class, mark the 30min interval before it
  const prepSlots: Record<string, Set<string>> = {};
  sheetBookings.forEach(b => {
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
      // 1. Check Main Sheet Data
      const activeSheetBooking = sheetBookings.find(b => {
        if (b.studio !== studio) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return midPoint >= bStart && midPoint < bEnd;
      });

      // 2. Check Requests Overlay
      const activeRequest = requestsOverlay.find(req => {
        if (req.studio !== studio || req.date !== targetDateStr) return false;
        const reqStart = new Date(req.startTime);
        
        let durationHrs = 1;
        if (req.duration === '30 mins') durationHrs = 0.5;
        if (req.duration === '1 hr 30 mins') durationHrs = 1.5;
        if (req.duration === '2 hrs') durationHrs = 2;
        
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
        endTime: addHours(new Date(activeRequest.startTime), 
          activeRequest.duration === '30 mins' ? 0.5 : 
          activeRequest.duration === '1 hr 30 mins' ? 1.5 : 
          activeRequest.duration === '2 hrs' ? 2 : 1
        ).toISOString(),
        startTimeLabel: format(new Date(activeRequest.startTime), 'h:mm a'),
        isBooked: true,
        requestStatus: activeRequest.status,
      } as ClassBooking : null);

      // 3. Preparation Slot Logic: If not booked, check if it's a prep slot
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
        startTimeLabel: format(intervalStart, 'h:mm a'),
        endTimeLabel: format(new Date(interval.end), 'h:mm a'),
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
                if (scanMid >= bStart && scanMid < bEnd) {
                    rowSpan++;
                } else {
                    break;
                }
                scan = addMinutes(scan, INTERVAL_MINUTES);
            }
        }

        grid[interval.start][studio] = {
          ...finalBooking,
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
