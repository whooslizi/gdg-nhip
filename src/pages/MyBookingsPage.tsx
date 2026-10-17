import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BookingDetails } from '@/components/BookingDetails';
import { CancelBooking } from '@/components/CancelBooking';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { listMyBookings, lookupBooking } from '@/services/booking';
import type { Booking } from '@/types/api';

const input =
  'mt-1 h-11 w-full rounded-lg border border-line px-3 focus:border-wine-600 focus:outline-none';

export function MyBookingsPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cancelled, setCancelled] = useState<Booking | null>(null);
  const lookup = useMutation({ mutationFn: () => lookupBooking(email.trim(), code.trim()) });
  const mine = useQuery({ queryKey: ['bookings'], queryFn: listMyBookings });
  const booking = cancelled ?? lookup.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setCancelled(null);
    lookup.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t('lookup.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('lookup.body')}</p>
      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
      >
        <label className="text-sm font-medium">
          {t('lookup.email')}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </label>
        <label className="text-sm font-medium">
          {t('lookup.code')}
          <input
            required
            pattern="[A-Za-z0-9]{4}-[A-Za-z0-9]{4}"
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={`${input} font-mono tracking-widest`}
          />
        </label>
        <Button type="submit" size="lg" disabled={lookup.isPending}>
          {t('lookup.submit')}
        </Button>
      </form>
      {lookup.isError && (
        <p role="alert" className="mt-4 text-sm text-wine-700">
          {lookup.error instanceof ApiError && lookup.error.status === 404
            ? t('lookup.notFound')
            : lookup.error.message}
        </p>
      )}
      {booking && (
        <div className="mt-8">
          <BookingDetails booking={booking} />
        </div>
      )}
      {lookup.data && (
        <CancelBooking key={lookup.data.id} booking={lookup.data} onCancelled={setCancelled} />
      )}

      {(mine.data?.length ?? 0) > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold">{t('lookup.thisDevice')}</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {mine.data!.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/booking/${b.id}`}
                  className="flex justify-between gap-4 px-4 py-3 hover:bg-paper"
                >
                  <span>
                    <span className="block font-semibold">{b.event.title}</span>
                    <span className="font-mono text-sm text-ink-muted">{b.reference}</span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {formatMoney(b.totalMinor, b.currency, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
