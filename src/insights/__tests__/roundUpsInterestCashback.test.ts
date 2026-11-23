import { generateDemoData } from '@/demo/generate';
import { makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { monthRange } from '../dates';
import { isInterest, roundUpsInterestCashback } from '../roundUpsInterestCashback';

const november = monthRange(new Date(2026, 10, 1));
const day = (d: number, hour = 12) => new Date(2026, 10, d, hour);
const interestPayment = (cents: number, at: Date) =>
  makeTransaction({
    accountId: 'saver',
    cents,
    at,
    description: 'Interest',
    transactionType: 'Interest',
  });

const nothing = {
  roundUps: { total: 0, boosted: 0, count: 0 },
  interest: { total: 0, count: 0 },
  cashback: { total: 0, count: 0 },
};

describe('roundUpsInterestCashback', () => {
  it('is all zeros with no transactions', () => {
    expect(roundUpsInterestCashback([], november)).toEqual(nothing);
  });

  it('adds up Round Ups from purchases, with the boosted part', () => {
    const result = roundUpsInterestCashback(
      [
        makeTransaction({ cents: -455, at: day(2), roundUpCents: 45 }),
        makeTransaction({ cents: -1210, at: day(3), roundUpCents: 290, boostCents: 200 }),
        makeTransaction({ cents: -900, at: day(4) }),
      ],
      november,
    );
    expect(result.roundUps).toEqual({ total: 335, boosted: 200, count: 2 });
  });

  it('counts each Round Up once, not again for the transfer into the Saver', () => {
    const result = roundUpsInterestCashback(
      [
        makeTransaction({ cents: -455, at: day(2, 9), roundUpCents: 45 }),
        makeTransaction({
          cents: -45,
          at: day(2, 23),
          description: 'Round Up',
          transferAccountId: 'saver',
        }),
        makeTransaction({
          accountId: 'saver',
          cents: 45,
          at: day(2, 23),
          description: 'Round Up',
          transferAccountId: 'spending',
        }),
      ],
      november,
    );
    expect(result).toEqual({ ...nothing, roundUps: { total: 45, boosted: 0, count: 1 } });
  });

  it('counts a held purchase’s Round Up, in dollars for a foreign purchase', () => {
    const result = roundUpsInterestCashback(
      [
        makeTransaction({ cents: -1234, at: day(5), status: 'HELD', roundUpCents: 66 }),
        makeTransaction({
          cents: -2010,
          at: day(6),
          roundUpCents: 90,
          foreign: { currencyCode: 'USD', cents: -1300 },
        }),
      ],
      november,
    );
    expect(result.roundUps).toEqual({ total: 156, boosted: 0, count: 2 });
  });

  it('adds up interest paid to you, but not interest charged or other money in', () => {
    const result = roundUpsInterestCashback(
      [
        interestPayment(1234, day(30, 23)),
        makeTransaction({ accountId: 'saver', cents: 66, at: day(1), description: 'interest' }),
        // Home loan interest is charged, not earned.
        makeTransaction({
          accountId: 'home-loan',
          cents: -150000,
          at: day(1),
          description: 'Interest',
          transactionType: 'Interest',
        }),
        makeTransaction({ cents: 300000, at: day(2), description: 'Salary' }),
        makeTransaction({ cents: 2000, at: day(3), description: 'Refund from Interest Books' }),
      ],
      november,
    );
    expect(result.interest).toEqual({ total: 1300, count: 2 });
  });

  it('adds up cashback paid on transactions', () => {
    const result = roundUpsInterestCashback(
      [
        makeTransaction({ cents: -5000, at: day(7), cashbackCents: 250 }),
        makeTransaction({ cents: -2000, at: day(8), status: 'HELD', cashbackCents: 100 }),
        makeTransaction({ cents: -2000, at: day(9) }),
      ],
      november,
    );
    expect(result.cashback).toEqual({ total: 350, count: 2 });
  });

  it('includes the start of the range and leaves out its end', () => {
    const result = roundUpsInterestCashback(
      [
        interestPayment(100, new Date(2026, 10, 1)),
        interestPayment(200, new Date(2026, 11, 1)),
        interestPayment(400, new Date(2026, 9, 31, 23, 59, 59, 999)),
      ],
      november,
    );
    expect(result.interest).toEqual({ total: 100, count: 1 });
  });

  it('handles 29 February and a range that crosses into a new year', () => {
    const leapDay = new Date(2028, 1, 29, 23, 55);
    const year = { start: new Date(2027, 11, 1), end: new Date(2028, 2, 1) };
    const result = roundUpsInterestCashback(
      [
        interestPayment(500, leapDay),
        interestPayment(300, new Date(2027, 11, 31, 23, 55)),
        interestPayment(900, new Date(2028, 2, 1)),
      ],
      year,
    );
    expect(result.interest).toEqual({ total: 800, count: 2 });
  });

  it('agrees with the Round Up transfers on the demo data', () => {
    const now = new Date(2026, 10, 20, 18);
    const { transactions } = generateDemoData({ seed: 1, now });
    // The demo moves each day's Round Ups at 11:50 pm; stop before today's move.
    const range = { start: new Date(2026, 9, 1), end: new Date(2026, 10, 20) };
    const result = roundUpsInterestCashback(transactions, range);
    const transferred = transactions
      .filter(
        (tx) =>
          tx.attributes.description === 'Round Ups' && tx.attributes.amount.valueInBaseUnits > 0,
      )
      .filter((tx) => {
        const at = new Date(tx.attributes.createdAt);
        return at >= range.start && at < range.end;
      })
      .reduce((sum, tx) => sum + tx.attributes.amount.valueInBaseUnits, 0);
    expect(result.roundUps.total).toBeGreaterThan(0);
    expect(result.roundUps.total).toBe(transferred);
    expect(result.interest.count).toBeGreaterThan(0);
  });
});

describe('isInterest', () => {
  it('needs money coming in from outside your accounts', () => {
    expect(isInterest(makeTransaction({ cents: 10, at: day(1), description: 'Interest' }))).toBe(
      true,
    );
    expect(
      isInterest(
        makeTransaction({
          cents: 10,
          at: day(1),
          description: 'Interest',
          transferAccountId: 'spending',
        }),
      ),
    ).toBe(false);
  });
});

describe('roundUpsInterestCashback in Sydney', () => {
  useTimeZone(SYDNEY);

  it('uses Sydney months, not UTC months', () => {
    // The month is built in Sydney time: 12:30 am on 1 November in Sydney is 31 October in UTC.
    const result = roundUpsInterestCashback(
      [
        interestPayment(100, new Date(2026, 10, 1, 0, 30)),
        interestPayment(200, new Date(2026, 9, 31, 23, 30)),
      ],
      monthRange(new Date(2026, 10, 15)),
    );
    expect(result.interest).toEqual({ total: 100, count: 1 });
  });
});
