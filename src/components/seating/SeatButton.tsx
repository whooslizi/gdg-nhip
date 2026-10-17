import { Check, Clock, Lock, X } from 'lucide-react';
import { memo } from 'react';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Seat } from '@/types/api';

export type SeatVisualState = 'available' | 'selected' | 'mine' | 'held' | 'sold' | 'blocked';

export function seatVisualState(seat: Seat, selected: boolean): SeatVisualState {
  if (seat.status === 'HELD' && seat.heldByMe) return 'mine';
  if (seat.status === 'HELD') return 'held';
  if (seat.status === 'SOLD') return 'sold';
  if (seat.status === 'BLOCKED') return 'blocked';
  return selected ? 'selected' : 'available';
}

// Each state pairs a colour with a shape/icon so it reads without colour vision.
export const seatStyles: Record<SeatVisualState, string> = {
  available: 'bg-seat-available border-ink/25 text-ink hover:border-wine-700 hover:bg-blush-100',
  selected: 'bg-seat-selected border-seat-selected text-white',
  mine: 'bg-blush-200 border-wine-700 border-2 text-wine-700',
  held: 'bg-seat-held border-amber-500 text-amber-950',
  sold: 'bg-seat-sold border-seat-sold text-white seat-hatch',
  blocked: 'bg-seat-blocked border-transparent text-ink-muted',
};

export const SeatIcon = ({ state }: { state: SeatVisualState }) => {
  const cls = 'size-3';
  if (state === 'selected') return <Check className={cls} aria-hidden />;
  if (state === 'mine') return <Lock className={cls} aria-hidden />;
  if (state === 'held') return <Clock className={cls} aria-hidden />;
  if (state === 'sold' || state === 'blocked') return <X className={cls} aria-hidden />;
  return null;
};

const stateKey = {
  available: 'seats.available',
  selected: 'seats.selected',
  mine: 'seats.yours',
  held: 'seats.held',
  sold: 'seats.sold',
  blocked: 'seats.blocked',
} as const;

export const SeatButton = memo(function SeatButton({
  seat,
  selected,
  tierName,
  currency,
  interactive,
  onToggle,
}: {
  seat: Seat;
  selected: boolean;
  tierName: string;
  currency: string;
  interactive: boolean;
  onToggle: (seat: Seat) => void;
}) {
  const { t, locale } = useI18n();
  const state = seatVisualState(seat, selected);
  const selectable = interactive && (state === 'available' || state === 'selected');
  const label = `${t('seats.seat')} ${seat.seatLabel}, ${tierName}, ${formatMoney(seat.priceMinor, currency, locale)} — ${t(stateKey[state])}`;
  return (
    <button
      type="button"
      data-seat={seat.seatLabel}
      data-state={state}
      aria-label={label}
      title={label}
      aria-pressed={state === 'available' || state === 'selected' ? selected : undefined}
      aria-disabled={!selectable}
      onClick={() => selectable && onToggle(seat)}
      className={`grid size-7 shrink-0 place-items-center rounded-t-lg rounded-b-sm border text-[10px] font-semibold transition-colors sm:size-8 ${seatStyles[state]} ${selectable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      {state === 'available' ? seat.seatNumber : <SeatIcon state={state} />}
    </button>
  );
});
