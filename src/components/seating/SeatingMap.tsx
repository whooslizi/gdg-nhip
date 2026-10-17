import { useI18n } from '@/lib/i18n';
import type { Seat, SeatMap } from '@/types/api';
import { SeatButton } from './SeatButton';

export function SeatingMap({
  map,
  selected,
  interactive,
  onToggle,
}: {
  map: SeatMap;
  selected: ReadonlySet<string>;
  interactive: boolean;
  onToggle: (seat: Seat) => void;
}) {
  const { t } = useI18n();
  const tiers = new Map(map.ticketTypes.map((tt) => [tt.id, tt]));
  const currency = map.ticketTypes[0]?.currency ?? 'VND';

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="mx-auto w-max min-w-full">
        <div className="mx-auto mb-8 w-3/4 max-w-md rounded-b-[2rem] bg-burgundy-900 py-2 text-center text-xs font-semibold tracking-[0.4em] text-blush-200 uppercase">
          {t('seats.stage')}
        </div>
        {map.sections.map((section) => (
          <section key={section.id} aria-label={section.name} className="mb-8 last:mb-0">
            <h3 className="mb-3 text-center text-xs font-semibold tracking-[0.2em] text-ink-muted uppercase">
              {section.name}
            </h3>
            <div className="flex flex-col items-center gap-1.5">
              {section.rows.map((row) => (
                <div
                  key={row.label}
                  role="group"
                  aria-label={t('seats.row', { row: row.label })}
                  className="flex items-center gap-1.5"
                >
                  <span aria-hidden className="w-5 text-right text-xs font-semibold text-ink-muted">
                    {row.label}
                  </span>
                  {row.seats.map((seat) => (
                    <SeatButton
                      key={seat.id}
                      seat={seat}
                      selected={selected.has(seat.id)}
                      tierName={tiers.get(seat.ticketTypeId)?.name ?? ''}
                      currency={currency}
                      interactive={interactive}
                      onToggle={onToggle}
                    />
                  ))}
                  <span aria-hidden className="w-5 text-xs font-semibold text-ink-muted">
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
