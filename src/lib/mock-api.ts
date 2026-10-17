/**
 * In-browser stand-in for the REST API, used while the site ships frontend-only
 * (no VITE_API_BASE_URL). Holds and bookings live in this browser's localStorage.
 * shortcut: nothing is shared between visitors; replace by setting VITE_API_BASE_URL once the backend is up.
 */
import { categories, events, type EventData } from '@/data/events';
import type { Booking, EventDetail, Hold, Seat, SeatMap } from '@/types/api';
import { ApiError } from './api-client';

const HOLD_MS = 5 * 60_000;
const MAX_SEATS = 8;
const PAGE_SIZE = 12;
const LAYOUT = [
  { name: 'Floor', rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], seatsPerRow: 14 },
  { name: 'Balcony', rows: ['J', 'K', 'L'], seatsPerRow: 16 },
];
const PREMIUM_ROWS = ['A', 'B', 'C'];
const BLOCKED = ['H1', 'H14'];

interface StoredHold {
  id: string;
  eventId: string;
  seatIds: string[];
  expiresAt: string;
  status: 'ACTIVE' | 'CONFIRMED' | 'CANCELLED';
  bookingId: string | null;
}
interface StoredBooking {
  id: string;
  holdId: string;
  reference: string;
  accessCode: string;
  email: string;
  confirmedAt: string;
  cancelCode?: string; // missing on bookings saved before cancellation existed
  cancelledAt?: string;
}
interface Store {
  holds: StoredHold[];
  bookings: StoredBooking[];
}

const KEY = 'nhip-bookings';
function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '') as Store;
  } catch {
    return { holds: [], bookings: [] };
  }
}
function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // private mode: bookings last only until reload
  }
}

const fail = (status: number, code: string, message: string, details?: Record<string, unknown>) => {
  throw new ApiError(status, code, message, details);
};
const notFound = (what: string) => fail(404, 'NOT_FOUND', `${what} not found`);

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join(
    '',
  );
const pair = () => `${code(4)}-${code(4)}`;

const isLive = (h: StoredHold) => h.status === 'ACTIVE' && new Date(h.expiresAt) > new Date();
const holdStatus = (h: StoredHold): Hold['status'] =>
  h.status === 'ACTIVE' && !isLive(h) ? 'EXPIRED' : h.status;

function seatsOf(e: EventData, store: Store): Map<string, Seat & { section: string }> {
  const taken = new Map<string, Seat['status']>();
  for (const h of store.holds)
    if (h.eventId === e.id && (h.status === 'CONFIRMED' || isLive(h)))
      for (const id of h.seatIds) taken.set(id, h.status === 'CONFIRMED' ? 'SOLD' : 'HELD');
  const seats = new Map<string, Seat & { section: string }>();
  for (const section of LAYOUT)
    for (const row of section.rows)
      for (let n = 1; n <= section.seatsPerRow; n++) {
        const label = `${row}${n}`;
        const id = `${e.id}:${label}`;
        const premium = PREMIUM_ROWS.includes(row);
        const status = BLOCKED.includes(label) ? 'BLOCKED' : (taken.get(id) ?? 'AVAILABLE');
        seats.set(id, {
          id,
          section: section.name,
          seatLabel: label,
          rowLabel: row,
          seatNumber: n,
          ticketTypeId: premium ? 'premium' : 'standard',
          priceMinor: premium ? e.seating!.premium : e.seating!.standard,
          status,
          // Every hold in this browser belongs to this visitor.
          heldByMe: status === 'HELD',
          version: 1,
        });
      }
  return seats;
}

const ticketTypes = (e: EventData) =>
  e.seating
    ? [
        { id: 'premium', name: 'VIP', priceMinor: e.seating.premium, currency: 'VND' },
        { id: 'standard', name: 'Standard', priceMinor: e.seating.standard, currency: 'VND' },
      ]
    : [];

function toDetail(e: EventData, store: Store): EventDetail {
  const seats = e.seating ? [...seatsOf(e, store).values()] : [];
  const free = (id?: string) =>
    seats.filter((s) => s.status === 'AVAILABLE' && (!id || s.ticketTypeId === id)).length;
  const { featured: _f, seating: _s, ...rest } = e;
  return {
    ...rest,
    ticketTypes: ticketTypes(e).map((tt) => ({ ...tt, availableCount: free(tt.id) })),
    availableCount: e.seating ? free() : null,
  };
}

