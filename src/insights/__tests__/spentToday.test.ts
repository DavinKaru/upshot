import { makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { AVERAGE_DAYS, spendingByDay, spentToday } from '../spentToday';

// Friday 20 November 2026, 6 pm.
const now = new Date(2026, 10, 20, 18, 0);
const spend = (cents: number, at: Date) => makeTransaction({ cents: -cents, at });
/** `hour`:`minute` on the day `daysAgo` days before `now`. */
const ago = (daysAgo: number, hour = 12, minute = 0) =>
  new Date(2026, 10, 20 - daysAgo, hour, minute);

describe('spentToday', () => {
  it('is all zeros, with no average day, when there are no transactions', () => {
    const result = spentToday([], now);
    expect(result.day).toBe('2026-11-20');
    expect(result.spent).toBe(0);
    expect(result.yesterday).toEqual({ day: '2026-11-19', spent: 0, spentByNow: 0 });
    expect(result.sameDayLastWeek).toEqual({ day: '2026-11-13', spent: 0, spentByNow: 0 });
    expect(result.lastSevenDays.map((d) => d.day)).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ]);
    expect(result.averageDay).toEqual({ days: 0, spent: null, spentByNow: null });
    expect(result.difference).toEqual({
      yesterday: 0,
      yesterdayByNow: 0,
      sameDayLastWeek: 0,
      sameDayLastWeekByNow: 0,
      averageDay: null,
      averageDayByNow: null,
    });
  });

  it('compares today with yesterday, in full and by the same time of day', () => {
    const result = spentToday(
      [
        spend(1500, ago(0, 8)),
        spend(2500, ago(0, 17, 59)),
        spend(1000, ago(1, 9)),
        spend(4200, ago(1, 18)),
        // After 6 pm yesterday: in the full day, not by now.
        spend(3000, ago(1, 18, 1)),
      ],
      now,
    );
    expect(result.spent).toBe(4000);
    expect(result.yesterday).toEqual({ day: '2026-11-19', spent: 8200, spentByNow: 5200 });
    expect(result.difference.yesterday).toBe(-4200);
    // "$12 less than yesterday by now".
    expect(result.difference.yesterdayByNow).toBe(-1200);
  });

  it('lists each of the last seven days and picks out the same day last week', () => {
    const txs = [1, 2, 3, 4, 5, 6, 7].map((n) => spend(n * 100, ago(n, 20)));
    const result = spentToday([...txs, spend(5000, ago(8)), spend(250, ago(0, 7))], now);
    expect(result.lastSevenDays.map((d) => d.spent)).toEqual([700, 600, 500, 400, 300, 200, 100]);
    // 8 pm is after 6 pm, so none of it counts by now.
    expect(result.lastSevenDays.every((d) => d.spentByNow === 0)).toBe(true);
    expect(result.sameDayLastWeek).toEqual({ day: '2026-11-13', spent: 700, spentByNow: 0 });
    expect(result.difference.sameDayLastWeek).toBe(250 - 700);
    expect(result.difference.sameDayLastWeekByNow).toBe(250);
  });

  it('averages the last 30 complete days, counting days with no spending', () => {
    const txs = [
      spend(3000, ago(1, 9)),
      spend(6000, ago(30, 20)),
      // 31 days ago is outside the average, but sets the history back far enough.
      spend(99900, ago(31)),
      // Today isn't part of the average.
      spend(1200, ago(0, 9)),
    ];
    const result = spentToday(txs, now);
    expect(result.averageDay).toEqual({ days: AVERAGE_DAYS, spent: 300, spentByNow: 100 });
    expect(result.difference.averageDay).toBe(900);
    expect(result.difference.averageDayByNow).toBe(1100);
  });

  it('averages only the days since your first transaction, when that is recent', () => {
    const result = spentToday(
      [
        makeTransaction({ cents: 100000, at: ago(4, 10) }),
        spend(1000, ago(3, 10)),
        spend(2000, ago(1, 20)),
      ],
      now,
    );
    // Four complete days: 4 days ago, when the history starts, to yesterday.
    expect(result.averageDay).toEqual({ days: 4, spent: 750, spentByNow: 250 });
  });

  it('has no average day when your first transaction is today', () => {
    const result = spentToday([spend(500, ago(0, 9))], now);
    expect(result.averageDay).toEqual({ days: 0, spent: null, spentByNow: null });
    expect(result.difference.averageDay).toBeNull();
  });

  it('leaves out transfers, Round Ups to a Saver, money in and anything after now', () => {
    const result = spentToday(
      [
        makeTransaction({ cents: -5000, at: ago(0, 9), transferAccountId: 'saver' }),
        makeTransaction({
          cents: -40,
          at: ago(0, 9),
          description: 'Round Up',
          transferAccountId: 'saver',
        }),
        // A refund doesn't reduce what was spent.
        makeTransaction({ cents: 2000, at: ago(0, 10) }),
        spend(700, ago(0, 18, 1)),
        spend(300, ago(0, 10)),
      ],
      now,
    );
    expect(result.spent).toBe(300);
  });

  it('counts held purchases once, at their amount in dollars', () => {
    const result = spentToday(
      [
        makeTransaction({ cents: -1234, at: ago(0, 9), status: 'HELD', roundUpCents: 66 }),
        makeTransaction({
          cents: -2050,
          at: ago(0, 10),
          foreign: { currencyCode: 'JPY', cents: -2000 },
        }),
        makeTransaction({ cents: -500, at: ago(1, 9), status: 'SETTLED' }),
      ],
      now,
    );
    expect(result.spent).toBe(1234 + 2050);
    expect(result.yesterday.spent).toBe(500);
  });

  it('counts a transaction at exactly midnight in the day it starts', () => {
    const midnight = new Date(2026, 10, 20);
    const result = spentToday(
      [spend(100, midnight), spend(200, new Date(midnight.getTime() - 1))],
      midnight,
    );
    expect(result.spent).toBe(100);
    expect(result.yesterday).toEqual({ day: '2026-11-19', spent: 200, spentByNow: 0 });
  });

  it('counts a transaction made at exactly now, today and by now on earlier days', () => {
    const result = spentToday([spend(100, now), spend(200, ago(1, 18))], now);
    expect(result.spent).toBe(100);
    expect(result.yesterday.spentByNow).toBe(200);
  });

  it('looks back across the start of a month and a year', () => {
    const newYear = new Date(2027, 0, 1, 9);
    const result = spentToday(
      [spend(100, new Date(2026, 11, 31, 8)), spend(200, new Date(2026, 11, 25, 8))],
      newYear,
    );
    expect(result.yesterday).toEqual({ day: '2026-12-31', spent: 100, spentByNow: 100 });
    expect(result.sameDayLastWeek).toEqual({ day: '2026-12-25', spent: 200, spentByNow: 200 });
  });

  it('skips a transaction whose date can’t be read, whatever order it comes in', () => {
    const unreadable = makeTransaction({ id: 'unreadable', cents: -100, at: ago(1) });
    unreadable.attributes.createdAt = 'not a date';
    const txs = [unreadable, spend(3000, ago(1, 12))];
    const expected = { days: 1, spent: 3000, spentByNow: 3000 };
    expect(spentToday(txs, now).averageDay).toEqual(expected);
    expect(spentToday([...txs].reverse(), now).averageDay).toEqual(expected);
    expect(spentToday(txs, now).yesterday.spent).toBe(3000);
  });

  it('handles 29 February and 1 March', () => {
    const leapDay = new Date(2028, 1, 29, 12);
    const txs = [spend(100, new Date(2028, 1, 28, 11)), spend(200, leapDay)];
    expect(spentToday(txs, leapDay)).toMatchObject({ day: '2028-02-29', spent: 200 });
    const march = spentToday(txs, new Date(2028, 2, 1, 12));
    expect(march.yesterday).toEqual({ day: '2028-02-29', spent: 200, spentByNow: 200 });
    expect(march.lastSevenDays[5]).toEqual({ day: '2028-02-28', spent: 100, spentByNow: 100 });
  });
});

