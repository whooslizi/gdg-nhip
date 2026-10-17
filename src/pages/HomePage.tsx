import { useQuery } from '@tanstack/react-query';
import { EventBrowser } from '@/components/events/EventBrowser';
import { HeroBanner } from '@/components/events/HeroBanner';
import { listFeaturedEvents } from '@/services/events';

export function HomePage() {
  const featured = useQuery({
    queryKey: ['events', 'featured'],
    queryFn: ({ signal }) => listFeaturedEvents(signal),
  });
  return (
    <>
      <HeroBanner events={featured.data ?? []} />
      <EventBrowser />
    </>
  );
}
