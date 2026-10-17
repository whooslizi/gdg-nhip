export type BookingState =
  'OPEN' | 'REGISTER' | 'COMING_SOON' | 'DETAILS_TBA' | 'SOLD_OUT' | 'CLOSED' | 'UNAVAILABLE';

export interface Category {
  slug: string;
  nameEn: string;
  nameVi: string;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  posterUrl: string | null;
  organizer: { name: string; slug: string; email?: string; website?: string; about?: string };
  categories: Category[];
  startAt: string | null;
  venue: string | null;
  city: string | null;
  bookingState: BookingState;
}

export interface EventDetail extends EventSummary {
  description: string;
  performers?: { name: string; bio: string }[];
  /** English copy; the fields above are Vietnamese. */
  en?: {
    description: string;
    performers?: { name: string; bio: string }[];
    organizerAbout?: string;
  };
  ticketTypes: {
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
    availableCount: number;
  }[];
  availableCount: number | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
}

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED';

export interface Seat {
  id: string;
  seatLabel: string;
  rowLabel: string;
  seatNumber: number;
  ticketTypeId: string;
  priceMinor: number;
  status: SeatStatus;
  heldByMe: boolean;
  version: number;
}

export interface SeatMap {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  bookingState: BookingState;
  venue: { name: string } | null;
  ticketTypes: { id: string; name: string; priceMinor: number; currency: string }[];
  sections: { id: string; name: string; rows: { label: string; seats: Seat[] }[] }[];
  activeHold: { id: string; expiresAt: string } | null;
  maxSeatsPerHold: number;
  serverTime: string;
}

export interface SeatChangeMessage {
  eventId: string;
  seats: { id: string; status: SeatStatus; version: number }[];
}

export interface Hold {
  id: string;
  eventId: string;
  status: 'ACTIVE' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  serverTime: string;
  items: {
    eventSeatingId: string;
    seatLabel: string;
    section: string;
    ticketType: string;
    unitPriceMinor: number;
  }[];
  totalMinor: number;
  currency: string;
  bookingId: string | null;
}

export interface Booking {
  id: string;
  reference: string;
  accessCode: string;
  email: string;
  status: string;
  event: {
    slug: string;
    title: string;
    posterUrl: string | null;
    startAt: string | null;
    venue: string | null;
    city: string | null;
  };
  items: { seatLabel: string; section: string; ticketType: string; unitPriceMinor: number }[];
  totalMinor: number;
  currency: string;
  confirmedAt: string | null;
  /** Only returned to the device that booked; never by email + code lookup. */
  cancelCode?: string;
  refundMinor?: number;
}
