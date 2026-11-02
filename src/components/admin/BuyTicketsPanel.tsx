import { Ticket } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/Button';
import type { AdminEvent } from '@/services/admin';

/**
 * Admins buy through the normal seat page: with this tab's admin login it skips the waiting
 * room and has no seat limit. Same-tab links, because the login lives in this tab's storage.
 */
export function BuyTicketsPanel({ events }: { events: AdminEvent[] }) {
  return (
    <section className="py-6">
      <p className="max-w-2xl text-sm text-ink-muted">
        Mở sơ đồ ghế bằng phiên admin này: không cần xếp hàng, không giới hạn số ghế mỗi lần giữ
        chỗ. Ghế vẫn được giữ 10 phút và thanh toán như khách thường.
      </p>
      {events.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">Chưa có sự kiện nào.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {events.map((event) => (
            <li key={event.eventid} className="flex items-center justify-between gap-4 py-3">
              <span className="font-medium">{event.eventname}</span>
              <Link
                to={`/events/${event.eventid}/seats`}
                className={buttonClass('secondary', 'sm', 'shrink-0')}
              >
                <Ticket className="size-4" aria-hidden /> Chọn ghế
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
