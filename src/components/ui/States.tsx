import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from './Button';

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white px-6 py-12 text-center"
    >
      <AlertTriangle className="size-8 text-wine-600" aria-hidden />
      <p className="font-semibold">{t('common.error')}</p>
      {message && <p className="max-w-md text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <Inbox className="size-8 text-ink-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-md text-sm text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}
