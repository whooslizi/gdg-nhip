import { Link } from 'react-router';
import { categoryName, placeAndDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { EventSummary } from '@/types/api';
import { Poster } from './Poster';
import { categoryTone, stateTone } from './stateStyles';

export function EventCard({ event }: { event: EventSummary }) {
  const { t, locale } = useI18n();
  const category = event.categories[0];
  return (
    <article className="group relative">
      <span
        className={`inline-block rounded-t-md px-3 py-1 text-xs font-semibold ${stateTone[event.bookingState]}`}
      >
        {t(`state.${event.bookingState}`)}
      </span>
      <Poster src={event.posterUrl} alt="" className="aspect-video rounded-md rounded-tl-none" />
      {category && (
        <span
          className={`mt-4 inline-block rounded-md px-3 py-1 text-sm ${categoryTone(category.slug)}`}
        >
          {categoryName(category, locale)}
        </span>
      )}
      <p className="mt-2 text-sm text-ink-muted">{placeAndDate(event, locale) ?? t('event.tba')}</p>
      <h3 className="mt-1 line-clamp-2 text-lg leading-snug font-bold uppercase">
        <Link
          to={`/events/${event.slug}`}
          className="after:absolute after:inset-0 group-hover:text-wine-700"
        >
          {event.title}
        </Link>
      </h3>
    </article>
  );
}
