import { screen, waitFor, within } from '@testing-library/react';
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
const renderPage = () =>
  renderRoute(<SeatSelectionPage />, { path: '/events/:slug/seats', url: '/events/bloom/seats' });

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
      return extra(url, init);
    }),
  };
}

describe('SeatSelectionPage', () => {
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
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    expect(within(desktop()).getByTestId('total')).toHaveTextContent(/250[.,]000/);
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    expect(await within(desktop()).findByText('Seats reserved')).toBeInTheDocument();
    expect(within(desktop()).getByRole('timer')).toHaveTextContent(/^[45]:\d\d$/);
    const post = server.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post![1]!.body))).toEqual({ showtimeId: 10, seatIds: [1] });
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
    renderPage();
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
    renderPage();
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
    renderPage();
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
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Seat A1,/ }));
    await userEvent.click(within(desktop()).getByRole('button', { name: 'Reserve seats' }));
    await userEvent.click(await within(desktop()).findByRole('button', { name: 'Release seats' }));
    expect(await within(desktop()).findByRole('button', { name: 'Reserve seats' })).toBeInTheDocument();
    expect(server.fetch.mock.calls.some(([url]) => String(url).endsWith('/holds/cancel'))).toBe(true);
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
