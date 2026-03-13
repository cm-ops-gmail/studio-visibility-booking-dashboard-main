'use server';

import { BookingRequest } from '@/app/lib/types';
import { subHours, isBefore } from 'date-fns';
import { getRequestsData, appendRequestData, updateRequestStatusInSheet } from '@/app/lib/google-sheets';

export async function submitBookingRequest(request: Omit<BookingRequest, 'id' | 'status' | 'requestedAt'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const status = 'pending';
  const requestedAt = new Date().toISOString();
  
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
}

export async function getAllRequests(): Promise<BookingRequest[]> {
  const data = await getRequestsData();
  const twelveHoursAgo = subHours(new Date(), 12);

  return data.map((req: any) => {
    let status = req.Status as 'pending' | 'approved' | 'rejected';
    const requestedAt = req.RequestedAt;

    // Handle 12-hour expiration for pending requests
    if (status === 'pending' && requestedAt && isBefore(new Date(requestedAt), twelveHoursAgo)) {
      status = 'rejected';
    }

    return {
      id: req.ID,
      studio: req.Studio,
      date: req.Date,
      startTime: req.StartTime,
      duration: req.Duration,
      status: status,
      requestedAt: requestedAt,
    };
  });
}

export async function updateRequestStatus(id: string, status: 'approved' | 'rejected') {
  await updateRequestStatusInSheet(id, status);
  return { success: true };
}

export async function getActiveRequestsOverlay(): Promise<BookingRequest[]> {
  const all = await getAllRequests();
  // We only show pending and approved on the calendar
  return all.filter(req => req.status !== 'rejected');
}