import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mockFetch, renderRoute, seatMap } from '@/test/utils';
import type { Hold } from '@/types/api';
import { SeatSelectionPage } from './SeatSelectionPage';

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));

const detail = { id: 'e1', slug: 'bloom', title: 'Bloom', bookingState: 'OPEN' };

const hold = (overrides: Partial<Hold> = {}): Hold => ({
  id: 'h1',
  eventId: 'e1',
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  serverTime: new Date().toISOString(),
  items: [
    {
      eventSeatingId: 'A1-id',
      seatLabel: 'A1',
      section: 'Floor',
      ticketType: 'Premium',
      unitPriceMinor: 250000,
    },
  ],
  totalMinor: 250000,
  currency: 'VND',
  bookingId: null,
  ...overrides,
});

const desktop = () => screen.getByRole('complementary');
const seat = (label: string) => screen.getByRole('button', { name: new RegExp(`^Seat ${label},`) });
const renderPage = () =>
  renderRoute(<SeatSelectionPage />, { path: '/events/:slug/seats', url: '/events/bloom/seats' });

function api(
  extra: (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined,
) {
  let map = seatMap();
  return {
    setMap: (m: typeof map) => (map = m),
    fetch: mockFetch((url, init) => {
      if (url.pathname.endsWith('/events/bloom')) return { body: detail };
      if (url.pathname.endsWith('/events/e1/seats')) return { body: map };
      return extra(url, init);
    }),
  };
}

describe('SeatSelectionPage', () => {
  it('reserves the selection and shows the server-confirmed hold with a countdown', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/events/e1/holds') && init.method === 'POST')
        return { status: 201, body: hold() };
      if (url.pathname.endsWith('/holds/h1')) return { body: hold() };
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    expect(within(desktop()).getByTestId('total')).toHaveTextContent(/250[.,]000/);

    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(await within(desktop()).findByText('Seats reserved')).toBeInTheDocument();
    expect(within(desktop()).getByRole('timer')).toHaveTextContent(/^[45]:\d\d$/);

    const post = server.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    // Only seat ids are sent — never prices or totals.
    expect(JSON.parse(String(post![1]!.body))).toEqual({ seatIds: ['A1-id'] });
  });

  it('confirms the hold with the buyer email and opens the booking', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/holds/h1/confirm')) return { status: 201, body: { id: 'b1' } };
      if (url.pathname.endsWith('/holds/h1')) return { body: hold() };
      if (url.pathname.endsWith('/events/e1/holds') && init.method === 'POST')
        return { status: 201, body: hold() };
    });
    const { router } = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    await userEvent.type(
      await within(desktop()).findByLabelText('Email for your tickets'),
      'ada@example.test',
    );
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/booking/b1'));
    const confirm = server.fetch.mock.calls.find(([u]) => String(u).endsWith('/confirm'));
    expect(JSON.parse(String(confirm![1]!.body))).toEqual({ email: 'ada@example.test' });
  });

  it('drops seats the server reports as taken and explains the conflict', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/events/e1/holds') && init.method === 'POST') {
        const taken = seatMap();
        taken.sections[0]!.rows[0]!.seats[0]!.status = 'HELD';
        server.setMap(taken);
        return {
          status: 409,
          body: {
            error: { code: 'SEATS_UNAVAILABLE', message: 'taken', details: { seatIds: ['A1-id'] } },
          },
        };
      }
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(seat('B1'));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));

    expect(await within(desktop()).findByRole('alert')).toHaveTextContent(/taken by someone else/);
    await waitFor(() => expect(seat('A1')).toHaveAccessibleName(/On hold/));
    expect(within(desktop()).getByTestId('total')).toHaveTextContent(/150[.,]000/);
  });

  it('tells the user when a resumed hold has expired', async () => {
    const server = api((url) => {
      if (url.pathname.endsWith('/holds/h1')) return { body: hold({ status: 'EXPIRED' }) };
    });
    server.setMap({ ...seatMap(), activeHold: { id: 'h1', expiresAt: new Date().toISOString() } });
    renderPage();
    const aside = await screen.findByRole('complementary');
    expect(await within(aside).findByRole('alert')).toHaveTextContent(/hold expired/);
    expect(within(desktop()).getByRole('button', { name: 'Reserve seats' })).toBeInTheDocument();
  });

  it('shows a retryable error when the seat map fails to load', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/events/bloom')) return { body: detail };
      if (url.pathname.endsWith('/events/e1/seats'))
        return { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } };
    });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
