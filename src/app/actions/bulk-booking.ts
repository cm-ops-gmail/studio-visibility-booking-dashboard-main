'use server';

import { getSheetData, getBulkBookingData, getRequestsData, appendBulkBookingData } from '@/app/lib/google-sheets';
import { BulkPreviewEntry } from '@/app/lib/types';
import { parse, format, addHours, isValid, areIntervalsOverlapping, subMinutes } from 'date-fns';

const CLASS_DURATION_HOURS = 2;
const PREP_DURATION_MINUTES = 30;

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
  return null;
}

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

function getProp(obj: any, candidates: string[]): any {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    const foundKey = keys.find(k => k.toLowerCase().trim() === cand.toLowerCase());
    if (foundKey) return obj[foundKey];
  }
  return null;
}

export async function parseAndPreviewBulkData(rawData: string): Promise<BulkPreviewEntry[]> {
  const lines = robustGetLines(rawData.trim());
  if (lines.length < 2) return [];

  const headers = robustSplit(lines[0]).map(h => 
    h.trim().toLowerCase().replace(/["'\n\r]+/g, ' ')
  );
  
  const rows = lines.slice(1).map(l => robustSplit(l));

  const findIdx = (candidates: string[]) => 
    headers.findIndex(h => {
      return candidates.some(c => {
        const normalizedC = c.toLowerCase();
        return h === normalizedC || h.includes(normalizedC);
      });
    });

  const dateIdx = findIdx(['date']);
  const timeIdx = findIdx(['scheduled time', 'start time', 'class start time', 'time']);
  let endTimeIdx = findIdx(['end time', 'scheduled end time']);
  const studioIdx = findIdx(['studio']);
  const teacherIdx = findIdx(['teacher 1', 'teacher']);
  const courseIdx = findIdx(['course']);
  const subjectIdx = findIdx(['subject']);
  const topicIdx = findIdx(['topic']);
  const productTypeIdx = findIdx(['product type']);

  if (endTimeIdx === -1 && timeIdx !== -1 && rows.length > 0) {
    const possibleEndTimeVal = rows[0][timeIdx + 1];
    if (possibleEndTimeVal && /^\d{1,2}:\d{2}/.test(possibleEndTimeVal)) {
      endTimeIdx = timeIdx + 1;
    }
  }

  if (dateIdx === -1 || timeIdx === -1 || studioIdx === -1) {
    return [];
  }

  const preview: BulkPreviewEntry[] = [];

  const [sheetData, bulkData, requestsData] = await Promise.all([
    getSheetData(),
    getBulkBookingData(),
    getRequestsData()
  ]);

  const existingOccupancy: Array<{ 
    studio: string; 
    teacher: string; 
    start: Date; 
    end: Date; 
    isPrep: boolean;
    productType: string;
    subject: string;
    topic: string;
  }> = [];

  const addOccupancy = (row: any, isBulk: boolean = false) => {
    let start: Date | null = null;
    let end: Date | null = null;
    let studioRaw = '';
    let teacherRaw = '';
    let subject = '';
    let topic = '';
    let productType = '';

    if (isBulk) {
        const sISO = getProp(row, ['StartTimeISO', 'startTimeISO', 'startTime']);
        const eISO = getProp(row, ['EndTimeISO', 'endTimeISO', 'endTime']);
        const dateVal = getProp(row, ['Date', 'date']);
        const parsedDay = parseSheetDate(dateVal);

        if (sISO) {
          start = new Date(sISO);
        } else if (parsedDay) {
          const timeStr = getProp(row, ['Scheduled Time', 'time', 'start time']);
          start = parseTime(timeStr, parsedDay);
        }

        if (eISO) {
          end = new Date(eISO);
        } else if (start) {
          const endTimeStr = getProp(row, ['End Time', 'scheduled end time']);
          end = (parsedDay && endTimeStr) ? parseTime(endTimeStr, parsedDay) : addHours(start, 2);
        }

        studioRaw = getProp(row, ['Studio', 'studio name']) || '';
        teacherRaw = getProp(row, ['Teacher 1', 'Teacher']) || '';
        subject = getProp(row, ['Subject']) || 'Bulk Class';
        topic = getProp(row, ['Topic']) || '';
        productType = getProp(row, ['Product Type']) || '';
    } else {
        const dateVal = String(getProp(row, ['Date']) || '').trim();
        const timeVal = String(getProp(row, ['Scheduled Time', 'Time', 'Start Time']) || '').trim();
        const endTimeVal = String(getProp(row, ['End Time', 'Scheduled End Time']) || '').trim();
        const parsedDay = parseSheetDate(dateVal);
        if (parsedDay) {
            start = parseTime(timeVal, parsedDay);
            if (start) {
                end = parseTime(endTimeVal, parsedDay) || addHours(start, 2);
            }
        }
        studioRaw = getProp(row, ['Studio', 'Studio Name']) || '';
        teacherRaw = getProp(row, ['Teacher 1', 'Teacher']) || '';
        subject = getProp(row, ['Subject']) || 'Main Class';
        topic = getProp(row, ['Topic']) || '';
        productType = getProp(row, ['Product Type']) || '';
    }

    if (start && end && isValid(start) && isValid(end)) {
        const studioName = normalizeStudio(studioRaw);
        existingOccupancy.push({
            studio: studioName,
            teacher: (teacherRaw || '').trim(),
            start, end,
            isPrep: false,
            productType,
            subject,
            topic
        });

        if (!productType.toLowerCase().includes('studio booking')) {
            existingOccupancy.push({
                studio: studioName,
                teacher: 'Ops Team',
                start: subMinutes(start, PREP_DURATION_MINUTES),
                end: start,
                isPrep: true,
                productType: 'PREPARATION',
                subject: `Prep for ${subject}`,
                topic: 'Mandatory Studio Preparation'
            });
        }
    }
  };

  sheetData.forEach(r => addOccupancy(r, false));
  bulkData.forEach(r => addOccupancy(r, true));
  
  requestsData.forEach(r => {
    if ((r.Status !== 'approved' && r.Status !== 'pending') || !r.StartTime) return;
    const start = new Date(r.StartTime);
    if (!isValid(start)) return;
    let durationHrs = r.Duration === '30 mins' ? 0.5 : (r.Duration === '1 hr 30 mins' ? 1.5 : (r.Duration === '2 hrs' ? 2 : 1));
    const end = addHours(start, durationHrs);
    existingOccupancy.push({
      studio: normalizeStudio(r.Studio),
      teacher: 'User Request',
      start, end,
      isPrep: false,
      productType: 'STUDIO BOOKING',
      subject: r.Status === 'approved' ? 'Approved Request' : 'Pending Request',
      topic: `Requested Duration: ${r.Duration}`
    });
  });

  const batchOccupancy: typeof existingOccupancy = [];

  rows.forEach((row, i) => {
    const dateStr = row[dateIdx];
    const startTimeStr = row[timeIdx];
    const endTimeStr = endTimeIdx !== -1 ? row[endTimeIdx] : null;
    const studioRaw = row[studioIdx];
    
    if (!dateStr || !startTimeStr || !studioRaw) return;

    const parsedDay = parseSheetDate(dateStr);
    if (!parsedDay) return;

    const startTime = parseTime(startTimeStr, parsedDay);
    if (!startTime) return;

    let endTime = endTimeStr ? parseTime(endTimeStr, parsedDay) : null;
    if (!endTime || endTime <= startTime) endTime = addHours(startTime, CLASS_DURATION_HOURS);

    const studioMatch = normalizeStudio(studioRaw);
    const teacher = teacherIdx !== -1 ? (row[teacherIdx] || 'TBA') : 'TBA';
    const teacherNorm = teacher.trim().toLowerCase();
    const subject = subjectIdx !== -1 ? (row[subjectIdx] || '') : '';
    const topic = topicIdx !== -1 ? (row[topicIdx] || '') : '';

    const conflicts = { studio: false, teacher: false };
    let isDuplicate = false;
    let conflictingSlot: any = null;

    const allCheckable = [...existingOccupancy, ...batchOccupancy];

    allCheckable.forEach(occ => {
      const occTeacherNorm = (occ.teacher || '').trim().toLowerCase();
      
      if (occ.studio !== studioMatch && occTeacherNorm !== teacherNorm) return;

      const overlap = areIntervalsOverlapping(
        { start: startTime, end: endTime },
        { start: occ.start, end: occ.end }
      );

      if (overlap) {
        if (occ.studio === studioMatch) {
          conflicts.studio = true;
          conflictingSlot = {
            subject: occ.subject,
            teacher: occ.teacher,
            time: `${format(occ.start, 'h:mm a')} - ${format(occ.end, 'h:mm a')}`,
            type: occ.isPrep ? 'PREPARATION' : (occ.productType || 'CLASS'),
            studio: occ.studio,
            topic: occ.topic,
            date: format(occ.start, 'EEEE, MMM d, yyyy')
          };
          if (!occ.isPrep && occ.start.getTime() === startTime.getTime() && occ.end.getTime() === endTime.getTime()) {
            isDuplicate = true;
          }
        }
        
        if (!occ.isPrep && teacherNorm !== 'tba' && teacherNorm !== '' && occTeacherNorm === teacherNorm) {
          conflicts.teacher = true;
          if (!conflictingSlot) {
            conflictingSlot = {
              subject: occ.subject,
              teacher: occ.teacher,
              time: `${format(occ.start, 'h:mm a')} - ${format(occ.end, 'h:mm a')}`,
              type: 'TEACHER OVERLAP',
              studio: occ.studio,
              topic: occ.topic,
              date: format(occ.start, 'EEEE, MMM d, yyyy')
            };
          }
        }
      }
    });

    preview.push({
      id: `preview-${i}`,
      date: dateStr,
      studio: studioMatch,
      scheduledTime: `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      teacher: teacher,
      course: courseIdx !== -1 ? (row[courseIdx] || '') : '',
      subject: subject,
      topic: topic,
      productType: productTypeIdx !== -1 ? (row[productTypeIdx] || '') : '',
      startTimeLabel: format(startTime, 'h:mm a'),
      endTimeLabel: format(endTime, 'h:mm a'),
      conflicts,
      isDuplicate,
      conflictingSlot,
      isBulk: true
    });

    batchOccupancy.push({
      studio: studioMatch,
      teacher: teacher,
      start: startTime,
      end: endTime,
      isPrep: false,
      productType: productTypeIdx !== -1 ? (row[productTypeIdx] || '') : 'BATCH PREVIEW',
      subject: subject || 'Batch Preview',
      topic: topic
    });
  });

  return preview;
}

export async function submitBulkBookings(entries: BulkPreviewEntry[]) {
  const toSubmit = entries
    .filter(e => !e.isDuplicate && !e.conflicts.studio)
    .map(e => [
      e.date,
      e.startTimeLabel,
      e.endTimeLabel || '',
      e.productType,
      e.course,
      e.subject,
      e.topic,
      e.teacher,
      e.studio,
      e.startTime,
      e.endTime
    ]);

  if (toSubmit.length > 0) {
    await appendBulkBookingData(toSubmit);
  }

  return { success: true, count: toSubmit.length };
}
