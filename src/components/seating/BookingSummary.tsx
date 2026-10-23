import { CreditCard, Timer } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Hold } from '@/types/api';
import { Button } from '../ui/Button';

export interface SelectedSeat {
  id: string;
  seatLabel: string;
  tierName: string;
  priceMinor: number;
}

type Props =
  | {
      mode: 'select';
      seats: SelectedSeat[];
      currency: string;
      canReserve: boolean;
      reserving: boolean;
      onReserve: () => void;
      pricesConfigured?: boolean;
      message: string | null;
    }
  | {
      mode: 'hold';
      hold: Hold;
      confirming: boolean;
      releasing: boolean;
      buyerDetailsRequired?: boolean;
      onConfirm: (buyer: { name: string; phone: string; email: string }) => void;
      onRelease: () => void;
      onExpire: () => void;
      canConfirm?: boolean;
      message: string | null;
    };

function Lines({
  items,
  currency,
  pricesConfigured = true,
}: {
  items: { key: string; label: string; sub: string; price: number }[];
  currency: string;
  pricesConfigured?: boolean;
}) {
  const { t, locale } = useI18n();
  const total = items.reduce((n, i) => n + i.price, 0);
  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.key} className="flex justify-between gap-3 py-2 text-sm">
            <span>
              <span className="font-semibold">{i.label}</span>{' '}
              <span className="text-ink-muted">{i.sub}</span>
            </span>
            <span className="tabular-nums">
              {pricesConfigured ? formatMoney(i.price, currency, locale) : t('seats.priceUnavailable')}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">{t('seats.total')}</span>
        <span className="text-2xl font-bold tabular-nums" data-testid="total">
          {pricesConfigured ? formatMoney(total, currency, locale) : t('seats.priceUnavailable')}
        </span>
      </div>
    </>
  );
}

function HoldTimer({ hold, onExpire }: { hold: Hold; onExpire: () => void }) {
  const { t } = useI18n();
  const remaining = useCountdown(hold.expiresAt, hold.serverTime);
  const expired = remaining !== null && remaining <= 0;
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });
  useEffect(() => {
    if (expired) onExpireRef.current();
  }, [expired]);
  const urgent = remaining !== null && remaining < 60_000;
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${urgent ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-blush-100 text-wine-700'}`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Timer className="size-4" aria-hidden />
        {t('seats.timeLeft')}
      </span>
      {/* Announce only in the last minute so screen readers aren't flooded. */}
      <span
        className="text-xl font-bold tabular-nums"
        role="timer"
        aria-live={urgent ? 'polite' : 'off'}
      >
        {remaining === null ? '–' : formatCountdown(remaining)}
      </span>
    </div>
  );
}

export function BookingSummary(props: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const alert = props.message && (
    <p role="alert" className="text-sm text-wine-700">
      {props.message}
    </p>
  );

  if (props.mode === 'hold') {
    const { hold } = props;
    const busy = props.confirming || props.releasing;
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          props.onConfirm({ name: name.trim(), phone: phone.trim(), email: email.trim() });
        }}
      >
        <h2 className="text-xl font-bold">{t('seats.reserved')}</h2>
        <HoldTimer hold={hold} onExpire={props.onExpire} />
        <Lines
          currency={hold.currency}
          pricesConfigured={hold.priceConfigured !== false}
          items={hold.items.map((i) => ({
            key: i.eventSeatingId,
            label: i.seatLabel,
            sub: i.ticketType,
            price: i.unitPriceMinor,
          }))}
        />
        {props.buyerDetailsRequired && (
          <>
            <div>
              <label htmlFor={nameId} className="text-sm font-medium">
                {t('seats.buyerName')}
              </label>
              <input
                id={nameId}
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-line px-3 focus:border-wine-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor={phoneId} className="text-sm font-medium">
                {t('seats.buyerPhone')}
              </label>
              <input
                id={phoneId}
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-line px-3 focus:border-wine-600 focus:outline-none"
              />
            </div>
          </>
        )}
        <div>
          <label htmlFor={emailId} className="text-sm font-medium">
            {t('seats.email')}
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-line px-3 focus:border-wine-600 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-muted">{t('seats.emailHint')}</p>
        </div>
        <p className="rounded-lg bg-paper p-3 text-xs text-ink-muted">{t('seats.payNote')}</p>
        {alert}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || props.canConfirm === false}
        >
          {props.confirming ? t('seats.paying') : <><CreditCard className="size-4" aria-hidden />{t('seats.pay')}</>}
        </Button>
        <Button variant="secondary" className="w-full" onClick={props.onRelease} disabled={busy}>
          {t('seats.release')}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t('seats.summary')}</h2>
      {props.seats.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('seats.none')}</p>
      ) : (
        <>
          <Lines
            currency={props.currency}
            pricesConfigured={props.pricesConfigured}
            items={props.seats.map((s) => ({
              key: s.id,
              label: s.seatLabel,
              sub: s.tierName,
              price: s.priceMinor,
            }))}
          />
          <p className="text-xs text-ink-muted">{t('seats.estimated')}</p>
        </>
      )}
      {alert}
      <Button
        size="lg"
        className="w-full"
        onClick={props.onReserve}
        disabled={!props.canReserve || props.reserving || props.seats.length === 0}
      >
        {props.reserving ? t('seats.reserving') : t('seats.reserve')}
      </Button>
    </div>
  );
}
