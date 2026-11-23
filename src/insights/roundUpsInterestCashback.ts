import type { TransactionResource } from '@/api/up/types';

import { inRange, type DateRange } from './dates';
import { isMoneyIn } from './savingsRate';

export interface RoundUpTotals {
  /** Everything rounded up into Savers, including boosts, in cents, as a positive number. */
  total: number;
  /** The boosted part of `total`, in cents, as a positive number. */
  boosted: number;
  /** How many purchases were rounded up. */
  count: number;
}

export interface EarnedTotals {
  /** In cents, as a positive number. */
  total: number;
  /** How many payments. */
  count: number;
}

export interface RoundUpsInterestCashback {
  roundUps: RoundUpTotals;
  /** Interest paid to you. */
  interest: EarnedTotals;
  /** Cashback paid to you. */
  cashback: EarnedTotals;
}

/**
 * True for interest paid into your accounts. Up's API doesn't define a type for interest, so
 * this matches money coming in whose `transactionType` or `description` is "Interest", which is
 * how Up labels it. Interest charged on a home loan is money going out, so it isn't counted.
 */
export function isInterest(tx: TransactionResource): boolean {
  if (!isMoneyIn(tx)) return false;
  const { transactionType, description } = tx.attributes;
  return (
    transactionType?.trim().toLowerCase() === 'interest' ||
    description.trim().toLowerCase() === 'interest'
  );
}

/**
 * Round Ups, interest and cashback over `range`, dated by when each transaction was made.
 *
 * Round Ups are read from the `roundUp` on each purchase, not from the transfers that move the
 * money into a Saver, so they're counted once however Up batches those transfers. A purchase is
 * counted while it's held as well as once it's settled, the same as for spending. Cashback is
 * read from the `cashback` on each transaction. Everything is in Australian dollars.
 *
 * Only what was made within `range` counts, even if that is after now. For this month so far,
 * pass `monthToDate(now)` rather than `monthRange(now)`.
 */
export function roundUpsInterestCashback(
  transactions: readonly TransactionResource[],
  range: DateRange,
): RoundUpsInterestCashback {
  const roundUps: RoundUpTotals = { total: 0, boosted: 0, count: 0 };
  const interest: EarnedTotals = { total: 0, count: 0 };
  const cashback: EarnedTotals = { total: 0, count: 0 };

  for (const tx of transactions) {
    const { roundUp, cashback: paid } = tx.attributes;
    if (!roundUp && !paid && !isInterest(tx)) continue;
    if (!inRange(new Date(tx.attributes.createdAt), range)) continue;

    if (roundUp) {
      // Both are negative in the API: money leaving for the Saver.
      const rounded = -roundUp.amount.valueInBaseUnits;
      if (rounded > 0) {
        roundUps.total += rounded;
        roundUps.boosted += Math.max(0, -(roundUp.boostPortion?.valueInBaseUnits ?? 0));
        roundUps.count += 1;
      }
    }
    if (paid && paid.amount.valueInBaseUnits > 0) {
      cashback.total += paid.amount.valueInBaseUnits;
      cashback.count += 1;
    }
    if (isInterest(tx)) {
      interest.total += tx.attributes.amount.valueInBaseUnits;
      interest.count += 1;
    }
  }

  return { roundUps, interest, cashback };
}
