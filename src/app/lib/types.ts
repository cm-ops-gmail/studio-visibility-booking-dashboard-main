
export interface ClassBooking {
  id: string;
  studio: string;
  date: string;
  scheduledTime: string; // e.g., "11:00 AM"
  course: string;
  subject: string;
  topic: string;
  teacher: string;
  startTime: string; // ISO or similar
  endTime: string;   // ISO or similar
  isBooked: boolean;
  suggestedDescription?: string;
}

export interface DaySchedule {
  date: string;
  studios: string[];
  slots: Record<string, ClassBooking[]>;
}
