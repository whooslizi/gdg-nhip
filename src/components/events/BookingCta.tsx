import { Link } from 'react-router';
import { useI18n } from '@/lib/i18n';
import type { EventSummary } from '@/types/api';
import { Button, buttonClass } from '../ui/Button';

export function BookingCta({
  event,
  className = '',
}: {
  event: Pick<EventSummary, 'slug' | 'bookingState'>;
  className?: string;
}) {
  const { t } = useI18n();
  const state = event.bookingState;
  if (state === 'OPEN' || state === 'REGISTER') {
    return (
      <Link to={`/events/${event.slug}/seats`} className={buttonClass('primary', 'lg', className)}>
        {t(`cta.${state}`)}
      </Link>
    );
  }
  return (
    <Button size="lg" disabled className={className}>
      {t(`state.${state}`)}
    </Button>
  );
}
