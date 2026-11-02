import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mockFetch, renderRoute } from '@/test/utils';
import type { AdminEvent, CheckInResult } from '@/services/admin';
import { CheckInPanel } from './CheckInPanel';

// The real scanner needs a camera and a worker; this stand-in lets the test "show" it a QR.
const camera = vi.hoisted(() => ({ decode: null as null | ((r: { data: string }) => void) }));
vi.mock('qr-scanner', () => ({
  default: class {
    static hasCamera = async () => true;
    static scanImage = async () => ({ data: 'NHIP1.FROM-IMAGE' });
    constructor(_video: HTMLVideoElement, onDecode: (r: { data: string }) => void) {
      camera.decode = onDecode;
    }
    start = async () => undefined;
    destroy = () => {
      camera.decode = null;
    };
  },
}));

const events = [{ eventid: 1, eventname: 'Bloom' } as AdminEvent];
const showtime = {
  showtimeid: 10,
  eventid: 1,
  roomid: 1,
  startat: '2026-11-10T12:00:00Z',
  endat: '2026-11-10T14:00:00Z',
  status: 'active',
};
const ticket: Omit<CheckInResult, 'result'> = {
  bookingCode: 'BK-ABCD-EFGH',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  phone: '0123456789',
  eventName: 'Bloom',
  startAt: '2026-11-10T12:00:00Z',
  price: 250000,
  seats: [{ label: 'A1', type: 'VIP' }],
  checkedInAt: '2026-11-10T11:58:00Z',
  checkedInBy: 'door-1',
};

function setup(result: CheckInResult['result']) {
  const fetch = mockFetch((url) => {
    if (url.pathname.endsWith('/events/1/showtimes'))
      return { body: { eventId: 1, showtimes: [showtime] } };
    if (url.pathname.endsWith('/admin/checkin'))
      return { body: { success: true, data: { result, ...ticket } } };
  });
  renderRoute(<CheckInPanel events={events} token="admin" onError={vi.fn()} />);
  return fetch;
}
const checkins = (fetch: ReturnType<typeof mockFetch>) =>
  fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/checkin'));

async function pickShowtime() {
  await screen.findByRole('option', { name: /#10/ });
  await userEvent.selectOptions(screen.getByLabelText('Suất chiếu đang soát vé'), '10');
}

describe('CheckInPanel', () => {
  it('keeps scanning disabled until a showtime is picked', async () => {
    setup('ok');
    expect(screen.getByRole('button', { name: /Bật camera/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled();
    await pickShowtime();
    expect(screen.getByRole('button', { name: /Bật camera/ })).toBeEnabled();
  });

  it('checks in a camera scan once, ignoring the same QR again within 3 seconds', async () => {
    const fetch = setup('ok');
    await pickShowtime();
    await userEvent.click(screen.getByRole('button', { name: /Bật camera/ }));
    await vi.waitFor(() => expect(camera.decode).not.toBeNull());
    act(() => camera.decode!({ data: 'NHIP1.TICKET' }));
    const card = await screen.findByRole('status');
    act(() => camera.decode!({ data: 'NHIP1.TICKET' }));
    act(() => camera.decode!({ data: 'NHIP1.TICKET' }));

    expect(checkins(fetch)).toHaveLength(1);
    expect(JSON.parse(String(checkins(fetch)[0]![1]!.body))).toEqual({
      token: 'NHIP1.TICKET',
      showtimeId: 10,
    });
    expect(card).toHaveTextContent('Đã check-in');
    for (const text of [
      'Ada Lovelace',
      'BK-ABCD-EFGH',
      'ada@example.test',
      '0123456789',
      'A1 (VIP) · 1 vé',
    ])
      expect(within(card).getByText(text, { exact: false })).toBeInTheDocument();
  });

  it.each([
    ['already_checked_in', 'Đã check-in lúc'],
    ['wrong_showtime', 'Vé này dành cho suất chiếu khác'],
    ['not_confirmed', 'Vé đã bị hủy hoặc thay thế'],
    ['revoked', 'Vé đã bị hủy hoặc thay thế'],
    ['invalid', 'Không phải vé nhịp hợp lệ'],
    ['not_found', 'Không phải vé nhịp hợp lệ'],
  ] as const)('shows the %s card from a pasted code', async (result, text) => {
    const fetch = setup(result);
    await pickShowtime();
    await userEvent.type(screen.getByLabelText(/dán mã vé/), 'NHIP1.PASTED');
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(await screen.findByRole('status')).toHaveTextContent(text);
    expect(JSON.parse(String(checkins(fetch)[0]![1]!.body)).token).toBe('NHIP1.PASTED');
  });
});
