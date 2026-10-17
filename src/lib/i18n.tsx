import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'vi' | 'en';

const vi = {
  'nav.allCategories': 'Tất cả danh mục',
  'nav.search': 'Tìm sự kiện, hòa nhạc, trường đại học...',
  'nav.findTickets': 'Tra cứu vé',
  'hero.prev': 'Slide trước',
  'hero.next': 'Slide tiếp',
  'hero.goTo': 'Đến slide',
  'events.title': 'Sự kiện',
  'events.all': 'Tất cả',
  'events.searchTitle': 'Kết quả cho “{q}”',
  'events.scroll': 'Xem thêm danh mục',
  'events.none': 'Chưa có sự kiện nào',
  'events.prev': 'Trước',
  'events.next': 'Sau',
  'event.tba': 'Sẽ được thông báo',
  'event.free': 'Miễn phí',
  'event.organizer': 'Ban tổ chức',
  'event.date': 'Thời gian',
  'event.venue': 'Địa điểm',
  'event.about': 'Giới thiệu',
  'event.available': 'Còn {count} chỗ',
  'event.performers': 'Nghệ sĩ/Khách mời',
  'state.OPEN': 'Đang mở bán',
  'state.REGISTER': 'Đang mở đăng ký',
  'state.COMING_SOON': 'Chờ mở bán',
  'state.DETAILS_TBA': 'Chưa có thông tin',
  'state.SOLD_OUT': 'Đã bán hết vé',
  'state.CLOSED': 'Đã đóng',
  'state.UNAVAILABLE': 'Không khả dụng',
  'cta.OPEN': 'Mua vé',
  'cta.REGISTER': 'Đăng ký',
  'seats.title': 'Chọn chỗ ngồi',
  'seats.stage': 'Sân khấu',
  'seats.available': 'Còn trống',
  'seats.selected': 'Bạn đang chọn',
  'seats.yours': 'Đang giữ cho bạn',
  'seats.held': 'Đang được giữ',
  'seats.sold': 'Đã bán',
  'seats.blocked': 'Không khả dụng',
  'seats.row': 'Hàng {row}',
  'seats.seat': 'Ghế',
  'seats.summary': 'Tóm tắt đặt vé',
  'seats.none': 'Chọn chỗ trên sơ đồ để tiếp tục.',
  'seats.total': 'Tổng cộng',
  'seats.estimated': 'Tạm tính — giá được xác nhận khi bạn giữ chỗ.',
  'seats.reserve': 'Giữ chỗ',
  'seats.reserving': 'Đang giữ chỗ…',
  'seats.max': 'Bạn có thể chọn tối đa {max} chỗ.',
  'seats.taken': 'Ghế {seats} vừa có người giữ và đã được bỏ khỏi lựa chọn của bạn.',
  'seats.conflict': 'Một số ghế đã có người khác giữ. Vui lòng chọn lại.',
  'seats.holdExists': 'Bạn đang giữ chỗ cho sự kiện này.',
  'seats.notOpen': 'Sự kiện này chưa mở đặt vé.',
  'seats.reserved': 'Đã giữ chỗ',
  'seats.timeLeft': 'Thời gian giữ chỗ',
  'seats.expired': 'Thời gian giữ chỗ đã hết và ghế đã được trả lại. Vui lòng chọn lại.',
  'seats.email': 'Email nhận vé',
  'seats.emailHint': 'Dùng email này cùng mã bảo mật để tra cứu vé.',
  'seats.confirm': 'Xác nhận đặt vé',
  'seats.confirming': 'Đang xác nhận…',
  'seats.release': 'Bỏ giữ chỗ',
  'seats.payNote': 'Chưa cần thanh toán trực tuyến. Mã bảo mật sẽ hiển thị sau khi xác nhận.',
  'seats.selectedCount': 'Đã chọn {count} ghế',
  'seats.showSummary': 'Xem tóm tắt',
  'seats.hideSummary': 'Ẩn tóm tắt',
  'seats.live': 'Cập nhật trực tiếp',
  'seats.offline': 'Đang kết nối lại…',
  'booking.confirmed': 'Đặt vé thành công',
  'booking.reference': 'Mã đặt vé',
  'booking.code': 'Mã bảo mật',
  'booking.codeHint':
    'Lưu lại mã này. Bạn cần email và mã bảo mật để tra cứu vé trên thiết bị khác.',
  'booking.confirmedAt': 'Xác nhận lúc',
  'booking.note': 'Hãy lưu lại mã đặt vé và mã bảo mật để check-in.',
  'booking.backToEvent': 'Quay lại sự kiện',
  'lookup.title': 'Tra cứu vé',
  'lookup.body':
    'Nhập email và mã bảo mật bạn nhận được khi đặt vé để xem vé, hoặc hủy vé và nhận hoàn tiền.',
  'lookup.email': 'Email',
  'lookup.code': 'Mã bảo mật',
  'lookup.submit': 'Tra cứu',
  'lookup.notFound': 'Không tìm thấy vé với email và mã này.',
  'lookup.thisDevice': 'Vé đã đặt trên thiết bị này',
  'booking.cancelled': 'Vé đã hủy',
  'booking.cancelCode': 'Mã hủy vé bí mật',
  'booking.cancelCodeHint':
    'Giữ bí mật mã này và không chia sẻ cho ai. Bạn cần nó để hủy vé và nhận hoàn tiền.',
  'booking.refunded': 'Đã hoàn tiền',
  'cancel.title': 'Hủy vé & hoàn tiền',
  'cancel.body':
    'Nhập mã hủy vé bí mật bạn nhận được khi đặt vé. Vé sẽ bị hủy, ghế được trả lại và bạn được hoàn 100% tiền vé.',
  'cancel.code': 'Mã hủy vé',
  'cancel.submit': 'Hủy vé',
  'cancel.submitting': 'Đang hủy…',
  'cancel.wrongCode': 'Mã hủy vé không đúng.',
  'cancel.done': 'Đã hủy vé thành công',
  'cancel.refund':
    'Yêu cầu hoàn {amount} đã được ghi nhận. (Bản demo — không có giao dịch tiền thật.)',
  'cancel.noRefund': 'Vé miễn phí nên không có khoản cần hoàn.',
  'cancel.cat': 'Tiếc quá! Đây là vài chú mèo để bạn vui lên.',
  'cancel.catCredit': 'Video: Jeromi Mikhael, CC0, Wikimedia Commons',
  'common.retry': 'Thử lại',
  'common.error': 'Đã có lỗi xảy ra',
  'common.home': 'Về trang chủ',
  'notFound.title': 'Không tìm thấy trang',
  'footer.tagline': 'Vé cho những khoảnh khắc đáng nhớ của giảng đường.',
  'footer.note': 'nhịp™ là sản phẩm của Nhóm 3, thuộc nhánh Web Developer — GDG-HUST Probation.',
  'footer.disclaimer':
    'nhịp™ được xây dựng duy nhất cho mục đích đánh giá trong vòng Probation của GDG-HUST và không phải là một dịch vụ thương mại. Mọi sự kiện, sản phẩm, tổ chức, cá nhân, hình ảnh, giá vé và nội dung xuất hiện trên trang chỉ mang tính minh họa cho sản phẩm. Chúng tôi không phát ngôn thay, không đại diện cho, không bán vé, không thu tiền và không tổ chức bất kỳ sự kiện nào được nhắc đến. Mọi giao dịch, mã đặt vé, mã hủy vé và khoản hoàn tiền đều là giả lập, không có giá trị thực tế. Việc nhắc đến bất kỳ tổ chức, cá nhân hay nhãn hiệu nào không có nghĩa là họ bảo trợ, xác nhận hay có liên kết với sản phẩm này; mọi nhãn hiệu thuộc về chủ sở hữu tương ứng. Nếu bạn là chủ sở hữu nội dung và muốn gỡ bỏ, vui lòng liên hệ GDG-HUST.',
  'footer.copyright': '© 2026 nhịp™',
  'footer.media': 'Hình ảnh và video được sử dụng theo giấy phép CC0/phạm vi công cộng.',
  'footer.cancel': 'Hủy vé & hoàn tiền',
};

