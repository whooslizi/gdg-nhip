import type { BookingState } from '@/types/api';

export const stateTone: Record<BookingState, string> = {
  OPEN: 'bg-emerald-600 text-white',
  REGISTER: 'bg-emerald-600 text-white',
  COMING_SOON: 'bg-wine-600 text-paper',
  DETAILS_TBA: 'bg-ink-muted text-paper',
  SOLD_OUT: 'bg-ink text-paper',
  CLOSED: 'bg-ink-muted text-paper',
  UNAVAILABLE: 'bg-ink-muted text-paper',
};

const categoryTones: Record<string, string> = {
  'music-concerts': 'bg-blush-100 text-wine-700',
  campus: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'university-anniversaries': 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
};
export const categoryTone = (slug: string) => categoryTones[slug] ?? 'bg-ink/5 text-ink-muted';
