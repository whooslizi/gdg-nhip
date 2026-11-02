import { CheckCircle2, DoorOpen, KeyRound, ShieldAlert, XCircle } from 'lucide-react';
import { TicketQr } from '@/components/TicketQr';
import { API_URL } from '@/lib/api-client';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Booking } from '@/types/api';

export function BookingDetails({ booking: b }: { booking: Booking }) {
  const { t, locale } = useI18n();
  const cancelled = b.status === 'CANCELLED';
  const Icon = cancelled ? XCircle : CheckCircle2;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="bg-burgundy-900 px-6 py-8 text-white">
        <Icon className="size-8 text-blush-300" aria-hidden />
        <h1 className="mt-2 text-2xl font-bold">
          {t(cancelled ? 'booking.cancelled' : 'booking.confirmed')}
        </h1>
        <p className="text-blush-200">{b.event.title}</p>
      </div>
      {b.accessCode && (
        <div className="m-6 rounded-lg border-2 border-dashed border-wine-600 bg-blush-100 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-wine-700">
            <KeyRound className="size-4" aria-hidden /> {t('booking.code')}
          </p>
          <p
            className="mt-1 font-mono text-3xl font-bold tracking-widest"
            data-testid="access-code"
          >
            {b.accessCode}
          </p>
          <p className="mt-2 text-sm text-ink-muted">{t('booking.codeHint')}</p>
        </div>
      )}
      {b.cancelCode && !cancelled && (
        <div className="mx-6 mb-6 rounded-lg border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-wine-700">
            <ShieldAlert className="size-4" aria-hidden /> {t('booking.cancelCode')}
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-widest" data-testid="cancel-code">
            {b.cancelCode}
          </p>
          <p className="mt-2 text-sm text-ink-muted">{t('booking.cancelCodeHint')}</p>
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-6 px-6 pt-8 sm:grid-cols-2">
        <div>
          <dt className="mb-1 text-xs font-semibold text-ink-muted uppercase">
            {t(API_URL ? 'booking.id' : 'booking.reference')}
          </dt>
          <dd className="font-mono text-lg font-bold" data-testid="booking-reference">
            {b.reference}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs font-semibold text-ink-muted uppercase">Email</dt>
          <dd>{b.email}</dd>
        </div>
        {b.confirmedAt && (
          <div>
            <dt className="mb-1 text-xs font-semibold text-ink-muted uppercase">
              {t('booking.confirmedAt')}
            </dt>
            <dd>{formatDateTime(b.confirmedAt, locale)}</dd>
          </div>
        )}
      </dl>
      {b.checkedInAt && (
        <p
          role="status"
          className="mx-6 mt-8 flex items-start gap-3 rounded-lg border border-emerald-600 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <DoorOpen className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">{t('booking.checkedIn')}</span>
            {t(b.checkedInBy ? 'booking.checkedInAtBy' : 'booking.checkedInAt', {
              time: formatDateTime(b.checkedInAt, locale),
              by: b.checkedInBy ?? '',
            })}
          </span>
        </p>
      )}
      {b.ticketToken && !cancelled && <TicketQr token={b.ticketToken} code={b.reference} />}
      <ul className="mx-6 mt-8 divide-y divide-line border-t border-line">
        {b.items.map((i) => (
          <li key={i.seatLabel} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{i.seatLabel}</span>{' '}
              <span className="text-ink-muted">
                {i.section} · {i.ticketType}
              </span>
            </span>
            <span className="tabular-nums">
              {i.priceConfigured === false
                ? t('seats.priceUnavailable')
                : formatMoney(i.unitPriceMinor, b.currency, locale)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mx-6 flex justify-between border-t border-line py-4">
        <span className="font-semibold">{t('seats.total')}</span>
        <span className="text-xl font-bold tabular-nums">
          {formatMoney(b.totalMinor, b.currency, locale)}
        </span>
      </div>
      {b.refundMinor !== undefined && (
        <div className="mx-6 flex justify-between border-t border-line py-3 text-wine-700">
          <span className="font-semibold">{t('booking.refunded')}</span>
          <span className="font-bold tabular-nums">
            {formatMoney(b.refundMinor, b.currency, locale)}
          </span>
        </div>
      )}
      <p className="mt-2 bg-paper px-6 py-4 text-sm text-ink-muted">
        {t(API_URL ? 'booking.liveNote' : 'booking.note')}
      </p>
    </div>
  );
}
