import type {
  AccountResource,
  AccountType,
  Money,
  OwnershipType,
  TransactionResource,
  TransactionStatus,
} from '@/api/up/types';

/** Small builders for hand-written test cases. Demo data covers the realistic cases. */

const money = (cents: number, currencyCode = 'AUD'): Money => ({
  currencyCode,
  value: (cents / 100).toFixed(2),
  valueInBaseUnits: cents,
});

export function makeAccount(
  id: string,
  balanceCents: number,
  options: { accountType?: AccountType; ownershipType?: OwnershipType } = {},
): AccountResource {
  const { accountType = 'SAVER', ownershipType = 'INDIVIDUAL' } = options;
  return {
    type: 'accounts',
    id,
    attributes: {
      displayName: id,
      accountType,
      ownershipType,
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
  id?: string;
  description?: string;
  /** Held transactions have no `settledAt`, and keep their amount in `holdInfo`. */
  status?: TransactionStatus;
  /** The Round Up on this purchase, in cents, as a positive number. */
  roundUpCents?: number;
  /** The boosted part of the Round Up, in cents, as a positive number. */
  boostCents?: number;
  /** Cashback paid on this transaction, in cents, as a positive number. */
  cashbackCents?: number;
  /** The amount in a foreign currency, in its smallest unit, when the purchase was overseas. */
  foreign?: { currencyCode: string; cents: number };
  transactionType?: string | null;
  /** Who made the transaction; `null` when Up doesn't say. */
  performingCustomer?: string | null;
}): TransactionResource {
  const {
    accountId = 'spending',
    cents,
    at,
    category,
    parentCategory,
    transferAccountId,
    id = `${accountId}-${at.toISOString()}-${cents}`,
    description = 'Test',
    status = 'SETTLED',
    roundUpCents,
    boostCents,
    cashbackCents,
    foreign,
    transactionType = null,
    performingCustomer = null,
  } = options;
  const foreignAmount = foreign ? money(foreign.cents, foreign.currencyCode) : null;
  return {
    type: 'transactions',
    id,
    attributes: {
      status,
      rawText: null,
      description,
      message: null,
      isCategorizable: true,
      holdInfo: status === 'HELD' ? { amount: money(cents), foreignAmount } : null,
      roundUp:
        roundUpCents !== undefined
          ? {
              amount: money(-roundUpCents),
              boostPortion: boostCents !== undefined ? money(-boostCents) : null,
            }
          : null,
      cashback:
        cashbackCents !== undefined
          ? { description: 'Test cashback', amount: money(cashbackCents) }
          : null,
      amount: money(cents),
      foreignAmount,
      cardPurchaseMethod: null,
      settledAt: status === 'HELD' ? null : at.toISOString(),
      createdAt: at.toISOString(),
      transactionType,
      note: null,
      performingCustomer: performingCustomer === null ? null : { displayName: performingCustomer },
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
