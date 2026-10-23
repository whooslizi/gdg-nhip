import { api, API_URL, ApiError } from '@/lib/api-client';
import type { Category, EventDetail, EventSummary, Page, SeatMap, SeatStatus } from '@/types/api';

export interface EventQuery {
  search?: string;
  category?: string;
  page?: number;
}

interface RestEvent {
  eventid: number;
  eventname: string;
  directors?: string[];
  actors?: string[];
  types?: string[];
  languages?: string[];
  poster?: string | null;
  duration?: number;
  startat?: string;
  endat?: string;
}

interface RestShowtime {
  showtimeid: number;
  startat: string;
  endat: string;
  status: string;
}

interface RestSeat {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  seatType: string;
  status: string;
}

export interface EventShowtime {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const categoryFor = (name: string): Category => ({
  slug: slugify(name),
  nameEn: name,
  nameVi: name,
});

const toSummary = (event: RestEvent, startAt?: string): EventSummary => {
  const categories = (event.types ?? []).map(categoryFor);
  return {
    id: String(event.eventid),
    slug: slugify(event.eventname),
    title: event.eventname,
    summary: null,
    posterUrl: event.poster ?? null,
    organizer: { name: event.directors?.[0] ?? 'Ban tổ chức', slug: 'organizer' },
    categories,
    startAt: startAt ?? event.startat ?? null,
    venue: null,
    city: null,
    bookingState: 'OPEN',
  };
};

const fold = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

async function getRestEvents(signal?: AbortSignal) {
  return api<RestEvent[]>('/events', { signal });
}

export async function listEvents(query: EventQuery, signal?: AbortSignal) {
  if (!API_URL) {
    const params = new URLSearchParams({ limit: '12' });
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, String(value));
    return api<Page<EventSummary>>(`/events?${params}`, { signal });
  }

  const source = await getRestEvents(signal);
  const search = fold(query.search ?? '');
  const found = source
    .filter((event) => !query.category || event.types?.some((type) => slugify(type) === query.category))
    .filter((event) => !search || fold(event.eventname).includes(search))
    .map((event) => toSummary(event));
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 12;
  return {
    items: found.slice((page - 1) * pageSize, page * pageSize),
    page,
    total: found.length,
    totalPages: Math.max(1, Math.ceil(found.length / pageSize)),
  } satisfies Page<EventSummary>;
}

export const listFeaturedEvents = async (signal?: AbortSignal) => {
  if (!API_URL)
    return api<{ items: EventSummary[] }>('/events/featured', { signal }).then((r) => r.items);
  const page = await listEvents({}, signal);
  return page.items.slice(0, 3);
};

