import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { useWaitingRoom } from './useWaitingRoom';

type FakeSocket = {
  handlers: Record<string, (payload?: unknown) => void>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  socketUrl: 'http://localhost:3001' as string | undefined,
  sockets: [] as FakeSocket[],
  heartbeat: vi.fn(),
}));

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original<object>()),
  get SOCKET_URL() {
    return mocks.socketUrl;
  },
}));

vi.mock('socket.io-client', () => ({
  io: () => {
    const socket: FakeSocket & { on: (event: string, fn: () => void) => unknown } = {
      handlers: {},
      emit: vi.fn(),
      disconnect: vi.fn(),
      on: (event, fn) => {
        socket.handlers[event] = fn;
        return socket;
      },
    };
    mocks.sockets.push(socket);
    return socket;
  },
}));

const waiting = (ahead: number) => ({
  result: 'waiting' as const,
  ahead,
  expiresAt: null,
  serverTime: new Date().toISOString(),
  localExpiresAt: null,
});

vi.mock('@/services/events', async (original) => ({
  ...(await original<object>()),
  joinQueue: async () => waiting(3),
  queueHeartbeat: (...args: unknown[]) => mocks.heartbeat(...args),
  leaveQueue: async () => {},
}));

function renderRoom() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useWaitingRoom('1'), { wrapper });
  act(() => {
    hook.result.current.join(null);
  });
  return hook;
}

describe('useWaitingRoom', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.sockets.length = 0;
    mocks.heartbeat.mockReset().mockResolvedValue(waiting(3));
  });
  afterEach(() => {
    vi.useRealTimers();
    mocks.socketUrl = 'http://localhost:3001';
  });

  it('keeps polling over HTTP when no socket server is configured', async () => {
    mocks.socketUrl = undefined;
    const { result } = renderRoom();
    await waitFor(() => expect(result.current.status?.ahead).toBe(3));
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(mocks.heartbeat.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.sockets).toHaveLength(0);
  });

  it('stops polling while the socket is connected and polls again when it drops', async () => {
    const { result } = renderRoom();
    await waitFor(() => expect(mocks.sockets).toHaveLength(1));
    const socket = mocks.sockets[0]!;

    act(() => socket.handlers.connect!());
    expect(socket.emit).toHaveBeenCalledWith('queue:subscribe', {
      eventId: 1,
      sessionId: result.current.sessionId,
    });

    mocks.heartbeat.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(11_000));
    expect(mocks.heartbeat).not.toHaveBeenCalled();

    act(() => socket.handlers['queue:status']!(waiting(1)));
    await waitFor(() => expect(result.current.status?.ahead).toBe(1));
    expect(result.current.status?.localExpiresAt).toBeNull();

    act(() => socket.handlers.disconnect!());
    await act(() => vi.advanceTimersByTimeAsync(6_000));
    expect(mocks.heartbeat).toHaveBeenCalled();
  });
});
