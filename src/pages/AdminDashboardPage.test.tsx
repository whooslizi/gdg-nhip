import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch, renderRoute } from '@/test/utils';
import { AdminDashboardPage } from './AdminDashboardPage';

const renderAdmin = () =>
  renderRoute(<AdminDashboardPage />, { path: '/admin', url: '/admin' });

describe('AdminDashboardPage', () => {
  beforeEach(() => sessionStorage.clear());

  it('logs in, validates the bearer session, and loads the event dashboard', async () => {
    const fetch = mockFetch((url) => {
      if (url.pathname.endsWith('/admin/login'))
        return {
          body: {
            success: true,
            data: { token: 'signed-token', username: 'ops', expiresAt: Date.now() + 60_000 },
          },
        };
      if (url.pathname.endsWith('/admin/session'))
        return {
          body: {
            success: true,
            data: { username: 'ops', expiresAt: Date.now() + 60_000 },
          },
        };
      if (url.pathname.endsWith('/events')) return { body: [] };
    });
    renderAdmin();

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'ops');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'correct-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Đăng nhập: ops')).toBeInTheDocument();
    const sessionCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/session'));
    expect((sessionCall?.[1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer signed-token',
    );
  });

  it('shows the server lockout response after three failed logins', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/admin/login'))
        return {
          status: 429,
          body: {
            success: false,
            code: 'LOGIN_LOCKED',
            message: 'Too many failed login attempts. Try again later.',
            details: { retryAfter: 600 },
          },
        };
    });
    renderAdmin();

    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'ops');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('thử lại sau 10 phút');
  });

  it('creates an area, cinema, and room with their parent IDs', async () => {
    sessionStorage.setItem('nhip-admin-session', 'signed-token');
    const areas: { areaid: number; areaname: string }[] = [];
    const cinemas: { cinemaid: number; cinemaname: string; areaid: number; locate: string }[] = [];
    const rooms: { roomid: number; roomname: string; cinemaid: number }[] = [];
    const fetch = mockFetch((url, init) => {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      if (url.pathname.endsWith('/admin/session'))
        return { body: { success: true, data: { username: 'ops', expiresAt: Date.now() + 60_000 } } };
      if (url.pathname.endsWith('/events')) return { body: [] };
      if (url.pathname.endsWith('/areas') && init.method === 'POST') {
        const area = { areaid: 4, areaname: body.areaName };
        areas.push(area);
        return { status: 201, body: { success: true, data: area } };
      }
      if (url.pathname.endsWith('/areas')) return { body: areas };
      if (url.pathname.endsWith('/areas/4/cinemas')) return { body: { areaId: 4, cinemas } };
      if (url.pathname.endsWith('/admin/cinemas')) {
        const cinema = {
          cinemaid: 8,
          cinemaname: body.cinemaName,
          areaid: body.areaId,
          locate: body.locate,
        };
        cinemas.push(cinema);
        return { status: 201, body: { success: true, data: cinema } };
      }
      if (url.pathname.endsWith('/cinemas/8/rooms')) return { body: { cinemaId: 8, rooms } };
      if (url.pathname.endsWith('/admin/rooms')) {
        const room = { roomid: 12, roomname: body.roomName, cinemaid: body.cinemaId };
        rooms.push(room);
        return { status: 201, body: { success: true, data: room } };
      }
    });
    renderAdmin();

    await userEvent.click(await screen.findByRole('button', { name: 'Cơ sở' }));
    await userEvent.type(screen.getByLabelText('Tên khu vực mới'), 'Hà Nội');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm khu vực' }));
    await userEvent.type(await screen.findByLabelText('Tên rạp chiếu mới'), 'Rạp trung tâm');
    await userEvent.type(screen.getByLabelText('Địa chỉ rạp chiếu mới'), 'Ba Đình');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm rạp' }));
    await userEvent.type(await screen.findByLabelText('Tên phòng chiếu mới'), 'Phòng 1');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm phòng chiếu' }));

    expect(await screen.findByText('Đã thêm phòng chiếu.')).toBeInTheDocument();
    const cinemaRequest = fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/cinemas'));
    const roomRequest = fetch.mock.calls.find(([url]) => String(url).endsWith('/admin/rooms'));
    expect(JSON.parse(String(cinemaRequest?.[1]?.body))).toEqual({
      cinemaName: 'Rạp trung tâm',
      areaId: 4,
      locate: 'Ba Đình',
    });
    expect(JSON.parse(String(roomRequest?.[1]?.body))).toEqual({ roomName: 'Phòng 1', cinemaId: 8 });
  });

  it('selects the existing room hierarchy when editing a showtime', async () => {
    sessionStorage.setItem('nhip-admin-session', 'signed-token');
    mockFetch((url) => {
      if (url.pathname.endsWith('/admin/session'))
        return { body: { success: true, data: { username: 'ops', expiresAt: Date.now() + 60_000 } } };
      if (url.pathname.endsWith('/events'))
        return {
          body: [{
            eventid: 2,
            eventname: 'Screening',
            directors: [],
            actors: [],
            types: [],
            languages: [],
            poster: null,
            duration: 120,
            startat: '2026-11-01',
            endat: '2026-11-01',
          }],
        };
      if (url.pathname.endsWith('/events/2/showtimes'))
        return {
          body: {
            eventId: 2,
            showtimes: [{
              showtimeid: 20,
              eventid: 2,
              roomid: 12,
              startat: '2026-11-01T10:00:00Z',
              endat: '2026-11-01T12:00:00Z',
              status: 'approved',
            }],
          },
        };
      if (url.pathname.endsWith('/areas')) return { body: [{ areaid: 4, areaname: 'Hà Nội' }] };
      if (url.pathname.endsWith('/areas/4/cinemas'))
        return { body: { areaId: 4, cinemas: [{ cinemaid: 8, cinemaname: 'Rạp trung tâm', areaid: 4, locate: 'Ba Đình' }] } };
      if (url.pathname.endsWith('/cinemas/8/rooms'))
        return { body: { cinemaId: 8, rooms: [{ roomid: 12, roomname: 'Phòng 1', cinemaid: 8 }] } };
    });
    renderAdmin();

    await userEvent.click(await screen.findByRole('button', { name: 'Suất chiếu' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa suất 20' }));

    expect(await screen.findByLabelText('Khu vực')).toHaveValue('4');
    expect(screen.getByLabelText('Rạp chiếu')).toHaveValue('8');
    expect(screen.getByLabelText('Phòng chiếu')).toHaveValue('12');
  });

  it('confirms and deletes an unused area', async () => {
    sessionStorage.setItem('nhip-admin-session', 'signed-token');
    let areaExists = true;
    const fetch = mockFetch((url, init) => {
      if (url.pathname.endsWith('/admin/session'))
        return { body: { success: true, data: { username: 'ops', expiresAt: Date.now() + 60_000 } } };
      if (url.pathname.endsWith('/events')) return { body: [] };
      if (url.pathname.endsWith('/areas/4') && init.method === 'DELETE') {
        areaExists = false;
        return { body: { success: true, data: { areaid: 4 } } };
      }
      if (url.pathname.endsWith('/areas'))
        return { body: areaExists ? [{ areaid: 4, areaname: 'Hà Nội' }] : [] };
      if (url.pathname.endsWith('/areas/4/cinemas')) return { body: { areaId: 4, cinemas: [] } };
    });
    renderAdmin();

    await userEvent.click(await screen.findByRole('button', { name: 'Cơ sở' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Hà Nội' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa Hà Nội' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Hà Nội đã được xóa');
    expect(fetch.mock.calls.some(([url, init]) =>
      String(url).endsWith('/admin/areas/4') && init?.method === 'DELETE',
    )).toBe(true);
  });
});
