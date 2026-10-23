import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router';
import { BookingDetails } from '@/components/BookingDetails';
import { CancelBooking } from '@/components/CancelBooking';
import { buttonClass } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { ApiError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { getBooking } from '@/services/booking';

export function BookingPage() {
  const { bookingId = '' } = useParams();
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => getBooking(bookingId),
  });

  if (query.isPending) return <Skeleton className="m-10 h-96" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return <Navigate to={`/my-bookings?bookingId=${encodeURIComponent(bookingId)}`} replace />;
    if (query.error instanceof ApiError && query.error.code === 'BOOKING_EMAIL_REQUIRED')
      return <Navigate to={`/my-bookings?bookingId=${encodeURIComponent(bookingId)}`} replace />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BookingDetails booking={query.data} />
      <CancelBooking booking={query.data} />
      <Link
        to={`/events/${query.data.event.slug}`}
        className={buttonClass('secondary', 'md', 'mt-6')}
      >
        {t('booking.backToEvent')}
      </Link>
    </div>
  );
}
