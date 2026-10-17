import { useQuery } from '@tanstack/react-query';
import { Search, Ticket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { categoryName } from '@/lib/format';
import { useI18n, type Locale } from '@/lib/i18n';
import { listCategories } from '@/services/events';

export function Logo({ className = 'text-wine-700' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`font-display text-3xl leading-none font-black tracking-tight sm:text-4xl ${className}`}
    >
      nhịp<span className="text-wine-500">.</span>
    </Link>
  );
}

export function Navbar() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('search') ?? '');
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => listCategories(signal),
  });

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/events?search=${encodeURIComponent(query.trim())}` : '/events');
  };

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-white px-4 py-4 sm:px-10 sm:py-5">
      <Logo />
      <form
        role="search"
        onSubmit={search}
        className="order-last flex h-11 w-full items-center rounded-full bg-ink/[0.05] pr-4 md:order-none md:w-auto md:flex-1"
      >
        <select
          aria-label={t('nav.allCategories')}
          value={params.get('category') ?? ''}
          onChange={(e) => navigate(e.target.value ? `/?category=${e.target.value}` : '/')}
          className="hidden h-full rounded-l-full bg-transparent pr-2 pl-5 text-sm font-medium sm:block"
        >
          <option value="">{t('nav.allCategories')}</option>
          {categories.data?.map((c) => (
            <option key={c.slug} value={c.slug}>
              {categoryName(c, locale)}
            </option>
          ))}
        </select>
        <Search className="ml-4 size-4 shrink-0 text-ink-muted sm:ml-2" aria-hidden />
        <input
          type="search"
          aria-label={t('nav.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('nav.search')}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm placeholder:text-ink-muted/80 focus:outline-none"
        />
      </form>
      <nav className="ml-auto flex items-center gap-4 md:ml-0">
        <Link
          to="/my-bookings"
          className="flex items-center gap-1.5 text-sm font-semibold hover:text-wine-700"
        >
          <Ticket className="size-4" aria-hidden />
          {t('nav.findTickets')}
        </Link>
        <select
          aria-label="Language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="h-9 rounded-md border border-line bg-white px-2 text-sm font-semibold"
        >
          <option value="vi">VN</option>
          <option value="en">EN</option>
        </select>
      </nav>
    </header>
  );
}
