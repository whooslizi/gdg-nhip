import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mockFetch, renderRoute, seatMap } from '@/test/utils';
import { SeatSelectionPage } from './SeatSelectionPage';

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));

const restEvent = {
  eventid: 1,
  eventname: 'Bloom',
  directors: ['GDG-HUST'],
  actors: [],
  types: [],
  languages: [],
  poster: null,
  duration: 120,
  startat: '2026-10-20',
  endat: '2026-10-20',
};
const restShowtime = {
  showtimeid: 10,
  startat: '2026-10-20T18:30:00Z',
  endat: '2026-10-20T20:30:00Z',
  status: 'active',
};
const secondRestShowtime = {
  ...restShowtime,
  showtimeid: 11,
  startat: '2026-10-26T18:30:00Z',
  endat: '2026-10-26T20:30:00Z',
};
const desktop = () => screen.getByRole('complementary');
const admitted = (expiresAt = new Date(Date.now() + 600_000).toISOString()) => ({
  result: 'admitted',
  ahead: 0,
  expiresAt,
  serverTime: new Date().toISOString(),
});
let admission = admitted();
const queueReply = (url: URL) =>
  /\/queue\/(join|heartbeat)$/.test(url.pathname)
    ? { body: { success: true, data: admission } }
    : url.pathname.endsWith('/queue/gate')
      ? { body: { success: true, data: { passed: true } } }
      : undefined;

const renderPage = () =>
  renderRoute(<SeatSelectionPage />, { path: '/events/:slug/seats', url: '/events/bloom/seats' });

// Most tests start on the seat map: get through the queue (admitted at once) and skip the reading time.
async function renderMap() {
  renderPage();
  const open = await screen.findByRole('button', { name: 'Open now' });
  await waitFor(() => expect(open).toBeEnabled()); // after the gate check
  await userEvent.click(open);
}

