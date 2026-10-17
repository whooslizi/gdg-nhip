import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="px-4 py-24 text-center">
      <p className="text-7xl font-bold text-wine-700">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('notFound.title')}</h1>
      <Link to="/" className={buttonClass('primary', 'md', 'mt-8')}>
        {t('common.home')}
      </Link>
    </div>
  );
}
