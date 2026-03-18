'use server';

import { getSheetData, getBulkBookingData, getRequestsData, appendBulkBookingData } from '@/app/lib/google-sheets';
import { BulkPreviewEntry, ClassBooking } from '@/app/lib/types';
import { parse, format, addHours, isValid, areIntervalsOverlapping } from 'date-fns';

const CLASS_DURATION_HOURS = 2;

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

export async function parseAndPreviewBulkData(rawData: string): Promise<BulkPreviewEntry[]> {
  const lines = rawData.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(l => l.split('\t').map(c => c.trim().replace(/"/g, '')));

  // Mapping keys
  const findIndex = (candidates: string[]) => 
    headers.findIndex(h => candidates.some(c => h.toLowerCase().includes(c.toLowerCase())));

  const dateIdx = findIndex(['Date']);
  const timeIdx = findIndex(['Scheduled Time', 'Start Time']);
  const studioIdx = findIndex(['Studio']);
  const teacherIdx = findIndex(['Teacher 1', 'Teacher']);
  const courseIdx = findIndex(['Course']);
  const subjectIdx = findIndex(['Subject']);
  const topicIdx = findIndex(['Topic']);
  const productTypeIdx = findIndex(['Product Type']);

  const preview: BulkPreviewEntry[] = [];

  // Fetch all existing data to check conflicts
  const [sheetData, bulkData, requestsData] = await Promise.all([
    getSheetData(),
    getBulkBookingData(),
    getRequestsData()
  ]);

  // Combine all "occupied" intervals
  const existingBookings: Array<{ studio: string; teacher: string; start: Date; end: Date; dateStr: string }> = [];

  const processExisting = (data: any[], type: 'sheet' | 'bulk' | 'request') => {
    data.forEach(row => {
      let startStr = row.StartTimeISO || row.startTime;
      let endStr = row.EndTimeISO || row.endTime;
      let studio = row.Studio || row.studio;
      let teacher = row['Teacher 1'] || row.teacher;
      let dateVal = row.Date || row.date;

      if (!startStr || !endStr) return;
      existingBookings.push({
        studio: normalizeStudio(studio),
        teacher: (teacher || '').trim(),
        start: new Date(startStr),
        end: new Date(endStr),
        dateStr: dateVal
      });
    });
  };

  processExisting(sheetData, 'sheet');
  processExisting(bulkData, 'bulk');
  processExisting(requestsData.filter(r => r.Status === 'approved' || r.Status === 'pending'), 'request');

  rows.forEach((row, i) => {
    const dateStr = row[dateIdx];
    const timeStr = row[timeIdx];
    const studioRaw = row[studioIdx];
    const teacher = row[teacherIdx];

    const parsedDay = parseSheetDate(dateStr);
    if (!parsedDay || !timeStr || !studioRaw) return;

    const startTime = parseTime(timeStr, parsedDay);
    if (!startTime) return;

    const endTime = addHours(startTime, CLASS_DURATION_HOURS);
    const studioMatch = normalizeStudio(studioRaw);

    const startTimeISO = startTime.toISOString();
    const endTimeISO = endTime.toISOString();

    const conflicts = {
      studio: false,
      teacher: false
    };

    let isDuplicate = false;

    existingBookings.forEach(eb => {
      const overlap = areIntervalsOverlapping(
        { start: startTime, end: endTime },
        { start: eb.start, end: eb.end }
      );

      if (overlap) {
        if (eb.studio === studioMatch) {
          conflicts.studio = true;
          // If it's the exact same interval and studio, it's a duplicate
          if (eb.start.getTime() === startTime.getTime()) isDuplicate = true;
        }
        if (eb.teacher && eb.teacher === teacher && eb.teacher !== 'TBA') {
          conflicts.teacher = true;
        }
      }
    });

    preview.push({
      id: `preview-${i}`,
      date: dateStr,
      studio: studioMatch,
      scheduledTime: timeStr,
      startTime: startTimeISO,
      endTime: endTimeISO,
      teacher: teacher || 'TBA',
      course: row[courseIdx] || '',
      subject: row[subjectIdx] || '',
      topic: row[topicIdx] || '',
      productType: row[productTypeIdx] || '',
      startTimeLabel: format(startTime, 'h:mm a'),
      endTimeLabel: format(endTime, 'h:mm a'),
      conflicts,
      isDuplicate,
      isBulk: true
    });
  });

  return preview;
}

export async function submitBulkBookings(entries: BulkPreviewEntry[]) {
  const toSubmit = entries.filter(e => !e.isDuplicate).map(e => [
    e.date,
    e.scheduledTime,
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
