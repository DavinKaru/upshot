import type { TransactionResource } from '@/api/up/types';

import { addDays, dayKey, inRange, startOfDay, timeOfDay, type DateRange } from './dates';
import { isSpending } from './spendingByCategory';

/** How many complete days the average day is taken over, at most. */
export const AVERAGE_DAYS = 30;

export interface DaySpending {
  /** "YYYY-MM-DD", a local calendar day. */
  day: string;
  /** Spent over the whole day, in cents, as a positive number. */
  spent: number;
  /**
   * Spent that day up to the time of day it is now, by the clock, in cents. On a day when
   * daylight saving started or ended, that's the same clock time, not the same hours since
   * midnight.
   */
  spentByNow: number;
}

export interface AverageDay {
  /**
   * How many complete days the average is over: the last `AVERAGE_DAYS`, or fewer when your
   * transactions start more recently than that. 0 when there's nothing before today.
   */
  days: number;
  /** Mean spent per day, in whole cents, counting days with no spending. `null` if `days` is 0. */
  spent: number | null;
  /** Mean spent per day by this time of day, in whole cents, or `null` if `days` is 0. */
  spentByNow: number | null;
}

/** How much more was spent today than on another day: negative means less. In cents. */
export interface SpentTodayDifferences {
  yesterday: number;
  yesterdayByNow: number;
  sameDayLastWeek: number;
  sameDayLastWeekByNow: number;
  /** `null` when there's no average day to compare with. */
  averageDay: number | null;
  averageDayByNow: number | null;
}

export interface SpentToday {
  /** "YYYY-MM-DD", today. */
  day: string;
  /** Spent so far today, in cents, as a positive number. */
  spent: number;
  yesterday: DaySpending;
  /** The same weekday a week ago. */
  sameDayLastWeek: DaySpending;
  /** The seven days before today, oldest first: from the same day last week to yesterday. */
  lastSevenDays: DaySpending[];
  averageDay: AverageDay;
  /**
   * Today's spending minus each comparison, so a UI can say "$12 less than yesterday by now"
   * from `yesterdayByNow` = -1200.
   */
  difference: SpentTodayDifferences;
}

/**
 * How much you've spent today, up to `date`, next to yesterday, each of the last seven days,
 * the same day last week and an average day, both for the whole day and up to the same time of
 * day.
 *
 * Spending is the same as everywhere else: money going out, without transfers between your own
 * accounts (such as Round Ups) or money coming in, so a refund doesn't reduce it. Each
 * transaction counts on the local day it was made (`createdAt`), whether it's held or settled.
 *
 * The average day is the mean over the `AVERAGE_DAYS` complete days before today, counting days
 * you spent nothing. If your earliest transaction is more recent than that, the average starts
 * on that transaction's day instead, so a new account isn't averaged over days before it had any
 * history.
 */
export function spentToday(
  transactions: readonly TransactionResource[],
  date: Date = new Date(),
): SpentToday {
  const today = dayKey(date);
  const now = timeOfDay(date);
  const windowStart = addDays(date, -AVERAGE_DAYS);

  type Totals = { spent: number; spentByNow: number };
  const days = new Map<string, Totals>();
  let earliest: Date | null = null;

  for (const tx of transactions) {
    const at = new Date(tx.attributes.createdAt);
    // Also skips a `createdAt` that isn't a date, which would otherwise spoil `earliest`.
    if (!(at <= date)) continue;
    if (earliest === null || at < earliest) earliest = at;
    if (at < windowStart || !isSpending(tx)) continue;
    const key = dayKey(at);
    let totals = days.get(key);
    if (!totals) {
      totals = { spent: 0, spentByNow: 0 };
      days.set(key, totals);
    }
    const spent = -tx.attributes.amount.valueInBaseUnits;
    totals.spent += spent;
    if (timeOfDay(at) <= now) totals.spentByNow += spent;
  }

  const dayAgo = (n: number): DaySpending => {
    const key = dayKey(addDays(date, -n));
    const totals = days.get(key);
    return { day: key, spent: totals?.spent ?? 0, spentByNow: totals?.spentByNow ?? 0 };
  };

  // Complete days before today that the average covers, back to the first day with history.
  let averageDays = 0;
  if (earliest !== null) {
    const first = startOfDay(earliest);
    while (averageDays < AVERAGE_DAYS && addDays(date, -(averageDays + 1)) >= first) {
      averageDays++;
    }
  }
  let averageSpent = 0;
  let averageByNow = 0;
  for (let n = 1; n <= averageDays; n++) {
    const day = dayAgo(n);
    averageSpent += day.spent;
    averageByNow += day.spentByNow;
  }
  const averageDay: AverageDay =
    averageDays > 0
      ? {
          days: averageDays,
          spent: Math.round(averageSpent / averageDays),
          spentByNow: Math.round(averageByNow / averageDays),
        }
      : { days: 0, spent: null, spentByNow: null };

  const spent = days.get(today)?.spent ?? 0;
  const lastSevenDays = [7, 6, 5, 4, 3, 2, 1].map(dayAgo);
  const yesterday = lastSevenDays[6] as DaySpending;
  const sameDayLastWeek = lastSevenDays[0] as DaySpending;

  return {
    day: today,
    spent,
    yesterday,
    sameDayLastWeek,
    lastSevenDays,
    averageDay,
    difference: {
      yesterday: spent - yesterday.spent,
      yesterdayByNow: spent - yesterday.spentByNow,
      sameDayLastWeek: spent - sameDayLastWeek.spent,
      sameDayLastWeekByNow: spent - sameDayLastWeek.spentByNow,
      averageDay: averageDay.spent === null ? null : spent - averageDay.spent,
      averageDayByNow: averageDay.spentByNow === null ? null : spent - averageDay.spentByNow,
    },
  };
}

export interface DailySpending {
  /** Every local calendar day the range touches, oldest first, with what was spent in range. */
  days: { day: string; spent: number }[];
  /** Spent across the whole range, in cents. Always the sum of `days`. */
  total: number;
}

/**
 * Spending on each local calendar day within `range`, with the same rules as `spentToday`. A
 * range that starts or ends partway through a day includes that day, counting only what falls
 * within the range, and an empty range has no days.
 *
 * Only what was made within `range` counts, even if that is after now. For this month so far,
 * pass `monthToDate(now)` rather than `monthRange(now)`.
 */
export function spendingByDay(
  transactions: readonly TransactionResource[],
  range: DateRange,
): DailySpending {
  if (!(range.start < range.end)) return { days: [], total: 0 };
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    const at = new Date(tx.attributes.createdAt);
    if (!inRange(at, range)) continue;
    const key = dayKey(at);
    totals.set(key, (totals.get(key) ?? 0) - tx.attributes.amount.valueInBaseUnits);
  }

  const days: DailySpending['days'] = [];
  let total = 0;
  for (let day = startOfDay(range.start); day < range.end; day = addDays(day, 1)) {
    const key = dayKey(day);
    const spent = totals.get(key) ?? 0;
    days.push({ day: key, spent });
    total += spent;
  }
  return { days, total };
}
