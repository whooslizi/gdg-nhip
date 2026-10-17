import { useI18n, type TranslationKey } from '@/lib/i18n';
import { SeatIcon, seatStyles, type SeatVisualState } from './SeatButton';

const items: { state: SeatVisualState; key: TranslationKey }[] = [
  { state: 'available', key: 'seats.available' },
  { state: 'selected', key: 'seats.selected' },
  { state: 'mine', key: 'seats.yours' },
  { state: 'held', key: 'seats.held' },
  { state: 'sold', key: 'seats.sold' },
  { state: 'blocked', key: 'seats.blocked' },
];

export function SeatLegend() {
  const { t } = useI18n();
  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
        {items.map(({ state, key }) => (
          <li key={state} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`grid size-5 place-items-center rounded-t-md rounded-b-sm border ${seatStyles[state]}`}
            >
              <SeatIcon state={state} />
            </span>
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}
