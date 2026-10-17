import type { BookingState } from '@/types/api';

export const stateTone: Record<BookingState, string> = {
  OPEN: 'bg-emerald-600 text-white',
  REGISTER: 'bg-emerald-600 text-white',
  COMING_SOON: 'bg-wine-600 text-white',
  DETAILS_TBA: 'bg-ink-muted text-white',
  SOLD_OUT: 'bg-ink text-white',
  CLOSED: 'bg-ink-muted text-white',
  UNAVAILABLE: 'bg-ink-muted text-white',
};

const categoryTones: Record<string, string> = {
  'music-concerts': 'bg-blush-100 text-wine-700',
  campus: 'bg-emerald-50 text-emerald-700',
  'university-anniversaries': 'bg-sky-50 text-sky-700',
};
export const categoryTone = (slug: string) => categoryTones[slug] ?? 'bg-ink/5 text-ink-muted';
