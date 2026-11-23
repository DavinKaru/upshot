import type { AccountResource, TransactionResource } from '@/api/up/types';

import { inRange, type DateRange } from './dates';
import { isSpending } from './spendingByCategory';

export interface PersonSpend {
  /** The person's name as Up shows it, with spacing tidied. */
  name: string;
  /** Spent by this person on 2Up accounts over the range, in cents, as a positive number. */
  spent: number;
  /** How many purchases. */
  count: number;
  /** `spent` as a share of `total` for the split, from 0 to 1. */
  share: number;
}

export interface TwoUpSplit {
  /** The 2Up accounts the split covers. Empty when you don't have one. */
  accountIds: string[];
  /** Spent on 2Up accounts over the range, in cents, including `unattributed`. */
  total: number;
  /** Each person who spent, most spent first, then by name. */
  people: PersonSpend[];
  /** Spending Up didn't say who made, so it isn't anyone's. */
  unattributed: { spent: number; count: number; share: number };
}

const tidy = (name: string) => name.replace(/\s+/g, ' ').trim();

/**
 * Who spent what on your 2Up (joint) accounts over `range`, using the `performingCustomer` Up
 * records on each transaction. Spending is the same as everywhere else: money going out, without
 * transfers between accounts or money coming in, so moving money into 2Up isn't spending and a
 * refund doesn't reduce anyone's share. Transactions Up doesn't name a person for are kept apart
 * as `unattributed`. People are told apart by name, ignoring differences in spacing.
 *
 * Only what was made within `range` counts, even if that is after now. For this month so far,
 * pass `monthToDate(now)` rather than `monthRange(now)`.
 */
export function twoUpSplit(
  transactions: readonly TransactionResource[],
  accounts: readonly AccountResource[],
  range: DateRange,
): TwoUpSplit {
  const joint = new Set(
    accounts.filter((a) => a.attributes.ownershipType === 'JOINT').map((a) => a.id),
  );
  const people = new Map<string, { spent: number; count: number }>();
  const unattributed = { spent: 0, count: 0 };
  let total = 0;

  for (const tx of transactions) {
    if (!joint.has(tx.relationships.account.data.id) || !isSpending(tx)) continue;
    if (!inRange(new Date(tx.attributes.createdAt), range)) continue;
    const spent = -tx.attributes.amount.valueInBaseUnits;
    total += spent;
    const name = tidy(tx.attributes.performingCustomer?.displayName ?? '');
    let entry = unattributed;
    if (name !== '') {
      entry = people.get(name) ?? { spent: 0, count: 0 };
      people.set(name, entry);
    }
    entry.spent += spent;
    entry.count += 1;
  }

  const shareOf = (spent: number) => (total > 0 ? spent / total : 0);
  return {
    accountIds: [...joint].sort(),
    total,
    people: [...people.entries()]
      .map(([name, p]) => ({ name, spent: p.spent, count: p.count, share: shareOf(p.spent) }))
      .sort((a, b) => b.spent - a.spent || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    unattributed: { ...unattributed, share: shareOf(unattributed.spent) },
  };
}