type Key = keyof typeof vi;

const en: Record<Key, string> = {
  'nav.allCategories': 'All categories',
  'nav.search': 'Search events, concerts, universities...',
  'nav.findTickets': 'Find my tickets',
  'hero.prev': 'Previous slide',
  'hero.next': 'Next slide',
  'hero.goTo': 'Go to slide',
  'events.title': 'Events',
  'events.all': 'All',
  'events.searchTitle': 'Results for “{q}”',
  'events.scroll': 'More categories',
  'events.none': 'No events yet',
  'events.prev': 'Previous',
  'events.next': 'Next',
  'event.tba': 'To be announced',
  'event.free': 'Free',
  'event.organizer': 'Organizer',
  'event.date': 'Date & time',
  'event.venue': 'Venue',
  'event.about': 'About this event',
  'event.available': '{count} left',
  'event.performers': 'Artists & guests',
  'state.OPEN': 'On sale',
  'state.REGISTER': 'Registration open',
  'state.COMING_SOON': 'Coming soon',
  'state.DETAILS_TBA': 'Details TBA',
  'state.SOLD_OUT': 'Sold out',
  'state.CLOSED': 'Closed',
  'state.UNAVAILABLE': 'Unavailable',
  'cta.OPEN': 'Get tickets',
  'cta.REGISTER': 'Register',
  'seats.title': 'Choose your seats',
  'seats.stage': 'Stage',
  'seats.available': 'Available',
  'seats.selected': 'Your selection',
  'seats.yours': 'Reserved for you',
  'seats.held': 'On hold',
  'seats.sold': 'Sold',
  'seats.blocked': 'Unavailable',
  'seats.row': 'Row {row}',
  'seats.seat': 'Seat',
  'seats.summary': 'Booking summary',
  'seats.none': 'Select seats on the map to continue.',
  'seats.total': 'Total',
  'seats.estimated': 'Estimate — confirmed when you reserve.',
  'seats.reserve': 'Reserve seats',
  'seats.reserving': 'Reserving…',
  'seats.max': 'You can select up to {max} seats.',
  'seats.taken': 'Seat {seats} was just taken and removed from your selection.',
  'seats.conflict': 'Some seats were taken by someone else. Please choose again.',
  'seats.holdExists': 'You already have seats on hold for this event.',
  'seats.notOpen': 'Booking is not open for this event.',
  'seats.reserved': 'Seats reserved',
  'seats.timeLeft': 'Hold time left',
  'seats.expired': 'Your hold expired and the seats were released. Please choose again.',
  'seats.email': 'Email for your tickets',
  'seats.emailHint': 'Use it with your security code to look up the booking.',
  'seats.confirm': 'Confirm booking',
  'seats.confirming': 'Confirming…',
  'seats.release': 'Release seats',
  'seats.payNote': 'No online payment needed. Your security code appears after you confirm.',
  'seats.selectedCount': '{count} seats selected',
  'seats.showSummary': 'Show summary',
  'seats.hideSummary': 'Hide summary',
  'seats.live': 'Live availability',
  'seats.offline': 'Reconnecting…',
  'booking.confirmed': 'Booking confirmed',
  'booking.reference': 'Booking reference',
  'booking.code': 'Security code',
  'booking.codeHint':
    'Save this code. You need your email and this code to view the booking on another device.',
  'booking.confirmedAt': 'Confirmed at',
  'booking.note': 'Keep your booking reference and security code for check-in.',
  'booking.backToEvent': 'Back to event',
  'lookup.title': 'Find my tickets',
  'lookup.body':
    'Enter the email and security code from your booking to view it, or to cancel it and get a refund.',
  'lookup.email': 'Email',
  'lookup.code': 'Security code',
  'lookup.submit': 'Look up',
  'lookup.notFound': 'No booking matches that email and code.',
  'lookup.thisDevice': 'Booked on this device',
  'booking.cancelled': 'Booking cancelled',
  'booking.cancelCode': 'Secret cancellation code',
  'booking.cancelCodeHint':
    'Keep this code private. You need it to cancel your booking and get a refund.',
  'booking.refunded': 'Refunded',
  'cancel.title': 'Cancel & refund',
  'cancel.body':
    'Enter the secret cancellation code you got when you booked. The booking is cancelled, the seats are released and you get a 100% refund.',
  'cancel.code': 'Cancellation code',
  'cancel.submit': 'Cancel booking',
  'cancel.submitting': 'Cancelling…',
  'cancel.wrongCode': 'That cancellation code is wrong.',
  'cancel.done': 'Booking cancelled',
  'cancel.refund': 'Your refund of {amount} has been requested. (Demo only — no real money moves.)',
  'cancel.noRefund': 'This ticket was free, so there is nothing to refund.',
  'cancel.cat': 'Sorry to see you go! Here are some kittens to cheer you up.',
  'cancel.catCredit': 'Video: Jeromi Mikhael, CC0, Wikimedia Commons',
  'common.retry': 'Try again',
  'common.error': 'Something went wrong',
  'common.home': 'Back to home',
  'notFound.title': 'Page not found',
  'footer.tagline': 'Tickets for the moments campuses remember.',
  'footer.note': 'nhịp™ is a product of Group 3, Web Developer branch — GDG-HUST Probation.',
  'footer.disclaimer':
    'nhịp™ was built solely for assessment in the GDG-HUST Probation round and is not a commercial service. All events, products, organizations, people, images, prices and content on this site exist only to demonstrate the product. We do not speak for or represent, sell tickets for, take payment for, or organize or conduct any event mentioned. All transactions, booking references, cancellation codes and refunds are simulated and have no real-world value. Mentioning any organization, person or brand does not imply their sponsorship, endorsement or affiliation; all trademarks belong to their respective owners. If you own any content here and want it removed, please contact GDG-HUST.',
  'footer.copyright': '© 2026 nhịp™',
  'footer.media': 'Images and video are used under CC0/public-domain terms.',
  'footer.cancel': 'Cancel & refund',
};

export type TranslationKey = Key;

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function storedLocale(): Locale {
  try {
    return localStorage.getItem('locale') === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function I18nProvider({
  children,
  locale: fixed,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => fixed ?? storedLocale());
  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        document.documentElement.lang = next;
        try {
          localStorage.setItem('locale', next);
        } catch {
          // private mode; the choice just won't persist
        }
      },
      t: (key, vars) =>
        (locale === 'vi' ? vi : en)[key].replace(/\{(\w+)\}/g, (_, k: string) =>
          String(vars?.[k] ?? ''),
        ),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