describe('spentToday across Australian daylight saving changes', () => {
  useTimeZone(SYDNEY);
  const HOUR = 60 * 60 * 1000;

  it('counts the whole 23-hour day when clocks go forward', () => {
    // Clocks went from 2 am to 3 am on Sunday 4 October 2026.
    const txs = [
      spend(100, new Date(2026, 9, 4, 0, 0)),
      spend(200, new Date(2026, 9, 4, 1, 59)),
      spend(400, new Date(2026, 9, 4, 3, 0)),
      spend(800, new Date(2026, 9, 4, 23, 59, 59, 999)),
      spend(1600, new Date(2026, 9, 5, 0, 0)),
    ];
    const result = spentToday(txs, new Date(2026, 9, 5, 12));
    expect(result.yesterday).toEqual({ day: '2026-10-04', spent: 1500, spentByNow: 700 });
    expect(result.spent).toBe(1600);
  });

  it('counts the whole 25-hour day when clocks go back, including the repeated hour', () => {
    // Clocks went from 3 am back to 2 am on Sunday 5 April 2026.
    const firstTwoThirty = new Date(2026, 3, 5, 2, 30);
    const secondTwoThirty = new Date(firstTwoThirty.getTime() + HOUR);
    const txs = [
      spend(100, firstTwoThirty),
      spend(200, secondTwoThirty),
      spend(400, new Date(2026, 3, 5, 23, 30)),
      spend(800, new Date(2026, 3, 6, 0, 0)),
    ];
    const result = spentToday(txs, new Date(2026, 3, 6, 2, 45));
    // Both 2:30 am purchases were before 2:45 am by the clock.
    expect(result.yesterday).toEqual({ day: '2026-04-05', spent: 700, spentByNow: 300 });
    expect(result.spent).toBe(800);
  });

  it('compares by the clock when today is the 23-hour day', () => {
    // 3:30 am on 4 October, 2.5 hours after midnight. Yesterday by now means up to 3:30 am.
    const result = spentToday(
      [spend(100, new Date(2026, 9, 3, 3, 0)), spend(200, new Date(2026, 9, 3, 3, 45))],
      new Date(2026, 9, 4, 3, 30),
    );
    expect(result.yesterday).toEqual({ day: '2026-10-03', spent: 300, spentByNow: 100 });
  });

  it('uses Sydney days, not UTC days', () => {
    // 9 am in Sydney on 20 November is still 19 November in UTC.
    const result = spentToday(
      [spend(100, new Date(2026, 10, 20, 9)), spend(200, new Date(2026, 10, 19, 12))],
      new Date(2026, 10, 20, 12),
    );
    expect(result.spent).toBe(100);
    expect(result.yesterday.spent).toBe(200);
  });

  it('averages over 30 calendar days across a change, not 30 lots of 24 hours', () => {
    // Today is 20 October, so the average starts on 20 September, before clocks went forward.
    const today = new Date(2026, 9, 20, 12);
    const result = spentToday(
      [spend(3000, new Date(2026, 8, 20, 0, 30)), spend(99900, new Date(2026, 8, 19, 23, 30))],
      today,
    );
    expect(result.averageDay).toEqual({ days: 30, spent: 100, spentByNow: 100 });
  });
});

