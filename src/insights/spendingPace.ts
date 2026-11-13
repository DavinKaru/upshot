import type { TransactionResource } from '@/api/up/types';

import { monthKey, previousMonth } from './dates';
import { isSpending, sameMomentLastMonth } from './spendingByCategory';

export interface SpendingPace {
  /** Running total spent by the end of each day this month, from the 1st to today, in cents. */
  thisMonth: number[];
  /** Running total spent by the end of each day last month, for the whole month, in cents. */
  lastMonth: number[];
  /** How many days this month has. */
  daysInMonth: number;
  /** Spent so far this month, up to `date`. */
  total: number;
  /** Spent last month by the same day and time, so a half-finished month compares fairly. */
  lastMonthSoFar: number;
}

/** Adds up a list of daily amounts into running totals. */
function runningTotals(daily: readonly number[]): number[] {
  let sum = 0;
  return daily.map((amount) => (sum += amount));
}

/**
 * How spending has built up over the month containing `date`, day by day, next to the whole of
 * last month. Counts the same spending as `spendingByCategory`: money going out, without
 * transfers between accounts or money coming in.
 */
export function spendingPace(
  transactions: readonly TransactionResource[],
  date: Date = new Date(),
): SpendingPace {
  const thisKey = monthKey(date);
  const lastKey = monthKey(previousMonth(date));
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daysInLastMonth = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  const cutoff = sameMomentLastMonth(date);

  const thisDaily: number[] = Array.from({ length: date.getDate() }, () => 0);
  const lastDaily: number[] = Array.from({ length: daysInLastMonth }, () => 0);
  let lastMonthSoFar = 0;

  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    const at = new Date(tx.attributes.createdAt);
    const spent = -tx.attributes.amount.valueInBaseUnits;
    const month = monthKey(at);
    if (month === thisKey && at <= date) {
      thisDaily[at.getDate() - 1] = (thisDaily[at.getDate() - 1] ?? 0) + spent;
    } else if (month === lastKey) {
      lastDaily[at.getDate() - 1] = (lastDaily[at.getDate() - 1] ?? 0) + spent;
      if (at <= cutoff) lastMonthSoFar += spent;
    }
  }

  const thisMonth = runningTotals(thisDaily);
  return {
    thisMonth,
    lastMonth: runningTotals(lastDaily),
    daysInMonth,
    total: thisMonth[thisMonth.length - 1] ?? 0,
    lastMonthSoFar,
  };
}
