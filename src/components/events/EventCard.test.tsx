import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { event, renderRoute } from '@/test/utils';
import { EventCard } from './EventCard';

describe('EventCard', () => {
  it('shows status, category, TBA place/date and links to the event', async () => {
    const { router } = renderRoute(<EventCard event={event()} />);
    expect(screen.getByText('On sale')).toBeInTheDocument();
    expect(screen.getByText('Music & Concerts')).toBeInTheDocument();
    expect(screen.getByText('To be announced')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Bloom with Us/ }));
    expect(router.state.location.pathname).toBe('/events/bloom');
  });

  it('shows city and date when known', () => {
    renderRoute(
      <EventCard
        event={event({ city: 'Hà Nội', startAt: '2026-11-21T12:00:00Z', bookingState: 'SOLD_OUT' })}
      />,
    );
    expect(screen.getByText(/Hà Nội, 21 November 2026/)).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });
});
