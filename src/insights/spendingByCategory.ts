import type { CategoryResource, TransactionResource } from '@/api/up/types';

import { monthKey, previousMonth } from './dates';

export const UNCATEGORISED_ID = 'uncategorised';

export interface CategorySpend {
  id: string;
  name: string;
  /** Money spent this month, in cents, as a positive number. */
  total: number;
  /**
   * Money spent in the same category over the same stretch of last month (from the 1st to the
   * same day and time), in cents, as a positive number. Comparing like with like means a
   * half-finished month isn't shown as a big drop.
   */
  lastMonth: number;
}

export interface ParentCategorySpend extends CategorySpend {
  /** Child categories with spending this month or last, largest first. */
  children: CategorySpend[];
}

export interface MonthlySpending {
  /** "YYYY-MM". */
  month: string;
  total: number;
  lastMonth: number;
  /** Parent categories with spending this month or last, largest first. */
  parents: ParentCategorySpend[];
}

/** True for money leaving the account as spending: not income, and not a transfer to a Saver. */
export function isSpending(tx: TransactionResource): boolean {
  return (
    tx.attributes.amount.valueInBaseUnits < 0 && tx.relationships.transferAccount.data === null
  );
}

/**
 * Totals spending by category for the month containing `date`, up to `date`, alongside the same
 * stretch of last month. Transfers between accounts and money coming in are left out.
 */
export function spendingByCategory(
  transactions: readonly TransactionResource[],
  categories: readonly CategoryResource[],
  date: Date = new Date(),
): MonthlySpending {
  const thisMonth = monthKey(date);
  const lastMonth = monthKey(previousMonth(date));
  const cutoff = sameMomentLastMonth(date);
  const names = new Map(categories.map((c) => [c.id, c.attributes.name]));

  type Bucket = { total: number; lastMonth: number; children: Map<string, CategorySpend> };
  const parents = new Map<string, Bucket>();

  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    const at = new Date(tx.attributes.createdAt);
    const month = monthKey(at);
    const isThisMonth = month === thisMonth;
    if (isThisMonth ? at > date : month !== lastMonth || at > cutoff) continue;

    const spent = -tx.attributes.amount.valueInBaseUnits;
    const parentId = tx.relationships.parentCategory.data?.id ?? UNCATEGORISED_ID;
    const childId = tx.relationships.category.data?.id ?? UNCATEGORISED_ID;

    let parent = parents.get(parentId);
    if (!parent) {
      parent = { total: 0, lastMonth: 0, children: new Map() };
      parents.set(parentId, parent);
    }
    let child = parent.children.get(childId);
    if (!child) {
      child = { id: childId, name: names.get(childId) ?? 'Uncategorised', total: 0, lastMonth: 0 };
      parent.children.set(childId, child);
    }

    if (isThisMonth) {
      parent.total += spent;
      child.total += spent;
    } else {
      parent.lastMonth += spent;
      child.lastMonth += spent;
    }
  }

  const byTotal = (a: CategorySpend, b: CategorySpend) =>
    b.total - a.total || b.lastMonth - a.lastMonth;

  const result: ParentCategorySpend[] = [...parents.entries()]
    .map(([id, bucket]) => ({
      id,
      name: names.get(id) ?? 'Uncategorised',
      total: bucket.total,
      lastMonth: bucket.lastMonth,
      children: [...bucket.children.values()].sort(byTotal),
    }))
    .sort(byTotal);

  return {
    month: thisMonth,
    total: result.reduce((sum, p) => sum + p.total, 0),
    lastMonth: result.reduce((sum, p) => sum + p.lastMonth, 0),
    parents: result,
  };
}

/** The same day and time in the previous month, clamped to that month's last day. */
export function sameMomentLastMonth(date: Date): Date {
  const daysInLastMonth = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth() - 1,
    Math.min(date.getDate(), daysInLastMonth),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}
