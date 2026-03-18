'use server';

import { getSheetData, getBulkBookingData, getRequestsData, appendBulkBookingData } from '@/app/lib/google-sheets';
import { BulkPreviewEntry, ClassBooking } from '@/app/lib/types';
import { parse, format, addHours, isValid, areIntervalsOverlapping, subMinutes, differenceInMinutes } from 'date-fns';

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

export async function parseAndPreviewBulkData(rawData: string): Promise<BulkPreviewEntry[]> {
  const lines = rawData.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(l => l.split('\t').map(c => c.trim().replace(/"/g, '')));

  const findIndex = (candidates: string[]) => 
    headers.findIndex(h => candidates.some(c => h.toLowerCase() === c.toLowerCase() || h.toLowerCase().includes(c.toLowerCase())));

  const dateIdx = findIndex(['Date']);
  const timeIdx = findIndex(['Scheduled Time', 'Start Time']);
  const endTimeIdx = findIndex(['End Time', 'Scheduled End Time']);
  const studioIdx = findIndex(['Studio']);
  const teacherIdx = findIndex(['Teacher 1', 'Teacher']);
  const courseIdx = findIndex(['Course']);
  const subjectIdx = findIndex(['Subject']);
  const topicIdx = findIndex(['Topic']);
  const productTypeIdx = findIndex(['Product Type']);

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
  }> = [];

  // Parse Main Sheet existing bookings
  sheetData.forEach(row => {
    const dateVal = String(row.Date || '').trim();
    const timeVal = String(row['Scheduled Time'] || row.Time || row['Start Time'] || '').trim();
    const endTimeVal = String(row['End Time'] || row['Scheduled End Time'] || '').trim();
    const studioRaw = String(row.Studio || row['Studio Name'] || '').trim();
    const subject = row.Subject || 'Main Schedule Class';
    
    const parsedDay = parseSheetDate(dateVal);
    if (!parsedDay) return;

    const startTime = parseTime(timeVal, parsedDay);
    if (!startTime) return;
    
    let endTime = addHours(startTime, CLASS_DURATION_HOURS);
    if (endTimeVal) {
      const parsedEnd = parseTime(endTimeVal, parsedDay);
      if (parsedEnd && parsedEnd > startTime) endTime = parsedEnd;
    }

    const studioName = normalizeStudio(studioRaw);

    existingOccupancy.push({
      studio: studioName,
      teacher: (row['Teacher 1'] || row.Teacher || '').trim(),
      start: startTime,
      end: endTime,
      isPrep: false,
      productType: row['Product Type'] || '',
      subject
    });

    if (!(row['Product Type'] || '').toLowerCase().includes('studio booking')) {
      existingOccupancy.push({
        studio: studioName,
        teacher: 'Ops Team',
        start: subMinutes(startTime, PREP_DURATION_MINUTES),
        end: startTime,
        isPrep: true,
        productType: 'PREPARATION',
        subject: `Prep for ${subject}`
      });
    }
  });

  // Parse Existing Bulk Bookings
  bulkData.forEach(row => {
    const startTimeISO = row.StartTimeISO || row.startTimeISO || row.startTime || row.StartTime;
    const endTimeISO = row.EndTimeISO || row.endTimeISO || row.endTime || row.EndTime;
    
    if (!startTimeISO || !endTimeISO) return;
    const start = new Date(startTimeISO);
    const end = new Date(endTimeISO);
    if (!isValid(start) || !isValid(end)) return;

    const studioName = normalizeStudio(row.Studio || row.studio || '');
    const subject = row.Subject || row.subject || 'Bulk Booked Class';

    existingOccupancy.push({
      studio: studioName,
      teacher: (row['Teacher 1'] || row.teacher || '').trim(),
      start,
      end,
      isPrep: false,
      productType: row['Product Type'] || row.productType || '',
      subject
    });

    if (!(row['Product Type'] || row.productType || '').toLowerCase().includes('studio booking')) {
      existingOccupancy.push({
        studio: studioName,
        teacher: 'Ops Team',
        start: subMinutes(start, PREP_DURATION_MINUTES),
        end: start,
        isPrep: true,
        productType: 'PREPARATION',
        subject: `Prep for ${subject}`
      });
    }
  });

  // Parse Pending/Approved Requests
  requestsData.forEach(r => {
    if ((r.Status !== 'approved' && r.Status !== 'pending') || !r.StartTime) return;
    const start = new Date(r.StartTime);
    if (!isValid(start)) return;
    let durationHrs = r.Duration === '30 mins' ? 0.5 : (r.Duration === '1 hr 30 mins' ? 1.5 : (r.Duration === '2 hrs' ? 2 : 1));
    const end = addHours(start, durationHrs);
    const studioName = normalizeStudio(r.Studio);

    existingOccupancy.push({
      studio: studioName,
      teacher: 'User Request',
      start,
      end,
      isPrep: false,
      productType: 'STUDIO BOOKING',
      subject: r.Status === 'approved' ? 'Approved Request' : 'Pending Request'
    });
  });

  rows.forEach((row, i) => {
    const dateStr = row[dateIdx];
    const startTimeStr = row[timeIdx];
    const endTimeStr = endTimeIdx !== -1 ? row[endTimeIdx] : null;
    const studioRaw = row[studioIdx];
    const teacher = row[teacherIdx];

    const parsedDay = parseSheetDate(dateStr);
    if (!parsedDay || !startTimeStr || !studioRaw) return;

    const startTime = parseTime(startTimeStr, parsedDay);
    if (!startTime) return;

    let endTime = addHours(startTime, CLASS_DURATION_HOURS);
    if (endTimeStr) {
      const parsedEndTime = parseTime(endTimeStr, parsedDay);
      if (parsedEndTime && parsedEndTime > startTime) {
        endTime = parsedEndTime;
      }
    }

    const studioMatch = normalizeStudio(studioRaw);

    const conflicts = { studio: false, teacher: false };
    let isDuplicate = false;
    let conflictingSlot: any = null;

    existingOccupancy.forEach(occ => {
      if (occ.studio !== studioMatch && occ.teacher !== teacher) return;

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
            type: occ.isPrep ? 'PREPARATION' : (occ.productType || 'CLASS')
          };
          if (!occ.isPrep && occ.start.getTime() === startTime.getTime() && occ.end.getTime() === endTime.getTime()) {
            isDuplicate = true;
          }
        }
        if (!occ.isPrep && occ.teacher && occ.teacher === teacher && teacher !== 'TBA' && teacher !== '') {
          conflicts.teacher = true;
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
      teacher: teacher || 'TBA',
      course: row[courseIdx] || '',
      subject: row[subjectIdx] || '',
      topic: row[topicIdx] || '',
      productType: row[productTypeIdx] || '',
      startTimeLabel: format(startTime, 'h:mm a'),
      endTimeLabel: format(endTime, 'h:mm a'),
      conflicts,
      isDuplicate,
      conflictingSlot,
      isBulk: true
    });
  });

  return preview;
}

export async function submitBulkBookings(entries: BulkPreviewEntry[]) {
  // Ordered mapping based on the User Header request:
  // Date, Scheduled Time, End Time, Product Type, Course, Subject, Topic, Teacher 1, Studio
  const toSubmit = entries
    .filter(e => !e.isDuplicate && !e.conflicts.studio)
    .map(e => [
      e.date,               // Date
      e.startTimeLabel,     // Scheduled Time (Only Start Time as requested)
      e.endTimeLabel || '', // End Time
      e.productType,        // Product Type
      e.course,             // Course
      e.subject,            // Subject
      e.topic,              // Topic
      e.teacher,            // Teacher 1
      e.studio,             // Studio
      e.startTime,          // StartTimeISO (Internal)
      e.endTime             // EndTimeISO (Internal)
    ]);

  if (toSubmit.length > 0) {
    await appendBulkBookingData(toSubmit);
  }

  return { success: true, count: toSubmit.length };
}
