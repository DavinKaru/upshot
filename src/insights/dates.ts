/** Date helpers that work in the phone's local time, which is what people expect to see. */

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for the local calendar day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM" for the local calendar month. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** The first day of the month before `date`. */
export function previousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

const shortDate = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long' });

/** "12 Nov". */
export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

/** "Thu, 12 Nov 2026". */
export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/** "November". */
export function formatMonth(date: Date): string {
  return monthName.format(date);
}

/** Parses a "YYYY-MM-DD" key back into a local date at midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
