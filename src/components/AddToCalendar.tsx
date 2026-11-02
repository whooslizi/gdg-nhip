import { CalendarPlus, ExternalLink } from 'lucide-react';
import { buttonClass } from '@/components/ui/Button';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '@/lib/ics';
import { useI18n } from '@/lib/i18n';
import type { Booking } from '@/types/api';

const TWO_HOURS = 2 * 3600_000;

export function AddToCalendar({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  const { event: e } = booking;
  if (booking.status !== 'CONFIRMED' || !e.startAt) return null;

  const start = new Date(e.startAt);
  const event: CalendarEvent = {
    uid: `${booking.reference}@nhip`,
    title: e.title,
    start,
    end: e.endAt ? new Date(e.endAt) : new Date(start.getTime() + TWO_HOURS),
    location: e.venue && (e.city ? `${e.venue}, ${e.city}` : e.venue),
    description: t('calendar.description', {
      code: booking.reference,
      seats: booking.items.map((i) => i.seatLabel).join(', '),
    }),
    url: `${window.location.origin}/booking/${booking.reference}`,
  };

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className={buttonClass('secondary')}
          onClick={() => downloadIcs(event, `nhip-${e.slug || booking.reference}`)}
        >
          <CalendarPlus className="size-4" aria-hidden />
          {t('calendar.download')}
        </button>
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('secondary')}
        >
          <ExternalLink className="size-4" aria-hidden />
          {t('calendar.google')}
        </a>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t('calendar.hint')}</p>
    </div>
  );
}
