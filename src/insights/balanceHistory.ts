import type { AccountResource, TransactionResource } from '@/api/up/types';

import { dayKey } from './dates';

export interface BalancePoint {
  /** Local calendar day, "YYYY-MM-DD". */
  day: string;
  /** Balance at the end of that day, in cents. */
  balance: number;
}

/**
 * Rebuilds an account's end-of-day balances from its current balance and transaction history.
 *
 * Up only reports the current balance, so we walk backwards: the balance at the end of a day is
 * today's balance minus every transaction that happened after that day.
 *
 * @param days How many days of history to return, ending today. Days before the account's
 *   earliest known transaction still get a balance, which is flat.
 */
export function balanceHistory(
  account: AccountResource,
  transactions: readonly TransactionResource[],
  days: number,
  today: Date = new Date(),
): BalancePoint[] {
  const netByDay = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.relationships.account.data.id !== account.id) continue;
    const key = dayKey(new Date(tx.attributes.createdAt));
    netByDay.set(key, (netByDay.get(key) ?? 0) + tx.attributes.amount.valueInBaseUnits);
  }

  const points: BalancePoint[] = [];
  let balance = account.attributes.balance.valueInBaseUnits;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < days; i++) {
    const key = dayKey(cursor);
    points.push({ day: key, balance });
    // Step back a day: undo everything that happened on this day.
    balance -= netByDay.get(key) ?? 0;
    cursor.setDate(cursor.getDate() - 1);
  }
  return points.reverse();
}

/** Adds several balance histories together day by day, for an "all Savers" view. */
export function sumHistories(histories: readonly BalancePoint[][]): BalancePoint[] {
  const [first, ...rest] = histories;
  if (!first) return [];
  return first.map((point, i) => ({
    day: point.day,
    balance: rest.reduce((sum, history) => sum + (history[i]?.balance ?? 0), point.balance),
  }));
}

/**
 * Thins a long history to at most about `maxPoints` evenly spaced points, always keeping the
 * latest. Long ranges then draw as a smooth curve and scrub in comfortable steps.
 */
export function samplePoints<T>(points: readonly T[], maxPoints = 60): T[] {
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const last = points.length - 1;
  return points.filter((_, i) => (last - i) % step === 0);
}
