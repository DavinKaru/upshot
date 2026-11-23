import { makeAccount, makeTransaction } from '@/test/fixtures';

import { monthRange } from '../dates';
import { monthlySummary } from '../monthlySummary';
import { roundUpsInterestCashback } from '../roundUpsInterestCashback';
import { spendingByDay, spentToday } from '../spentToday';
import { topMerchants } from '../topMerchants';
import { twoUpSplit } from '../twoUpSplit';

/*
 * Each insight should handle 20,000 transactions, several years of heavy use, well within a
 * frame or two. The limit here is loose so slow CI machines don't fail it; run with
 * UPSHOT_PERF=1 to print the timings.
 */
const COUNT = 20_000;
const LIMIT_MS = 1000;
const now = new Date(2026, 10, 20, 18);

const merchants = Array.from(
  { length: 400 },
  (_, i) => `Merchant ${i % 200}${i >= 200 ? ' ' : ''}`,
);
const transactions = Array.from({ length: COUNT }, (_, i) => {
  // Spread over about three years, a little over an hour apart.
  const at = new Date(now.getTime() - i * 79 * 60_000);
  const kind = i % 10;
  return makeTransaction({
    id: `perf-${i}`,
    accountId: kind === 9 ? 'two-up' : 'spending',
    cents: kind === 0 ? 250_000 : -((i * 37) % 20_000) - 1,
    at,
    description: kind === 0 ? 'Salary' : (merchants[i % merchants.length] ?? ''),
    transferAccountId: kind === 8 ? 'saver' : undefined,
    status: i < 30 ? 'HELD' : 'SETTLED',
    roundUpCents: kind > 0 && kind < 8 ? i % 100 : undefined,
    cashbackCents: kind === 7 ? 50 : undefined,
    performingCustomer: kind === 9 ? (i % 20 === 9 ? 'Alex Example' : 'Sam Sample') : null,
  });
});
const accounts = [makeAccount('two-up', 0, { ownershipType: 'JOINT' })];
const threeYears = { start: new Date(2023, 10, 1), end: new Date(2026, 11, 1) };

const cases: [string, () => unknown][] = [
  ['monthlySummary', () => monthlySummary(transactions, now)],
  ['spentToday', () => spentToday(transactions, now)],
  ['spendingByDay (three years)', () => spendingByDay(transactions, threeYears)],
  ['topMerchants (three years)', () => topMerchants(transactions, threeYears)],
  [
    'roundUpsInterestCashback (month)',
    () => roundUpsInterestCashback(transactions, monthRange(now)),
  ],
  ['twoUpSplit (three years)', () => twoUpSplit(transactions, accounts, threeYears)],
];

describe(`insights with ${COUNT.toLocaleString('en-AU')} transactions`, () => {
  it.each(cases)('%s runs in well under a second', (name, run) => {
    run();
    const runs = 5;
    const start = performance.now();
    for (let i = 0; i < runs; i++) run();
    const ms = (performance.now() - start) / runs;
    if (process.env.UPSHOT_PERF) console.log(`${name}: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});
