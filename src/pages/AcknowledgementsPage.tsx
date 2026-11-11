import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function AcknowledgementsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-display text-4xl font-black text-wine-700 sm:text-5xl">
        {t('thanks.title')}
      </h1>

      <div className="mt-10 space-y-5 text-lg leading-relaxed">
        <p className="font-semibold">{t('thanks.greeting')}</p>
        <p>{t('thanks.intro')}</p>
        <p>{t('thanks.journey')}</p>
        <p>{t('thanks.mentors')}</p>
        <p>
          {t('thanks.gdgBefore')}{' '}
          <a
            href="https://www.facebook.com/gdgoc.hust"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-wine-700 underline underline-offset-4"
          >
            Google Developer Group on Campus - HUST (GDG-HUST)
            <ExternalLink className="size-3.5" aria-hidden />
          </a>{' '}
          {t('thanks.gdgAfter')}
        </p>
        <p>{t('thanks.team')}</p>
        <p>{t('thanks.closing')}</p>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <p className="text-ink-muted">{t('thanks.signoff')}</p>
        <p className="mt-1 font-display text-2xl font-black text-wine-700">
          {t('thanks.signature')}
        </p>
      </div>
    </div>
  );
}
