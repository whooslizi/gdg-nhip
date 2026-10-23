import { Link } from 'react-router';
import { useI18n } from '@/lib/i18n';
import { Logo } from './Navbar';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-20 bg-burgundy-950 text-blush-200">
      <div className="flex flex-col gap-6 px-4 py-12 sm:px-10 md:flex-row md:items-end md:justify-between">
        <div>
          <Logo className="text-white" />
          <p className="mt-3 max-w-sm text-sm text-blush-200/80">{t('footer.tagline')}</p>
        </div>
        <div className="space-y-2 text-sm md:text-right">
          <Link to="/my-bookings" className="block font-semibold text-white hover:underline">
            {t('nav.findTickets')}
          </Link>
          <Link to="/my-bookings" className="block font-semibold text-white hover:underline">
            {t('footer.cancel')}
          </Link>
          <Link to="/admin" className="block font-semibold text-white hover:underline">
            Quản trị
          </Link>
          <p className="max-w-sm text-blush-200/70">{t('footer.note')}</p>
        </div>
      </div>
      <div className="space-y-2 border-t border-white/10 px-4 py-6 text-xs text-blush-200/60 sm:px-10">
        <p className="max-w-3xl">{t('footer.disclaimer')}</p>
        <p>{t('footer.media')}</p>
        <p>{t('footer.copyright')}</p>
      </div>
    </footer>
  );
}
