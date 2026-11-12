import type { AccountResource, Money, TransactionResource } from '@/api/up/types';

/** Small builders for hand-written test cases. Demo data covers the realistic cases. */

const money = (cents: number): Money => ({
  currencyCode: 'AUD',
  value: (cents / 100).toFixed(2),
  valueInBaseUnits: cents,
});

export function makeAccount(id: string, balanceCents: number): AccountResource {
  return {
    type: 'accounts',
    id,
    attributes: {
      displayName: id,
      accountType: 'SAVER',
      ownershipType: 'INDIVIDUAL',
      balance: money(balanceCents),
      createdAt: '2020-01-01T00:00:00+11:00',
    },
    relationships: { transactions: {} },
  };
}

export function makeTransaction(options: {
  accountId?: string;
  cents: number;
  at: Date;
  category?: string;
  parentCategory?: string;
  transferAccountId?: string;
}): TransactionResource {
  const {
    accountId = 'spending',
    cents,
    at,
    category,
    parentCategory,
    transferAccountId,
  } = options;
  return {
    type: 'transactions',
    id: `${accountId}-${at.toISOString()}-${cents}`,
    attributes: {
      status: 'SETTLED',
      rawText: null,
      description: 'Test',
      message: null,
      isCategorizable: true,
      holdInfo: null,
      roundUp: null,
      cashback: null,
      amount: money(cents),
      foreignAmount: null,
      cardPurchaseMethod: null,
      settledAt: at.toISOString(),
      createdAt: at.toISOString(),
      transactionType: null,
      note: null,
      performingCustomer: null,
      deepLinkURL: '',
    },
    relationships: {
      account: { data: { type: 'accounts', id: accountId } },
      transferAccount: {
        data: transferAccountId ? { type: 'accounts', id: transferAccountId } : null,
      },
      category: { data: category ? { type: 'categories', id: category } : null },
      parentCategory: {
        data: parentCategory ? { type: 'categories', id: parentCategory } : null,
      },
      tags: { data: [] },
      attachment: { data: null },
    },
  };
}
