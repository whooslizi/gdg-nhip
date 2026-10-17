import { api } from '@/lib/api-client';
import type { Category, EventDetail, EventSummary, Page, SeatMap } from '@/types/api';

export interface EventQuery {
  search?: string;
  category?: string;
  page?: number;
}

export function listEvents(query: EventQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: '12' });
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, String(value));
  return api<Page<EventSummary>>(`/events?${params}`, { signal });
}

export const listFeaturedEvents = (signal?: AbortSignal) =>
  api<{ items: EventSummary[] }>('/events/featured', { signal }).then((r) => r.items);

export const getEvent = (slug: string, signal?: AbortSignal) =>
  api<EventDetail>(`/events/${encodeURIComponent(slug)}`, { signal });

export const listCategories = (signal?: AbortSignal) =>
  api<{ items: Category[] }>('/categories', { signal }).then((r) => r.items);

export const getSeatMap = (eventId: string, signal?: AbortSignal) =>
  api<SeatMap>(`/events/${eventId}/seats`, { signal });
