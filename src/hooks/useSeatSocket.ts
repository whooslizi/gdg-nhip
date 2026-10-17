import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/api-client';
import type { SeatChangeMessage, SeatMap } from '@/types/api';

/** Patches the cached seat map from socket hints; stale versions are ignored and REST is re-fetched on reconnect. */
export function useSeatSocket(
  eventId: string | undefined,
  onChange?: (msg: SeatChangeMessage) => void,
) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!eventId || !SOCKET_URL) return;
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    const key = ['seat-map', eventId];

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('event:subscribe', { eventId });
      queryClient.invalidateQueries({ queryKey: key });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('seat:availability-changed', (msg: SeatChangeMessage) => {
      if (msg.eventId !== eventId) return;
      const changes = new Map(msg.seats.map((s) => [s.id, s]));
      queryClient.setQueryData<SeatMap>(
        key,
        (map) =>
          map && {
            ...map,
            sections: map.sections.map((section) => ({
              ...section,
              rows: section.rows.map((row) => ({
                ...row,
                seats: row.seats.map((seat) => {
                  const change = changes.get(seat.id);
                  if (!change || change.version <= seat.version) return seat;
                  // Ownership flags come from REST; a notification never grants "mine".
                  return {
                    ...seat,
                    status: change.status,
                    version: change.version,
                    heldByMe: seat.heldByMe && change.status === 'HELD',
                  };
                }),
              })),
            })),
          },
      );
      onChangeRef.current?.(msg);
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, queryClient]);

  // null: no live server to connect to (frontend-only build).
  return SOCKET_URL ? connected : null;
}
