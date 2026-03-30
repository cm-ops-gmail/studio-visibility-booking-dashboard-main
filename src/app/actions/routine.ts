
'use server';

import { 
  getSheetData, 
  getRequestsData, 
  getBulkBookingData, 
  getCentralOpsData, 
  getRecordShootData 
} from '@/app/lib/google-sheets';
import { SuggestedRoutineSlot, TeacherConflictInfo, BulkRoutineResult } from '@/app/lib/types';
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
  getDay,
  isAfter
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

// --- START: Helper functions from bulk-booking ---
function robustSplit(text: string, separator: string = '\t'): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    if (char === separator && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function robustGetLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}
// --- END: Helper functions from bulk-booking ---


async function getFullOccupancy() {
    const [daywise, requests, bulk, central, shoots] = await Promise.all([
        getSheetData(),
        getRequestsData(),
        getBulkBookingData(),
        getCentralOpsData(),
        getRecordShootData()
      ]);

      const teacherPool = new Set<string>();
      const occupancyMap: Record<string, boolean> = {}; 
      const teacherOccupancy: Record<string, { subject: string, topic: string, studio: string, time: string, date: string, teacher: string }> = {}; 
      const detailedOccupancy: Record<string, Array<{ start: Date, end: Date, subject: string, topic: string, teacher: string }>> = {};
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
          detailedOccupancy[occKey].push({ start, end, subject: subjectLabel, topic: topicLabel, teacher: teacherName || '' });
    
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
              date: format(date, 'EEEE, MMM d'),
              teacher: teacherName,
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
        const endTimeVal = row['End Time'] || row['Scheduled End Time'] || '';
        const end = parseTime(endTimeVal, d) || addHours(start, 2);
        if (start && end) markOccupied(d, row.Studio, start, end, row['Teacher 1'], row.Subject, row.Topic);
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
        const endTimeVal = row['End Time'] || row['Scheduled End Time'] || '';
        const end = parseTime(endTimeVal, d) || addHours(start, 2.5);
        if (start && end) markOccupied(d, row.Studio, start, end, row['Teacher 1'], row.Subject, row.Topic);
      });
    
      shoots.forEach(row => {
        const d = parseSheetDate(row.Date || '');
        if (!d) return;
        const start = parseTime(row['Scheduled Time'], d);
        const end = parseTime(row['End Time'], d);
        if (start && end) markOccupied(d, row['Shooting Place'], start, end, row['Instructor Name'], row['Topic Name'], row['Topic Name']);
      });

      return { teacherPool, occupancyMap, teacherOccupancy, detailedOccupancy, studioUtilizationHours };
}