describe('spentToday on Lord Howe Island, where clocks change by half an hour', () => {
  useTimeZone('Australia/Lord_Howe');

  it('counts the whole 23.5-hour day when clocks go forward', () => {
    // Clocks went from 2 am to 2:30 am on 4 October 2026.
    const start = new Date(2026, 9, 4);
    expect(new Date(2026, 9, 5).getTime() - start.getTime()).toBe(23.5 * 60 * 60 * 1000);
    const result = spentToday(
      [
        spend(100, new Date(2026, 9, 4, 0, 0)),
        spend(200, new Date(2026, 9, 4, 1, 59)),
        spend(400, new Date(2026, 9, 4, 2, 30)),
        spend(800, new Date(2026, 9, 4, 23, 59)),
        spend(1600, new Date(2026, 9, 5, 0, 0)),
      ],
      new Date(2026, 9, 5, 2, 45),
    );
    expect(result.yesterday).toEqual({ day: '2026-10-04', spent: 1500, spentByNow: 700 });
    expect(result.spent).toBe(1600);
  });

  it('counts the repeated half hour once each when clocks go back', () => {
    // Clocks went from 2 am back to 1:30 am on 5 April 2026, so 1:45 am happened twice.
    const first = new Date(2026, 3, 5, 1, 45);
    const second = new Date(first.getTime() + 30 * 60 * 1000);
    expect(second.getHours() * 60 + second.getMinutes()).toBe(105);
    const result = spentToday(
      [spend(100, first), spend(200, second), spend(400, new Date(2026, 3, 5, 12))],
      new Date(2026, 3, 6, 1, 50),
    );
    expect(result.yesterday).toEqual({ day: '2026-04-05', spent: 700, spentByNow: 300 });
  });
});

