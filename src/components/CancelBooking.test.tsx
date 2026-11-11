import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { renderRoute } from '@/test/utils';
import type { Booking } from '@/types/api';
import { CancelBooking } from './CancelBooking';

const cancelBooking = vi.hoisted(() => vi.fn());
vi.mock('@/services/booking', () => ({ cancelBooking }));

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
    startAt: null,
    endAt: null,
    venue: null,
    city: null,
  },
  items: [],
  totalMinor: 0,
  currency: 'VND',
  confirmedAt: null,
};

describe('CancelBooking', () => {
  afterEach(() => cancelBooking.mockReset());

  it('sends the cancel code, never the email', async () => {
    cancelBooking.mockResolvedValue({ ...booking, status: 'CANCELLED' });
    renderRoute(<CancelBooking booking={booking} />);
    await userEvent.type(screen.getByLabelText('Cancellation code'), 'abcd-2345');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(cancelBooking).toHaveBeenCalledWith('BK-ABCD-EFGH', 'ABCD-2345', null);
    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument();
  });

  it('prefills the code saved on the booking device', async () => {
    cancelBooking.mockResolvedValue({ ...booking, status: 'CANCELLED' });
    renderRoute(<CancelBooking booking={{ ...booking, cancelCode: 'WXYZ-6789' }} />);
    expect(screen.getByLabelText('Cancellation code')).toHaveValue('WXYZ-6789');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(cancelBooking).toHaveBeenCalledWith('BK-ABCD-EFGH', 'WXYZ-6789', null);
  });

  it('explains wrong codes and bookings that only organisers can cancel', async () => {
    cancelBooking.mockRejectedValueOnce(new ApiError(403, 'INVALID_CANCEL_CODE', 'Wrong'));
    renderRoute(<CancelBooking booking={booking} />);
    await userEvent.type(screen.getByLabelText('Cancellation code'), 'AAAA-AAAA');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That cancellation code is wrong.');

    cancelBooking.mockRejectedValueOnce(new ApiError(403, 'CANCEL_NOT_AVAILABLE', 'No'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('contact the organisers');
  });
});