export async function generateRoutine(
  startDateStr: string, 
  endDateStr: string, 
  slotCount: number, 
  durationMinutes: number,
  maxSlotsPerDay: number
): Promise<SuggestedRoutineSlot[]> {
  const { teacherPool, occupancyMap, teacherOccupancy, detailedOccupancy, studioUtilizationHours } = await getFullOccupancy();

  const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
  const endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const rankedStudios = [...ROUTINE_STUDIOS].sort((a, b) => studioUtilizationHours[a] - studioUtilizationHours[b]);
  const suggestions: SuggestedRoutineSlot[] = [];
  const now = new Date();

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
            
            let score = Math.min(minDistToPrev, minDistToNext) + (minDistToPrev + minDistToNext) / 10;
            candidates.push({ start: slotStart, end: slotEnd, score });
          }
          searchTime = addMinutes(searchTime, 30);
        }

        if (candidates.length > 0) {
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

export async function generateCustomBulkRoutine(
    startDateStr: string, 
    endDateStr: string,
    slotCount: number,
    durationMinutes: number,
    maxSlotsPerDay: number,
    priorityDays: number[] = [],
    priorityTimings: {start: string, end: string}[],
    priorityStudios: string[] = [],
    rawData: string
): Promise<BulkRoutineResult[]> {
    if (!rawData.trim() && slotCount === 0) return [];

    const { teacherPool, occupancyMap, teacherOccupancy, studioUtilizationHours, detailedOccupancy } = await getFullOccupancy();
    
    const baseRankedStudios = [...ROUTINE_STUDIOS].sort((a, b) => studioUtilizationHours[a] - studioUtilizationHours[b]);
    const prioritizedRanked = baseRankedStudios.filter(s => priorityStudios.includes(s));
    const otherRanked = baseRankedStudios.filter(s => !priorityStudios.includes(s));
    const finalRankedStudios = priorityStudios.length > 0 ? [...prioritizedRanked, ...otherRanked] : baseRankedStudios;

    const now = new Date();

    const finalRoutine: BulkRoutineResult[] = [];
    const batchOccupancyMap = { ...occupancyMap };
    const batchTeacherOccupancy = { ...teacherOccupancy };

    const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
    const endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getTeacherAvailabilitiesForSlot = (slotStart: Date, slotEnd: Date, dateKey: string): { teacherPoolStatus: Record<string, TeacherConflictInfo>, availableTeachers: string[] } => {
      const teacherPoolStatus: Record<string, TeacherConflictInfo> = {};
      const availableTeachers: string[] = [];
      
      Array.from(teacherPool).sort().forEach(teacher => {
          let conflict: TeacherConflictInfo['conflict'] = undefined;
          let tCheck = new Date(slotStart);
          while (tCheck < slotEnd) {
              const occ = batchTeacherOccupancy[`${dateKey}|${teacher}|${format(tCheck, 'HH:mm')}`];
              if (occ) {
                  conflict = {
                      subject: occ.subject,
                      topic: occ.topic,
                      studio: occ.studio,
                      time: occ.time,
                      date: occ.date,
                      teacher: occ.teacher,
                  };
                  break;
              }
              tCheck = addMinutes(tCheck, 30);
          }

          teacherPoolStatus[teacher] = { isBusy: !!conflict, conflict };
          if (!conflict) {
              availableTeachers.push(teacher);
          }
      });
      return { teacherPoolStatus, availableTeachers };
    };
    
    // Step 1: Process raw data if it exists
    if (rawData.trim()) {
        const lines = robustGetLines(rawData.trim());
        const rawHeaders = robustSplit(lines[0]).map(h => h.trim().toLowerCase().replace(/["'\n\r]+/g, ' '));
        const hasHeaders = rawHeaders.some(h => ['date', 'studio', 'teacher', 'subject', 'topic'].includes(h));
        const rows = (hasHeaders ? lines.slice(1) : lines).map(l => robustSplit(l));
        const headers = hasHeaders ? rawHeaders : [];

        const findIdx = (cands: string[]) => headers.findIndex(h => cands.some(c => h.includes(c.toLowerCase())));

        const dateIdx = findIdx(['date']);
        const timeIdx = findIdx(['scheduled time', 'start time']);
        const studioIdx = findIdx(['studio']);
        const teacherIdx = findIdx(['teacher 1', 'teacher']);
        const courseIdx = findIdx(['course']);
        const subjectIdx = findIdx(['subject']);
        const topicIdx = findIdx(['topic']);
        const productTypeIdx = findIdx(['product type']);

        for (const [i, row] of rows.entries()) {
            const getRowVal = (idx: number) => (idx !== -1 && row[idx]) ? row[idx] : '';
            
            const inputTeacher = getRowVal(teacherIdx) || '';
            
            const rowData: BulkRoutineResult = {
                id: `bulk-${i}`,
                inputCourse: getRowVal(courseIdx),
                inputSubject: getRowVal(subjectIdx),
                inputTopic: getRowVal(topicIdx),
                inputTeacher: inputTeacher,
                inputProductType: getRowVal(productTypeIdx),
                assignedDate: '', assignedDateLabel: '', assignedTimeLabel: '', assignedStartTime: '', assignedEndTime: '',
                assignedStudio: '', assignedTeacher: inputTeacher,
                status: 'no_slot_found',
                isAutoAssigned: { date: false, studio: false },
                conflicts: { studio: false, teacher: false },
                teacherPoolStatus: {},
                availableTeachers: [],
            };

            const providedDateStr = getRowVal(dateIdx);
            const providedTimeStr = getRowVal(timeIdx);
            const providedStudioStr = getRowVal(studioIdx);

            // CASE 1: User provides all info. Validate it.
            if (providedDateStr && providedTimeStr && providedStudioStr) {
                const day = parseSheetDate(providedDateStr);
                const startTime = day ? parseTime(providedTimeStr, day) : null;
                
                if (day && startTime && isAfter(addMinutes(startTime, durationMinutes), now)) {
                    const slotStart = startTime;
                    const slotEnd = addMinutes(startTime, durationMinutes);
                    const studio = normalizeStudio(providedStudioStr);
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const teacherName = rowData.inputTeacher;

                    // Populate rowData with user's input, regardless of conflict
                    rowData.assignedDate = dateKey;
                    rowData.assignedDateLabel = format(day, 'EEEE, MMM d');
                    rowData.assignedTimeLabel = `${format(slotStart, 'h:mm a')} - ${format(slotEnd, 'h:mm a')}`;
                    rowData.assignedStartTime = slotStart.toISOString();
                    rowData.assignedEndTime = slotEnd.toISOString();
                    rowData.assignedStudio = studio;

                    const { teacherPoolStatus, availableTeachers } = getTeacherAvailabilitiesForSlot(slotStart, slotEnd, dateKey);
                    rowData.teacherPoolStatus = teacherPoolStatus;
                    rowData.availableTeachers = availableTeachers;

                    // Check for studio conflict
                    let checkTime = new Date(slotStart);
                    while (checkTime < slotEnd) {
                        if (batchOccupancyMap[`${dateKey}|${studio}|${format(checkTime, 'HH:mm')}`]) {
                            rowData.conflicts.studio = true;
                             // Find the conflicting slot details
                            const allBookings = (detailedOccupancy[`${dateKey}|${studio}`] || []).concat(
                                finalRoutine
                                .filter(r => r.assignedDate === dateKey && r.assignedStudio === studio && (r.status === 'scheduled' || r.status === 'auto_generated'))
                                .map(r => ({ start: new Date(r.assignedStartTime), end: new Date(r.assignedEndTime), subject: r.inputSubject, topic: r.inputTopic, teacher: r.assignedTeacher }))
                            );
                            const conflictingSlot = allBookings.find(b => areIntervalsOverlapping({start: slotStart, end: slotEnd}, {start: b.start, end: b.end}));
                            if (conflictingSlot) {
                                rowData.conflictDetails = {
                                    subject: conflictingSlot.subject,
                                    topic: conflictingSlot.topic,
                                    studio: studio,
                                    time: `${format(conflictingSlot.start, 'h:mm a')} - ${format(conflictingSlot.end, 'h:mm a')}`,
                                    date: format(conflictingSlot.start, 'EEEE, MMM d'),
                                    teacher: conflictingSlot.teacher
                                };
                            }
                            break;
                        }
                        checkTime = addMinutes(checkTime, 30);
                    }

                    // Check for teacher conflict
                    if (teacherName && teacherName !== '') {
                        const teacherStatus = rowData.teacherPoolStatus[teacherName];
                        if (teacherStatus?.isBusy) {
                            rowData.conflicts.teacher = true;
                            if (!rowData.conflictDetails) {
                                rowData.conflictDetails = { ...teacherStatus.conflict!, teacher: teacherName };
                            }
                        }
                    }

                    if (rowData.conflicts.studio || rowData.conflicts.teacher) {
                        rowData.status = 'conflict';
                    } else {
                        // No conflict, schedule it and update occupancy maps for the batch
                        rowData.status = 'scheduled';
                        let markTime = new Date(slotStart);
                        while (markTime < slotEnd) {
                            const timeKey = format(markTime, 'HH:mm');
                            batchOccupancyMap[`${dateKey}|${studio}|${timeKey}`] = true;
                            if (teacherName && teacherName !== '') {
                                batchTeacherOccupancy[`${dateKey}|${teacherName}|${timeKey}`] = {
                                    subject: rowData.inputSubject, topic: rowData.inputTopic, studio: studio,
                                    time: rowData.assignedTimeLabel, date: rowData.assignedDateLabel,
                                    teacher: teacherName
                                };
                            }
                            markTime = addMinutes(markTime, 30);
                        }
                    }
                }
                finalRoutine.push(rowData);
                continue; 
            }

            // CASE 2: Auto-assign logic
            const potentialSlots: Array<{
                start: Date; end: Date; studio: string; day: Date; score: number;
            }> = [];
            
            const daysToSearch = providedDateStr ? ([parseSheetDate(providedDateStr)].filter(d => d && isValid(d)) as Date[]) : days;
            for (const day of daysToSearch) {
                const dayOfWeek = getDay(day);
                if (!providedDateStr && priorityDays.length > 0 && !priorityDays.includes(dayOfWeek)) continue;

                let dayStart = getOperationalWindow(day).start;
                let dayEnd = getOperationalWindow(day).end;

                if (priorityTimings.length > 0) {
                    dayStart = setHours(startOfDay(day), 10);
                    dayEnd = setHours(startOfDay(day), 22);
                }

                const searchLogic = (startTime: Date) => {
                    if (isBefore(startTime, now)) return;
                    const slotStart = startTime;
                    const slotEnd = addMinutes(slotStart, durationMinutes);

                    if (!providedTimeStr && priorityTimings.length > 0) {
                        const slotStartFmt = format(slotStart, 'HH:mm');
                        const slotEndFmt = format(slotEnd, 'HH:mm');
                        if (!priorityTimings.some(t => slotStartFmt >= t.start && slotEndFmt <= t.end)) return;
                    }

                    const studiosToSearch = providedStudioStr ? [normalizeStudio(providedStudioStr)] : finalRankedStudios;

                    for (const studio of studiosToSearch) {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        
                        let studioIsFree = true;
                        let check = new Date(slotStart);
                        while (check < slotEnd) {
                            if (batchOccupancyMap[`${dateKey}|${studio}|${format(check, 'HH:mm')}`]) {
                                studioIsFree = false;
                                break;
                            }
                            check = addMinutes(check, 30);
                        }
                        if (!studioIsFree) continue;

                        const { start: opStart, end: opEnd } = getOperationalWindow(day);
                        const occKey = `${dateKey}|${studio}`;
                        const allBookingsForScoring = (detailedOccupancy[occKey] || []).concat(
                            finalRoutine
                            .filter(r => r.assignedDate === dateKey && r.assignedStudio === studio)
                            .map(r => ({ start: new Date(r.assignedStartTime), end: new Date(r.assignedEndTime), subject: '', topic: '', teacher: '' }))
                        );

                        let minDistToPrev = Math.abs(differenceInMinutes(slotStart, opStart));
                        let minDistToNext = Math.abs(differenceInMinutes(opEnd, slotEnd));
                        allBookingsForScoring.forEach(b => {
                            if (b.end <= slotStart) {
                                const dist = Math.abs(differenceInMinutes(slotStart, b.end));
                                if (dist < minDistToPrev) minDistToPrev = dist;
                            }
                            if (b.start >= slotEnd) {
                                const dist = Math.abs(differenceInMinutes(b.start, slotEnd));
                                if (dist < minDistToNext) minDistToNext = dist;
                            }
                        });
                        
                        let score = Math.min(minDistToPrev, minDistToNext) + (minDistToPrev + minDistToNext) / 10;
                        potentialSlots.push({ start: slotStart, end: slotEnd, studio, day, score });
                    }
                }
                
                if (providedTimeStr) {
                    const startTime = parseTime(providedTimeStr, day);
                    if (startTime && startTime >= dayStart && addMinutes(startTime, durationMinutes) <= dayEnd) {
                         searchLogic(startTime);
                    }
                } else {
                    let searchTime = dayStart;
                    while (addMinutes(searchTime, durationMinutes) <= dayEnd) {
                        searchLogic(searchTime);
                        searchTime = addMinutes(searchTime, 30);
                    }
                }
            }
        
            if (potentialSlots.length > 0) {
                potentialSlots.sort((a, b) => b.score - a.score);
                let bestSlot: typeof potentialSlots[0] | null = null;
                for (const potential of potentialSlots) {
                    const dateKey = format(potential.day, 'yyyy-MM-dd');
                    let teacherIsFree = true;
                    if (rowData.inputTeacher !== '') {
                        let tCheck = new Date(potential.start);
                        while (tCheck < potential.end) {
                            const occ = batchTeacherOccupancy[`${dateKey}|${rowData.inputTeacher}|${format(tCheck, 'HH:mm')}`];
                            if (occ) {
                                teacherIsFree = false;
                                rowData.conflictDetails = { ...occ, teacher: occ.teacher || rowData.inputTeacher };
                                break;
                            }
                            tCheck = addMinutes(tCheck, 30);
                        }
                    }
                    if (teacherIsFree) {
                        bestSlot = potential;
                        break; 
                    }
                }

                if (bestSlot) {
                    rowData.status = 'scheduled';
                    rowData.assignedDate = format(bestSlot.day, 'yyyy-MM-dd');
                    rowData.assignedDateLabel = format(bestSlot.day, 'EEEE, MMM d');
                    rowData.assignedStartTime = bestSlot.start.toISOString();
                    rowData.assignedEndTime = bestSlot.end.toISOString();
                    rowData.assignedTimeLabel = `${format(bestSlot.start, 'h:mm a')} - ${format(bestSlot.end, 'h:mm a')}`;
                    rowData.assignedStudio = bestSlot.studio;
                    rowData.isAutoAssigned = { date: !providedDateStr, studio: !providedStudioStr };
                    rowData.assignedTeacher = inputTeacher || '';

                    const { teacherPoolStatus, availableTeachers } = getTeacherAvailabilitiesForSlot(bestSlot.start, bestSlot.end, rowData.assignedDate);
                    rowData.teacherPoolStatus = teacherPoolStatus;
                    rowData.availableTeachers = availableTeachers;


                    let markTime = new Date(bestSlot.start);
                    while(markTime < bestSlot.end) {
                        const timeKey = format(markTime, 'HH:mm');
                        const dateKey = format(bestSlot.day, 'yyyy-MM-dd');
                        batchOccupancyMap[`${dateKey}|${bestSlot.studio}|${timeKey}`] = true;
                        if (rowData.assignedTeacher && rowData.assignedTeacher !== '') {
                            batchTeacherOccupancy[`${dateKey}|${rowData.assignedTeacher}|${timeKey}`] = {
                                subject: rowData.inputSubject, topic: rowData.inputTopic, studio: bestSlot.studio,
                                time: rowData.assignedTimeLabel, date: rowData.assignedDateLabel, teacher: rowData.assignedTeacher,
                            };
                        }
                        markTime = addMinutes(markTime, 30);
                    }
                } else {
                    rowData.status = 'teacher_conflict';
                }
            }
            finalRoutine.push(rowData);
        }
    }
    
    // Step 2: Generate remaining slots if needed
    const slotsFromRawData = finalRoutine.filter(r => r.status === 'scheduled' || r.status === 'conflict' || r.status === 'auto_generated').length;
    const remainingSlotsToGenerate = slotCount - slotsFromRawData;

    if (remainingSlotsToGenerate > 0) {
        let addedCount = 0;
        for (let currentDensity = 1; currentDensity <= maxSlotsPerDay; currentDensity++) {
            if (addedCount >= remainingSlotsToGenerate) break;

            for (const day of days) {
                if (addedCount >= remainingSlotsToGenerate) break;
                
                const dateKey = format(day, 'yyyy-MM-dd');
                const slotsAlreadyToday = finalRoutine.filter(s => s.assignedDate === dateKey).length;
                if (slotsAlreadyToday >= currentDensity) continue;

                const dayOfWeek = getDay(day);
                if (priorityDays.length > 0 && !priorityDays.includes(dayOfWeek)) continue;
                
                const candidates: Array<{ start: Date, end: Date, studio: string, score: number }> = [];

                let searchStart = getOperationalWindow(day).start;
                let searchEnd = getOperationalWindow(day).end;

                if (priorityTimings.length > 0) {
                  searchStart = setHours(startOfDay(day), 10);
                  searchEnd = setHours(startOfDay(day), 22);
                }

                let searchTime = searchStart;
                while (addMinutes(searchTime, durationMinutes) <= searchEnd) {
                    const slotStart = searchTime;
                    const slotEnd = addMinutes(searchTime, durationMinutes);

                    if (isBefore(slotStart, now)) {
                      searchTime = addMinutes(searchTime, 30);
                      continue;
                    }
                    
                    if (priorityTimings.length > 0) {
                        const slotStartFmt = format(slotStart, 'HH:mm');
                        const slotEndFmt = format(slotEnd, 'HH:mm');
                        if (!priorityTimings.some(t => slotStartFmt >= t.start && slotEndFmt <= t.end)) {
                           searchTime = addMinutes(searchTime, 30);
                           continue;
                        }
                    }

                    for (const studio of finalRankedStudios) {
                        let isFree = true;
                        let check = new Date(slotStart);
                        while (check < slotEnd) {
                            if (batchOccupancyMap[`${dateKey}|${studio}|${format(check, 'HH:mm')}`]) {
                                isFree = false;
                                break;
                            }
                            check = addMinutes(check, 30);
                        }

                        if (isFree) {
                            const { start: opStart, end: opEnd } = getOperationalWindow(day);
                            const occKey = `${dateKey}|${studio}`;
                            const allBookingsForScoring = (detailedOccupancy[occKey] || []).concat(
                                finalRoutine
                                .filter(r => (r.status === 'scheduled' || r.status === 'auto_generated') && r.assignedDate === dateKey && r.assignedStudio === studio)
                                .map(r => ({ start: new Date(r.assignedStartTime), end: new Date(r.assignedEndTime), subject: '', topic: '', teacher: '' }))
                            );

                            let minDistToPrev = Math.abs(differenceInMinutes(slotStart, opStart));
                            let minDistToNext = Math.abs(differenceInMinutes(opEnd, slotEnd));
                            allBookingsForScoring.forEach(b => {
                              if (b.end <= slotStart) {
                                const dist = Math.abs(differenceInMinutes(slotStart, b.end));
                                if (dist < minDistToPrev) minDistToPrev = dist;
                              }
                              if (b.start >= slotEnd) {
                                const dist = Math.abs(differenceInMinutes(b.start, slotEnd));
                                if (dist < minDistToNext) minDistToNext = dist;
                              }
                            });
                            
                            let score = Math.min(minDistToPrev, minDistToNext) + (minDistToPrev + minDistToNext) / 10;
                            candidates.push({ start: slotStart, end: slotEnd, studio, score });
                        }
                    }
                    searchTime = addMinutes(searchTime, 30);
                }
                
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.score - a.score);
                    const best = candidates[0];

                    const { teacherPoolStatus, availableTeachers } = getTeacherAvailabilitiesForSlot(best.start, best.end, dateKey);

                    const newSlot: BulkRoutineResult = {
                        id: `auto-gen-${finalRoutine.length}`,
                        inputCourse: '', inputSubject: '', inputTopic: '', inputTeacher: '', inputProductType: '',
                        assignedDate: dateKey,
                        assignedDateLabel: format(day, 'EEEE, MMM d'),
                        assignedTimeLabel: `${format(best.start, 'h:mm a')} - ${format(best.end, 'h:mm a')}`,
                        assignedStartTime: best.start.toISOString(),
                        assignedEndTime: best.end.toISOString(),
                        assignedStudio: best.studio,
                        assignedTeacher: '',
                        status: 'auto_generated',
                        isAutoAssigned: { date: true, studio: true },
                        isAutoGenerated: true,
                        teacherPoolStatus,
                        availableTeachers,
                    };
                    finalRoutine.push(newSlot);
                    
                    let markTime = new Date(best.start);
                    while(markTime < best.end) {
                        const timeKey = format(markTime, 'HH:mm');
                        batchOccupancyMap[`${dateKey}|${best.studio}|${timeKey}`] = true;
                        markTime = addMinutes(markTime, 30);
                    }
                    addedCount++;
                }
            }
        }
    }
    
    return finalRoutine.sort((a, b) => {
        const timeA = a.assignedStartTime ? new Date(a.assignedStartTime).getTime() : 0;
        const timeB = b.assignedStartTime ? new Date(b.assignedStartTime).getTime() : 0;
        if (timeA === 0 && timeB === 0) return 0;
        if (timeA === 0) return 1;
        if (timeB === 0) return -1;
        return timeA - timeB;
    });
}
