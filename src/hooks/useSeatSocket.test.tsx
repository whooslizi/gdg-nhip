import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { getSeatMap } from '@/services/events';
import { mockFetch } from '@/test/utils';
import type { SeatChangeMessage, SeatMap } from '@/types/api';
import { useSeatSocket } from './useSeatSocket';

const handlers = vi.hoisted(() => ({}) as Record<string, (payload?: unknown) => void>);

vi.mock('socket.io-client', () => ({
  io: () => {
    const socket = {
      on: (event: string, fn: (payload?: unknown) => void) => {
        handlers[event] = fn;
        return socket;
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    return socket;
  },
}));

const LOADED_AT = Date.parse('2026-11-15T10:00:00Z');
const key = ['seat-map', '1', '10'];

async function loadMap() {
  mockFetch((url) => {
    if (url.pathname.endsWith('/events/1'))
      return { body: { success: true, data: { eventid: 1, eventname: 'Bloom' } } };
    if (url.pathname.endsWith('/showtimes/10/seats'))
      return {
        body: {
          success: true,
          data: {
            eventId: 1,
            showtimeId: 10,
            roomId: 3,
            seats: [
              { seatId: 5, rowLabel: 'A', seatNumber: 1, seatType: 'standard', status: 'available' },
            ],
          },
        },
      };
  });
  const now = vi.spyOn(Date, 'now').mockReturnValue(LOADED_AT);
  try {
    return await getSeatMap('1', '10');
  } finally {
    now.mockRestore();
  }
}

function renderSocket(map: SeatMap) {
  const client = new QueryClient();
  client.setQueryData(key, map);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(() => useSeatSocket('1'), { wrapper });
  const seat = () => client.getQueryData<SeatMap>(key)!.sections[0]!.rows[0]!.seats[0]!;
  const send = (status: SeatChangeMessage['seats'][0]['status'], version: number) =>
    act(() =>
      handlers['seat:availability-changed']!({
        eventId: '1',
        showtimeId: '10',
        seats: [{ id: '5', status, version }],
      } satisfies SeatChangeMessage),
    );
  return { seat, send };
}

describe('useSeatSocket', () => {
  it('ignores socket messages older than the REST load and applies newer ones', async () => {
    const map = await loadMap();
    expect(map.sections[0]!.rows[0]!.seats[0]!.version).toBe(LOADED_AT);
    const { seat, send } = renderSocket(map);

    send('SOLD', LOADED_AT - 1);
    expect(seat().status).toBe('AVAILABLE');

    send('HELD', LOADED_AT + 1);
    expect(seat()).toMatchObject({ status: 'HELD', version: LOADED_AT + 1, heldByMe: false });
  });
});
