import { buildCategories } from '@/demo/categories';
import { makeTransaction } from '@/test/fixtures';

import { sameMomentLastMonth, spendingByCategory, UNCATEGORISED_ID } from '../spendingByCategory';

const categories = buildCategories();
const now = new Date(2026, 10, 20, 18, 0);
const thisMonth = (day: number) => new Date(2026, 10, day, 12);
const lastMonth = (day: number) => new Date(2026, 9, day, 12);

const coffee = (cents: number, at: Date) =>
  makeTransaction({
    cents: -cents,
    at,
    category: 'restaurants-and-cafes',
    parentCategory: 'good-life',
  });
const groceries = (cents: number, at: Date) =>
  makeTransaction({ cents: -cents, at, category: 'groceries', parentCategory: 'home' });

describe('spendingByCategory', () => {
  it('totals this month by parent and child, largest first, with last month alongside', () => {
    const result = spendingByCategory(
      [
        coffee(500, thisMonth(3)),
        coffee(700, thisMonth(10)),
        groceries(9000, thisMonth(5)),
        groceries(4000, lastMonth(20)),
        coffee(300, lastMonth(2)),
      ],
      categories,
      now,
    );

    expect(result.month).toBe('2026-11');
    expect(result.total).toBe(10200);
    expect(result.lastMonth).toBe(4300);
    expect(result.parents.map((p) => [p.id, p.name, p.total, p.lastMonth])).toEqual([
      ['home', 'Home', 9000, 4000],
      ['good-life', 'Good Life', 1200, 300],
    ]);
    expect(result.parents[1]?.children).toEqual([
      { id: 'restaurants-and-cafes', name: 'Restaurants & Cafes', total: 1200, lastMonth: 300 },
    ]);
  });

  it('leaves out income, transfers and months outside the comparison', () => {
    const result = spendingByCategory(
      [
        makeTransaction({ cents: 348050, at: thisMonth(6) }),
        makeTransaction({ cents: -25000, at: thisMonth(6), transferAccountId: 'saver' }),
        groceries(5000, new Date(2026, 8, 15)),
      ],
      categories,
      now,
    );

    expect(result.total).toBe(0);
    expect(result.lastMonth).toBe(0);
    expect(result.parents).toEqual([]);
  });

  it('compares with the same stretch of last month, not the whole month', () => {
    const result = spendingByCategory(
      [
        groceries(1000, lastMonth(19)),
        groceries(5000, lastMonth(28)),
        groceries(700, thisMonth(25)),
      ],
      categories,
      now,
    );
    // The 28 Oct purchase is after "this time last month", and 25 Nov hasn't happened yet.
    expect(result.lastMonth).toBe(1000);
    expect(result.total).toBe(0);
  });

  it('groups spending without a category under Uncategorised', () => {
    const result = spendingByCategory(
      [makeTransaction({ cents: -1234, at: thisMonth(1) })],
      categories,
      now,
    );

    expect(result.parents).toEqual([
      {
        id: UNCATEGORISED_ID,
        name: 'Uncategorised',
        total: 1234,
        lastMonth: 0,
        children: [{ id: UNCATEGORISED_ID, name: 'Uncategorised', total: 1234, lastMonth: 0 }],
      },
    ]);
  });
});

describe('sameMomentLastMonth', () => {
  it('keeps the day and time', () => {
    expect(sameMomentLastMonth(new Date(2026, 10, 12, 9, 30))).toEqual(
      new Date(2026, 9, 12, 9, 30),
    );
  });

  it('clamps to the end of a shorter month', () => {
    expect(sameMomentLastMonth(new Date(2026, 2, 31, 8))).toEqual(new Date(2026, 1, 28, 8));
  });
});
