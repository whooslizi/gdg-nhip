import { api } from '@/lib/api-client';
import type { Booking, Hold } from '@/types/api';

export const createHold = (eventId: string, seatIds: string[]) =>
  api<Hold>(`/events/${eventId}/holds`, { method: 'POST', body: { seatIds } });
export const getHold = (holdId: string) => api<Hold>(`/holds/${holdId}`);
export const cancelHold = (holdId: string) => api<Hold>(`/holds/${holdId}`, { method: 'DELETE' });
export const confirmHold = (holdId: string, email: string) =>
  api<Booking>(`/holds/${holdId}/confirm`, { method: 'POST', body: { email } });

export const getBooking = (bookingId: string) => api<Booking>(`/bookings/${bookingId}`);
export const listMyBookings = () => api<{ items: Booking[] }>('/bookings').then((r) => r.items);
export const lookupBooking = (email: string, code: string) =>
  api<Booking>('/bookings/lookup', { method: 'POST', body: { email, code } });
export const cancelBooking = (bookingId: string, cancelCode: string) =>
  api<Booking>(`/bookings/${bookingId}/cancel`, { method: 'POST', body: { cancelCode } });
