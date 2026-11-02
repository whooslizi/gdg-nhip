import {
  buildIcs,
  escapeText,
  foldLine,
  googleCalendarUrl,
  icsDate,
  type CalendarEvent,
} from './ics';

const event: CalendarEvent = {
  uid: 'BK-ABCD-EFGH@nhip',
  title: 'Đêm nhạc Hội trường C2: Những bản tình ca Việt Nam bất hủ, phần hai; khách mời đặc biệt',
  start: new Date('2026-11-10T12:00:00Z'),
  end: new Date('2026-11-10T14:30:00Z'),
  location: 'Hội trường C2, Đại học Bách khoa Hà Nội',
  description: 'Mã đặt vé: BK-ABCD-EFGH\nGhế: A1, A2',
  url: 'https://gdg-nhip.vercel.app/booking/BK-ABCD-EFGH',
};
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('ics', () => {
  it('uses CRLF line endings only', () => {
    const ics = buildIcs(event);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('folds long Vietnamese lines at 75 bytes and unfolds back to the original', () => {
    const line = `SUMMARY:${escapeText(event.title)}`;
    expect(bytes(line)).toBeGreaterThan(75);
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(bytes(part)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    for (const part of buildIcs(event).split('\r\n')) expect(bytes(part)).toBeLessThanOrEqual(75);
  });

  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });

  it('formats dates as UTC basic format', () => {
    expect(icsDate(new Date('2026-11-10T19:05:09+07:00'))).toBe('20261110T120509Z');
  });

  it('uses the injected now for DTSTAMP and includes the event fields', () => {
    const ics = buildIcs(event, new Date('2026-11-02T08:00:00Z')).replace(/\r\n /g, '');
    expect(ics).toContain('DTSTAMP:20261102T080000Z\r\n');
    expect(ics).toContain('DTSTART:20261110T120000Z\r\n');
    expect(ics).toContain('DTEND:20261110T143000Z\r\n');
    expect(ics).toContain('UID:BK-ABCD-EFGH@nhip\r\n');
    expect(ics).toContain('DESCRIPTION:Mã đặt vé: BK-ABCD-EFGH\\nGhế: A1\\, A2\r\n');
  });

  it('builds a Google Calendar link with start/end dates', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261110T120000Z/20261110T143000Z');
    expect(url.searchParams.get('text')).toBe(event.title);
  });
});
