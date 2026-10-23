import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { API_URL, ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { cancelBooking } from '@/services/booking';
import type { Booking } from '@/types/api';

const input =
  'mt-1 h-11 w-full rounded-lg border border-line px-3 focus:border-wine-600 focus:outline-none';

/** Cancel form; after a successful cancel shows the refund and a cat video. */
export function CancelBooking({
  booking,
  onCancelled,
}: {
  booking: Booking;
  onCancelled?: (booking: Booking) => void;
}) {
  const { t, locale } = useI18n();
  const [cancelCode, setCancelCode] = useState('');
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.id, API_URL ? booking.email : cancelCode.trim()),
    onSuccess: (b) => {
      onCancelled?.(b);
      return queryClient.invalidateQueries();
    },
  });
  const submitCancel = (e: FormEvent) => {
    e.preventDefault();
    cancel.mutate();
  };

  return (
    <>
      {booking.status !== 'CANCELLED' && !cancel.data && (
        <form onSubmit={submitCancel} className="mt-6 rounded-xl border border-line p-6">
          <h2 className="text-lg font-bold">{t('cancel.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t(API_URL ? 'cancel.liveBody' : 'cancel.body')}
          </p>
          {!API_URL && (
            <label className="mt-4 block text-sm font-medium">
              {t('cancel.code')}
              <input
                required
                pattern="[A-Za-z0-9]{4}-[A-Za-z0-9]{4}"
                placeholder="XXXX-XXXX"
                autoComplete="off"
                value={cancelCode}
                onChange={(e) => setCancelCode(e.target.value.toUpperCase())}
                className={`${input} font-mono tracking-widest`}
              />
            </label>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Button type="submit" size="lg" disabled={cancel.isPending}>
              {t(cancel.isPending ? 'cancel.submitting' : 'cancel.submit')}
            </Button>
          </div>
          {cancel.isError && (
            <p role="alert" className="mt-3 text-sm text-wine-700">
              {cancel.error instanceof ApiError && cancel.error.status === 403
                ? t('cancel.wrongCode')
                : cancel.error.message}
            </p>
          )}
        </form>
      )}
      {cancel.data && (
        <section role="status" className="mt-6 rounded-xl border border-line p-6">
          <h2 className="text-lg font-bold">{t('cancel.done')}</h2>
          <p className="mt-1 text-sm">
            {cancel.data.refundMinor
              ? t('cancel.refund', {
                  amount: formatMoney(cancel.data.refundMinor, cancel.data.currency, locale),
                })
              : t('cancel.noRefund')}
          </p>
          <p className="mt-4 font-semibold">{t('cancel.cat')}</p>
          {/* Muted so browsers allow autoplay; controls let the viewer unmute. */}
          <video
            src="/media/cat.webm"
            autoPlay
            muted
            loop
            playsInline
            controls
            className="mt-3 aspect-video w-full rounded-lg bg-black"
          />
          <p className="mt-2 text-xs text-ink-muted">
            <a
              href="https://commons.wikimedia.org/wiki/File:Three_orange_kittens_following_their_mother.webm"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {t('cancel.catCredit')}
            </a>
          </p>
        </section>
      )}
    </>
  );
}
