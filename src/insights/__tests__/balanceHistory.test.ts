import { makeAccount, makeTransaction } from '@/test/fixtures';

import { balanceHistory, samplePoints, sumHistories } from '../balanceHistory';

const today = new Date(2026, 10, 12, 15, 0);
const daysAgo = (n: number, hour = 12) => new Date(2026, 10, 12 - n, hour);

describe('balanceHistory', () => {
  it('walks back from the current balance, one day at a time', () => {
    const account = makeAccount('saver', 100000);
    const transactions = [
      makeTransaction({ accountId: 'saver', cents: 20000, at: daysAgo(0) }),
      makeTransaction({ accountId: 'saver', cents: -5000, at: daysAgo(1) }),
    ];

    expect(balanceHistory(account, transactions, 3, today)).toEqual([
      { day: '2026-11-10', balance: 85000 },
      { day: '2026-11-11', balance: 80000 },
      { day: '2026-11-12', balance: 100000 },
    ]);
  });

  it('ignores other accounts and keeps the balance flat on quiet days', () => {
    const account = makeAccount('saver', 5000);
    const transactions = [
      makeTransaction({ accountId: 'spending', cents: -99999, at: daysAgo(0) }),
      makeTransaction({ accountId: 'saver', cents: 1000, at: daysAgo(3) }),
    ];

    const history = balanceHistory(account, transactions, 5, today);
    expect(history.map((p) => p.balance)).toEqual([4000, 5000, 5000, 5000, 5000]);
  });

  it('returns the requested number of days, oldest first', () => {
    const history = balanceHistory(makeAccount('saver', 0), [], 30, today);
    expect(history).toHaveLength(30);
    expect(history[0]?.day).toBe('2026-10-14');
    expect(history[29]?.day).toBe('2026-11-12');
  });
});

describe('sumHistories', () => {
  it('adds balances day by day', () => {
    const a = [
      { day: '2026-11-11', balance: 100 },
      { day: '2026-11-12', balance: 200 },
    ];
    const b = [
      { day: '2026-11-11', balance: 5 },
      { day: '2026-11-12', balance: 7 },
    ];
    expect(sumHistories([a, b])).toEqual([
      { day: '2026-11-11', balance: 105 },
      { day: '2026-11-12', balance: 207 },
    ]);
  });

  it('returns nothing for no histories', () => {
    expect(sumHistories([])).toEqual([]);
  });
});

describe('samplePoints', () => {
  const days = Array.from({ length: 365 }, (_, i) => i);

  it('keeps short histories as they are', () => {
    expect(samplePoints(days.slice(0, 30))).toEqual(days.slice(0, 30));
  });

  it('thins long histories evenly, always keeping the latest point', () => {
    const sampled = samplePoints(days, 60);
    expect(sampled.length).toBeLessThanOrEqual(61);
    expect(sampled[sampled.length - 1]).toBe(364);
    expect((sampled[1] as number) - (sampled[0] as number)).toBe(7);
  });
});
