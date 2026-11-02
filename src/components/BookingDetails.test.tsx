import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderRoute } from '@/test/utils';
import type { Booking } from '@/types/api';
import { BookingDetails } from './BookingDetails';

// jsdom has no canvas; the QR library itself is not under test here.
const toDataURL = vi.hoisted(() => vi.fn(async (_token: string) => 'data:image/png;base64,QR'));
vi.mock('qrcode', () => ({ default: { toDataURL } }));

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
    venue: null,
    city: null,
  },
  items: [{ seatLabel: 'A1', section: 'Hall', ticketType: 'VIP', unitPriceMinor: 1 }],
  totalMinor: 1,
  currency: 'VND',
  confirmedAt: '2026-10-24T10:00:00Z',
  ticketToken: 'NHIP1.BK-ABCD-EFGH.10.1.sig',
};

describe('BookingDetails ticket QR', () => {
  afterEach(() => toDataURL.mockClear());

  it('draws the server token as a QR with a save button for a confirmed booking', async () => {
    renderRoute(<BookingDetails booking={booking} />);
    const img = await screen.findByAltText('Entry ticket QR code for booking BK-ABCD-EFGH');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,QR');
    expect(toDataURL.mock.calls[0]![0]).toBe('NHIP1.BK-ABCD-EFGH.10.1.sig');
    const save = screen.getByRole('link', { name: 'Save ticket image' });
    expect(save).toHaveAttribute('download', 'nhip-ticket-BK-ABCD-EFGH.png');
  });

  it('shows no QR without a token or once cancelled', () => {
    const { unmount } = renderRoute(<BookingDetails booking={{ ...booking, ticketToken: null }} />);
    expect(screen.queryByText('Your ticket')).toBeNull();
    unmount();
    renderRoute(<BookingDetails booking={{ ...booking, status: 'CANCELLED' }} />);
    expect(screen.queryByText('Your ticket')).toBeNull();
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it('says when and by whom the ticket was scanned at the door', () => {
    renderRoute(
      <BookingDetails
        booking={{ ...booking, checkedInAt: '2026-11-10T12:02:00Z', checkedInBy: 'staff1' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Checked in\s*Scanned by staff1 at/);
  });

  it('shows no check-in note before the ticket is scanned', () => {
    renderRoute(<BookingDetails booking={booking} />);
    expect(screen.queryByText('Checked in')).toBeNull();
  });
});