export async function getEvent(slug: string, signal?: AbortSignal) {
  if (!API_URL) return api<EventDetail>(`/events/${encodeURIComponent(slug)}`, { signal });

  const events = await getRestEvents(signal);
  const match = events.find((event) => String(event.eventid) === slug || slugify(event.eventname) === slug);
  if (!match) throw new ApiError(404, 'NOT_FOUND', 'Event not found');

  const [event, showtimeResponse] = await Promise.all([
    api<RestEvent>(`/events/${match.eventid}`, { signal }),
    api<{ eventId: number; showtimes: RestShowtime[] }>(`/events/${match.eventid}/showtimes`, {
      signal,
    }),
  ]);
  const firstShowtime = showtimeResponse.showtimes[0];
  const summary = toSummary(event, firstShowtime?.startat);
  return {
    ...summary,
    bookingState: firstShowtime ? 'OPEN' : 'UNAVAILABLE',
    description: [
      event.types?.length ? `Thể loại: ${event.types.join(', ')}` : '',
      event.languages?.length ? `Ngôn ngữ: ${event.languages.join(', ')}` : '',
      event.duration ? `Thời lượng: ${event.duration} phút` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    performers: event.actors?.map((name) => ({ name, bio: '' })),
    ticketTypes: [],
    availableCount: null,
  } satisfies EventDetail;
}

export async function listCategories(signal?: AbortSignal) {
  if (!API_URL) return api<{ items: Category[] }>('/categories', { signal }).then((r) => r.items);
  const events = await getRestEvents(signal);
  const names = [...new Set(events.flatMap((event) => event.types ?? []))];
  return names.map(categoryFor);
}

export async function listShowtimes(
  eventId: string,
  fallbackStartAt: string | null,
  signal?: AbortSignal,
): Promise<EventShowtime[]> {
  if (!API_URL) {
    return fallbackStartAt
      ? [{ id: eventId, startAt: fallbackStartAt, endAt: fallbackStartAt, status: 'available' }]
      : [];
  }
  const response = await api<{ showtimes: RestShowtime[] }>(`/events/${eventId}/showtimes`, {
    signal,
  });
  return response.showtimes.map((showtime) => ({
    id: String(showtime.showtimeid),
    startAt: showtime.startat,
    endAt: showtime.endat,
    status: showtime.status,
  }));
}

const ticketTypeFor = (seatType: string) => {
  switch (seatType.trim().toLowerCase()) {
    case 'normal':
    case 'standard':
      return { id: 'standard', name: 'Standard', priceMinor: 150_000 };
    case 'vip':
      return { id: 'vip', name: 'VIP', priceMinor: 250_000 };
    default:
      return { id: slugify(seatType), name: seatType, priceMinor: null };
  }
};

export async function getSeatMap(
  eventId: string,
  showtimeId: string,
  signal?: AbortSignal,
) {
  if (!API_URL) return api<SeatMap>(`/events/${eventId}/seats`, { signal });

  const result = await api<{
    eventId: number;
    showtimeId: number;
    roomId: number;
    seats: RestSeat[];
  }>(`/showtimes/${showtimeId}/seats`, { signal });
  const event = await api<RestEvent>(`/events/${eventId}`, { signal });
  const statusOf = (status: string): SeatStatus => {
    switch (status.toLowerCase()) {
      case 'holding':
        return 'HELD';
      case 'booked':
        return 'SOLD';
      case 'blocked':
        return 'BLOCKED';
      default:
        return 'AVAILABLE';
    }
  };
  const seats = result.seats.map((seat) => {
    const ticketType = ticketTypeFor(seat.seatType);
    return {
      id: String(seat.seatId),
      seatLabel: `${seat.rowLabel}${seat.seatNumber}`,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      ticketTypeId: ticketType.id,
      priceMinor: ticketType.priceMinor ?? 0,
      priceConfigured: ticketType.priceMinor !== null,
      status: statusOf(seat.status),
      heldByMe: false,
      version: 1,
    };
  });
  const ticketTypes = [...new Map(
    result.seats.map((seat) => {
      const type = ticketTypeFor(seat.seatType);
      return [type.id, type] as const;
    }),
  ).values()];

  return {
    eventId: String(result.eventId),
    showtimeId: String(result.showtimeId),
    priceConfigured: ticketTypes.every((type) => type.priceMinor !== null),
    eventSlug: slugify(event.eventname),
    eventTitle: event.eventname,
    bookingState: 'OPEN',
    venue: null,
    ticketTypes: ticketTypes.map((type) => ({
      id: type.id,
      name: type.name,
      priceMinor: type.priceMinor ?? 0,
      currency: 'VND',
    })),
    sections: [{
      id: String(result.roomId),
      name: `Room ${result.roomId}`,
      rows: [...new Set(result.seats.map((seat) => seat.rowLabel))]
        .sort()
        .map((label) => ({
          label,
          seats: seats.filter((seat) => seat.rowLabel === label),
        })),
    }],
    activeHold: null,
    maxSeatsPerHold: 8,
    serverTime: new Date().toISOString(),
  } satisfies SeatMap;
}
