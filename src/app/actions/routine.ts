
'use server';

import { 
  getGenericSheetData,
  getSheetData, 
  getRequestsData, 
  getBulkBookingData, 
  getCentralOpsData, 
  getRecordShootData 
} from '@/app/lib/google-sheets';
import { SuggestedRoutineSlot, TeacherConflictInfo } from '@/app/lib/types';
import { 
  parse, 
  format, 
  addMinutes, 
  isValid, 
  isBefore, 
  startOfDay, 
  setHours, 
  setMinutes, 
  eachDayOfInterval, 
  addHours,
  areIntervalsOverlapping,
  differenceInMinutes,
  getDay
} from 'date-fns';

const ROUTINE_STUDIOS = [
  'Studio 1 - HQ1', 'Studio 2 - HQ1', 'Studio 3 - HQ1', 'Studio 4 - HQ1', 'Studio 5 - HQ5',
  'Studio 6 - HQ5', 'Studio 7 - HQ5', 'Studio 8 - HQ5', 'Studio 9 - NB2', 'Studio 10 - NB2',
  'Studio 11 - NB2',
];

/**
 * Helper to get the operational window for a specific day based on the "Current Scenario"
 * Sun-Thu: 2 PM - 10 PM (8h)
 * Fri-Sat: 2 PM - 6 PM (4h)
 */
function getOperationalWindow(date: Date) {
  const dayOfWeek = getDay(date); // 0 (Sun) to 6 (Sat)
  const reference = startOfDay(date);
  
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Fri or Sat
    return {
      start: setMinutes(setHours(reference, 14), 0),
      end: setMinutes(setHours(reference, 18), 0)
    };
  }
  
  // Sun-Thu
  return {
    start: setMinutes(setHours(reference, 14), 0),
    end: setMinutes(setHours(reference, 22), 0)
  };
}

function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const monthDay = parts[0].match(/^[a-zA-Z]+$/) ? parts[1] : parts[0];
    const year = parts[parts.length - 1];
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
  return null;
}

function normalizeStudio(name: string): string {
  const s = String(name || '').trim();
  const match = ROUTINE_STUDIOS.find(allowed => 
    allowed === s || allowed.startsWith(s + ' -')
  );
  return match || s;
}

