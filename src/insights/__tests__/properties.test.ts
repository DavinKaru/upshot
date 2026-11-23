import * as fc from 'fast-check';

import type { TransactionResource } from '@/api/up/types';
import { makeAccount, makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { addDays, dayKey, inRange, monthKey, startOfDay, type DateRange } from '../dates';
import { monthlySummary } from '../monthlySummary';
import { roundUpsInterestCashback } from '../roundUpsInterestCashback';
import { isMoneyIn } from '../savingsRate';
import { isSpending } from '../spendingByCategory';
import { spendingByDay, spentToday } from '../spentToday';
import { topMerchants } from '../topMerchants';
import { twoUpSplit } from '../twoUpSplit';

/*
 * Invariants that hold for any transactions and any date. Each property runs a few hundred
 * random cases. They run once in the machine's time zone and once forced to Sydney time, to
 * always cover its clock changes; run the suite with `TZ=UTC` or `TZ=America/Los_Angeles` to
 * cover other zones.
 */

const RUNS = { numRuns: 300 };
const MINUTE = 60_000;

/**
 * Days after 1 January 2026 when Sydney's clocks change (5 April and 4 October 2026, 4 April and
 * 3 October 2027), and the days either side of them.
 */
const CHANGEOVER_DAYS = [94, 276, 458, 640].flatMap((day) => [day - 1, day, day + 1]);

/**
 * A moment in 2026–2027, as a local date and time. A good share land on or next to a daylight
 * saving change, and the times favour midnight, the last minute of a day and the hour the clocks
 * skip or repeat, so those come up often. A separate case covers 29 February 2028.
 */
const localMoment = fc
  .tuple(
    fc.oneof(fc.integer({ min: 0, max: 800 }), fc.constantFrom(...CHANGEOVER_DAYS)),
    fc.oneof(
      fc.constantFrom(0, 1, 2 * 60 + 30, 3 * 60, 24 * 60 - 1),
      fc.integer({ min: 0, max: 24 * 60 - 1 }),
    ),
    fc.constantFrom(0, 59_999),
  )
  .map(([day, minute, ms]) => {
    const base = new Date(2026, 0, 1 + day);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, minute, 0, ms);
  });
const instant = fc
  .integer({ min: Date.UTC(2025, 11, 31), max: Date.UTC(2028, 2, 2) })
  .map((ms) => new Date(ms));
const moment = fc.oneof(
  localMoment,
  instant,
  fc.constant(null).map(() => new Date(2028, 1, 29, 12)),
);

const merchants = ['Bean There', 'BEAN THERE', ' bean  there', 'Fernleaf Grocer', 'Kite Air', ''];
const people = [null, 'Alex Example', 'Sam Sample', ' Sam  Sample '];

const transaction = fc
  .record({
    cents: fc.oneof(fc.integer({ min: -500_000, max: 500_000 }), fc.constantFrom(0, -1, 1)),
    at: moment,
    accountId: fc.constantFrom('spending', 'saver', 'two-up'),
    transfer: fc.constantFrom(undefined, undefined, undefined, 'saver', 'spending'),
    status: fc.constantFrom('HELD' as const, 'SETTLED' as const),
    description: fc.constantFrom(...merchants, 'Interest', 'Round Up'),
    roundUpCents: fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
    boostCents: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    cashbackCents: fc.option(fc.integer({ min: 0, max: 5_000 }), { nil: undefined }),
    foreign: fc.option(fc.constant({ currencyCode: 'USD', cents: -1234 }), { nil: undefined }),
    transactionType: fc.constantFrom(null, 'Purchase', 'Interest'),
    performingCustomer: fc.constantFrom(...people),
  })
  .map((t) =>
    makeTransaction({
      ...t,
      transferAccountId: t.transfer,
      id: `${t.accountId}-${t.at.getTime()}-${t.cents}`,
    }),
  );
const transactions = fc.array(transaction, { maxLength: 60 });

