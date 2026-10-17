import type { Booking, Hold, SeatMap } from '@/types/api';
import { mockApi } from './mock-api';

const EVENT = 'gdg-hust-20-10-bloom-with-us';

describe('mockApi', () => {
  beforeEach(() => localStorage.clear());

  it('holds seats, rejects a clash, confirms and finds the booking by email + code', async () => {
    const map = await mockApi<SeatMap>(`/events/${EVENT}/seats`);
    const [a, b] = map.sections[0]!.rows[0]!.seats;

    const hold = await mockApi<Hold>(`/events/${EVENT}/holds`, {
      method: 'POST',
      body: { seatIds: [a!.id, b!.id] },
    });
    expect(hold.totalMinor).toBe(500_000);
    await expect(
      mockApi(`/events/${EVENT}/holds`, { method: 'POST', body: { seatIds: [a!.id] } }),
    ).rejects.toMatchObject({ code: 'HOLD_EXISTS' });

    const booking = await mockApi<Booking>(`/holds/${hold.id}/confirm`, {
      method: 'POST',
      body: { email: 'Me@Example.com' },
    });
    const after = await mockApi<SeatMap>(`/events/${EVENT}/seats`);
    expect(after.sections[0]!.rows[0]!.seats[0]!.status).toBe('SOLD');

    const found = await mockApi<Booking>('/bookings/lookup', {
      method: 'POST',
      body: { email: 'me@example.com', code: booking.accessCode.toLowerCase() },
    });
    expect(found.id).toBe(booking.id);
    expect(found.cancelCode).toBeUndefined();
  });

  it('cancels only with the secret cancel code, refunds and frees the seats', async () => {
    const map = await mockApi<SeatMap>(`/events/${EVENT}/seats`);
    const seat = map.sections[0]!.rows[0]!.seats[0]!;
    const hold = await mockApi<Hold>(`/events/${EVENT}/holds`, {
      method: 'POST',
      body: { seatIds: [seat.id] },
    });
    const booking = await mockApi<Booking>(`/holds/${hold.id}/confirm`, {
      method: 'POST',
      body: { email: 'me@example.com' },
    });
    const cancel = (cancelCode: string) =>
      mockApi<Booking>(`/bookings/${booking.id}/cancel`, { method: 'POST', body: { cancelCode } });

    await expect(cancel(booking.accessCode)).rejects.toMatchObject({ status: 403 });
    const cancelled = await cancel(booking.cancelCode!.toLowerCase());
    expect(cancelled).toMatchObject({ status: 'CANCELLED', refundMinor: 250_000 });
    await expect(cancel(booking.cancelCode!)).rejects.toMatchObject({ status: 409 });
    const after = await mockApi<SeatMap>(`/events/${EVENT}/seats`);
    expect(after.sections[0]!.rows[0]!.seats[0]!.status).toBe('AVAILABLE');
  });

  it('searches without diacritics and 404s unknown events', async () => {
    const page = await mockApi<{ items: { slug: string }[] }>('/events?search=giai%20tich');
    expect(page.items.map((e) => e.slug)).toEqual(['giai-tich-1-the-liveshow']);
    await expect(mockApi('/events/nope')).rejects.toMatchObject({ status: 404 });
  });
});