function api(extra: (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined) {
  const map = seatMap();
  return {
    fetch: mockFetch((url, init) => {
      if (url.pathname.endsWith('/events')) return { body: [restEvent] };
      if (url.pathname.endsWith('/events/1')) return { body: restEvent };
      if (url.pathname.endsWith('/events/1/showtimes'))
        return { body: { eventId: 1, showtimes: [restShowtime, secondRestShowtime] } };
      if (/\/showtimes\/(10|11)\/seats$/.test(url.pathname)) {
        const showtimeId = Number(url.pathname.split('/')[3]);
        const seats = map.sections.flatMap((section) =>
          section.rows.flatMap((row) => row.seats),
        );
        return {
          body: {
            eventId: 1,
            showtimeId: 10,
            roomId: 1,
            seats: seats.map((item, index) => ({
              seatId: index + 1,
              rowLabel: item.rowLabel,
              seatNumber: item.seatNumber,
              seatType: item.ticketTypeId === 'premium' ? 'VIP' : 'standard',
              status: showtimeId === 11 && index === 0 ? 'booked' : item.status.toLowerCase(),
            })),
          },
        };
      }
      return extra(url, init) ?? queueReply(url);
    }),
  };
}

describe('SeatSelectionPage', () => {
  beforeEach(() => {
    admission = admitted();
  });

  it('holds selected backend seats and shows the server expiration', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return {
          status: 201,
          body: {
            holdToken: 'h1',
            showtimeId: 10,
            seatIds: [1],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
    });
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    expect(within(desktop()).getByTestId('total')).toHaveTextContent(/250[.,]000/);
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(await within(desktop()).findByText('Seats reserved')).toBeInTheDocument();
    expect(within(desktop()).getByRole('timer')).toHaveTextContent(/^[45]:\d\d$/);
    const post = server.fetch.mock.calls.find(([url]) => String(url).endsWith('/holds'));
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      showtimeId: 10,
      seatIds: [1],
      queueSessionId: expect.any(String),
    });
  });

  it('enables checkout using the agreed normal and VIP seat prices', async () => {
    api((url, init) => {
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return {
          status: 201,
          body: {
            holdToken: 'h1',
            showtimeId: 10,
            seatIds: [1, 4],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
    });
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Seat B1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(within(desktop()).getByRole('button', { name: 'Pay now' })).toBeEnabled();
    expect(within(desktop()).getByTestId('total')).toHaveTextContent(/400[.,]000/);
  });

  it('sends buyer details and the mapped total to the backend payment endpoint', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return {
          status: 201,
          body: {
            holdToken: 'hold-token',
            showtimeId: 10,
            seatIds: [1],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
      if (url.pathname.endsWith('/payments/mock'))
        return {
          body: {
            success: true,
            message: 'Payment successful',
            data: {
              paymentId: 12,
              bookingId: 'BK-ABCD-EFGH',
              bookingDbId: 3,
              bookingToken: 'booking-token',
            },
          },
        };
      if (url.pathname.endsWith('/bookings/BK-ABCD-EFGH'))
        return {
          body: {
            success: true,
            data: {
              id: 'BK-ABCD-EFGH',
              reference: 'BK-ABCD-EFGH',
              accessCode: '',
              email: 'ada@example.test',
              status: 'CONFIRMED',
              event: {
                slug: 'bloom',
                title: 'Bloom',
                posterUrl: null,
                startAt: restShowtime.startat,
                venue: 'Cinema · Room 1',
                city: null,
              },
              items: [{ seatLabel: 'A1', section: 'Cinema · Room 1', ticketType: 'VIP', unitPriceMinor: 250_000 }],
              totalMinor: 250_000,
              currency: 'VND',
              confirmedAt: new Date().toISOString(),
            },
          },
        };
    });
    const { router } = renderPage();
    const open = await screen.findByRole('button', { name: 'Open now' });
    await waitFor(() => expect(open).toBeEnabled());
    await userEvent.click(open);
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    await userEvent.type(await within(desktop()).findByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(within(desktop()).getByLabelText('Phone number'), '0123456789');
    await userEvent.type(within(desktop()).getByLabelText('Email for your tickets'), 'ada@example.test');
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Pay now' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/booking/BK-ABCD-EFGH'));
    const paymentRequest = server.fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/payments/mock'),
    );
    expect(JSON.parse(String(paymentRequest![1]!.body))).toEqual({
      holdToken: 'hold-token',
      userName: 'Ada Lovelace',
      userPhone: '0123456789',
      userEmail: 'ada@example.test',
      price: 250_000,
      result: 'success',
    });
  });

  it('loads a separate seat map when another showtime is selected', async () => {
    const server = api(() => undefined);
    await renderMap();
    await userEvent.selectOptions(await screen.findByLabelText('Showtime'), '11');
    expect(await screen.findByRole('button', { name: /^Seat A1,.*Sold/ })).toBeInTheDocument();
    expect(
      server.fetch.mock.calls.some(([url]) => String(url).endsWith('/showtimes/11/seats')),
    ).toBe(true);
  });

  it('shows a backend hold conflict', async () => {
    api((url, init) => {
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return { status: 409, body: { success: false, message: 'Some seats are unavailable' } };
    });
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(await within(desktop()).findByRole('alert')).toHaveTextContent(/unavailable/);
  });

  it('releases a hold through the backend cancel route', async () => {
    const server = api((url, init) => {
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return {
          status: 201,
          body: {
            holdToken: 'h1',
            showtimeId: 10,
            seatIds: [1],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
      if (url.pathname.endsWith('/holds/cancel')) return { body: { success: true } };
    });
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    await userEvent.click(await within(desktop()).findByRole('button', { name: 'Release seats' }));
    expect(await within(desktop()).findByRole('button', { name: 'Reserve seats' })).toBeInTheDocument();
    expect(server.fetch.mock.calls.some(([url]) => String(url).endsWith('/holds/cancel'))).toBe(true);
  });

  it('shows how many people are ahead while waiting in the queue', async () => {
    const server = api((url) =>
      /\/queue\/(join|heartbeat)$/.test(url.pathname)
        ? {
            body: {
              success: true,
              data: { result: 'waiting', ahead: 3, expiresAt: null, serverTime: new Date().toISOString() },
            },
          }
        : undefined,
    );
    renderPage();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('ahead of you in line')).toBeInTheDocument();
    expect(screen.getByText(/A seat is only yours once Reserve succeeds/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open now' })).toBeNull();
    const join = server.fetch.mock.calls.find(([url]) => String(url).endsWith('/queue/join'));
    expect(JSON.parse(String(join![1]!.body))).toMatchObject({ eventId: 1 });
    expect(screen.queryByRole('button', { name: /^Seat A1,/ })).toBeNull();
  });

  it('gives an admitted guest reading time, with a button to open the map at once', async () => {
    api(() => undefined);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'It’s your turn' })).toBeInTheDocument();
    expect(screen.getByText(/opens in (10|[1-9]) s/)).toBeInTheDocument();
    const open = screen.getByRole('button', { name: 'Open now' });
    await waitFor(() => expect(open).toBeEnabled());
    await userEvent.click(open);
    expect(await screen.findByRole('button', { name: /^Seat A1,/ })).toBeInTheDocument();
    expect(screen.getByText(/^Time left: (10:00|9:\d\d)$/)).toBeInTheDocument();
  });

  it('opens the map by itself after the 10 seconds of reading time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api(() => undefined);
      renderPage();
      expect(await screen.findByRole('heading', { name: 'It’s your turn' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(9_000));
      expect(screen.queryByRole('button', { name: /^Seat A1,/ })).toBeNull();
      act(() => vi.advanceTimersByTime(1_500));
      expect(await screen.findByRole('button', { name: /^Seat A1,/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the guest back to the queue after 10 minutes', async () => {
    admission = admitted(new Date(Date.now() - 1000).toISOString());
    api((url) => {
      if (url.pathname.endsWith('/queue/join') && screen.queryByRole('heading', { name: 'Time’s up' }))
        admission = admitted();
      return undefined;
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Time’s up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Seat A1,/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Join the queue again' }));
    expect(await screen.findByRole('heading', { name: 'It’s your turn' })).toBeInTheDocument();
  });

  it('keeps the gate shut until the human check passes, and sends the queue session with holds', async () => {
    let gateOpen = false;
    const server = api((url, init) => {
      if (url.pathname.endsWith('/queue/gate'))
        return gateOpen
          ? { body: { success: true, data: { passed: true } } }
          : { status: 403, body: { success: false, code: 'CAPTCHA_FAILED', message: 'no' } };
      if (url.pathname.endsWith('/holds') && init.method === 'POST')
        return {
          status: 201,
          body: {
            holdToken: 'h1',
            showtimeId: 10,
            seatIds: [1],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not verify you are human');
    expect(screen.queryByRole('button', { name: 'Open now' })).toBeNull();

    gateOpen = true;
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    const open = await screen.findByRole('button', { name: 'Open now' });
    await waitFor(() => expect(open).toBeEnabled());
    await userEvent.click(open);
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(await within(desktop()).findByText('Seats reserved')).toBeInTheDocument();

    const body = (path: string) =>
      JSON.parse(String(server.fetch.mock.calls.find(([url]) => String(url).endsWith(path))![1]!.body));
    expect(body('/holds').queueSessionId).toBe(body('/queue/gate').sessionId);
  });

  it('gives the place in line back when the guest leaves the page', async () => {
    const server = api(() => undefined);
    const { unmount } = renderPage();
    expect(await screen.findByRole('heading', { name: 'It’s your turn' })).toBeInTheDocument();
    unmount();
    const body = (path: string) =>
      JSON.parse(String(server.fetch.mock.calls.find(([url]) => String(url).endsWith(path))![1]!.body));
    expect(body('/queue/leave').sessionId).toBe(body('/queue/join').sessionId);
  });

  it('lets a logged-in admin skip the queue and hold through the admin route', async () => {
    sessionStorage.setItem('nhip-admin-session', 'admin-token');
    try {
      const server = api((url, init) => {
        if (url.pathname.endsWith('/admin/session'))
          return { body: { success: true, data: { username: 'admin', expiresAt: 0 } } };
        if (url.pathname.endsWith('/admin/holds') && init.method === 'POST')
          return {
            status: 201,
            body: {
              holdToken: 'h1',
              showtimeId: 10,
              seatIds: [1],
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            },
          };
      });
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
      expect(screen.getByText('Admin mode: no queue, no seat limit')).toBeInTheDocument();
      await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
      expect(await within(desktop()).findByText('Seats reserved')).toBeInTheDocument();

      const calls = server.fetch.mock.calls.map(([url]) => String(url));
      expect(calls.some((url) => url.includes('/queue/'))).toBe(false);
      expect(calls.some((url) => url.endsWith('/api/holds'))).toBe(false);
      const hold = server.fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/holds'));
      expect(new Headers(hold![1]!.headers).get('Authorization')).toBe('Bearer admin-token');
    } finally {
      sessionStorage.removeItem('nhip-admin-session');
    }
  });

  it('shows a retryable error when the backend seat map fails', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/events')) return { body: [restEvent] };
      if (url.pathname.endsWith('/events/1')) return { body: restEvent };
      if (url.pathname.endsWith('/events/1/showtimes'))
        return { body: { eventId: 1, showtimes: [restShowtime] } };
      if (url.pathname.endsWith('/showtimes/10/seats'))
        return { status: 500, body: { success: false, message: 'boom' } };
    });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
