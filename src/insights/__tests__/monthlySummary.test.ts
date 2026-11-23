import { makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { monthlySummary } from '../monthlySummary';

const now = new Date(2026, 10, 20, 18, 0);
const spend = (cents: number, at: Date) => makeTransaction({ cents: -cents, at });
const income = (cents: number, at: Date) => makeTransaction({ cents, at });

describe('monthlySummary', () => {
  it('is all zeros with no transactions', () => {
    expect(monthlySummary([], now)).toEqual({
      month: '2026-11',
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
      lastMonth: { month: '2026-10', moneyIn: 0, moneyOut: 0, net: 0 },
      lastMonthSoFar: { moneyIn: 0, moneyOut: 0, net: 0 },
      change: { moneyIn: 0, moneyOut: 0, net: 0 },
    });
  });

  it('adds up money in and out this month, and compares with the same stretch of last month', () => {
    const summary = monthlySummary(
      [
        income(300000, new Date(2026, 10, 2, 6)),
        spend(4500, new Date(2026, 10, 3, 12)),
        spend(12000, new Date(2026, 10, 20, 17)),
        income(250000, new Date(2026, 9, 2, 6)),
        spend(8000, new Date(2026, 9, 10, 12)),
        // After the 20th last month: in the whole month, not the stretch so far.
        spend(50000, new Date(2026, 9, 25, 12)),
        income(1000, new Date(2026, 9, 31, 9)),
      ],
      now,
    );
    expect(summary).toMatchObject({ month: '2026-11', moneyIn: 300000, moneyOut: 16500 });
    expect(summary.net).toBe(283500);
    expect(summary.lastMonth).toEqual({
      month: '2026-10',
      moneyIn: 251000,
      moneyOut: 58000,
      net: 193000,
    });
    expect(summary.lastMonthSoFar).toEqual({ moneyIn: 250000, moneyOut: 8000, net: 242000 });
    expect(summary.change).toEqual({ moneyIn: 50000, moneyOut: 8500, net: 41500 });
  });

  it('leaves out transfers between your own accounts, Round Up transfers, and the future', () => {
    const summary = monthlySummary(
      [
        makeTransaction({ cents: -20000, at: new Date(2026, 10, 4), transferAccountId: 'saver' }),
        makeTransaction({
          accountId: 'saver',
          cents: 20000,
          at: new Date(2026, 10, 4),
          transferAccountId: 'spending',
        }),
        makeTransaction({
          cents: -85,
          at: new Date(2026, 10, 4, 23, 50),
          description: 'Round Up',
          transferAccountId: 'saver',
        }),
        spend(900, new Date(2026, 10, 20, 18, 0, 0, 1)),
        income(900, new Date(2026, 11, 1)),
      ],
      now,
    );
    expect(summary).toMatchObject({ moneyIn: 0, moneyOut: 0, net: 0 });
  });

  it('counts held and settled purchases once each, refunds as money in, and in dollars', () => {
    const summary = monthlySummary(
      [
        makeTransaction({ cents: -2500, at: new Date(2026, 10, 19), status: 'HELD' }),
        makeTransaction({ cents: -4000, at: new Date(2026, 10, 10), roundUpCents: 60 }),
        // A refund: money in, not less spending.
        income(4000, new Date(2026, 10, 12)),
        // Charged 30.00 US dollars, which came to 45.67 Australian dollars.
        makeTransaction({
          cents: -4567,
          at: new Date(2026, 10, 15),
          foreign: { currencyCode: 'USD', cents: -3000 },
        }),
      ],
      now,
    );
    expect(summary).toMatchObject({ moneyIn: 4000, moneyOut: 2500 + 4000 + 4567 });
  });

  it('starts a month at local midnight on the 1st', () => {
    const first = new Date(2026, 10, 1);
    const summary = monthlySummary(
      [
        spend(100, first),
        spend(200, new Date(2026, 9, 31, 23, 59, 59, 999)),
        spend(400, new Date(2026, 9, 1)),
        spend(800, new Date(2026, 9, 1, 0, 0, 0, 1)),
      ],
      first,
    );
    expect(summary.moneyOut).toBe(100);
    expect(summary.lastMonth.moneyOut).toBe(1400);
    // At midnight on the 1st, the same moment last month is midnight on 1 October.
    expect(summary.lastMonthSoFar.moneyOut).toBe(400);
  });

  it('compares 1 January with December of the year before', () => {
    const summary = monthlySummary(
      [spend(100, new Date(2027, 0, 1, 9)), spend(200, new Date(2026, 11, 1, 8))],
      new Date(2027, 0, 1, 10),
    );
    expect(summary.month).toBe('2027-01');
    expect(summary.lastMonth).toMatchObject({ month: '2026-12', moneyOut: 200 });
    expect(summary.lastMonthSoFar.moneyOut).toBe(200);
    expect(summary.change.moneyOut).toBe(-100);
  });

  it('handles 29 February, and a month with more days than the one before', () => {
    const leapDay = monthlySummary(
      [spend(100, new Date(2028, 1, 29, 9)), spend(200, new Date(2028, 0, 29, 9))],
      new Date(2028, 1, 29, 10),
    );
    expect(leapDay).toMatchObject({ month: '2028-02', moneyOut: 100 });
    expect(leapDay.lastMonthSoFar.moneyOut).toBe(200);

    // 31 March compares with 29 February, the last day February has.
    const endOfMarch = monthlySummary(
      [spend(300, new Date(2028, 1, 29, 9)), spend(50, new Date(2028, 1, 29, 11))],
      new Date(2028, 2, 31, 10),
    );
    expect(endOfMarch.lastMonthSoFar.moneyOut).toBe(300);
    expect(endOfMarch.lastMonth.moneyOut).toBe(350);
  });

  it('gives the same answer whatever order the transactions come in', () => {
    const txs = [
      income(300000, new Date(2026, 10, 2, 6)),
      spend(4500, new Date(2026, 10, 3, 12)),
      spend(8000, new Date(2026, 9, 10, 12)),
    ];
    expect(monthlySummary([...txs].reverse(), now)).toEqual(monthlySummary(txs, now));
  });
});

describe('monthlySummary in Australian local time', () => {
  useTimeZone(SYDNEY);

  it('splits months at Sydney midnight, not UTC midnight', () => {
    // 12:30 am on 1 November in Sydney is still 31 October in UTC.
    const summary = monthlySummary(
      [spend(100, new Date(2026, 10, 1, 0, 30)), spend(200, new Date(2026, 9, 31, 23, 30))],
      new Date(2026, 10, 2, 12),
    );
    expect(summary.moneyOut).toBe(100);
    expect(summary.lastMonth.moneyOut).toBe(200);
  });

  it('counts every transaction in a month with a daylight saving change', () => {
    // Clocks went back at 3 am on 5 April 2026, so 2:30 am happened twice.
    const first = new Date(2026, 3, 5, 2, 30);
    const second = new Date(first.getTime() + 60 * 60 * 1000);
    expect(second.getHours()).toBe(2);
    const summary = monthlySummary(
      [spend(100, first), spend(200, second), spend(400, new Date(2026, 3, 30, 23, 59))],
      new Date(2026, 3, 30, 23, 59, 59),
    );
    expect(summary.moneyOut).toBe(700);
  });
});
