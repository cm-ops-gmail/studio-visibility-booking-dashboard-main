'use server';

import { getCentralOpsData, getRecordShootData } from '@/app/lib/google-sheets';
import { UtilizationStat } from '@/app/lib/types';
import { parse, format, differenceInMinutes, isValid, eachDayOfInterval, startOfDay } from 'date-fns';

const DAY_START_HOUR = 10;
const DAY_END_HOUR = 22;
const TOTAL_DAY_HOURS = DAY_END_HOUR - DAY_START_HOUR; // 12 hours

const ALLOWED_STUDIOS = [
  'Studio 1 - HQ1', 'Studio 2 - HQ1', 'Studio 3 - HQ1', 'Studio 4 - HQ1', 'Studio 5 - HQ5',
  'Studio 6 - HQ5', 'Studio 7 - HQ5', 'Studio 8 - HQ5', 'Studio 9 - NB2', 'Studio 10 - NB2',
  'Studio 11 - NB2', 'POD 1 - HQ1', 'POD 2 - HQ1', 'Green Room',
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

export async function fetchUtilizationStats(startDateStr: string, endDateStr: string): Promise<UtilizationStat[]> {
  const [centralOps, recordShoots] = await Promise.all([
    getCentralOpsData(),
    getRecordShootData()
  ]);

  const startDayObj = parse(startDateStr, 'yyyy-MM-dd', new Date());
  const endDayObj = parse(endDateStr, 'yyyy-MM-dd', new Date());

  const daysInRange = eachDayOfInterval({ start: startDayObj, end: endDayObj }).length;
  const totalAvailableHours = daysInRange * TOTAL_DAY_HOURS;

  const stats: Record<string, UtilizationStat> = {};
  ALLOWED_STUDIOS.forEach(studio => {
    stats[studio] = {
      studio,
      percentage: 0,
      usedHours: 0,
      totalAvailableHours,
      details: { classes: [], shoots: [] }
    };
  });

  // Process Central Ops (2.5 hours per entry)
  centralOps.forEach(row => {
    const parsedDate = parseSheetDate(row.Date || '');
    if (!parsedDate) return;
    
    const dateKey = format(parsedDate, 'yyyy-MM-dd');
    if (dateKey < startDateStr || dateKey > endDateStr) return;

    const studio = normalizeStudio(row.Studio || '');
    if (stats[studio]) {
      stats[studio].usedHours += 2.5;
      stats[studio].details.classes.push({
        date: format(parsedDate, 'MMM d, yyyy'),
        time: row['Scheduled Time'] || 'N/A',
        topic: row.Topic || 'Untitled Topic',
        subject: row.Subject || '',
        teacher: row['Teacher 1'] || 'TBA',
        duration: 2.5
      });
    }
  });

  // Process Record Shoots
  recordShoots.forEach(row => {
    const parsedDate = parseSheetDate(row.Date || '');
    if (!parsedDate) return;
    
    const dateKey = format(parsedDate, 'yyyy-MM-dd');
    if (dateKey < startDateStr || dateKey > endDateStr) return;

    const studio = normalizeStudio(row['Shooting Place'] || '');
    if (stats[studio]) {
      const startTime = parseTime(row['Scheduled Time'], parsedDate);
      const endTime = parseTime(row['End Time'], parsedDate);
      
      if (startTime && endTime && isValid(startTime) && isValid(endTime)) {
        const durationMin = differenceInMinutes(endTime, startTime);
        const durationHrs = Math.max(0, durationMin / 60);
        
        stats[studio].usedHours += durationHrs;
        stats[studio].details.shoots.push({
          date: format(parsedDate, 'MMM d, yyyy'),
          time: `${row['Scheduled Time']} - ${row['End Time']}`,
          topic: row['Topic Name'] || 'Untitled Shoot',
          teacher: row['Instructor Name'] || 'TBA',
          duration: durationHrs
        });
      }
    }
  });

  // Calculate percentages
  return Object.values(stats).map(stat => ({
    ...stat,
    percentage: stat.totalAvailableHours > 0 
      ? Math.min(100, (stat.usedHours / stat.totalAvailableHours) * 100)
      : 0
  }));
}
