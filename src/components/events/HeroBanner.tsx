import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { placeAndDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { EventSummary } from '@/types/api';
import { Poster } from './Poster';
import { stateTone } from './stateStyles';

export function HeroBanner({ events }: { events: EventSummary[] }) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const event = events[index];
  if (!event) return <div className="aspect-[16/9] bg-burgundy-900 sm:aspect-[3.3/1]" />;
  const go = (delta: number) => setIndex((i) => (i + delta + events.length) % events.length);
  const arrow =
    'absolute top-1/2 z-20 hidden size-11 sm:grid -translate-y-1/2 place-items-center rounded-full bg-white text-burgundy-900 shadow-md hover:bg-blush-200';

  return (
    <section aria-roledescription="carousel" aria-label="Featured events" className="relative">
      <Poster
        src={event.posterUrl}
        alt=""
        eager
        className="aspect-[16/9] max-h-[560px] w-full sm:aspect-[3.3/1]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-burgundy-950/90 via-burgundy-950/50 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-center gap-3 px-6 text-white sm:px-20">
        <span
          className={`w-fit rounded-md px-3 py-1 text-xs font-semibold ${stateTone[event.bookingState]}`}
        >
          {t(`state.${event.bookingState}`)}
        </span>
        <h1 className="font-display text-2xl leading-tight font-bold text-balance sm:text-5xl">
          <Link to={`/events/${event.slug}`} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </h1>
        <p className="text-sm text-blush-200 sm:text-base">
          {placeAndDate(event, locale) ?? t('event.tba')}
        </p>
      </div>
      {events.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t('hero.prev')}
            className={`${arrow} left-3`}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t('hero.next')}
            className={`${arrow} right-3`}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-3">
            {events.map((e, i) => (
              <button
                key={e.id}
                type="button"
                aria-label={`${t('hero.goTo')} ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`size-2.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/45 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
