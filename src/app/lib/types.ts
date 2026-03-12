
export interface ClassBooking {
  id: string;
  studio: string;
  date: string;
  scheduledTime: string; // e.g., "11:00 AM"
  course: string;
  subject: string;
  topic: string;
  teacher: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  isBooked: boolean;
  suggestedDescription?: string;
}

export interface DaySchedule {
  date: string;
  studios: string[];
  timeSlots: string[]; // List of all unique times found for the day
  grid: Record<string, Record<string, ClassBooking>>; // time -> studio -> booking
}
