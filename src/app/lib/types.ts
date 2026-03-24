
export interface ClassBooking {
  id: string;
  studio: string;
  date: string;
  scheduledTime: string; // e.g., "11:00 AM"
  course: string;
  subject: string;
  topic: string;
  teacher: string;
  productType: string; 
  startTime: string; // ISO
  endTime: string;   // ISO
  startTimeLabel?: string; // Pre-formatted for display
  endTimeLabel?: string;   // Pre-formatted for display
  durationLabel?: string;  // e.g., "1h 30m"
  isBooked: boolean;
  suggestedDescription?: string;
  rowSpan?: number; // Calculated intervals to span
  isFirst?: boolean; // Whether this is the starting interval for rendering
  isPrepSlot?: boolean; // Whether this is a preparation slot
  // Booking Request Fields
  requestStatus?: 'pending' | 'approved' | 'rejected';
  requestedAt?: string; // ISO
  requestedDuration?: string; // e.g. "1h 30m"
  isBulk?: boolean; // Flag for bulk booked items
}

export interface TimeInterval {
  start: string; // ISO
  end: string;   // ISO
  label: string; // e.g., "10:00 AM - 12:00 PM"
}

export interface DaySchedule {
  date: string;
  studios: string[];
  intervals: TimeInterval[]; // Dynamic time intervals for the day
  grid: Record<string, Record<string, ClassBooking>>; // startISO -> studio -> booking
}

export interface BookingRequest {
  id: string;
  studio: string;
  date: string;
  startTime: string; // ISO
  duration: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string; // ISO
}

export interface BulkPreviewEntry extends Omit<ClassBooking, 'isBooked'> {
  conflicts: {
    studio: boolean;
    teacher: boolean;
  };
  isDuplicate: boolean;
  conflictingSlot?: {
    subject: string;
    teacher: string;
    time: string;
    type: string;
    studio?: string;
    topic?: string;
    date?: string;
  };
}

export interface RangeSummary {
  booked: ClassBooking[];
  availableCount: number;
}

export interface UtilizationStat {
  studio: string;
  percentage: number;
  usedHours: number;
  totalAvailableHours: number;
  details: {
    classes: any[];
    shoots: any[];
  };
}

export interface TeacherConflictInfo {
  isBusy: boolean;
  conflict?: {
    subject: string;
    topic?: string;
    time: string;
    studio: string;
    date: string;
  };
}

export interface SuggestedRoutineSlot {
  id: string;
  date: string;
  dateLabel: string;
  studio: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  availableTeachers: string[]; // Still keep for simple usage
  teacherPoolStatus: Record<string, TeacherConflictInfo>; // Detailed status for every teacher
  selectedTeacher?: string;
  subject?: string;
  topic?: string;
}
