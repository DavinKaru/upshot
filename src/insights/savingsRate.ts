import type { TransactionResource } from '@/api/up/types';

import { monthKey } from './dates';
import { isSpending } from './spendingByCategory';

export interface MonthFlow {
  /** "YYYY-MM". */
  month: string;
  /** Money that came in from outside your accounts: pay, refunds and interest, in cents. */
  moneyIn: number;
  /** Money that went out of your accounts, in cents, as a positive number. */
  spent: number;
  /** What came in minus what went out. Negative when you spent more than came in. */
  kept: number;
  /** `kept` as a share of `moneyIn`, from -∞ to 1, or `null` when nothing came in. */
  rate: number | null;
}

export interface SavingsRate {
  /** The last few whole months, oldest first. */
  months: MonthFlow[];
  /** The month so far. */
  thisMonth: MonthFlow;
  /** Everything kept over `months` as a share of everything that came in, or `null`. */
  average: number | null;
}

/** True for money arriving from outside your accounts, rather than moved between them. */
export function isMoneyIn(tx: TransactionResource): boolean {
  return (
    tx.attributes.amount.valueInBaseUnits > 0 && tx.relationships.transferAccount.data === null
  );
}

const rateOf = (kept: number, moneyIn: number) => (moneyIn > 0 ? kept / moneyIn : null);

function flow(month: string, moneyIn: number, spent: number): MonthFlow {
  const kept = moneyIn - spent;
  return { month, moneyIn, spent, kept, rate: rateOf(kept, moneyIn) };
}

/**
 * How much of what came in you kept, month by month, across all your accounts. Moving money
 * between your own accounts, like into a Saver, neither counts as money in nor as spending, so
 * what's kept is how much your accounts grew between them.
 *
 * Returns the last `count` whole months before the month containing `date`, the month so far,
 * and the rate over the whole months together. The average weighs each month by what came in,
 * so a month with three paydays counts for more than one with two.
 */
export function savingsRate(
  transactions: readonly TransactionResource[],
  count = 6,
  date: Date = new Date(),
): SavingsRate {
  const keys = Array.from({ length: count + 1 }, (_, i) =>
    monthKey(new Date(date.getFullYear(), date.getMonth() - count + i, 1)),
  );
  const totals = new Map(keys.map((key) => [key, { moneyIn: 0, spent: 0 }]));

  for (const tx of transactions) {
    const at = new Date(tx.attributes.createdAt);
    if (at > date) continue;
    const entry = totals.get(monthKey(at));
    if (!entry) continue;
    if (isMoneyIn(tx)) entry.moneyIn += tx.attributes.amount.valueInBaseUnits;
    else if (isSpending(tx)) entry.spent -= tx.attributes.amount.valueInBaseUnits;
  }

  const flows = keys.map((key) => {
    const t = totals.get(key) ?? { moneyIn: 0, spent: 0 };
    return flow(key, t.moneyIn, t.spent);
  });
  const months = flows.slice(0, count);
  const moneyIn = months.reduce((sum, m) => sum + m.moneyIn, 0);
  const kept = months.reduce((sum, m) => sum + m.kept, 0);

  return {
    months,
    thisMonth: flows[count] ?? flow(monthKey(date), 0, 0),
    average: rateOf(kept, moneyIn),
  };
}