describe('spendingByDay', () => {
  it('lists every day in the range, with nothing spent on days without purchases', () => {
    const range = { start: new Date(2026, 10, 1), end: new Date(2026, 10, 4) };
    const result = spendingByDay(
      [
        spend(100, new Date(2026, 10, 1)),
        spend(200, new Date(2026, 10, 3, 23, 59)),
        spend(400, new Date(2026, 10, 4)),
        spend(800, new Date(2026, 9, 31, 23, 59)),
      ],
      range,
    );
    expect(result).toEqual({
      days: [
        { day: '2026-11-01', spent: 100 },
        { day: '2026-11-02', spent: 0 },
        { day: '2026-11-03', spent: 200 },
      ],
      total: 300,
    });
  });

  it('is empty for an empty range', () => {
    const at = new Date(2026, 10, 1);
    expect(spendingByDay([spend(100, at)], { start: at, end: at })).toEqual({
      days: [],
      total: 0,
    });
  });

  it('is empty for a range with no time in it, at any time of day', () => {
    const at = new Date(2026, 10, 1, 15);
    expect(spendingByDay([spend(100, at)], { start: at, end: at })).toEqual({
      days: [],
      total: 0,
    });
    const backwards = { start: at, end: new Date(2026, 10, 1, 10) };
    expect(spendingByDay([spend(100, new Date(2026, 10, 1, 12))], backwards)).toEqual({
      days: [],
      total: 0,
    });
  });

  it('includes partial days at either end, counting only what is in range', () => {
    const range = { start: new Date(2026, 10, 1, 12), end: new Date(2026, 10, 2, 12) };
    const result = spendingByDay(
      [
        spend(100, new Date(2026, 10, 1, 11)),
        spend(200, new Date(2026, 10, 1, 13)),
        spend(400, new Date(2026, 10, 2, 11)),
        spend(800, new Date(2026, 10, 2, 13)),
      ],
      range,
    );
    expect(result.days).toEqual([
      { day: '2026-11-01', spent: 200 },
      { day: '2026-11-02', spent: 400 },
    ]);
  });

  describe('in Sydney', () => {
    useTimeZone(SYDNEY);

    it('has one entry per calendar day across both daylight saving changes', () => {
      const year = { start: new Date(2026, 0, 1), end: new Date(2027, 0, 1) };
      const result = spendingByDay([], year);
      expect(result.days).toHaveLength(365);
      expect(new Set(result.days.map((d) => d.day)).size).toBe(365);
      expect(result.days.map((d) => d.day)).toContain('2026-04-05');
      expect(result.days.map((d) => d.day)).toContain('2026-10-04');
    });
  });
});
