import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { event, mockFetch, renderRoute } from '@/test/utils';
import { EventBrowser } from './EventBrowser';

const categories = { items: [{ slug: 'sports', nameEn: 'Sports', nameVi: 'Thể thao' }] };
const page = (items: unknown[]) => ({
  body: { items, page: 1, total: items.length, totalPages: 1 },
});

describe('EventBrowser', () => {
  it('lists events and filters by category tab through the API', async () => {
    const fetch = mockFetch((url) => {
      if (url.pathname.endsWith('/categories')) return { body: categories };
      if (url.pathname.endsWith('/events'))
        return page(url.searchParams.get('category') === 'sports' ? [] : [event()]);
    });
    renderRoute(<EventBrowser />);
    expect(await screen.findByRole('link', { name: /Bloom with Us/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sports' }));
    expect(await screen.findByText('No events yet')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('category=sports'))).toBe(true);
  });

  it('shows the search term and passes it on', async () => {
    const fetch = mockFetch((url) => {
      if (url.pathname.endsWith('/categories')) return { body: categories };
      if (url.pathname.endsWith('/events')) return page([]);
    });
    renderRoute(<EventBrowser />, { path: '/events', url: '/events?search=bloom' });
    expect(await screen.findByRole('heading', { name: 'Results for “bloom”' })).toBeInTheDocument();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('search=bloom'))).toBe(true);
  });

  it('offers a retry when loading fails', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/categories')) return { body: categories };
      if (url.pathname.endsWith('/events'))
        return { status: 500, body: { error: { code: 'INTERNAL', message: 'down' } } };
    });
    renderRoute(<EventBrowser />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
