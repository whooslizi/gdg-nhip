import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, CameraOff, CircleCheck, CircleX, ImageUp, TriangleAlert } from 'lucide-react';
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  checkIn,
  listAdminShowtimes,
  type AdminEvent,
  type CheckInOutcome,
  type CheckInResult,
} from '@/services/admin';

const DUPLICATE_MS = 3000; // the camera reads the same QR many times per second
const HISTORY = 20;

const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

const outcomes: Record<
  CheckInOutcome,
  { tone: 'ok' | 'warn' | 'bad'; Icon: typeof CircleCheck; title: (r: CheckInResult) => string }
> = {
  ok: { tone: 'ok', Icon: CircleCheck, title: () => 'Đã check-in' },
  already_checked_in: {
    tone: 'warn',
    Icon: TriangleAlert,
    title: (r) =>
      `Đã check-in lúc ${time(r.checkedInAt)}${r.checkedInBy ? ` bởi ${r.checkedInBy}` : ''}`,
  },
  wrong_showtime: {
    tone: 'bad',
    Icon: CircleX,
    title: (r) =>
      `Vé này dành cho suất chiếu khác${r.showtimeId ? ` (suất #${r.showtimeId})` : ''}`,
  },
  not_confirmed: { tone: 'bad', Icon: CircleX, title: () => 'Vé đã bị hủy hoặc thay thế' },
  revoked: { tone: 'bad', Icon: CircleX, title: () => 'Vé đã bị hủy hoặc thay thế' },
  invalid: { tone: 'bad', Icon: CircleX, title: () => 'Không phải vé nhịp hợp lệ' },
  not_found: { tone: 'bad', Icon: CircleX, title: () => 'Không phải vé nhịp hợp lệ' },
};

const toneClass = {
  ok: 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  warn: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  bad: 'border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
};

function ResultCard({ result }: { result: CheckInResult }) {
  const { tone, Icon, title } = outcomes[result.result];
  const rows: [string, string | undefined][] = [
    ['Mã đặt vé', result.bookingCode],
    ['Email', result.email],
    ['Số điện thoại', result.phone],
    ['Sự kiện', result.eventName],
    ['Suất chiếu', result.startAt ? formatDateTime(result.startAt, 'vi') : undefined],
    [
      'Ghế',
      result.seats?.length
        ? `${result.seats.map((s) => `${s.label} (${s.type})`).join(', ')} · ${result.seats.length} vé`
        : undefined,
    ],
    [
      'Đã thanh toán',
      result.price !== undefined ? formatMoney(result.price, 'VND', 'vi') : undefined,
    ],
    ['Mua lúc', result.purchasedAt ? formatDateTime(result.purchasedAt, 'vi') : undefined],
  ];
  return (
    <section role="status" aria-live="assertive" className={`border-l-8 p-5 ${toneClass[tone]}`}>
      <p className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
        <Icon className="size-9 shrink-0" aria-hidden />
        {title(result)}
      </p>
      {result.name && <p className="mt-3 text-3xl font-bold sm:text-4xl">{result.name}</p>}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold opacity-75">{label}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

export function CheckInPanel({
  events,
  token,
  onError,
}: {
  events: AdminEvent[];
  token: string;
  onError: (error: Error, setMessage: (message: string) => void) => void;
}) {
  const [eventId, setEventId] = useState(events[0]?.eventid ?? 0);
  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [history, setHistory] = useState<{ at: Date; result: CheckInResult }[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ token: string; at: number } | null>(null);

  const showtimes = useQuery({
    queryKey: ['admin-showtimes', eventId],
    queryFn: () => listAdminShowtimes(eventId, token),
    enabled: eventId > 0,
  });

  const scan = useMutation({
    mutationFn: (ticket: string) => checkIn(ticket, showtimeId!, token),
    onSuccess: (result) => {
      setMessage(null);
      setHistory((h) => [{ at: new Date(), result }, ...h].slice(0, HISTORY));
      navigator.vibrate?.(result.result === 'ok' ? 80 : [80, 60, 80]);
    },
    onError: (error) => onError(error, setMessage),
  });

  // Camera and file scans both land here; drop repeats of the same QR and scans mid-request.
  const onScanRef = useRef<(ticket: string) => void>(() => undefined);
  useEffect(() => {
    onScanRef.current = (ticket) => {
      const now = Date.now();
      if (!showtimeId || scan.isPending) return;
      if (last.current?.token === ticket && now - last.current.at < DUPLICATE_MS) return;
      last.current = { token: ticket, at: now };
      scan.mutate(ticket);
    };
  });

  useEffect(() => {
    if (!cameraOn || !video.current) return;
    const scanner = new QrScanner(video.current, (r) => onScanRef.current(r.data), {
      returnDetailedScanResult: true,
      preferredCamera: 'environment',
      highlightScanRegion: true,
    });
    let stopped = false;
    QrScanner.hasCamera()
      .then((has) => {
        if (stopped) return;
        if (!has) throw new Error('no-camera');
        return scanner.start();
      })
      .catch((error: unknown) => {
        if (stopped) return;
        setCameraOn(false);
        setMessage(
          error instanceof Error && error.message === 'no-camera'
            ? 'Không tìm thấy camera trên thiết bị này. Dùng ô dán mã hoặc ảnh vé bên dưới.'
            : 'Không mở được camera. Hãy cho phép quyền camera và dùng HTTPS (hoặc localhost).',
        );
      });
    return () => {
      stopped = true;
      scanner.destroy();
    };
  }, [cameraOn]);

  const scanFile = async (file: File) => {
    try {
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      onScanRef.current(r.data);
    } catch {
      setMessage('Không đọc được mã QR trong ảnh này.');
    }
  };

  const ready = showtimeId !== null;
  const latest = history[0]?.result;
  const inputClass = 'mt-1 h-11 w-full border border-line bg-surface px-3';

  return (
    <section className="grid gap-8 py-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Sự kiện
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(Number(e.target.value));
                setShowtimeId(null);
              }}
              className={inputClass}
            >
              {events.map((ev) => (
                <option key={ev.eventid} value={ev.eventid}>
                  {ev.eventname}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Suất chiếu đang soát vé
            <select
              value={showtimeId ?? ''}
              onChange={(e) => setShowtimeId(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">Chọn suất chiếu…</option>
              {showtimes.data?.map((st) => (
                <option key={st.showtimeid} value={st.showtimeid}>
                  {formatDateTime(st.startat, 'vi')} · #{st.showtimeid}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!ready && <p className="text-sm text-ink-muted">Chọn suất chiếu để bắt đầu soát vé.</p>}

        <div>
          <video
            ref={video}
            muted
            playsInline
            className={`aspect-video w-full bg-black ${cameraOn ? '' : 'hidden'}`}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={!ready}
              variant={cameraOn ? 'secondary' : 'primary'}
              onClick={() => {
                setMessage(null);
                setCameraOn((on) => !on);
              }}
            >
              {cameraOn ? (
                <>
                  <CameraOff className="size-5" aria-hidden /> Tắt camera
                </>
              ) : (
                <>
                  <Camera className="size-5" aria-hidden /> Bật camera quét vé
                </>
              )}
            </Button>
            <label
              className={`inline-flex h-12 cursor-pointer items-center gap-2 border border-ink/15 px-5 text-sm font-semibold ${ready ? '' : 'pointer-events-none opacity-50'}`}
            >
              <ImageUp className="size-5" aria-hidden /> Quét từ ảnh vé
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={!ready}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void scanFile(file);
                }}
              />
            </label>
          </div>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            last.current = null; // a deliberate re-check of the same code is allowed
            onScanRef.current(manual.trim());
          }}
        >
          <label className="block flex-1 text-sm font-medium">
            Hoặc dán mã vé (không có camera)
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="NHIP1.BK-…"
              autoComplete="off"
              className={`${inputClass} font-mono`}
            />
          </label>
          <Button type="submit" size="lg" disabled={!ready || scan.isPending}>
            Kiểm tra
          </Button>
        </form>

        {message && (
          <p role="alert" className="text-sm text-wine-700">
            {message}
          </p>
        )}
        {scan.isPending && <p className="text-sm text-ink-muted">Đang kiểm tra vé…</p>}
        {latest && <ResultCard result={latest} />}
      </div>

      <aside>
        <h3 className="text-sm font-semibold">Lượt quét gần đây</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Chưa có lượt quét nào trong phiên này.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line border-y border-line text-sm">
            {history.map(({ at, result }, i) => {
              const { Icon, title } = outcomes[result.result];
              return (
                <li key={`${at.getTime()}-${i}`} className="flex items-start gap-2 py-2">
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="tabular-nums text-ink-muted">
                    {at.toLocaleTimeString('vi-VN')}
                  </span>
                  <span>
                    {title(result)}
                    {result.name && <span className="font-semibold"> · {result.name}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </section>
  );
}
