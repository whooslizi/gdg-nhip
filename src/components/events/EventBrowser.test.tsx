import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch, renderRoute } from '@/test/utils';
import { EventBrowser } from './EventBrowser';

const events = [
  {
    eventid: 1,
    eventname: 'GDG-HUST 20/10 Concert: Bloom with Us',
    directors: ['GDG-HUST'],
    types: ['Sports'],
    languages: ['Vietnamese'],
    poster: null,
    duration: 120,
    startat: '2026-10-20',
    endat: '2026-10-20',
  },
];

describe('EventBrowser', () => {
  it('lists REST events and filters by their event type', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/events')) return { body: events };
    });
    renderRoute(<EventBrowser />);
    expect(await screen.findByRole('link', { name: /Bloom with Us/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sports' }));
    expect(screen.getByRole('link', { name: /Bloom with Us/ })).toBeInTheDocument();
  });

  it('filters REST events by the entered search term', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/events')) return { body: events };
    });
    renderRoute(<EventBrowser />, { path: '/events', url: '/events?search=bloom' });
    expect(await screen.findByRole('heading', { name: 'Results for “bloom”' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Bloom with Us/ })).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/events'))
        return { status: 500, body: { error: { code: 'INTERNAL', message: 'down' } } };
    });
    renderRoute(<EventBrowser />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
