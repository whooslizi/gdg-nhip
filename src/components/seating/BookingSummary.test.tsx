import { act, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderRoute } from '@/test/utils';
import type { Hold } from '@/types/api';
import { BookingSummary } from './BookingSummary';

const baseHold = (expiresInMs: number): Hold => {
  const now = Date.now();
  return {
    id: 'h1',
    eventId: 'e1',
    status: 'ACTIVE',
    expiresAt: new Date(now + expiresInMs).toISOString(),
    serverTime: new Date(now).toISOString(),
    items: [
      {
        eventSeatingId: 'a1',
        seatLabel: 'A1',
        section: 'Floor',
        ticketType: 'Premium',
        unitPriceMinor: 250000,
      },
    ],
    totalMinor: 250000,
    currency: 'VND',
    bookingId: null,
  };
};

describe('BookingSummary', () => {
  afterEach(() => vi.useRealTimers());

  it('shows selected seats and the estimated total', () => {
    renderRoute(
      <BookingSummary
        mode="select"
        seats={[
          { id: '1', seatLabel: 'A1', tierName: 'Premium', priceMinor: 250000 },
          { id: '2', seatLabel: 'B1', tierName: 'Standard', priceMinor: 150000 },
        ]}
        currency="VND"
        canReserve
        reserving={false}
        onReserve={() => undefined}
        message={null}
      />,
    );
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByTestId('total')).toHaveTextContent(/400[.,]000/);
    expect(screen.getByRole('button', { name: 'Reserve seats' })).toBeEnabled();
  });

  it('counts down and reports expiry', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const onExpire = vi.fn();
    renderRoute(
      <BookingSummary
        mode="hold"
        hold={baseHold(65_000)}
        confirming={false}
        releasing={false}
        onConfirm={() => undefined}
        onRelease={() => undefined}
        onExpire={onExpire}
        message={null}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('1:05');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:55');
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(56_000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
