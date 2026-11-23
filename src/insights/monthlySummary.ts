import type { TransactionResource } from '@/api/up/types';

import { monthKey, previousMonth } from './dates';
import { isMoneyIn } from './savingsRate';
import { isSpending, sameMomentLastMonth } from './spendingByCategory';

export interface MoneyFlow {
  /** Money that came in from outside your accounts: pay, refunds and interest, in cents. */
  moneyIn: number;
  /** Money spent, in cents, as a positive number. */
  moneyOut: number;
  /** `moneyIn` minus `moneyOut`. Negative when more went out than came in. */
  net: number;
}

export interface MonthlySummary extends MoneyFlow {
  /** "YYYY-MM", the month containing the date asked about, counted up to that date. */
  month: string;
  /** The whole of last month. */
  lastMonth: MoneyFlow & { month: string };
  /**
   * Last month from the 1st to the same day and time, so a half-finished month compares
   * fairly. The same stretch `spendingByCategory` and `spendingPace` compare against.
   */
  lastMonthSoFar: MoneyFlow;
  /** This month minus `lastMonthSoFar`: positive when more came in, went out or was kept. */
  change: MoneyFlow;
}

const flow = (moneyIn: number, moneyOut: number): MoneyFlow => ({
  moneyIn,
  moneyOut,
  net: moneyIn - moneyOut,
});

/**
 * Money in, money out and the difference, for the month containing `date` up to `date`, across
 * all your accounts. Uses the same rules as the savings rate: moving money between your own
 * accounts is neither money in nor spending, refunds count as money in rather than reducing
 * spending, and transactions are dated when they were made, whether held or settled.
 */
export function monthlySummary(
  transactions: readonly TransactionResource[],
  date: Date = new Date(),
): MonthlySummary {
  const thisKey = monthKey(date);
  const lastKey = monthKey(previousMonth(date));
  const cutoff = sameMomentLastMonth(date);

  let thisIn = 0;
  let thisOut = 0;
  let lastIn = 0;
  let lastOut = 0;
  let lastInSoFar = 0;
  let lastOutSoFar = 0;

  for (const tx of transactions) {
    const moneyIn = isMoneyIn(tx);
    if (!moneyIn && !isSpending(tx)) continue;
    const at = new Date(tx.attributes.createdAt);
    if (at > date) continue;
    const month = monthKey(at);
    // Money in is positive and spending negative, so this is always a positive amount.
    const cents = Math.abs(tx.attributes.amount.valueInBaseUnits);
    if (month === thisKey) {
      if (moneyIn) thisIn += cents;
      else thisOut += cents;
    } else if (month === lastKey) {
      if (moneyIn) lastIn += cents;
      else lastOut += cents;
      if (at <= cutoff) {
        if (moneyIn) lastInSoFar += cents;
        else lastOutSoFar += cents;
      }
    }
  }

  const lastMonthSoFar = flow(lastInSoFar, lastOutSoFar);
  return {
    month: thisKey,
    ...flow(thisIn, thisOut),
    lastMonth: { month: lastKey, ...flow(lastIn, lastOut) },
    lastMonthSoFar,
    change: flow(thisIn - lastMonthSoFar.moneyIn, thisOut - lastMonthSoFar.moneyOut),
  };
}
