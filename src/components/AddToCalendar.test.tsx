import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderRoute } from '@/test/utils';
import type { Booking } from '@/types/api';
import { AddToCalendar } from './AddToCalendar';

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
    startAt: '2026-11-10T12:00:00Z',
    endAt: null,
    venue: 'Cinema · Room 1',
    city: 'Hà Nội',
  },
  items: [{ seatLabel: 'A1', section: 'Cinema · Room 1', ticketType: 'VIP', unitPriceMinor: 1 }],
  totalMinor: 1,
  currency: 'VND',
  confirmedAt: '2026-10-24T10:00:00Z',
};

describe('AddToCalendar', () => {
  it('downloads an .ics file and links to Google Calendar for a confirmed booking', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:nhip');
    // jsdom has no object URLs.
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    renderRoute(<AddToCalendar booking={booking} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add to calendar (.ics)' }));
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/calendar;charset=utf-8');
    const ics = (await blob.text()).replace(/\r\n /g, '');
    expect(ics).toContain('DTEND:20261110T140000Z'); // no endAt: start + 2 h
    expect(ics).toContain('LOCATION:Cinema · Room 1\\, Hà Nội');
    expect(ics).not.toContain('buyer@example.test');

    const google = screen.getByRole('link', { name: 'Google Calendar' });
    expect(google).toHaveAttribute('target', '_blank');
    expect(google.getAttribute('href')).toContain('action=TEMPLATE');
  });

  it('renders nothing when the booking is cancelled or has no start time', () => {
    const { unmount } = renderRoute(
      <AddToCalendar booking={{ ...booking, status: 'CANCELLED' }} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    renderRoute(
      <AddToCalendar booking={{ ...booking, event: { ...booking.event, startAt: null } }} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