export async function generateRoutine(
  startDateStr: string, 
  endDateStr: string, 
  slotCount: number, 
  durationMinutes: number,
  maxSlotsPerDay: number
): Promise<SuggestedRoutineSlot[]> {
  const [daywise, requests, bulk, central, shoots] = await Promise.all([
    getSheetData(),
    getRequestsData(),
    getBulkBookingData(),
    getCentralOpsData(),
    getRecordShootData()
  ]);

  const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
  const endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const teacherPool = new Set<string>();
  const occupancyMap: Record<string, boolean> = {}; 
  const teacherOccupancy: Record<string, { subject: string, topic: string, studio: string, time: string, date: string }> = {}; 
  
  // Store detailed occupancy intervals for buffer calculations
  const detailedOccupancy: Record<string, Array<{ start: Date, end: Date }>> = {};

  const studioUtilizationHours: Record<string, number> = {};
  ROUTINE_STUDIOS.forEach(s => studioUtilizationHours[s] = 0);

  const markOccupied = (date: Date, studio: string, start: Date, end: Date, teacher?: string, subject?: string, topic?: string) => {
    const normStudio = normalizeStudio(studio);
    const dateKey = format(date, 'yyyy-MM-dd');
    const teacherName = teacher?.trim();
    const subjectLabel = subject || 'Occupied';
    const topicLabel = topic || '';

    if (ROUTINE_STUDIOS.includes(normStudio)) {
      const durationHrs = Math.abs(differenceInMinutes(end, start)) / 60;
      studioUtilizationHours[normStudio] += durationHrs;

      const occKey = `${dateKey}|${normStudio}`;
      if (!detailedOccupancy[occKey]) detailedOccupancy[occKey] = [];
      detailedOccupancy[occKey].push({ start, end });

      let current = new Date(start);
      while (current < end) {
        const timeKey = format(current, 'HH:mm');
        occupancyMap[`${dateKey}|${normStudio}|${timeKey}`] = true;
        current = addMinutes(current, 30);
      }
    }

    if (teacherName && !['tba', 'pending', 'tbd', 'user request', 'ops team', ''].includes(teacherName.toLowerCase())) {
      teacherPool.add(teacherName);
      let current = new Date(start);
      while (current < end) {
        const timeKey = format(current, 'HH:mm');
        teacherOccupancy[`${dateKey}|${teacherName}|${timeKey}`] = {
          subject: subjectLabel,
          topic: topicLabel,
          studio: normStudio,
          time: `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`,
          date: format(date, 'EEEE, MMM d')
        };
        current = addMinutes(current, 30);
      }
    }
  };

  daywise.forEach(row => {
    const d = parseSheetDate(row.Date || '');
    if (!d) return;
    const start = parseTime(row['Scheduled Time'], d);
    if (!start) return;
    markOccupied(d, row.Studio, start, addHours(start, 2.5), row['Teacher 1'], row.Subject, row.Topic);
  });

  requests.forEach(row => {
    if (row.Status !== 'approved' && row.Status !== 'pending') return;
    const start = new Date(row.StartTime);
    if (!isValid(start)) return;
    const duration = row.Duration === '30 mins' ? 30 : (row.Duration === '1 hr' ? 60 : (row.Duration === '1 hr 30 mins' ? 90 : 120));
    markOccupied(start, row.Studio, start, addMinutes(start, duration), 'User Request', row.Status === 'pending' ? 'Pending Request' : 'Approved Request', `Requested: ${row.Duration}`);
  });

  bulk.forEach(row => {
    const d = parseSheetDate(row.Date || '');
    if (!d) return;
    const start = row.StartTimeISO ? new Date(row.StartTimeISO) : parseTime(row['Scheduled Time'], d);
    const end = row.EndTimeISO ? new Date(row.EndTimeISO) : (start ? addHours(start, 2) : null);
    if (start && end) markOccupied(d, row.Studio, start, end, row.Teacher, row.Subject, row.Topic);
  });

  central.forEach(row => {
    const d = parseSheetDate(row.Date || '');
    if (!d) return;
    const start = parseTime(row['Scheduled Time'], d);
    if (!start) return;
    markOccupied(d, row.Studio, start, addHours(start, 2.5), row['Teacher 1'], row.Subject, row.Topic);
  });

  shoots.forEach(row => {
    const d = parseSheetDate(row.Date || '');
    if (!d) return;
    const start = parseTime(row['Scheduled Time'], d);
    const end = parseTime(row['End Time'], d);
    if (start && end) markOccupied(d, row['Shooting Place'], start, end, row['Instructor Name'], row['Topic Name'], row['Topic Name']);
  });

  const rankedStudios = [...ROUTINE_STUDIOS].sort((a, b) => studioUtilizationHours[a] - studioUtilizationHours[b]);
  const suggestions: SuggestedRoutineSlot[] = [];
  const now = new Date();

  // Multi-pass Round-Robin strategy to maximize range utilization
  for (let currentDensity = 1; currentDensity <= maxSlotsPerDay; currentDensity++) {
    if (suggestions.length >= slotCount) break;

    for (const day of days) {
      if (suggestions.length >= slotCount) break;

      const dateKey = format(day, 'yyyy-MM-dd');
      const slotsAlreadyFoundToday = suggestions.filter(s => s.date === dateKey).length;
      if (slotsAlreadyFoundToday >= currentDensity) continue;

      const { start: dayStart, end: dayEnd } = getOperationalWindow(day);

      let foundForToday = false;
      for (const studio of rankedStudios) {
        if (foundForToday) break;
        if (suggestions.some(s => s.date === dateKey && s.studio === studio)) continue;

        // Collect all possible valid candidates for this studio/day
        const candidates: Array<{ start: Date, end: Date, score: number }> = [];

        let searchTime = new Date(dayStart);
        while (addMinutes(searchTime, durationMinutes) <= dayEnd) {
          if (isBefore(searchTime, now)) {
            searchTime = addMinutes(searchTime, 30);
            continue;
          }

          const slotStart = searchTime;
          const slotEnd = addMinutes(searchTime, durationMinutes);
          let isFree = true;
          let check = new Date(slotStart);
          while (check < slotEnd) {
            if (occupancyMap[`${dateKey}|${studio}|${format(check, 'HH:mm')}`]) {
              isFree = false;
              break;
            }
            check = addMinutes(check, 30);
          }

          if (isFree) {
            const overlapsWithSuggestions = suggestions.some(s => {
              if (s.date !== dateKey || s.studio !== studio) return false;
              return areIntervalsOverlapping({ start: slotStart, end: slotEnd }, { start: new Date(s.startTime), end: new Date(s.endTime) });
            });
            if (overlapsWithSuggestions) isFree = false;
          }

          if (isFree) {
            // Calculate Flexibility Score: min distance to closest adjacent bookings
            const occKey = `${dateKey}|${studio}`;
            const bookings = (detailedOccupancy[occKey] || []).concat(
              suggestions
                .filter(s => s.date === dateKey && s.studio === studio)
                .map(s => ({ start: new Date(s.startTime), end: new Date(s.endTime) }))
            );

            let minDistToPrev = Math.abs(differenceInMinutes(slotStart, dayStart));
            let minDistToNext = Math.abs(differenceInMinutes(dayEnd, slotEnd));

            bookings.forEach(b => {
              if (b.end <= slotStart) {
                const dist = Math.abs(differenceInMinutes(slotStart, b.end));
                if (dist < minDistToPrev) minDistToPrev = dist;
              }
              if (b.start >= slotEnd) {
                const dist = Math.abs(differenceInMinutes(b.start, slotEnd));
                if (dist < minDistToNext) minDistToNext = dist;
              }
            });

            // Score prioritize slots with larger buffers on both sides
            const score = Math.min(minDistToPrev, minDistToNext) + (minDistToPrev + minDistToNext) / 10;
            candidates.push({ start: slotStart, end: slotEnd, score });
          }
          searchTime = addMinutes(searchTime, 30);
        }

        if (candidates.length > 0) {
          // Sort candidates by flexibility score descending (best isolation first)
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];
          const slotStart = best.start;
          const slotEnd = best.end;

          const teacherPoolStatus: Record<string, TeacherConflictInfo> = {};
          const availableTeachers: string[] = [];

          Array.from(teacherPool).sort().forEach(teacher => {
            let conflict: TeacherConflictInfo['conflict'] = undefined;
            let tCheck = new Date(slotStart);
            while (tCheck < slotEnd) {
              const occ = teacherOccupancy[`${dateKey}|${teacher}|${format(tCheck, 'HH:mm')}`];
              if (occ) {
                conflict = {
                  subject: occ.subject,
                  topic: occ.topic,
                  studio: occ.studio,
                  time: occ.time,
                  date: occ.date
                };
                break;
              }
              tCheck = addMinutes(tCheck, 30);
            }

            teacherPoolStatus[teacher] = {
              isBusy: !!conflict,
              conflict
            };

            if (!conflict) {
              availableTeachers.push(teacher);
            }
          });

          suggestions.push({
            id: `suggest-${dateKey}-${studio.replace(/\s+/g, '-')}-${format(slotStart, 'HHmm')}`,
            date: dateKey,
            dateLabel: format(day, 'EEEE, MMM d, yyyy'),
            studio,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            timeLabel: `${format(slotStart, 'h:mm a')} - ${format(slotEnd, 'h:mm a')}`,
            availableTeachers,
            teacherPoolStatus
          });

          foundForToday = true;
        }
      }
    }
  }

  return suggestions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
