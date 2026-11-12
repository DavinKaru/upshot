import type { TransactionResource } from '@/api/up/types';

import { monthKey } from './dates';

export interface CountAndTotal {
  count: number;
  /** Cents, as a positive number. */
  total: number;
}

export interface SaverMonth {
  /** "YYYY-MM". */
  month: string;
  /** Money in, not counting interest (transfers, Round Ups). */
  saves: CountAndTotal;
  /** Money out. */
  withdrawals: CountAndTotal;
  /** Interest earned, in cents. */
  interest: number;
  /** Everything in minus everything out, in cents. */
  net: number;
}

const isInterest = (tx: TransactionResource) =>
  tx.attributes.transactionType === 'Interest' || tx.attributes.description === 'Interest';

/**
 * Month-by-month activity for one or more Savers: what went in, what came out and the interest
 * earned. Returns the last `months` months, newest first, including months with no activity.
 */
export function saverMonths(
  transactions: readonly TransactionResource[],
  saverIds: readonly string[],
  months: number,
  today: Date = new Date(),
): SaverMonth[] {
  const ids = new Set(saverIds);
  const keys = Array.from({ length: months }, (_, i) =>
    monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)),
  );
  const byMonth = new Map<string, SaverMonth>(
    keys.map((month) => [
      month,
      {
        month,
        saves: { count: 0, total: 0 },
        withdrawals: { count: 0, total: 0 },
        interest: 0,
        net: 0,
      },
    ]),
  );

  for (const tx of transactions) {
    if (!ids.has(tx.relationships.account.data.id)) continue;
    const entry = byMonth.get(monthKey(new Date(tx.attributes.createdAt)));
    if (!entry) continue;
    // Transfers between two of the selected Savers cancel out, so they're left out.
    const other = tx.relationships.transferAccount.data?.id;
    if (other && ids.has(other)) continue;

    const cents = tx.attributes.amount.valueInBaseUnits;
    entry.net += cents;
    if (cents > 0 && isInterest(tx)) {
      entry.interest += cents;
    } else if (cents > 0) {
      entry.saves.count += 1;
      entry.saves.total += cents;
    } else if (cents < 0) {
      entry.withdrawals.count += 1;
      entry.withdrawals.total -= cents;
    }
  }

  return keys.map((key) => byMonth.get(key) as SaverMonth);
}
