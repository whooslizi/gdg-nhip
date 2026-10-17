import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { BookingSummary, type SelectedSeat } from '@/components/seating/BookingSummary';
import { SeatingMap } from '@/components/seating/SeatingMap';
import { SeatLegend } from '@/components/seating/SeatLegend';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useSeatSocket } from '@/hooks/useSeatSocket';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cancelHold, confirmHold, createHold, getHold } from '@/services/booking';
import { getEvent, getSeatMap } from '@/services/events';
import type { Seat, SeatChangeMessage, SeatMap } from '@/types/api';

export function SeatSelectionPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [holdId, setHoldId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['event', slug],
    queryFn: ({ signal }) => getEvent(slug, signal),
  });
  const eventId = eventQuery.data?.id;
  const mapKey = ['seat-map', eventId];
  const mapQuery = useQuery({
    queryKey: mapKey,
    queryFn: ({ signal }) => getSeatMap(eventId!, signal),
    enabled: !!eventId,
    refetchInterval: 30_000, // in case the socket is down
  });
  const map = mapQuery.data;

  const currentHoldId = holdId ?? map?.activeHold?.id ?? null;
  const holdQuery = useQuery({
    queryKey: ['hold', currentHoldId],
    queryFn: () => getHold(currentHoldId!),
    enabled: !!currentHoldId,
    refetchOnMount: 'always',
  });
  const hold = holdQuery.data?.id === currentHoldId ? holdQuery.data : undefined;
  const holdActive = hold?.status === 'ACTIVE';

  const seatsById = useMemo(() => {
    const m = new Map<string, Seat>();
    map?.sections.forEach((s) =>
      s.rows.forEach((r) => r.seats.forEach((seat) => m.set(seat.id, seat))),
    );
    return m;
  }, [map]);
  const tierName = useCallback(
    (id: string) => map?.ticketTypes.find((tt) => tt.id === id)?.name ?? '',
    [map],
  );
  const currency = map?.ticketTypes[0]?.currency ?? 'VND';

  const selectedSeats: SelectedSeat[] = [...selected]
    .map((id) => seatsById.get(id))
    .filter((s): s is Seat => !!s && s.status === 'AVAILABLE')
    .map((s) => ({
      id: s.id,
      seatLabel: s.seatLabel,
      tierName: tierName(s.ticketTypeId),
      priceMinor: s.priceMinor,
    }));

  const refreshMap = () => queryClient.invalidateQueries({ queryKey: mapKey });

  const reserve = useMutation({
    mutationFn: () =>
      createHold(
        eventId!,
        selectedSeats.map((s) => s.id),
      ),
    onSuccess: (newHold) => {
      queryClient.setQueryData(['hold', newHold.id], newHold);
      setHoldId(newHold.id);
      setSelected(new Set());
      setMessage(null);
      setSheetOpen(true);
      refreshMap();
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return setMessage(t('common.error'));
      if (error.code === 'SEATS_UNAVAILABLE') {
        const taken = new Set((error.details?.seatIds as string[] | undefined) ?? []);
        setSelected((prev) => new Set([...prev].filter((id) => !taken.has(id))));
        setMessage(t('seats.conflict'));
      } else if (error.code === 'HOLD_EXISTS') {
        setHoldId((error.details?.holdId as string | undefined) ?? null);
        setMessage(t('seats.holdExists'));
      } else if (error.code === 'BOOKING_NOT_OPEN') {
        setMessage(t('seats.notOpen'));
      } else {
        setMessage(error.message);
      }
      refreshMap();
    },
  });

  const onSeatChange = (msg: SeatChangeMessage) => {
    // Our own reservation broadcasts before its HTTP response arrives.
    if (reserve.isPending) return;
    const lost = msg.seats.filter((s) => s.status !== 'AVAILABLE' && selected.has(s.id));
    if (lost.length === 0) return;
    setSelected((prev) => new Set([...prev].filter((id) => !lost.some((l) => l.id === id))));
    setMessage(
      t('seats.taken', { seats: lost.map((l) => seatsById.get(l.id)?.seatLabel ?? '').join(', ') }),
    );
  };
  const live = useSeatSocket(eventId, onSeatChange);

  const confirm = useMutation({
    mutationFn: (email: string) => confirmHold(currentHoldId!, email),
    onSuccess: (booking) => {
      queryClient.setQueryData(['booking', booking.id], booking);
      navigate(`/booking/${booking.id}`);
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError && error.code === 'HOLD_EXPIRED'
          ? t('seats.expired')
          : error.message,
      );
      queryClient.invalidateQueries({ queryKey: ['hold', currentHoldId] });
      refreshMap();
    },
  });

  const release = useMutation({
    mutationFn: () => cancelHold(currentHoldId!),
    onSuccess: () => {
      // Otherwise the stale activeHold resumes the released hold until the refetch lands.
      queryClient.setQueryData<SeatMap>(mapKey, (m) => m && { ...m, activeHold: null });
      setHoldId(null);
      setMessage(null);
      refreshMap();
    },
    onError: (error) => setMessage(error.message),
  });

  const onExpire = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['hold', currentHoldId] });
    queryClient.invalidateQueries({ queryKey: ['seat-map', eventId] });
  }, [queryClient, currentHoldId, eventId]);

  const toggle = useCallback(
    (seat: Seat) => {
      setMessage(null);
      setHoldId(null); // forget an expired hold once the buyer starts over
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(seat.id)) next.delete(seat.id);
        else if (map && next.size >= map.maxSeatsPerHold) {
          setMessage(t('seats.max', { max: map.maxSeatsPerHold }));
          return prev;
        } else next.add(seat.id);
        return next;
      });
    },
    [map, t],
  );

  if (eventQuery.isError || mapQuery.isError) {
    const error = (eventQuery.error ?? mapQuery.error) as Error;
    if (error instanceof ApiError && error.status === 404) return <Navigate to="/404" replace />;
    return (
      <div className="px-4 py-16 sm:px-10">
        <ErrorState
          message={error.message}
          onRetry={() => (eventQuery.isError ? eventQuery.refetch() : mapQuery.refetch())}
        />
      </div>
    );
  }

  if (!map) {
    return (
      <div className="grid gap-6 px-4 py-10 sm:px-10 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (hold?.status === 'CONFIRMED' && hold.bookingId)
    return <Navigate to={`/booking/${hold.bookingId}`} replace />;

  const bookable = map.bookingState === 'OPEN' || map.bookingState === 'REGISTER';
  const expiredMessage = hold?.status === 'EXPIRED' && !holdActive ? t('seats.expired') : null;
  const shownMessage = message ?? expiredMessage;

  const summary = holdActive ? (
    <BookingSummary
      mode="hold"
      hold={hold}
      confirming={confirm.isPending}
      releasing={release.isPending}
      onConfirm={(email) => confirm.mutate(email)}
      onRelease={() => release.mutate()}
      onExpire={onExpire}
      message={shownMessage}
    />
  ) : (
    <BookingSummary
      mode="select"
      seats={selectedSeats}
      currency={currency}
      canReserve={bookable}
      reserving={reserve.isPending}
      onReserve={() => reserve.mutate()}
      message={shownMessage ?? (bookable ? null : t('seats.notOpen'))}
    />
  );

  const mobileTotal = holdActive
    ? hold.totalMinor
    : selectedSeats.reduce((n, s) => n + s.priceMinor, 0);
  const mobileCount = holdActive ? hold.items.length : selectedSeats.length;

  return (
    <div className="px-4 pt-8 pb-40 sm:px-10 lg:pb-12">
      <Link
        to={`/events/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-wine-700"
      >
        <ArrowLeft className="size-4" aria-hidden /> {map.eventTitle}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('seats.title')}</h1>
          {map.venue && <p className="mt-1 text-sm text-ink-muted">{map.venue.name}</p>}
        </div>
        {live !== null && (
          <p
            className={`flex items-center gap-1.5 text-xs ${live ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}
            role="status"
          >
            {live ? (
              <Wifi className="size-4" aria-hidden />
            ) : (
              <WifiOff className="size-4" aria-hidden />
            )}
            {live ? t('seats.live') : t('seats.offline')}
          </p>
        )}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* min-w-0: let the map scroll inside its box instead of widening the page. */}
        <div className="min-w-0 space-y-4">
          <SeatLegend />
          <SeatingMap
            map={map}
            selected={selected}
            interactive={bookable && !holdActive}
            onToggle={toggle}
          />
          <ul className="flex flex-wrap gap-4 text-sm text-ink-muted">
            {map.ticketTypes.map((tt) => (
              <li key={tt.id}>
                <span className="font-semibold text-ink">{tt.name}</span> ·{' '}
                {formatMoney(tt.priceMinor, tt.currency, locale)}
              </li>
            ))}
          </ul>
        </div>

        <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.2)] lg:sticky lg:top-6 lg:rounded-xl lg:border lg:shadow-none">
          <button
            type="button"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left lg:hidden"
          >
            <span className="text-sm">
              <span className="font-semibold">
                {t('seats.selectedCount', { count: mobileCount })}
              </span>
              <span className="ml-2 text-ink-muted tabular-nums">
                {formatMoney(mobileTotal, currency, locale)}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-wine-700">
              {sheetOpen ? t('seats.hideSummary') : t('seats.showSummary')}
              <ChevronUp
                className={`size-4 transition-transform ${sheetOpen ? '' : 'rotate-180'}`}
                aria-hidden
              />
            </span>
          </button>
          <div
            className={`max-h-[65vh] overflow-y-auto border-t border-line p-4 lg:block lg:max-h-none lg:border-0 lg:p-5 ${sheetOpen ? 'block' : 'hidden'}`}
          >
            {summary}
          </div>
        </aside>
      </div>
    </div>
  );
}
