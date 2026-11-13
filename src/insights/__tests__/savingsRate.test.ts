import { generateDemoData } from '@/demo/generate';
import { makeTransaction } from '@/test/fixtures';

import { monthKey } from '../dates';
import { savingsRate } from '../savingsRate';

const now = new Date(2026, 10, 20, 18, 0);

describe('savingsRate', () => {
  it('splits each month into money in, spending and what was kept', () => {
    const rate = savingsRate(
      [
        makeTransaction({ cents: 400000, at: new Date(2026, 9, 2, 6) }),
        makeTransaction({ cents: -300000, at: new Date(2026, 9, 10, 12) }),
        makeTransaction({ cents: 200000, at: new Date(2026, 8, 2, 6) }),
        makeTransaction({ cents: -250000, at: new Date(2026, 8, 12, 12) }),
        makeTransaction({ cents: 100000, at: new Date(2026, 10, 3, 6) }),
      ],
      2,
      now,
    );
    expect(rate.months.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    expect(rate.months[0]).toMatchObject({ moneyIn: 200000, spent: 250000, kept: -50000 });
    expect(rate.months[0]?.rate).toBeCloseTo(-0.25);
    expect(rate.months[1]).toMatchObject({ moneyIn: 400000, spent: 300000, kept: 100000 });
    expect(rate.months[1]?.rate).toBeCloseTo(0.25);
    // 50,000 kept of 600,000 across both months.
    expect(rate.average).toBeCloseTo(50000 / 600000);
    expect(rate.thisMonth).toMatchObject({ month: '2026-11', moneyIn: 100000, kept: 100000 });
  });

  it('ignores moving money between your own accounts and anything after now', () => {
    const rate = savingsRate(
      [
        makeTransaction({ cents: -5000, at: new Date(2026, 10, 4), transferAccountId: 'saver' }),
        makeTransaction({ cents: 5000, at: new Date(2026, 10, 4), transferAccountId: 'spend' }),
        makeTransaction({ cents: -900, at: new Date(2026, 10, 20, 20) }),
      ],
      1,
      now,
    );
    expect(rate.thisMonth).toMatchObject({ moneyIn: 0, spent: 0, kept: 0, rate: null });
    expect(rate.months[0]?.rate).toBeNull();
    expect(rate.average).toBeNull();
  });

  it('keeps what your accounts grew by, between them, on the demo data', () => {
    const { transactions, generatedAt } = generateDemoData({ seed: 1, now });
    const rate = savingsRate(transactions, 6, generatedAt);
    for (const month of [...rate.months, rate.thisMonth]) {
      const growth = transactions
        .filter((tx) => monthKey(new Date(tx.attributes.createdAt)) === month.month)
        .reduce((sum, tx) => sum + tx.attributes.amount.valueInBaseUnits, 0);
      expect(month.kept).toBe(growth);
      expect(month.moneyIn).toBeGreaterThan(0);
    }
  });
});
