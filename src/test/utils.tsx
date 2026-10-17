import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { EventSummary, SeatMap } from '@/types/api';

export function renderRoute(
  element: ReactNode,
  { path = '/', url }: { path?: string; url?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>other route</p> },
    ],
    { initialEntries: [url ?? path] },
  );
  return {
    router,
    ...render(
      <QueryClientProvider client={client}>
        <I18nProvider locale="en">
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryClientProvider>,
    ),
  };
}

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined;

export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const res = handler(url, init) ?? {
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'not mocked' } },
    };
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export const event = (overrides: Partial<EventSummary> = {}): EventSummary => ({
  id: 'e1',
  slug: 'bloom',
  title: 'GDG-HUST 20/10 Concert: Bloom with Us',
  summary: 'A campus concert',
  posterUrl: null,
  organizer: { name: 'GDG-HUST', slug: 'gdg-hust' },
  categories: [{ slug: 'music-concerts', nameEn: 'Music & Concerts', nameVi: 'Âm nhạc' }],
  startAt: null,
  venue: null,
  city: null,
  bookingState: 'OPEN',
  ...overrides,
});

const seat = (
  row: string,
  n: number,
  status: SeatMap['sections'][0]['rows'][0]['seats'][0]['status'] = 'AVAILABLE',
) => ({
  id: `${row}${n}-id`,
  seatLabel: `${row}${n}`,
  rowLabel: row,
  seatNumber: n,
  ticketTypeId: row === 'A' ? 'premium' : 'standard',
  priceMinor: row === 'A' ? 250000 : 150000,
  status,
  heldByMe: false,
  version: 1,
});

export const seatMap = (): SeatMap => ({
  eventId: 'e1',
  eventSlug: 'bloom',
  eventTitle: 'Bloom',
  bookingState: 'OPEN',
  venue: { name: 'Sample Auditorium' },
  ticketTypes: [
    { id: 'premium', name: 'Premium', priceMinor: 250000, currency: 'VND' },
    { id: 'standard', name: 'Standard', priceMinor: 150000, currency: 'VND' },
  ],
  sections: [
    {
      id: 's1',
      name: 'Floor',
      rows: [
        { label: 'A', seats: [seat('A', 1), seat('A', 2), seat('A', 3, 'HELD')] },
        { label: 'B', seats: [seat('B', 1), seat('B', 2, 'SOLD'), seat('B', 3, 'BLOCKED')] },
      ],
    },
  ],
  activeHold: null,
  maxSeatsPerHold: 8,
  serverTime: new Date().toISOString(),
});
