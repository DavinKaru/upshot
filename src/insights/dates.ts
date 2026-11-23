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
const shortMonthName = new Intl.DateTimeFormat('en-AU', { month: 'short' });

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

/** "Nov". */
export function formatShortMonth(date: Date): string {
  return shortMonthName.format(date);
}

/** The first day of a "YYYY-MM" month key, at local midnight. */
export function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, 1);
}

/** Parses a "YYYY-MM-DD" key back into a local date at midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * A stretch of time from `start` up to, but not including, `end`. Half-open, so ranges that
 * meet at a midnight never count the same moment twice.
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/** True when `at` falls within `range`. */
export function inRange(at: Date, range: DateRange): boolean {
  return at >= range.start && at < range.end;
}

/** Local midnight at the start of the day containing `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Local midnight `days` calendar days after the day containing `date` (before, if negative).
 * Counts calendar days rather than 24-hour periods, so daylight saving changes don't shift it.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The whole local calendar month containing `date`. */
export function monthRange(date: Date): DateRange {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

/**
 * The local calendar month containing `date`, from the 1st up to and including `date`: the month
 * so far, the same stretch `monthlySummary` and `spentToday` count.
 */
export function monthToDate(date: Date): DateRange {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getTime() + 1),
  };
}

/**
 * How far into its local day `date` is, by the clock on the wall, in milliseconds. On a day when
 * daylight saving starts or ends this is the clock time, not the time elapsed since midnight, so
 * "by 3 pm" means 3 pm on every day.
 */
export function timeOfDay(date: Date): number {
  return (
    ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +
    date.getMilliseconds()
  );
}
