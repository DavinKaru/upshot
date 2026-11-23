import type { TransactionResource } from '@/api/up/types';

import { inRange, type DateRange } from './dates';
import { isSpending } from './spendingByCategory';

/** Shown for purchases with a blank description. */
export const UNKNOWN_MERCHANT = 'Unknown merchant';

export interface MerchantSpend {
  /** The normalised name purchases are grouped by. See `merchantKey`. */
  key: string;
  /** The way the name is most often written, for showing. */
  name: string;
  /** Spent with this merchant over the range, in cents, as a positive number. */
  spent: number;
  /** How many purchases. */
  count: number;
}

export interface TopMerchants {
  /** Most spent first. Ties go to the merchant bought from more often, then by key. */
  byTotal: MerchantSpend[];
  /** Most purchases first. Ties go to the merchant with more spent, then by key. */
  byCount: MerchantSpend[];
  /** Spent over the range across all merchants, in cents. */
  total: number;
  /** Purchases over the range across all merchants. */
  count: number;
}

const SPACES = /\s+/g;
// Invisible formatting characters, such as zero-width spaces, soft hyphens and direction marks.
// (Unicode format characters, listed out so it works on any JavaScript engine.) Zero-width
// joiners and non-joiners stay, because emoji and some scripts need them.
const INVISIBLE =
  /[\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/g;
const JOINERS = /[\u200C\u200D]/g;
// Curly and other look-alike apostrophes and quotes, which read the same as straight ones.
const APOSTROPHES = /[\u2018\u2019\u201B\u02BC]/g;
const QUOTES = /[\u201C\u201D\u201F]/g;

/**
 * Normalises a merchant name for grouping. Up's `description` is already a cleaned-up merchant
 * name (the raw card text is in `rawText`), so this only removes differences people wouldn't
 * notice: it folds Unicode compatibility forms together (NFKC: full-width letters, accents typed
 * as separate marks), treats curly apostrophes and quotes as straight ones, drops invisible
 * formatting characters, and ignores spacing and case, so "Bean There", "BEAN THERE",
 * " bean  there " and "BeanThere" are one merchant, as are "Dan's Deli" and "Dan’s Deli".
 * Case is folded fully, so "STRASSE" matches "Straße" and a Greek final sigma matches sigma.
 * It doesn't strip other punctuation, store numbers or suburbs, which could merge merchants that
 * are different. A name with nothing visible in it gives "".
 */
export function merchantKey(description: string): string {
  const key = description
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    // Spacing goes before case, since a Greek sigma's lowercase form depends on what follows it.
    .replace(SPACES, '')
    .toUpperCase()
    .toLowerCase();
  return key.replace(JOINERS, '') === '' ? '' : key;
}

/** A description as written, with its spacing tidied, for showing. */
function displayName(description: string): string {
  return description.normalize('NFKC').replace(INVISIBLE, '').replace(SPACES, ' ').trim();
}

/**
 * Where you spent the most, and where you buy most often, over `range`. Counts the same spending
 * as the other insights: money going out, without transfers between your own accounts or money
 * coming in. A refund is money in, so it doesn't reduce a merchant's total or count. Amounts are
 * in Australian dollars, even for purchases made in another currency.
 *
 * Pass `limit` to keep only the top few in each list; the totals still cover every merchant. A
 * `limit` that isn't a number keeps everything.
 *
 * Only what was made within `range` counts, even if that is after now. For this month so far,
 * pass `monthToDate(now)` rather than `monthRange(now)`.
 */
export function topMerchants(
  transactions: readonly TransactionResource[],
  range: DateRange,
  limit?: number,
): TopMerchants {
  type Bucket = { spent: number; count: number; names: Map<string, number> };
  const buckets = new Map<string, Bucket>();
  let total = 0;
  let count = 0;

  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    if (!inRange(new Date(tx.attributes.createdAt), range)) continue;
    const { description } = tx.attributes;
    const key = merchantKey(description);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { spent: 0, count: 0, names: new Map() };
      buckets.set(key, bucket);
    }
    const spent = -tx.attributes.amount.valueInBaseUnits;
    bucket.spent += spent;
    bucket.count += 1;
    const name = displayName(description);
    bucket.names.set(name, (bucket.names.get(name) ?? 0) + 1);
    total += spent;
    count += 1;
  }

  const merchants: MerchantSpend[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    name: key === '' ? UNKNOWN_MERCHANT : mostCommon(bucket.names),
    spent: bucket.spent,
    count: bucket.count,
  }));
  const byKey = (a: MerchantSpend, b: MerchantSpend) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  const byTotal = [...merchants].sort(
    (a, b) => b.spent - a.spent || b.count - a.count || byKey(a, b),
  );
  const byCount = [...merchants].sort(
    (a, b) => b.count - a.count || b.spent - a.spent || byKey(a, b),
  );

  const keep = typeof limit === 'number' && !Number.isNaN(limit) ? Math.max(0, limit) : Infinity;
  return {
    byTotal: byTotal.slice(0, keep),
    byCount: byCount.slice(0, keep),
    total,
    count,
  };
}

/** The most common name, choosing the first in code-point order on a tie so order never matters. */
function mostCommon(names: Map<string, number>): string {
  let best = '';
  let bestCount = 0;
  for (const [name, n] of names) {
    if (n > bestCount || (n === bestCount && name < best)) {
      best = name;
      bestCount = n;
    }
  }
  return best;
}
