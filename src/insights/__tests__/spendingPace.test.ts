import { buildCategories } from '@/demo/categories';
import { generateDemoData } from '@/demo/generate';
import { makeTransaction } from '@/test/fixtures';

import { spendingByCategory } from '../spendingByCategory';
import { spendingPace } from '../spendingPace';

const now = new Date(2026, 10, 20, 18, 0);
const spend = (cents: number, at: Date) =>
  makeTransaction({ cents: -cents, at, category: 'groceries', parentCategory: 'home' });

describe('spendingPace', () => {
  it('builds running totals for this month to today, and all of last month', () => {
    const pace = spendingPace(
      [
        spend(500, new Date(2026, 10, 2, 9)),
        spend(700, new Date(2026, 10, 2, 15)),
        spend(1000, new Date(2026, 10, 19, 12)),
        spend(300, new Date(2026, 9, 1, 12)),
        spend(4000, new Date(2026, 9, 25, 12)),
      ],
      now,
    );
    expect(pace.daysInMonth).toBe(30);
    expect(pace.thisMonth).toHaveLength(20);
    expect(pace.thisMonth.slice(0, 3)).toEqual([0, 1200, 1200]);
    expect(pace.total).toBe(2200);
    expect(pace.lastMonth).toHaveLength(31);
    expect(pace.lastMonth[30]).toBe(4300);
    // By 20 October only the 300 had been spent.
    expect(pace.lastMonthSoFar).toBe(300);
  });

  it('leaves out money coming in, transfers and anything after now', () => {
    const pace = spendingPace(
      [
        makeTransaction({ cents: 50000, at: new Date(2026, 10, 3, 9) }),
        makeTransaction({ cents: -2000, at: new Date(2026, 10, 4, 9), transferAccountId: 'saver' }),
        spend(900, new Date(2026, 10, 20, 20)),
      ],
      now,
    );
    expect(pace.total).toBe(0);
  });

  it('agrees with the category breakdown on the demo data', () => {
    const { transactions, generatedAt } = generateDemoData({ seed: 1, now });
    const pace = spendingPace(transactions, generatedAt);
    const month = spendingByCategory(transactions, buildCategories(), generatedAt);
    expect(pace.total).toBe(month.total);
    expect(pace.lastMonthSoFar).toBe(month.lastMonth);
    for (let i = 1; i < pace.thisMonth.length; i++) {
      expect(pace.thisMonth[i]).toBeGreaterThanOrEqual(pace.thisMonth[i - 1] ?? 0);
    }
  });
});
