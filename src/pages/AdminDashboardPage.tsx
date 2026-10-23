import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarPlus, Check, LogOut, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ApiError, API_URL } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import {
  adminLogin,
  createAdminArea,
  createAdminCinema,
  createAdminEvent,
  createAdminRoom,
  createAdminShowtime,
  deleteAdminArea,
  deleteAdminCinema,
  deleteAdminRoom,
  getAdminFacilityTree,
  getAdminSession,
  listAdminEvents,
  listAdminShowtimes,
  listAdminAreas,
  listAreaCinemas,
  listCinemaRooms,
  updateAdminEvent,
  updateAdminShowtime,
  type AdminEvent,
  type AdminShowtime,
} from '@/services/admin';

const TOKEN_KEY = 'nhip-admin-session';
const inputClass =
  'mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-wine-600 focus:outline-none';
interface EventDraft {
  eventName: string;
  directors: string;
  actors: string;
  types: string;
  languages: string;
  poster: string;
  duration: string;
  startAt: string;
  endAt: string;
}

const emptyEventDraft: EventDraft = {
  eventName: '',
  directors: '',
  actors: '',
  types: '',
  languages: '',
  poster: '',
  duration: '',
  startAt: '',
  endAt: '',
};

const splitValues = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const asDate = (value: string) => value.slice(0, 10);
const toLocalInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const toIso = (value: string) => new Date(value).toISOString();

