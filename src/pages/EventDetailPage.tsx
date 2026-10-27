import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Globe, Mail, MapPin } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import { BookingCta } from '@/components/events/BookingCta';
import { Poster } from '@/components/events/Poster';
import { categoryTone } from '@/components/events/stateStyles';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { ApiError } from '@/lib/api-client';
import { categoryName, formatDateTime, formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getEvent, listShowtimes } from '@/services/events';

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-wine-700">{icon}</span>
      <div>
        <dt className="text-xs font-semibold text-ink-muted uppercase">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

export function EventDetailPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: ['event', slug],
    queryFn: ({ signal }) => getEvent(slug, signal),
  });
  const queryClient = useQueryClient();
  const eventId = query.data?.id;
  const startAt = query.data?.startAt ?? null;
  // Warm the seat page's showtimes while the user reads the details.
  useEffect(() => {
    if (eventId)
      queryClient.prefetchQuery({
        queryKey: ['showtimes', eventId],
        queryFn: ({ signal }) => listShowtimes(eventId, startAt, signal),
      });
  }, [queryClient, eventId, startAt]);

  if (query.isPending) return <Skeleton className="aspect-[3.3/1] rounded-none" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return <Navigate to="/404" replace />;
    return (
      <div className="px-4 py-16 sm:px-10">
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      </div>
    );
  }
  const event = query.data;
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const en = locale === 'en' ? event.en : undefined;
  const performers = en?.performers ?? event.performers;
  const organizerAbout = en?.organizerAbout ?? event.organizer.about;

  return (
    <>
      <Poster
        src={event.posterUrl}
        alt={event.title}
        eager
        className="aspect-[16/9] max-h-[560px] w-full sm:aspect-[3.3/1]"
      />
      <div className="grid gap-10 px-4 pt-10 sm:px-10 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap gap-2">
            {event.categories.map((c) => (
              <span key={c.slug} className={`rounded-md px-3 py-1 text-sm ${categoryTone(c.slug)}`}>
                {categoryName(c, locale)}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-3xl leading-tight font-bold uppercase sm:text-4xl">
            {event.title}
          </h1>
          <h2 className="mt-8 text-xl font-bold">{t('event.about')}</h2>
          <p className="mt-3 max-w-prose leading-relaxed whitespace-pre-line">
            {en?.description ?? event.description}
          </p>

          {performers && performers.length > 0 && (
            <>
              <h2 className="mt-10 text-xl font-bold">{t('event.performers')}</h2>
              <ul className="mt-3 space-y-5">
                {performers.map((p) => (
                  <li key={p.name}>
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-1 max-w-prose leading-relaxed text-ink-muted">{p.bio}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-10 text-xl font-bold">{t('event.organizer')}</h2>
          <p className="mt-3 font-semibold">{event.organizer.name}</p>
          {event.organizer.email && (
            <a
              href={`mailto:${event.organizer.email}`}
              className="mt-1 flex items-center gap-2 text-sm text-wine-700 hover:underline"
            >
              <Mail className="size-4" aria-hidden /> {event.organizer.email}
            </a>
          )}
          {event.organizer.website && (
            <a
              href={event.organizer.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-2 text-sm text-wine-700 hover:underline"
            >
              <Globe className="size-4" aria-hidden /> {event.organizer.website}
            </a>
          )}
          {organizerAbout && (
            <p className="mt-3 max-w-prose leading-relaxed whitespace-pre-line text-ink-muted">
              {organizerAbout}
            </p>
          )}
        </div>

        <aside className="space-y-5 rounded-xl border border-line p-6 lg:sticky lg:top-6 lg:self-start">
          <dl className="space-y-4">
            <Fact icon={<CalendarDays className="size-5" aria-hidden />} label={t('event.date')}>
              {event.startAt ? formatDateTime(event.startAt, locale) : t('event.tba')}
            </Fact>
            <Fact icon={<MapPin className="size-5" aria-hidden />} label={t('event.venue')}>
              {place || t('event.tba')}
            </Fact>
            <Fact icon={<Building2 className="size-5" aria-hidden />} label={t('event.organizer')}>
              {event.organizer.name}
            </Fact>
          </dl>
          {event.ticketTypes.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {event.ticketTypes.map((tt) => (
                <li key={tt.id} className="flex justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{tt.name}</p>
                    <p className="text-xs text-ink-muted">
                      {t('event.available', { count: tt.availableCount })}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {tt.priceMinor === 0
                      ? t('event.free')
                      : formatMoney(tt.priceMinor, tt.currency, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <BookingCta event={event} className="w-full" />
        </aside>
      </div>
    </>
  );
}
