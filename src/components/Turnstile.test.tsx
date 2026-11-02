import { act, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderRoute } from '@/test/utils';
import { BookingSummary } from './seating/BookingSummary';

const env = vi.hoisted(() => ({ apiUrl: 'http://localhost:3001/api' as string | undefined }));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    get API_URL() {
      return env.apiUrl;
    },
  };
});

const seats = [{ id: 's1', seatLabel: 'A1', tierName: 'VIP', priceMinor: 250_000 }];

function renderSummary(onReserve = vi.fn()) {
  renderRoute(
    <BookingSummary
      mode="select"
      seats={seats}
      currency="VND"
      canReserve
      reserving={false}
      onReserve={onReserve}
      message={null}
    />,
  );
  return onReserve;
}

describe('Turnstile', () => {
  let options: Record<string, unknown> | undefined;
  const turnstile = {
    render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
      options = o;
      return 'widget-1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    env.apiUrl = 'http://localhost:3001/api';
    options = undefined;
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    window.turnstile = turnstile;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    delete window.turnstile;
  });

  it('keeps Reserve disabled until the token callback fires, then sends and resets the token', async () => {
    const onReserve = renderSummary();
    const reserve = screen.getByRole('button', { name: 'Reserve seats' });
    expect(reserve).toBeDisabled();
    await vi.waitFor(() => expect(options).toBeDefined());
    expect(options).toMatchObject({
      sitekey: '1x00000000000000000000AA',
      action: 'hold',
      language: 'en',
    });

    act(() => (options!.callback as (token: string) => void)('XXXX.DUMMY.TOKEN.XXXX'));
    expect(reserve).toBeEnabled();

    act(() => reserve.click());
    expect(onReserve).toHaveBeenCalledWith('XXXX.DUMMY.TOKEN.XXXX');
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(reserve).toBeDisabled();
  });

  it('is not rendered in mock mode, and Reserve works without a token', () => {
    env.apiUrl = undefined;
    const onReserve = renderSummary();
    expect(turnstile.render).not.toHaveBeenCalled();
    const reserve = screen.getByRole('button', { name: 'Reserve seats' });
    act(() => reserve.click());
    expect(onReserve).toHaveBeenCalledWith(null);
  });

  it('is not rendered without a sitekey', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    renderSummary();
    expect(turnstile.render).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reserve seats' })).toBeEnabled();
  });
});