function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearStoredToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable in a restricted browser context.
  }
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'showtimes' | 'facilities'>('events');

  const session = useQuery({
    queryKey: ['admin-session', token],
    queryFn: () => getAdminSession(token!),
    enabled: !!token,
    retry: false,
  });
  const events = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => listAdminEvents(token!),
    enabled: !!token && session.isSuccess,
  });

  const login = useMutation({
    mutationFn: () => adminLogin(username.trim(), password),
    onSuccess: (result) => {
      try {
        sessionStorage.setItem(TOKEN_KEY, result.token);
      } catch {
        setLoginError('Không thể lưu phiên đăng nhập trong trình duyệt này.');
        return;
      }
      setLoginError(null);
      setPassword('');
      setToken(result.token);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
        const retryAfter = Number(error.details?.retryAfter ?? 600);
        setLoginError(`Đăng nhập sai quá 3 lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút.`);
      } else if (error instanceof ApiError && error.status === 401) {
        const remaining = error.details?.attemptsRemaining;
        setLoginError(
          typeof remaining === 'number'
            ? `Sai tài khoản hoặc mật khẩu. Còn ${remaining} lần thử.`
            : error.message,
        );
      } else {
        setLoginError(error.message);
      }
    },
  });

  const logout = () => {
    clearStoredToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ['admin-session'] });
    queryClient.removeQueries({ queryKey: ['admin-events'] });
  };

  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) clearStoredToken();
  }, [session.error]);

  const handleAdminError = (error: Error, setMessage: (message: string) => void) => {
    if (error instanceof ApiError && error.status === 401) logout();
    else setMessage(error.message);
  };

  if (!API_URL) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-8">
        <div className="border-l-4 border-amber-500 bg-surface p-6">
          <h1 className="text-xl font-bold">Dashboard cần backend</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Hãy cấu hình VITE_API_BASE_URL và ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET.
          </p>
        </div>
      </div>
    );
  }

  if (!token || session.isError) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-12 px-4 py-12 sm:px-10 lg:grid-cols-[1fr_380px]">
        <section>
          <p className="text-sm font-semibold text-wine-700">NHỊP / ADMIN</p>
          <h1 className="mt-3 font-display text-4xl font-bold">Quản trị sự kiện</h1>
          <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
            Quản lý nội dung sự kiện và lịch chiếu từ cùng một nơi. Các thay đổi được gửi trực tiếp
            tới REST API quản trị.
          </p>
        </section>
        <form
          className="space-y-5 border border-line bg-surface p-6"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="grid size-10 place-items-center rounded-md bg-blush-100 text-wine-700">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">Đăng nhập admin</h2>
              <p className="text-xs text-ink-muted">Phiên đăng nhập chỉ tồn tại trong tab này</p>
            </div>
          </div>
          <label className="block text-sm font-medium">
            Tên đăng nhập
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Mật khẩu
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </label>
          {(loginError ?? (session.isError ? session.error.message : null)) && (
            <p role="alert" className="text-sm text-wine-700">
              {loginError ?? session.error?.message}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Đang xác thực…' : 'Đăng nhập'}
          </Button>
          <p className="text-xs text-ink-muted">3 lần đăng nhập sai sẽ khóa trong 10 phút.</p>
        </form>
      </div>
    );
  }

  if (session.isPending) {
    return <div className="px-4 py-16 text-center text-sm text-ink-muted">Đang kiểm tra phiên admin…</div>;
  }
  if (session.isError) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-semibold text-wine-700">NHỊP / ADMIN</p>
          <h1 className="mt-1 text-2xl font-bold">Quản trị nội dung</h1>
          <p className="mt-1 text-sm text-ink-muted">Đăng nhập: {session.data.username}</p>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="size-4" aria-hidden /> Đăng xuất
        </Button>
      </header>

      <nav className="mt-6 flex gap-6 border-b border-line" aria-label="Khu vực quản trị">
        <button
          type="button"
          aria-pressed={activeTab === 'events'}
          onClick={() => setActiveTab('events')}
          className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'events' ? 'border-wine-700 text-wine-700' : 'border-transparent text-ink-muted'}`}
        >
          Sự kiện
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'showtimes'}
          onClick={() => setActiveTab('showtimes')}
          className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'showtimes' ? 'border-wine-700 text-wine-700' : 'border-transparent text-ink-muted'}`}
        >
          Suất chiếu
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'facilities'}
          onClick={() => setActiveTab('facilities')}
          className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'facilities' ? 'border-wine-700 text-wine-700' : 'border-transparent text-ink-muted'}`}
        >
          Cơ sở
        </button>
      </nav>

      {events.isPending ? (
        <p className="py-12 text-sm text-ink-muted">Đang tải dữ liệu sự kiện…</p>
      ) : events.isError ? (
        <p role="alert" className="py-8 text-sm text-wine-700">{events.error.message}</p>
      ) : activeTab === 'events' ? (
        <EventsPanel events={events.data} token={token} onError={handleAdminError} />
      ) : activeTab === 'showtimes' ? (
        <ShowtimesPanel events={events.data} token={token} onError={handleAdminError} />
      ) : (
        <FacilitiesPanel token={token} onError={handleAdminError} />
      )}
    </div>
  );
}

function EventsPanel({
  events,
  token,
  onError,
}: {
  events: AdminEvent[];
  token: string;
  onError: (error: Error, setMessage: (message: string) => void) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyEventDraft);
  const [message, setMessage] = useState<string | null>(null);

  const selectEvent = (id: number | null) => {
    const selectedEvent = events.find((event) => event.eventid === id);
    setSelectedId(id);
    setDraft(
      selectedEvent
        ? {
            eventName: selectedEvent.eventname,
            directors: selectedEvent.directors.join(', '),
            actors: selectedEvent.actors.join(', '),
            types: selectedEvent.types.join(', '),
            languages: selectedEvent.languages.join(', '),
            poster: selectedEvent.poster ?? '',
            duration: String(selectedEvent.duration),
            startAt: asDate(selectedEvent.startat),
            endAt: asDate(selectedEvent.endat),
          }
        : emptyEventDraft,
    );
    setMessage(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        eventName: draft.eventName.trim(),
        directors: splitValues(draft.directors),
        actors: splitValues(draft.actors),
        types: splitValues(draft.types),
        languages: splitValues(draft.languages),
        poster: draft.poster.trim(),
        duration: Number(draft.duration),
        startAt: draft.startAt,
        endAt: draft.endAt,
      };
      return selectedId
        ? updateAdminEvent(selectedId, token, body)
        : createAdminEvent(token, body);
    },
    onSuccess: (saved) => {
      setSelectedId(saved.eventid);
      setMessage(selectedId ? 'Đã cập nhật sự kiện.' : 'Đã tạo sự kiện.');
      return queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (error) => onError(error, setMessage),
  });

  const field = (
    key: keyof EventDraft,
    label: string,
    options: { type?: string; required?: boolean; hint?: string } = {},
  ) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={options.type ?? 'text'}
        required={options.required ?? false}
        value={draft[key]}
        onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))}
        className={inputClass}
      />
      {options.hint && <span className="mt-1 block text-xs font-normal text-ink-muted">{options.hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Sự kiện ({events.length})</h2>
            <p className="mt-1 text-sm text-ink-muted">Chọn một sự kiện để chỉnh sửa.</p>
          </div>
          <Button variant="secondary" onClick={() => selectEvent(null)}>
            <Plus className="size-4" aria-hidden /> Tạo mới
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {events.map((event) => (
            <li key={event.eventid}>
              <button
                type="button"
                aria-pressed={selectedId === event.eventid}
                onClick={() => selectEvent(event.eventid)}
                className={`flex w-full items-center justify-between gap-4 py-4 text-left ${selectedId === event.eventid ? 'text-wine-700' : 'hover:text-wine-700'}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{event.eventname}</span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    ID {event.eventid} · {event.duration} phút · {event.types.join(', ') || 'Chưa phân loại'}
                  </span>
                </span>
                <Pencil className="size-4 shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold">{selectedId ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'}</h2>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            save.mutate();
          }}
        >
          <div className="sm:col-span-2">{field('eventName', 'Tên sự kiện', { required: true })}</div>
          {field('directors', 'Đạo diễn / ban tổ chức', { hint: 'Phân tách nhiều giá trị bằng dấu phẩy.' })}
          {field('actors', 'Diễn viên / khách mời', { hint: 'Phân tách nhiều giá trị bằng dấu phẩy.' })}
          {field('types', 'Thể loại', { hint: 'Phân tách nhiều giá trị bằng dấu phẩy.' })}
          {field('languages', 'Ngôn ngữ', { hint: 'Phân tách nhiều giá trị bằng dấu phẩy.' })}
          {field('duration', 'Thời lượng (phút)', { type: 'number', required: true })}
          {field('poster', 'URL poster', { required: true })}
          {field('startAt', 'Ngày bắt đầu', { type: 'date', required: true })}
          {field('endAt', 'Ngày kết thúc', { type: 'date', required: true })}
          {message && <p role="status" className="text-sm text-wine-700 sm:col-span-2">{message}</p>}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending ? 'Đang lưu…' : selectedId ? 'Lưu thay đổi' : 'Tạo sự kiện'}
            </Button>
            {selectedId && (
              <Button variant="secondary" onClick={() => selectEvent(null)}>
                Hủy chỉnh sửa
              </Button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function ShowtimesPanel({
  events,
  token,
  onError,
}: {
  events: AdminEvent[];
  token: string;
  onError: (error: Error, setMessage: (message: string) => void) => void;
}) {
  const queryClient = useQueryClient();
  const facilityTree = useQuery({
    queryKey: ['admin-facility-tree', token],
    queryFn: () => getAdminFacilityTree(token),
  });
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const eventId = selectedEventId ?? events[0]?.eventid ?? 0;
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [status, setStatus] = useState('approved');
  const [message, setMessage] = useState<string | null>(null);
  const showtimes = useQuery({
    queryKey: ['admin-showtimes', eventId],
    queryFn: () => listAdminShowtimes(eventId, token),
    enabled: eventId > 0,
  });
  const cinemaTree = facilityTree.data?.flatMap((area) =>
    area.cinemas.map((cinema) => ({ area, cinema })),
  ) ?? [];
  const roomLocation = cinemaTree.find(({ cinema }) =>
    cinema.rooms.some((room) => room.roomid === Number(roomId)),
  );
  const areaId = selectedAreaId ?? roomLocation?.area.areaid ?? facilityTree.data?.[0]?.areaid ?? 0;
  const cinemas = facilityTree.data?.find((area) => area.areaid === areaId)?.cinemas ?? [];
  const cinemaId = selectedCinemaId ?? roomLocation?.cinema.cinemaid ?? cinemas[0]?.cinemaid ?? 0;
  const rooms = cinemas.find((cinema) => cinema.cinemaid === cinemaId)?.rooms ?? [];

  const save = useMutation({
    mutationFn: () => {
      const body = {
        eventId,
        roomId: Number(roomId),
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        status: status.trim(),
      };
      return showtimeId
        ? updateAdminShowtime(showtimeId, token, body)
        : createAdminShowtime(token, body);
    },
    onSuccess: () => {
      setMessage(showtimeId ? 'Đã cập nhật suất chiếu.' : 'Đã tạo suất chiếu.');
      return queryClient.invalidateQueries({ queryKey: ['admin-showtimes', eventId] });
    },
    onError: (error) => onError(error, setMessage),
  });

  const startEdit = (showtime: AdminShowtime) => {
    setShowtimeId(showtime.showtimeid);
    setRoomId(String(showtime.roomid));
    setSelectedAreaId(null);
    setSelectedCinemaId(null);
    setStartAt(toLocalInput(showtime.startat));
    setEndAt(toLocalInput(showtime.endat));
    setStatus(showtime.status);
    setMessage(null);
  };

  const newShowtime = () => {
    setShowtimeId(null);
    setRoomId('');
    setStartAt('');
    setEndAt('');
    setStatus('approved');
    setMessage(null);
  };

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Lịch chiếu</h2>
            <label className="mt-3 block text-sm font-medium">
              Sự kiện
              <select
                value={eventId || ''}
                onChange={(event) => {
                  setSelectedEventId(Number(event.target.value));
                  setShowtimeId(null);
                  newShowtime();
                }}
                className={`${inputClass} min-w-64`}
                required
              >
                {events.map((event) => (
                  <option key={event.eventid} value={event.eventid}>{event.eventname}</option>
                ))}
              </select>
            </label>
          </div>
          <Button variant="secondary" onClick={newShowtime}>
            <CalendarPlus className="size-4" aria-hidden /> Thêm suất chiếu
          </Button>
        </div>
        {showtimes.isPending ? (
          <p className="py-8 text-sm text-ink-muted">Đang tải lịch…</p>
        ) : showtimes.isError ? (
          <p role="alert" className="py-8 text-sm text-wine-700">{showtimes.error.message}</p>
        ) : showtimes.data.length === 0 ? (
          <p className="mt-5 border-y border-line py-8 text-sm text-ink-muted">Sự kiện chưa có suất chiếu.</p>
        ) : (
          <div className="mt-5 overflow-x-auto border-y border-line">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="py-3 pr-4 font-semibold">ID</th>
                  <th className="py-3 pr-4 font-semibold">Bắt đầu</th>
                  <th className="py-3 pr-4 font-semibold">Kết thúc</th>
                  <th className="py-3 pr-4 font-semibold">Phòng</th>
                  <th className="py-3 pr-4 font-semibold">Trạng thái</th>
                  <th className="py-3 font-semibold">Sửa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {showtimes.data.map((showtime) => (
                  <tr key={showtime.showtimeid}>
                    <td className="py-3 pr-4 font-mono">{showtime.showtimeid}</td>
                    <td className="py-3 pr-4">{formatDateTime(showtime.startat, 'vi')}</td>
                    <td className="py-3 pr-4">{formatDateTime(showtime.endat, 'vi')}</td>
                    <td className="py-3 pr-4">
                      {cinemaTree.find(({ cinema }) => cinema.rooms.some((room) => room.roomid === showtime.roomid))?.cinema.cinemaname ?? 'Rạp'}
                      {' · '}{cinemaTree.flatMap(({ cinema }) => cinema.rooms).find((room) => room.roomid === showtime.roomid)?.roomname ?? `#${showtime.roomid}`}
                    </td>
                    <td className="py-3 pr-4">{showtime.status}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        aria-label={`Sửa suất ${showtime.showtimeid}`}
                        onClick={() => startEdit(showtime)}
                        disabled={facilityTree.isPending}
                        className="grid size-9 place-items-center rounded-md text-wine-700 hover:bg-blush-100"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold">{showtimeId ? `Sửa suất #${showtimeId}` : 'Tạo suất chiếu'}</h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            save.mutate();
          }}
        >
          <label className="block text-sm font-medium">
            Khu vực
            <select
              required
              value={areaId || ''}
              disabled={facilityTree.isPending || !facilityTree.data?.length}
              onChange={(event) => {
                setSelectedAreaId(Number(event.target.value));
                setSelectedCinemaId(null);
                setRoomId('');
              }}
              className={inputClass}
            >
              <option value="">Chọn khu vực</option>
              {(facilityTree.data ?? []).map((area) => (
                <option key={area.areaid} value={area.areaid}>{area.areaname}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Rạp chiếu
            <select
              required
              value={cinemaId || ''}
              disabled={!areaId || !cinemas.length}
              onChange={(event) => {
                setSelectedCinemaId(Number(event.target.value));
                setRoomId('');
              }}
              className={inputClass}
            >
              <option value="">Chọn rạp</option>
              {cinemas.map((cinema) => (
                <option key={cinema.cinemaid} value={cinema.cinemaid}>{cinema.cinemaname}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Phòng chiếu
            <select
              required
              value={roomId}
              disabled={!cinemaId || !rooms.length}
              onChange={(event) => setRoomId(event.target.value)}
              className={inputClass}
            >
              <option value="">Chọn phòng</option>
              {rooms.map((room) => (
                <option key={room.roomid} value={room.roomid}>{room.roomname} · #{room.roomid}</option>
              ))}
            </select>
            {!facilityTree.isPending && !rooms.length && (
              <span className="mt-1 block text-xs font-normal text-ink-muted">Chưa có phòng chiếu trong rạp này.</span>
            )}
          </label>
          <label className="block text-sm font-medium">
            Bắt đầu
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Kết thúc
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Trạng thái
            <input
              required
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={inputClass}
            />
          </label>
          {message && <p role="status" className="text-sm text-wine-700">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Đang lưu…' : showtimeId ? 'Lưu suất chiếu' : 'Tạo suất chiếu'}
            </Button>
            {showtimeId && <Button variant="secondary" onClick={newShowtime}>Hủy chỉnh sửa</Button>}
          </div>
        </form>
      </section>
    </div>
  );
}

function FacilitiesPanel({
  token,
  onError,
}: {
  token: string;
  onError: (error: Error, setMessage: (message: string) => void) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCinema, setSelectedCinema] = useState('');
  const [areaName, setAreaName] = useState('');
  const [cinemaName, setCinemaName] = useState('');
  const [locate, setLocate] = useState('');
  const [roomName, setRoomName] = useState('');
  const [areaMessage, setAreaMessage] = useState<string | null>(null);
  const [cinemaMessage, setCinemaMessage] = useState<string | null>(null);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'area' | 'cinema' | 'room';
    id: number;
    label: string;
  } | null>(null);

  const areas = useQuery({
    queryKey: ['admin-areas'],
    queryFn: () => listAdminAreas(token),
  });
  const areaId = Number(selectedArea) || areas.data?.[0]?.areaid || 0;
  const cinemas = useQuery({
    queryKey: ['admin-cinemas', areaId],
    queryFn: () => listAreaCinemas(areaId, token),
    enabled: areaId > 0,
  });
  const cinemaId = Number(selectedCinema) || cinemas.data?.[0]?.cinemaid || 0;
  const rooms = useQuery({
    queryKey: ['admin-rooms', cinemaId],
    queryFn: () => listCinemaRooms(cinemaId, token),
    enabled: cinemaId > 0,
  });

  const removeFacility = useMutation({
    mutationFn: async () => {
      if (!pendingDelete) throw new Error('Chưa chọn cơ sở cần xóa.');
      if (pendingDelete.kind === 'area') await deleteAdminArea(pendingDelete.id, token);
      else if (pendingDelete.kind === 'cinema') await deleteAdminCinema(pendingDelete.id, token);
      else await deleteAdminRoom(pendingDelete.id, token);
    },
    onSuccess: async () => {
      if (pendingDelete?.kind === 'area' && selectedArea === String(pendingDelete.id)) {
        setSelectedArea('');
        setSelectedCinema('');
      }
      if (pendingDelete?.kind === 'cinema' && selectedCinema === String(pendingDelete.id)) {
        setSelectedCinema('');
      }
      setDeleteMessage(`${pendingDelete?.label ?? 'Cơ sở'} đã được xóa.`);
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-areas'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-cinemas'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-facility-tree'] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'FACILITY_IN_USE') {
        setDeleteMessage('Không thể xóa vì cơ sở này vẫn đang được dữ liệu khác sử dụng.');
      } else {
        onError(error, setDeleteMessage);
      }
      setPendingDelete(null);
    },
  });

  const deleteButton = (kind: 'area' | 'cinema' | 'room', id: number, label: string) => {
    const confirming = pendingDelete?.kind === kind && pendingDelete.id === id;
    if (confirming) {
      return (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Xác nhận xóa ${label}`}
            title="Xác nhận xóa"
            disabled={removeFacility.isPending}
            onClick={() => removeFacility.mutate()}
            className="grid size-9 place-items-center rounded-md text-red-700 hover:bg-red-50"
          >
            <Check className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Hủy xóa"
            onClick={() => setPendingDelete(null)}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-paper"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        aria-label={`Xóa ${label}`}
        title={`Xóa ${label}`}
        onClick={() => {
          setDeleteMessage(null);
          setPendingDelete({ kind, id, label });
        }}
        className="grid size-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    );
  };

  const createArea = useMutation({
    mutationFn: () => createAdminArea(token, areaName.trim()),
    onSuccess: async (area) => {
      setAreaName('');
      setSelectedArea(String(area.areaid));
      setAreaMessage('Đã thêm khu vực.');
      await queryClient.invalidateQueries({ queryKey: ['admin-areas'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-cinemas'] });
    },
    onError: (error) => onError(error, setAreaMessage),
  });
  const createCinema = useMutation({
    mutationFn: () =>
      createAdminCinema(token, { cinemaName: cinemaName.trim(), areaId, locate: locate.trim() }),
    onSuccess: async (cinema) => {
      setCinemaName('');
      setLocate('');
      setSelectedCinema(String(cinema.cinemaid));
      setCinemaMessage('Đã thêm rạp chiếu.');
      await queryClient.invalidateQueries({ queryKey: ['admin-cinemas', areaId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
    },
    onError: (error) => onError(error, setCinemaMessage),
  });
  const createRoom = useMutation({
    mutationFn: () => createAdminRoom(token, { roomName: roomName.trim(), cinemaId }),
    onSuccess: async () => {
      setRoomName('');
      setRoomMessage('Đã thêm phòng chiếu.');
      await queryClient.invalidateQueries({ queryKey: ['admin-rooms', cinemaId] });
    },
    onError: (error) => onError(error, setRoomMessage),
  });

  return (
    <div className="grid items-start gap-5 py-6 xl:grid-cols-3">
      {deleteMessage && (
        <p role="status" className="text-sm text-wine-700 xl:col-span-3">{deleteMessage}</p>
      )}
      <FacilitySection icon={<Building2 className="size-5" aria-hidden />} title="Khu vực">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setAreaMessage(null);
            createArea.mutate();
          }}
        >
          <input
            required
            aria-label="Tên khu vực mới"
            placeholder="Tên khu vực"
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
            className={inputClass}
          />
          <Button type="submit" aria-label="Thêm khu vực" disabled={createArea.isPending}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </form>
        {areaMessage && <p role="status" className="mt-3 text-sm text-wine-700">{areaMessage}</p>}
        {areas.isError && <p role="alert" className="mt-3 text-sm text-wine-700">{areas.error.message}</p>}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(areas.data ?? []).map((area) => (
            <li key={area.areaid} className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={areaId === area.areaid}
                onClick={() => {
                  setSelectedArea(String(area.areaid));
                  setSelectedCinema('');
                }}
                className="flex min-w-0 flex-1 justify-between gap-3 py-3 text-left hover:text-wine-700"
              >
                <span className="font-medium">{area.areaname}</span>
                <span className="font-mono text-xs text-ink-muted">#{area.areaid}</span>
              </button>
              {deleteButton('area', area.areaid, area.areaname)}
            </li>
          ))}
        </ul>
      </FacilitySection>

      <FacilitySection icon={<Building2 className="size-5" aria-hidden />} title="Rạp chiếu">
        <label className="block text-sm font-medium">
          Khu vực
          <select
            value={areaId || ''}
            onChange={(event) => {
              setSelectedArea(event.target.value);
              setSelectedCinema('');
            }}
            className={inputClass}
            disabled={!areas.data?.length}
          >
            {(areas.data ?? []).map((area) => (
              <option key={area.areaid} value={area.areaid}>{area.areaname}</option>
            ))}
          </select>
        </label>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setCinemaMessage(null);
            createCinema.mutate();
          }}
        >
          <input
            required
            aria-label="Tên rạp chiếu mới"
            placeholder="Tên rạp"
            value={cinemaName}
            onChange={(event) => setCinemaName(event.target.value)}
            className={inputClass}
          />
          <input
            required
            aria-label="Địa chỉ rạp chiếu mới"
            placeholder="Địa chỉ / vị trí"
            value={locate}
            onChange={(event) => setLocate(event.target.value)}
            className={inputClass}
          />
          <Button type="submit" disabled={!areaId || createCinema.isPending}>
            <Plus className="size-4" aria-hidden /> Thêm rạp
          </Button>
        </form>
        {cinemaMessage && <p role="status" className="mt-3 text-sm text-wine-700">{cinemaMessage}</p>}
        {cinemas.isError && <p role="alert" className="mt-3 text-sm text-wine-700">{cinemas.error.message}</p>}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(cinemas.data ?? []).map((cinema) => (
            <li key={cinema.cinemaid} className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={cinemaId === cinema.cinemaid}
                onClick={() => setSelectedCinema(String(cinema.cinemaid))}
                className="min-w-0 flex-1 py-3 text-left hover:text-wine-700"
              >
                <span className="block font-medium">{cinema.cinemaname}</span>
                <span className="mt-1 block text-xs text-ink-muted">#{cinema.cinemaid} · {cinema.locate}</span>
              </button>
              {deleteButton('cinema', cinema.cinemaid, cinema.cinemaname)}
            </li>
          ))}
        </ul>
      </FacilitySection>

      <FacilitySection icon={<Building2 className="size-5" aria-hidden />} title="Phòng chiếu">
        <label className="block text-sm font-medium">
          Rạp
          <select
            value={cinemaId || ''}
            onChange={(event) => setSelectedCinema(event.target.value)}
            className={inputClass}
            disabled={!cinemas.data?.length}
          >
            {(cinemas.data ?? []).map((cinema) => (
              <option key={cinema.cinemaid} value={cinema.cinemaid}>{cinema.cinemaname}</option>
            ))}
          </select>
        </label>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setRoomMessage(null);
            createRoom.mutate();
          }}
        >
          <input
            required
            aria-label="Tên phòng chiếu mới"
            placeholder="Tên phòng"
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            className={inputClass}
          />
          <Button type="submit" aria-label="Thêm phòng chiếu" disabled={!cinemaId || createRoom.isPending}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </form>
        {roomMessage && <p role="status" className="mt-3 text-sm text-wine-700">{roomMessage}</p>}
        {rooms.isError && <p role="alert" className="mt-3 text-sm text-wine-700">{rooms.error.message}</p>}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(rooms.data ?? []).map((room) => (
            <li key={room.roomid} className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium">{room.roomname}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">#{room.roomid}</span>
                {deleteButton('room', room.roomid, room.roomname)}
              </span>
            </li>
          ))}
        </ul>
      </FacilitySection>
    </div>
  );
}

function FacilitySection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border border-line bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <span className="text-wine-700">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}
