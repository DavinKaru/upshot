import { makeAccount, makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { monthRange } from '../dates';
import { twoUpSplit } from '../twoUpSplit';

const november = monthRange(new Date(2026, 10, 1));
const accounts = [
  makeAccount('spending', 0, { accountType: 'TRANSACTIONAL' }),
  makeAccount('two-up', 0, { accountType: 'TRANSACTIONAL', ownershipType: 'JOINT' }),
  makeAccount('two-up-saver', 0, { ownershipType: 'JOINT' }),
];
const jointBuy = (cents: number, who: string | null, day = 10, accountId = 'two-up') =>
  makeTransaction({
    accountId,
    cents: -cents,
    at: new Date(2026, 10, day, 12),
    performingCustomer: who,
    id: `${accountId}-${who}-${day}-${cents}`,
  });

describe('twoUpSplit', () => {
  it('is empty with no transactions', () => {
    expect(twoUpSplit([], accounts, november)).toEqual({
      accountIds: ['two-up', 'two-up-saver'],
      total: 0,
      people: [],
      unattributed: { spent: 0, count: 0, share: 0 },
    });
  });

  it('has no accounts when you have no 2Up account', () => {
    const result = twoUpSplit([jointBuy(100, 'Alex Example')], accounts.slice(0, 1), november);
    expect(result).toMatchObject({ accountIds: [], total: 0, people: [] });
  });

  it('splits spending between two people, most spent first', () => {
    const result = twoUpSplit(
      [
        jointBuy(3000, 'Alex Example', 2),
        jointBuy(1000, 'Sam Sample', 3),
        jointBuy(4000, 'Sam Sample', 4),
        jointBuy(2000, 'Alex Example', 5, 'two-up-saver'),
      ],
      accounts,
      november,
    );
    expect(result.total).toBe(10000);
    expect(result.people).toEqual([
      { name: 'Alex Example', spent: 5000, count: 2, share: 0.5 },
      { name: 'Sam Sample', spent: 5000, count: 2, share: 0.5 },
    ]);
  });

  it('gives everything to one person when only one spent', () => {
    const result = twoUpSplit(
      [jointBuy(3000, 'Sam Sample', 2), jointBuy(500, 'Sam Sample', 3)],
      accounts,
      november,
    );
    expect(result.people).toEqual([{ name: 'Sam Sample', spent: 3500, count: 2, share: 1 }]);
  });

  it('keeps spending without a named person apart', () => {
    const result = twoUpSplit(
      [jointBuy(3000, 'Sam Sample', 2), jointBuy(1000, null, 3), jointBuy(1000, '  ', 4)],
      accounts,
      november,
    );
    expect(result.total).toBe(5000);
    expect(result.people).toEqual([{ name: 'Sam Sample', spent: 3000, count: 1, share: 0.6 }]);
    expect(result.unattributed).toEqual({ spent: 2000, count: 2, share: 0.4 });
  });

  it('treats names differing only by spacing as the same person', () => {
    const result = twoUpSplit(
      [jointBuy(100, 'Sam Sample', 2), jointBuy(200, ' Sam  Sample ', 3)],
      accounts,
      november,
    );
    expect(result.people).toEqual([{ name: 'Sam Sample', spent: 300, count: 2, share: 1 }]);
  });

  it('leaves out your own accounts, transfers, refunds and the edges of the range', () => {
    const result = twoUpSplit(
      [
        // Your own account, even though it names you.
        makeTransaction({
          cents: -900,
          at: new Date(2026, 10, 2),
          performingCustomer: 'Alex Example',
        }),
        // Moving money in and out of 2Up.
        makeTransaction({
          accountId: 'two-up',
          cents: 50000,
          at: new Date(2026, 10, 2),
          transferAccountId: 'spending',
          performingCustomer: 'Alex Example',
        }),
        makeTransaction({
          accountId: 'two-up',
          cents: -20000,
          at: new Date(2026, 10, 3),
          transferAccountId: 'two-up-saver',
          performingCustomer: 'Sam Sample',
        }),
        // A Round Up from a 2Up purchase into a 2Up Saver.
        makeTransaction({
          accountId: 'two-up',
          cents: -55,
          at: new Date(2026, 10, 3),
          description: 'Round Up',
          transferAccountId: 'two-up-saver',
          performingCustomer: 'Sam Sample',
        }),
        // A refund is money in.
        makeTransaction({
          accountId: 'two-up',
          cents: 1500,
          at: new Date(2026, 10, 4),
          performingCustomer: 'Sam Sample',
        }),
        makeTransaction({
          accountId: 'two-up',
          cents: -100,
          at: new Date(2026, 11, 1),
          performingCustomer: 'Sam Sample',
        }),
        makeTransaction({
          accountId: 'two-up',
          cents: -100,
          at: new Date(2026, 10, 1),
          performingCustomer: 'Sam Sample',
        }),
      ],
      accounts,
      november,
    );
    expect(result.total).toBe(100);
    expect(result.people).toEqual([{ name: 'Sam Sample', spent: 100, count: 1, share: 1 }]);
  });

  it('counts held purchases once, in dollars', () => {
    const result = twoUpSplit(
      [
        makeTransaction({
          accountId: 'two-up',
          cents: -2500,
          at: new Date(2026, 10, 5),
          status: 'HELD',
          performingCustomer: 'Alex Example',
        }),
        makeTransaction({
          accountId: 'two-up',
          cents: -7500,
          at: new Date(2026, 10, 6),
          foreign: { currencyCode: 'EUR', cents: -4500 },
          performingCustomer: 'Sam Sample',
        }),
      ],
      accounts,
      november,
    );
    expect(result.people.map((p) => [p.name, p.spent])).toEqual([
      ['Sam Sample', 7500],
      ['Alex Example', 2500],
    ]);
  });

  describe('in Sydney', () => {
    useTimeZone(SYDNEY);

    it('uses Sydney months, not UTC months', () => {
      const result = twoUpSplit(
        [
          makeTransaction({
            accountId: 'two-up',
            cents: -100,
            at: new Date(2026, 10, 1, 0, 30),
            performingCustomer: 'Sam Sample',
          }),
          makeTransaction({
            accountId: 'two-up',
            cents: -200,
            at: new Date(2026, 9, 31, 23, 30),
            performingCustomer: 'Sam Sample',
          }),
        ],
        accounts,
        monthRange(new Date(2026, 10, 15)),
      );
      expect(result.total).toBe(100);
    });
  });
});
