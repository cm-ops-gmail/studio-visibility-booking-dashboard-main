
'use server';

import { BookingRequest } from '@/app/lib/types';
import { addHours, isBefore, subHours } from 'date-fns';

// In-memory store for requests (mocking persistence without Firestore as requested)
// Note: In a production serverless env, this would reset on cold starts.
let requests: BookingRequest[] = [];

export async function submitBookingRequest(request: Omit<BookingRequest, 'id' | 'status' | 'requestedAt'>) {
  const newRequest: BookingRequest = {
    ...request,
    id: Math.random().toString(36).substring(2, 9),
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  requests.push(newRequest);
  return { success: true, request: newRequest };
}

export async function getAllRequests(): Promise<BookingRequest[]> {
  // Filter out requests older than 12 hours that are still pending
  const twelveHoursAgo = subHours(new Date(), 12);
  
  requests = requests.map(req => {
    if (req.status === 'pending' && isBefore(new Date(req.requestedAt), twelveHoursAgo)) {
      return { ...req, status: 'rejected' as const };
    }
    return req;
  });

  return requests;
}

export async function updateRequestStatus(id: string, status: 'approved' | 'rejected') {
  requests = requests.map(req => req.id === id ? { ...req, status } : req);
  return { success: true };
}

export async function getActiveRequestsOverlay(): Promise<BookingRequest[]> {
  const all = await getAllRequests();
  return all.filter(req => req.status !== 'rejected');
}
