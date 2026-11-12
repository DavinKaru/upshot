import { balanceHistory } from '@/insights/balanceHistory';

import { CATEGORY_TREE } from '../categories';
import { generateDemoData } from '../generate';

const now = new Date(2026, 10, 12, 15, 30);
const data = generateDemoData({ seed: 7, now });
const byId = new Map(data.transactions.map((tx) => [tx.id, tx]));

describe('generateDemoData', () => {
  it('gives the same data for the same seed and date', () => {
    const again = generateDemoData({ seed: 7, now });
    expect(again.transactions).toEqual(data.transactions);
    expect(again.accounts).toEqual(data.accounts);
  });

  it('creates a spending account and three Savers', () => {
    expect(data.accounts.map((a) => [a.attributes.displayName, a.attributes.accountType])).toEqual([
      ['Spending', 'TRANSACTIONAL'],
      ['🌧️ Rainy Day', 'SAVER'],
      ['🗾 Japan Trip', 'SAVER'],
      ['🏡 Home Deposit', 'SAVER'],
    ]);
  });

  it('covers about a year, newest first, with nothing in the future', () => {
    const times = data.transactions.map((tx) => new Date(tx.attributes.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(Math.max(...times)).toBeLessThanOrEqual(now.getTime());
    expect(Math.min(...times)).toBeLessThan(new Date(2025, 11, 1).getTime());
    expect(data.transactions.length).toBeGreaterThan(1000);
  });

  it('keeps every balance positive throughout the year', () => {
    const negative = data.accounts
      .map((account) => ({
        account: account.attributes.displayName,
        lowest: Math.min(
          ...balanceHistory(account, data.transactions, 365, now).map((p) => p.balance),
        ),
      }))
      .filter(({ lowest }) => lowest <= 0);
    expect(negative).toEqual([]);
  });

  it('records each transfer on both accounts, with opposite amounts', () => {
    const transfers = data.transactions.filter((tx) => tx.relationships.transferAccount.data);
    const unmatched = transfers.filter((tx) => {
      const otherAccount = tx.relationships.transferAccount.data?.id;
      const amount = tx.attributes.amount.valueInBaseUnits;
      return !transfers.some(
        (other) =>
          other.relationships.account.data.id === otherAccount &&
          other.attributes.amount.valueInBaseUnits === -amount,
      );
    });
    expect(transfers.length).toBeGreaterThan(50);
    expect(unmatched).toEqual([]);
  });

  it('only uses known categories, with the right parent', () => {
    for (const tx of data.transactions) {
      const child = tx.relationships.category.data?.id;
      const parent = tx.relationships.parentCategory.data?.id;
      if (!child) {
        expect(parent).toBeUndefined();
        continue;
      }
      expect(parent).toBeDefined();
      expect(Object.keys(CATEGORY_TREE[parent as string]?.children ?? {})).toContain(child);
    }
  });

  it('leaves only the last day and a half of card purchases held', () => {
    const held = data.transactions.filter((tx) => tx.attributes.status === 'HELD');
    expect(held.length).toBeGreaterThan(0);
    for (const tx of held) {
      expect(now.getTime() - new Date(tx.attributes.createdAt).getTime()).toBeLessThan(
        1.5 * 24 * 60 * 60 * 1000,
      );
      expect(tx.attributes.settledAt).toBeNull();
    }
  });

  it('adds monthly interest to every Saver', () => {
    const savers = data.accounts.filter((a) => a.attributes.accountType === 'SAVER');
    for (const saver of savers) {
      const interest = data.transactions.filter(
        (tx) =>
          tx.relationships.account.data.id === saver.id && tx.attributes.description === 'Interest',
      );
      expect(interest.length).toBeGreaterThanOrEqual(11);
    }
    expect(byId.size).toBe(data.transactions.length);
  });
});