function toHold(h: StoredHold, store: Store): Hold {
  const e = findEvent(h.eventId);
  const seats = seatsOf(e, store);
  const names = Object.fromEntries(ticketTypes(e).map((tt) => [tt.id, tt.name]));
  const items = h.seatIds.map((id) => {
    const s = seats.get(id)!;
    return {
      eventSeatingId: id,
      seatLabel: s.seatLabel,
      section: s.section,
      ticketType: names[s.ticketTypeId]!,
      unitPriceMinor: s.priceMinor,
    };
  });
  return {
    id: h.id,
    eventId: h.eventId,
    status: holdStatus(h),
    expiresAt: h.expiresAt,
    serverTime: new Date().toISOString(),
    items,
    totalMinor: items.reduce((n, i) => n + i.unitPriceMinor, 0),
    currency: 'VND',
    bookingId: h.bookingId,
  };
}

function toBooking(b: StoredBooking, store: Store, withCancelCode = false): Booking {
  const h = store.holds.find((x) => x.id === b.holdId)!;
  const e = findEvent(h.eventId);
  const hold = toHold(h, store);
  return {
    id: b.id,
    reference: b.reference,
    accessCode: b.accessCode,
    email: b.email,
    status: b.cancelledAt ? 'CANCELLED' : 'CONFIRMED',
    event: {
      slug: e.slug,
      title: e.title,
      posterUrl: e.posterUrl,
      startAt: e.startAt,
      venue: e.venue,
      city: e.city,
    },
    items: hold.items.map(({ eventSeatingId: _id, ...item }) => item),
    totalMinor: hold.totalMinor,
    currency: hold.currency,
    confirmedAt: b.confirmedAt,
    ...(withCancelCode && { cancelCode: b.cancelCode }),
    ...(b.cancelledAt && { refundMinor: hold.totalMinor }),
  };
}

function findEvent(idOrSlug: string) {
  return events.find((e) => e.id === idOrSlug || e.slug === idOrSlug) ?? notFound('Event');
}
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const byDate = (a: EventData, b: EventData) => (a.startAt ?? '').localeCompare(b.startAt ?? '');

