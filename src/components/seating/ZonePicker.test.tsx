import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderRoute } from '@/test/utils';
import type { Seat, SeatMap } from '@/types/api';
import { ZonePicker } from './ZonePicker';

const seat = (id: string, zone: string, status: Seat['status'] = 'AVAILABLE'): Seat => ({
  id,
  seatLabel: `${zone} · #${id}`,
  rowLabel: zone[0]!,
  seatNumber: Number(id),
  ticketTypeId: zone.toLowerCase(),
  priceMinor: zone === 'GOLD' ? 2_600_000 : 900_000,
  status,
  heldByMe: false,
  version: 1,
});

const map: SeatMap = {
  eventId: '5',
  eventSlug: 'tour',
  eventTitle: 'Tour',
  bookingState: 'OPEN',
  venue: null,
  layout: 'zones',
  ticketTypes: [
    { id: 'gold', name: 'GOLD', priceMinor: 2_600_000, currency: 'VND' },
    { id: 'bronze', name: 'BRONZE', priceMinor: 900_000, currency: 'VND' },
  ],
  sections: [
    {
      id: '1',
      name: 'Arena',
      rows: [
        { label: 'G', seats: [seat('1', 'GOLD'), seat('2', 'GOLD'), seat('3', 'GOLD', 'HELD')] },
        { label: 'B', seats: [seat('4', 'BRONZE', 'SOLD')] },
      ],
    },
  ],
  activeHold: null,
  maxSeatsPerHold: 8,
  serverTime: '2026-11-02T00:00:00Z',
};

describe('ZonePicker', () => {
  it('adds a free ticket from the zone and removes a chosen one', async () => {
    const onToggle = vi.fn();
    const { unmount } = renderRoute(
      <ZonePicker map={map} selected={new Set()} interactive onToggle={onToggle} />,
    );
    expect(screen.getByRole('button', { name: 'Remove one GOLD ticket' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add one GOLD ticket' }));
    // Only seats that are free: never the held one.
    expect(['1', '2']).toContain(onToggle.mock.calls[0]![0].id);
    unmount();

    onToggle.mockClear();
    renderRoute(<ZonePicker map={map} selected={new Set(['2'])} interactive onToggle={onToggle} />);
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove one GOLD ticket' }));
    expect(onToggle.mock.calls[0]![0].id).toBe('2');
  });

  it('shows a sold-out zone with no buttons, and how few are left', () => {
    renderRoute(<ZonePicker map={map} selected={new Set()} interactive onToggle={vi.fn()} />);
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add one BRONZE ticket' })).toBeNull();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('cannot add the last free ticket twice or while not interactive', () => {
    const { unmount } = renderRoute(
      <ZonePicker map={map} selected={new Set(['1', '2'])} interactive onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Add one GOLD ticket' })).toBeDisabled();
    unmount();
    renderRoute(
      <ZonePicker map={map} selected={new Set()} interactive={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Add one GOLD ticket' })).toBeDisabled();
  });
});
