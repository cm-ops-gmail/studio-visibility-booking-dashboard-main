'use server';

import { BookingRequest } from '@/app/lib/types';
import { subHours, isBefore } from 'date-fns';
import { getRequestsData, appendRequestData, updateRequestStatusInSheet } from '@/app/lib/google-sheets';

export async function submitBookingRequest(request: Omit<BookingRequest, 'id' | 'status' | 'requestedAt'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const status = 'pending';
  const requestedAt = new Date().toISOString();
  
  try {
    // Columns: ID, Studio, Date, StartTime, Duration, Status, RequestedAt
    await appendRequestData([
      id,
      request.studio,
      request.date,
      request.startTime,
      request.duration,
      status,
      requestedAt
    ]);
    return { success: true, request: { ...request, id, status, requestedAt } };
  } catch (error) {
    console.error('Failed to submit booking request to sheet:', error);
    throw new Error('Database submission failed');
  }
}

export async function getAllRequests(): Promise<BookingRequest[]> {
  const data = await getRequestsData();
  const twelveHoursAgo = subHours(new Date(), 12);

  return data.map((req: any) => {
    let status = (req.Status || 'pending') as 'pending' | 'approved' | 'rejected';
    const requestedAt = req.RequestedAt;

    // Handle 12-hour expiration for pending requests
    if (status === 'pending' && requestedAt) {
      try {
        if (isBefore(new Date(requestedAt), twelveHoursAgo)) {
          status = 'rejected';
        }
      } catch (e) {
        // Fallback if date parsing fails
      }
    }

    return {
      id: req.ID || '',
      studio: req.Studio || '',
      date: req.Date || '',
      startTime: req.StartTime || '',
      duration: req.Duration || '1 hr',
      status: status,
      requestedAt: requestedAt || '',
    };
  }).filter(req => req.id !== '');
}

export async function updateRequestStatus(id: string, status: 'approved' | 'rejected') {
  await updateRequestStatusInSheet(id, status);
  return { success: true };
}

export async function getActiveRequestsOverlay(): Promise<BookingRequest[]> {
  const all = await getAllRequests();
  // We only show pending and approved on the calendar to represent "occupied" slots
  return all.filter(req => req.status === 'pending' || req.status === 'approved');
}
