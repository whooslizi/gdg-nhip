import { api, API_URL, ApiError } from '@/lib/api-client';
import type { Booking, Hold, SeatMap } from '@/types/api';

const liveHolds = new Map<string, Hold>();
const DEVICE_BOOKINGS_KEY = 'nhip-live-bookings';

interface DeviceBooking {
  id: string;
  email: string;
}

function readDeviceBookings(): DeviceBooking[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_BOOKINGS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DeviceBooking =>
        !!item && typeof item.id === 'string' && typeof item.email === 'string',
    );
  } catch {
    return [];
  }
}

function rememberDeviceBooking(id: string, email: string) {
  try {
    const bookings = readDeviceBookings().filter((booking) => booking.id !== id);
    bookings.unshift({ id, email });
    localStorage.setItem(DEVICE_BOOKINGS_KEY, JSON.stringify(bookings));
  } catch {
    // Booking remains valid if local device storage is unavailable.
  }
}

export async function createHold(eventId: string, seatIds: string[], seatMap?: SeatMap) {
  if (!API_URL) return api<Hold>(`/events/${eventId}/holds`, { method: 'POST', body: { seatIds } });
  if (!seatMap?.showtimeId) throw new ApiError(400, 'SHOWTIME_REQUIRED', 'No showtime selected');

  const result = await api<{
    holdToken: string;
    showtimeId: number;
    seatIds: number[];
    expiresAt: string;
  }>('/holds', {
    method: 'POST',
    body: {
      showtimeId: Number(seatMap.showtimeId),
      seatIds: seatIds.map(Number),
    },
  });
  const seats = new Map(
    seatMap.sections.flatMap((section) =>
      section.rows.flatMap((row) => row.seats.map((seat) => [seat.id, seat] as const)),
    ),
  );
  const items = result.seatIds.map((id) => {
    const seat = seats.get(String(id));
    return {
      eventSeatingId: String(id),
      seatLabel: seat?.seatLabel ?? String(id),
      section: seatMap.sections.find((section) =>
        section.rows.some((row) => row.seats.some((item) => item.id === String(id))),
      )?.name ?? '',
      ticketType: seatMap.ticketTypes.find((type) => type.id === seat?.ticketTypeId)?.name ?? '',
      unitPriceMinor: seat?.priceMinor ?? 0,
    };
  });
  const hold: Hold = {
    id: result.holdToken,
    eventId,
    status: 'ACTIVE',
    expiresAt: result.expiresAt,
    serverTime: new Date().toISOString(),
    items,
    totalMinor: items.reduce((total, item) => total + item.unitPriceMinor, 0),
    priceConfigured: seatMap.priceConfigured !== false,
    currency: 'VND',
    bookingId: null,
  };
  liveHolds.set(hold.id, hold);
  return hold;
}

export const getHold = (holdId: string) => {
  if (!API_URL) return api<Hold>(`/holds/${holdId}`);
  const hold = liveHolds.get(holdId);
  if (!hold) throw new ApiError(404, 'NOT_FOUND', 'Hold details are no longer available');
  return Promise.resolve(hold);
};

export async function cancelHold(holdId: string) {
  if (!API_URL) return api<Hold>(`/holds/${holdId}`, { method: 'DELETE' });
  await api<{ success: boolean; message: string }>('/holds/cancel', {
    method: 'POST',
    body: { holdToken: holdId },
  });
  const hold = liveHolds.get(holdId);
  if (!hold) throw new ApiError(404, 'NOT_FOUND', 'Hold details are no longer available');
  const cancelled = { ...hold, status: 'CANCELLED' as const };
  liveHolds.set(holdId, cancelled);
  return cancelled;
}
export async function confirmHold(
  holdId: string,
  buyer: { name: string; phone: string; email: string },
  price: number,
) {
  if (!API_URL)
    return api<Booking>(`/holds/${holdId}/confirm`, {
      method: 'POST',
      body: { email: buyer.email },
    });

  const payment = await createMockPayment({
    holdToken: holdId,
    userName: buyer.name,
    userPhone: buyer.phone,
    userEmail: buyer.email,
    price,
    result: 'success',
  });
  return getBooking(String(payment.bookingId), buyer.email);
}

export const createMockPayment = (input: {
  holdToken: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  price: number;
  result: 'success' | 'failed';
}) => api<{ paymentId: number; bookingId: string; bookingDbId: number; bookingToken: string }>('/payments/mock', {
  method: 'POST',
  body: input,
});

export async function getBooking(bookingId: string, email?: string) {
  if (!API_URL) return api<Booking>(`/bookings/${bookingId}`);

  const userEmail = email ?? readDeviceBookings().find((booking) => booking.id === bookingId)?.email;
  if (!userEmail) throw new ApiError(400, 'BOOKING_EMAIL_REQUIRED', 'Enter the email used for this booking.');
  const params = new URLSearchParams({ email: userEmail });
  const booking = await api<Booking>(`/bookings/${encodeURIComponent(bookingId)}?${params}`);
  rememberDeviceBooking(booking.id, booking.email);
  return booking;
}

export async function listMyBookings() {
  if (!API_URL) return api<{ items: Booking[] }>('/bookings').then((r) => r.items);

  const stored = readDeviceBookings();
  const results = await Promise.all(
    stored.map(async (booking) => {
      try {
        return await getBooking(booking.id, booking.email);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }),
  );
  const available = results.filter((booking): booking is Booking => booking !== null);
  try {
    localStorage.setItem(
      DEVICE_BOOKINGS_KEY,
      JSON.stringify(available.map((booking) => ({ id: booking.id, email: booking.email }))),
    );
  } catch {
    // Keep returning bookings if local device storage is unavailable.
  }
  return available;
}

export async function lookupBooking(email: string, bookingId: string) {
  if (!API_URL) {
    return api<Booking>('/bookings/lookup', {
      method: 'POST',
      body: { email, code: bookingId },
    });
  }
  const booking = await api<Booking>('/bookings/lookup', {
    method: 'POST',
    body: { email, bookingId: bookingId.trim().toUpperCase() },
  });
  rememberDeviceBooking(booking.id, booking.email);
  return booking;
}

export const cancelBooking = (bookingId: string, verification: string) =>
  api<Booking>(`/bookings/${bookingId}/cancel`, {
    method: 'POST',
    body: API_URL ? { email: verification } : { cancelCode: verification },
  });
