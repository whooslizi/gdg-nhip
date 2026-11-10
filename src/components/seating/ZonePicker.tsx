import { Minus, Plus } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Seat, SeatMap } from '@/types/api';

// One colour per price tier, most expensive first. The tier name and price are always written
// next to the colour, so it never carries meaning on its own.
const TIER_COLORS = [
  'bg-rose-600',
  'bg-orange-500',
  'bg-sky-500',
  'bg-emerald-600',
  'bg-violet-600',
];

/**
 * Big events sell by zone: the buyer picks how many tickets per zone and a free ticket in that
 * zone is chosen for them. It drives the same `selected` set as the seat map, so holding and
 * paying work the same way; the server still checks every ticket is free.
 */
export function ZonePicker({
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
  const { t, locale } = useI18n();
  const seats = map.sections.flatMap((s) => s.rows.flatMap((r) => r.seats));
  const tiers = [...new Set(map.ticketTypes.map((z) => z.priceMinor))].sort((a, b) => b - a);
  const zones = map.ticketTypes.map((zone) => {
    const inZone = seats.filter((s) => s.ticketTypeId === zone.id);
    return {
      ...zone,
      color: TIER_COLORS[tiers.indexOf(zone.priceMinor) % TIER_COLORS.length],
      chosen: inZone.filter((s) => selected.has(s.id)),
      free: inZone.filter((s) => s.status === 'AVAILABLE' && !selected.has(s.id)),
    };
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div aria-hidden className="rounded-xl bg-burgundy-900 p-4 sm:p-6">
        <div className="mx-auto w-3/4 rounded-md bg-black py-3 text-center text-sm font-bold tracking-[0.3em] text-white uppercase">
          {t('zones.stage')}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`rounded-md px-3 py-5 text-xs font-bold text-white ${zone.color} ${zone.free.length + zone.chosen.length === 0 ? 'opacity-35' : ''}`}
            >
              {zone.name}
              {zone.chosen.length > 0 && ` · ${zone.chosen.length}`}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-ink-muted">{t('zones.hint')}</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {zones.map((zone) => {
            const soldOut = zone.free.length === 0;
            return (
              <li key={zone.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase">
                    <span className={`size-2.5 shrink-0 rounded-full ${zone.color}`} aria-hidden />
                    {zone.name}
                  </p>
                  <p className="mt-0.5 font-bold tabular-nums">
                    {formatMoney(zone.priceMinor, zone.currency, locale)}
                  </p>
                  {!soldOut && zone.free.length <= 10 && (
                    <p className="text-xs text-wine-700">
                      {t('zones.left', { count: zone.free.length })}
                    </p>
                  )}
                </div>
                {soldOut && zone.chosen.length === 0 ? (
                  <span className="shrink-0 rounded-full bg-ink/5 px-3 py-1.5 text-sm font-semibold">
                    {t('zones.soldOut')}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('zones.remove', { zone: zone.name })}
                      disabled={!interactive || zone.chosen.length === 0}
                      onClick={() => onToggle(zone.chosen[zone.chosen.length - 1]!)}
                      className="grid size-9 place-items-center rounded-full border border-line text-wine-700 hover:bg-blush-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>
                    <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
                      {zone.chosen.length}
                    </span>
                    <button
                      type="button"
                      aria-label={t('zones.add', { zone: zone.name })}
                      disabled={!interactive || soldOut}
                      // Spread buyers out so two people adding at once rarely pick the same ticket.
                      onClick={() =>
                        onToggle(zone.free[Math.floor(Math.random() * zone.free.length)]!)
                      }
                      className="grid size-9 place-items-center rounded-full border border-line text-wine-700 hover:bg-blush-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
