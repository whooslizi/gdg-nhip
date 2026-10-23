import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch, renderRoute } from '@/test/utils';
import type { Booking } from '@/types/api';
import { MyBookingsPage } from './MyBookingsPage';

const booking: Booking = {
  id: 'BK-ABCD-EFGH',
  reference: 'BK-ABCD-EFGH',
  accessCode: '',
  email: 'buyer@example.test',
  status: 'CONFIRMED',
  event: {
    slug: 'bloom',
    title: 'Bloom',
    posterUrl: null,
    startAt: '2026-11-01T10:00:00Z',
    venue: 'Cinema · Room 1',
    city: null,
  },
  items: [{ seatLabel: 'A1', section: 'Cinema · Room 1', ticketType: 'VIP', unitPriceMinor: 250_000 }],
  totalMinor: 250_000,
  currency: 'VND',
  confirmedAt: '2026-10-24T10:00:00Z',
};

const renderLookupPage = (url = '/my-bookings') =>
  renderRoute(<MyBookingsPage />, { path: '/my-bookings', url });

describe('MyBookingsPage live API', () => {
  beforeEach(() => localStorage.clear());

  it('prefills the booking ID when arriving from a different device', () => {
    renderLookupPage('/my-bookings?bookingId=BK-ABCD-EFGH');
    expect(screen.getByLabelText('Booking ID')).toHaveValue('BK-ABCD-EFGH');
    expect(screen.getByLabelText('Email')).toBeRequired();
  });

  it('looks up and cancels a booking by booking ID and checkout email', async () => {
    let currentBooking = booking;
    const fetch = mockFetch((url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      if (url.pathname.endsWith('/bookings/lookup')) {
        return { body: { success: true, data: currentBooking } };
      }
      if (url.pathname.endsWith('/bookings/BK-ABCD-EFGH/cancel') && init.method === 'POST') {
        currentBooking = { ...currentBooking, status: 'CANCELLED', refundMinor: 250_000 };
        return { body: { success: true, data: currentBooking } };
      }
      if (url.pathname.endsWith('/bookings/BK-ABCD-EFGH')) {
        expect(url.searchParams.get('email')).toBe('buyer@example.test');
        return { body: { success: true, data: currentBooking } };
      }
      if (url.pathname.endsWith('/bookings')) return { body: { items: [] } };
      return { status: 404, body: { success: false, message: 'not mocked', details: body } };
    });
    renderLookupPage();

    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.test');
    await userEvent.type(screen.getByLabelText('Booking ID'), 'BK-ABCD-EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByTestId('booking-reference')).toHaveTextContent('BK-ABCD-EFGH');
    expect(await screen.findByRole('heading', { name: 'Booked on this device' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Bloom.*BK-ABCD-EFGH/ })).toHaveAttribute(
      'href',
      '/booking/BK-ABCD-EFGH',
    );
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/bookings/lookup'),
    )?.[1]?.body))).toEqual({ email: 'buyer@example.test', bookingId: 'BK-ABCD-EFGH' });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByRole('heading', { name: 'Booking cancelled', level: 1 })).toBeInTheDocument();
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/bookings/BK-ABCD-EFGH/cancel'),
    )?.[1]?.body))).toEqual({ email: 'buyer@example.test' });
  });
});
