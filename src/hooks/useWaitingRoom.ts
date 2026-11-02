import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { joinQueue, leaveQueue, passGate, queueHeartbeat } from '@/services/events';
import type { QueueStatus } from '@/types/api';

/**
 * This visit's place in the event's waiting room. Leaving the page (or reloading it) gives the
 * place up, so coming back means queueing again. `left` is the time remaining on the seat map
 * once admitted (0 when it ran out, null before admission).
 */
export function useWaitingRoom(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const [sessionId] = useState(() => crypto.randomUUID());
  const key = ['queue', eventId, sessionId];
  const gate = useMutation({
    mutationFn: (turnstileToken: string | null) => passGate(eventId!, sessionId, turnstileToken),
  });
  const join = useMutation({
    mutationFn: (turnstileToken: string | null) => joinQueue(eventId!, sessionId, turnstileToken),
    onSuccess: (status) => {
      gate.reset(); // a new place in line has to pass the gate again
      queryClient.setQueryData(key, status);
    },
  });
  const status = useQuery<QueueStatus | undefined>({
    queryKey: key,
    queryFn: () => queueHeartbeat(eventId!, sessionId),
    enabled: false,
  }).data;
  const left = useCountdown(status?.localExpiresAt ?? null, null);
  const inQueue = !!status && status.result !== 'not_in_queue';

  // Waiting tabs check often so the line moves visibly; admitted tabs only keep their slot alive.
  useQuery({
    queryKey: [...key, 'heartbeat'],
    queryFn: async () => {
      const next = await queueHeartbeat(eventId!, sessionId);
      queryClient.setQueryData(key, next);
      return next;
    },
    enabled: !!eventId && inQueue && left !== 0,
    refetchInterval: status?.result === 'admitted' ? 15_000 : 5_000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  useEffect(() => {
    const leave = () => leaveQueue(sessionId);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [sessionId]);

  return {
    status,
    left,
    join: (turnstileToken: string | null) => eventId && join.mutate(turnstileToken),
    joining: join.isPending,
    joinError: join.error,
    passGate: (turnstileToken: string | null) => eventId && gate.mutate(turnstileToken),
    gatePassed: gate.isSuccess,
    gating: gate.isPending,
    gateError: gate.error,
    /** Sent with holds: the server only accepts seats from a visit that passed the gate. */
    sessionId,
  };
}