export async function mockApi<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const method = init.method ?? 'GET';
  const url = new URL(path, 'http://local');
  const body = (init.body ?? {}) as {
    seatIds?: string[];
    email?: string;
    code?: string;
    cancelCode?: string;
  };
  const store = load();
  const route = (m: string, re: RegExp) => (method === m ? url.pathname.match(re) : null);
  let match: RegExpMatchArray | null;

  if (route('GET', /^\/categories$/)) return { items: categories } as T;

  if (route('GET', /^\/events\/featured$/))
    return { items: events.filter((e) => e.featured).map((e) => toDetail(e, store)) } as T;

  if (route('GET', /^\/events$/)) {
    const search = fold(url.searchParams.get('search') ?? '');
    const category = url.searchParams.get('category');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const found = events
      .filter((e) => !category || e.categories.some((c) => c.slug === category))
      .filter((e) => !search || fold(`${e.title} ${e.organizer.name}`).includes(search))
      .sort(byDate);
    return {
      items: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => toDetail(e, store)),
      page,
      total: found.length,
      totalPages: Math.max(1, Math.ceil(found.length / PAGE_SIZE)),
    } as T;
  }

  if ((match = route('GET', /^\/events\/([^/]+)\/seats$/))) {
    const e = findEvent(match[1]!);
    if (!e.seating) notFound('Seating');
    const seats = [...seatsOf(e, store).values()];
    const active = store.holds.find((h) => h.eventId === e.id && isLive(h));
    return {
      eventId: e.id,
      eventSlug: e.slug,
      eventTitle: e.title,
      bookingState: e.bookingState,
      venue: { name: e.seating!.venueName },
      ticketTypes: ticketTypes(e),
      sections: LAYOUT.map((s) => ({
        id: s.name,
        name: s.name,
        rows: s.rows.map((label) => ({
          label,
          seats: seats.filter((seat) => seat.rowLabel === label),
        })),
      })),
      activeHold: active ? { id: active.id, expiresAt: active.expiresAt } : null,
      maxSeatsPerHold: MAX_SEATS,
      serverTime: new Date().toISOString(),
    } satisfies SeatMap as T;
  }

  if ((match = route('GET', /^\/events\/([^/]+)$/)))
    return toDetail(findEvent(decodeURIComponent(match[1]!)), store) as T;

  if ((match = route('POST', /^\/events\/([^/]+)\/holds$/))) {
    const e = findEvent(match[1]!);
    if (!e.seating || (e.bookingState !== 'OPEN' && e.bookingState !== 'REGISTER'))
      fail(409, 'BOOKING_NOT_OPEN', 'Booking is not open for this event');
    const ids = body.seatIds ?? [];
    if (ids.length === 0 || ids.length > MAX_SEATS || new Set(ids).size !== ids.length)
      fail(422, 'INVALID_SEATS', `Choose 1 to ${MAX_SEATS} different seats`);
    const existing = store.holds.find((h) => h.eventId === e.id && isLive(h));
    if (existing)
      fail(409, 'HOLD_EXISTS', 'You already have seats on hold for this event', {
        holdId: existing.id,
      });
    const seats = seatsOf(e, store);
    const taken = ids.filter((id) => seats.get(id)?.status !== 'AVAILABLE');
    if (taken.length)
      fail(409, 'SEATS_UNAVAILABLE', 'Some selected seats are no longer available', {
        seatIds: taken,
      });
    const hold: StoredHold = {
      id: crypto.randomUUID(),
      eventId: e.id,
      seatIds: ids,
      expiresAt: new Date(Date.now() + HOLD_MS).toISOString(),
      status: 'ACTIVE',
      bookingId: null,
    };
    store.holds.push(hold);
    save(store);
    return toHold(hold, store) as T;
  }

  if ((match = url.pathname.match(/^\/holds\/([^/]+)(\/confirm)?$/))) {
    const hold = store.holds.find((h) => h.id === match![1]) ?? notFound('Hold');
    if (method === 'GET' && !match[2]) return toHold(hold, store) as T;
    if (method === 'DELETE' && !match[2]) {
      if (isLive(hold)) hold.status = 'CANCELLED';
      save(store);
      return toHold(hold, store) as T;
    }
    if (method === 'POST' && match[2]) {
      if (hold.bookingId)
        return toBooking(
          store.bookings.find((b) => b.id === hold.bookingId)!,
          store,
          true,
        ) as T;
      if (!isLive(hold)) fail(409, 'HOLD_EXPIRED', 'Your hold has expired');
      const email = (body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail(422, 'VALIDATION', 'Enter a valid email address');
      const booking: StoredBooking = {
        id: crypto.randomUUID(),
        holdId: hold.id,
        reference: `BK-${pair()}`,
        accessCode: pair(),
        cancelCode: pair(),
        email,
        confirmedAt: new Date().toISOString(),
      };
      hold.status = 'CONFIRMED';
      hold.bookingId = booking.id;
      store.bookings.push(booking);
      save(store);
      return toBooking(booking, store, true) as T;
    }
  }

  if (route('GET', /^\/bookings$/))
    return { items: store.bookings.map((b) => toBooking(b, store, true)).reverse() } as T;

  if (route('POST', /^\/bookings\/lookup$/)) {
    const email = (body.email ?? '').trim().toLowerCase();
    const accessCode = (body.code ?? '').trim().toUpperCase();
    const b = store.bookings.find((x) => x.email === email && x.accessCode === accessCode);
    return toBooking(b ?? notFound('Booking'), store) as T;
  }

  if ((match = route('GET', /^\/bookings\/([^/]+)$/))) {
    const b = store.bookings.find((x) => x.id === match![1]) ?? notFound('Booking');
    return toBooking(b, store, true) as T;
  }

  if ((match = route('POST', /^\/bookings\/([^/]+)\/cancel$/))) {
    const b = store.bookings.find((x) => x.id === match![1]) ?? notFound('Booking');
    if (b.cancelledAt) fail(409, 'ALREADY_CANCELLED', 'This booking is already cancelled');
    if (!b.cancelCode || (body.cancelCode ?? '').trim().toUpperCase() !== b.cancelCode)
      fail(403, 'INVALID_CANCEL_CODE', 'Wrong cancellation code');
    b.cancelledAt = new Date().toISOString();
    // Cancelling the hold frees the seats for everyone else.
    store.holds.find((h) => h.id === b.holdId)!.status = 'CANCELLED';
    save(store);
    return toBooking(b, store) as T;
  }

  return notFound('Route');
}
