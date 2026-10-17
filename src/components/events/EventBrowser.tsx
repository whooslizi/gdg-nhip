import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { categoryName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { listCategories, listEvents } from '@/services/events';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/States';
import { EventCard } from './EventCard';

const grid =
  'grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

export function EventBrowser() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const tabs = useRef<HTMLDivElement>(null);
  const search = params.get('search') ?? undefined;
  const category = params.get('category') ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => listCategories(signal),
  });
  const query = { search, category, page };
  const events = useQuery({
    queryKey: ['events', query],
    queryFn: ({ signal }) => listEvents(query, signal),
    placeholderData: keepPreviousData,
  });

  const set = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { preventScrollReset: true });
  };

  const tab = (slug: string | undefined, label: string) => (
    <button
      key={slug ?? 'all'}
      type="button"
      aria-pressed={category === slug}
      onClick={() => set({ category: slug, page: undefined })}
      className={`shrink-0 border-b-2 py-3 text-[15px] font-medium transition-colors ${
        category === slug
          ? 'border-wine-700 text-wine-700'
          : 'border-transparent text-ink-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="px-4 pt-12 sm:px-10">
      <h2 className="text-3xl font-bold">
        {search ? t('events.searchTitle', { q: search }) : t('events.title')}
      </h2>
      <div className="relative mt-6 flex items-center border-b border-line">
        <div ref={tabs} className="flex gap-10 overflow-x-auto pr-12 [scrollbar-width:none]">
          {tab(undefined, t('events.all'))}
          {categories.data?.map((c) => tab(c.slug, categoryName(c, locale)))}
        </div>
        <button
          type="button"
          aria-label={t('events.scroll')}
          onClick={() => tabs.current?.scrollBy({ left: 240, behavior: 'smooth' })}
          className="absolute right-0 grid size-9 place-items-center bg-surface hover:text-wine-700"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-10">
        {events.isPending ? (
          <div className={grid} aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : events.isError ? (
          <ErrorState message={events.error.message} onRetry={() => events.refetch()} />
        ) : events.data.items.length === 0 ? (
          <EmptyState title={t('events.none')} />
        ) : (
          <>
            <ul className={grid}>
              {events.data.items.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
            {events.data.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-12 flex items-center justify-center gap-4 text-sm"
              >
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => set({ page: String(page - 1) })}
                >
                  {t('events.prev')}
                </Button>
                <span>
                  {page} / {events.data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= events.data.totalPages}
                  onClick={() => set({ page: String(page + 1) })}
                >
                  {t('events.next')}
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
