import type { Category, EventSummary } from '@/types/api';
import type { Locale } from './i18n';

const intl = (locale: Locale) => (locale === 'vi' ? 'vi-VN' : 'en-GB');

/** Amounts are integer minor units; VND has none. */
export function formatMoney(amountMinor: number, currency: string, locale: Locale) {
  const vnd = currency === 'VND';
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: vnd ? 0 : 2,
  }).format(vnd ? amountMinor : amountMinor / 100);
}

const dateFormat = (locale: Locale, withTime: boolean) =>
  new Intl.DateTimeFormat(intl(locale), {
    dateStyle: 'long',
    ...(withTime && { timeStyle: 'short' }),
    timeZone: 'Asia/Ho_Chi_Minh',
  });

export const formatDate = (iso: string, locale: Locale) =>
  dateFormat(locale, false).format(new Date(iso));
export const formatDateTime = (iso: string, locale: Locale) =>
  dateFormat(locale, true).format(new Date(iso));

export function placeAndDate(e: Pick<EventSummary, 'city' | 'startAt'>, locale: Locale) {
  return [e.city, e.startAt && formatDate(e.startAt, locale)].filter(Boolean).join(', ') || null;
}

export const categoryName = (c: Category, locale: Locale) =>
  locale === 'vi' ? c.nameVi : c.nameEn;

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