/** The transactions and a shuffled copy of them. */
const withShuffle = transactions.chain((txs) =>
  fc.shuffledSubarray(txs, { minLength: txs.length }).map((shuffled) => [txs, shuffled] as const),
);

const accounts = [
  makeAccount('spending', 0, { accountType: 'TRANSACTIONAL' }),
  makeAccount('saver', 0),
  makeAccount('two-up', 0, { accountType: 'TRANSACTIONAL', ownershipType: 'JOINT' }),
];

const range = fc
  .tuple(moment, fc.integer({ min: 0, max: 120 * 24 * 60 }))
  .map(([start, minutes]): DateRange => ({
    start,
    end: new Date(start.getTime() + minutes * MINUTE),
  }));

const at = (tx: TransactionResource) => new Date(tx.attributes.createdAt);
const cents = (tx: TransactionResource) => tx.attributes.amount.valueInBaseUnits;
/** Spending in a range, added up directly, to check the insights against. */
const spentIn = (txs: readonly TransactionResource[], r: DateRange) =>
  txs.filter((tx) => isSpending(tx) && inRange(at(tx), r)).reduce((s, tx) => s - cents(tx), 0);

function properties() {
  describe('monthlySummary', () => {
    it('has net equal to money in minus money out, for this month, last month and the change', () => {
      fc.assert(
        fc.property(transactions, moment, (txs, date) => {
          const s = monthlySummary(txs, date);
          for (const f of [s, s.lastMonth, s.lastMonthSoFar, s.change]) {
            expect(f.net).toBe(f.moneyIn - f.moneyOut);
          }
          expect(s.change.net).toBe(s.net - s.lastMonthSoFar.net);
          expect(s.lastMonthSoFar.moneyIn).toBeLessThanOrEqual(s.lastMonth.moneyIn);
          expect(s.lastMonthSoFar.moneyOut).toBeLessThanOrEqual(s.lastMonth.moneyOut);
        }),
        RUNS,
      );
    });

    it('adds up to the same totals as counting each transaction directly', () => {
      fc.assert(
        fc.property(transactions, moment, (txs, date) => {
          const s = monthlySummary(txs, date);
          const thisMonth = txs.filter(
            (tx) => monthKey(at(tx)) === monthKey(date) && at(tx) <= date,
          );
          const moneyIn = thisMonth.filter(isMoneyIn).reduce((sum, tx) => sum + cents(tx), 0);
          expect(s.moneyIn).toBe(moneyIn);
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          expect(s.moneyOut).toBe(spentIn(txs, { start, end: new Date(date.getTime() + 1) }));
        }),
        RUNS,
      );
    });

    it('never depends on the order of the transactions', () => {
      fc.assert(
        fc.property(withShuffle, moment, ([txs, shuffled], date) => {
          expect(monthlySummary(shuffled, date)).toEqual(monthlySummary(txs, date));
        }),
        RUNS,
      );
    });
  });

  describe('spendingByDay', () => {
    it('has days that add up to the range total, which matches counting directly', () => {
      fc.assert(
        fc.property(transactions, range, (txs, r) => {
          const result = spendingByDay(txs, r);
          expect(result.days.reduce((sum, d) => sum + d.spent, 0)).toBe(result.total);
          expect(result.total).toBe(spentIn(txs, r));
          // One entry per calendar day, in order, with no gaps or repeats.
          const keys = result.days.map((d) => d.day);
          expect(new Set(keys).size).toBe(keys.length);
          for (let i = 1; i < keys.length; i++) {
            expect(keys[i]).toBe(dayKey(addDays(startOfDay(r.start), i)));
          }
        }),
        RUNS,
      );
    });

    it('adds up across a range split in two at any moment', () => {
      fc.assert(
        fc.property(
          transactions,
          range,
          fc.double({ min: 0, max: 1, noNaN: true }),
          (txs, r, t) => {
            const split = new Date(
              r.start.getTime() + Math.floor((r.end.getTime() - r.start.getTime()) * t),
            );
            const first = spendingByDay(txs, { start: r.start, end: split });
            const second = spendingByDay(txs, { start: split, end: r.end });
            expect(first.total + second.total).toBe(spendingByDay(txs, r).total);
          },
        ),
        RUNS,
      );
    });
  });

  describe('spentToday', () => {
    it('agrees with spending by day for today and each of the last seven days', () => {
      fc.assert(
        fc.property(transactions, moment, (txs, date) => {
          const result = spentToday(txs, date);
          const today = { start: startOfDay(date), end: new Date(date.getTime() + 1) };
          expect(result.spent).toBe(spentIn(txs, today));
          expect(result.day).toBe(dayKey(date));
          result.lastSevenDays.forEach((day, i) => {
            const start = addDays(date, i - 7);
            expect(day.day).toBe(dayKey(start));
            expect(day.spent).toBe(spentIn(txs, { start, end: addDays(start, 1) }));
            expect(day.spentByNow).toBeLessThanOrEqual(day.spent);
          });
          expect(result.yesterday).toEqual(result.lastSevenDays[6]);
          expect(result.sameDayLastWeek).toEqual(result.lastSevenDays[0]);
        }),
        RUNS,
      );
    });

    it('has differences that are today minus the comparison', () => {
      fc.assert(
        fc.property(transactions, moment, (txs, date) => {
          const r = spentToday(txs, date);
          expect(r.difference.yesterday).toBe(r.spent - r.yesterday.spent);
          expect(r.difference.yesterdayByNow).toBe(r.spent - r.yesterday.spentByNow);
          expect(r.difference.sameDayLastWeek).toBe(r.spent - r.sameDayLastWeek.spent);
          expect(r.difference.sameDayLastWeekByNow).toBe(r.spent - r.sameDayLastWeek.spentByNow);
          if (r.averageDay.spent === null) {
            expect(r.difference.averageDay).toBeNull();
          } else {
            expect(r.difference.averageDay).toBe(r.spent - r.averageDay.spent);
          }
        }),
        RUNS,
      );
    });

    it('averages the spending over its days, to the nearest cent', () => {
      fc.assert(
        fc.property(transactions, moment, (txs, date) => {
          const { averageDay } = spentToday(txs, date);
          expect(averageDay.days).toBeLessThanOrEqual(30);
          if (averageDay.days === 0) return;
          const window = { start: addDays(date, -averageDay.days), end: startOfDay(date) };
          const total = spendingByDay(txs, window).total;
          expect(Math.abs((averageDay.spent ?? NaN) - total / averageDay.days)).toBeLessThanOrEqual(
            0.5,
          );
          expect(averageDay.spentByNow ?? NaN).toBeLessThanOrEqual(averageDay.spent ?? NaN);
        }),
        RUNS,
      );
    });

    it('never depends on the order of the transactions', () => {
      fc.assert(
        fc.property(withShuffle, moment, ([txs, shuffled], date) => {
          expect(spentToday(shuffled, date)).toEqual(spentToday(txs, date));
        }),
        RUNS,
      );
    });
  });

  describe('topMerchants', () => {
    it('has merchants that add up to the total, which matches spending by day', () => {
      fc.assert(
        fc.property(transactions, range, (txs, r) => {
          const result = topMerchants(txs, r);
          expect(result.byTotal.reduce((sum, m) => sum + m.spent, 0)).toBe(result.total);
          expect(result.byTotal.reduce((sum, m) => sum + m.count, 0)).toBe(result.count);
          expect(result.total).toBe(spendingByDay(txs, r).total);
          expect([...result.byCount].sort((a, b) => (a.key < b.key ? -1 : 1))).toEqual(
            [...result.byTotal].sort((a, b) => (a.key < b.key ? -1 : 1)),
          );
          for (let i = 1; i < result.byTotal.length; i++) {
            expect(result.byTotal[i - 1]?.spent).toBeGreaterThanOrEqual(
              result.byTotal[i]?.spent ?? 0,
            );
            expect(result.byCount[i - 1]?.count).toBeGreaterThanOrEqual(
              result.byCount[i]?.count ?? 0,
            );
          }
        }),
        RUNS,
      );
    });

    it('never depends on the order of the transactions, and a limit keeps the top of each list', () => {
      fc.assert(
        fc.property(withShuffle, range, fc.nat(5), ([txs, shuffled], r, limit) => {
          const all = topMerchants(txs, r);
          expect(topMerchants(shuffled, r)).toEqual(all);
          const top = topMerchants(shuffled, r, limit);
          expect(top.byTotal).toEqual(all.byTotal.slice(0, limit));
          expect(top.byCount).toEqual(all.byCount.slice(0, limit));
        }),
        RUNS,
      );
    });
  });

  describe('roundUpsInterestCashback', () => {
    it('adds up each transaction’s Round Up, interest and cashback, across a split range', () => {
      fc.assert(
        fc.property(
          transactions,
          range,
          fc.double({ min: 0, max: 1, noNaN: true }),
          (txs, r, t) => {
            const result = roundUpsInterestCashback(txs, r);
            const inside = txs.filter((tx) => inRange(at(tx), r));
            const roundUps = inside.reduce(
              (sum, tx) =>
                sum + Math.max(0, -(tx.attributes.roundUp?.amount.valueInBaseUnits ?? 0)),
              0,
            );
            const cashback = inside.reduce(
              (sum, tx) => sum + Math.max(0, tx.attributes.cashback?.amount.valueInBaseUnits ?? 0),
              0,
            );
            expect(result.roundUps.total).toBe(roundUps);
            expect(result.cashback.total).toBe(cashback);
            expect(result.roundUps.boosted).toBeGreaterThanOrEqual(0);
            expect(result.interest.total).toBeGreaterThanOrEqual(0);

            const split = new Date(
              r.start.getTime() + Math.floor((r.end.getTime() - r.start.getTime()) * t),
            );
            const a = roundUpsInterestCashback(txs, { start: r.start, end: split });
            const b = roundUpsInterestCashback(txs, { start: split, end: r.end });
            for (const key of ['roundUps', 'interest', 'cashback'] as const) {
              expect(a[key].total + b[key].total).toBe(result[key].total);
              expect(a[key].count + b[key].count).toBe(result[key].count);
            }
          },
        ),
        RUNS,
      );
    });

    it('never depends on the order of the transactions', () => {
      fc.assert(
        fc.property(withShuffle, range, ([txs, shuffled], r) => {
          expect(roundUpsInterestCashback(shuffled, r)).toEqual(roundUpsInterestCashback(txs, r));
        }),
        RUNS,
      );
    });
  });

  describe('twoUpSplit', () => {
    it('has people and unattributed spending that add up to the 2Up total', () => {
      fc.assert(
        fc.property(transactions, range, (txs, r) => {
          const result = twoUpSplit(txs, accounts, r);
          const parts = result.people.reduce((sum, p) => sum + p.spent, result.unattributed.spent);
          expect(parts).toBe(result.total);
          const joint = txs.filter((tx) => tx.relationships.account.data.id === 'two-up');
          expect(result.total).toBe(spentIn(joint, r));
          if (result.total > 0) {
            const shares = result.people.reduce((s, p) => s + p.share, result.unattributed.share);
            expect(shares).toBeCloseTo(1, 9);
          }
          expect(result.people.length).toBeLessThanOrEqual(2);
        }),
        RUNS,
      );
    });

    it('never depends on the order of the transactions', () => {
      fc.assert(
        fc.property(withShuffle, range, ([txs, shuffled], r) => {
          expect(twoUpSplit(shuffled, accounts, r)).toEqual(twoUpSplit(txs, accounts, r));
        }),
        RUNS,
      );
    });
  });
}

describe('insight properties in the machine’s time zone', properties);

describe('insight properties in Sydney time', () => {
  useTimeZone(SYDNEY);
  properties();
});
