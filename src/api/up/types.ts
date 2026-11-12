/**
 * Types for the parts of the Up Banking API (v1) that Upshot uses.
 *
 * Written by hand from Up's public API reference (https://developer.up.com.au), covering
 * accounts, transactions, categories, tags, webhooks and ping. Attachments aren't covered
 * because Upshot doesn't use them. Field comments only note what matters to Upshot; see
 * Up's reference for the full descriptions.
 *
 * The API follows JSON:API: each record is a resource with `type`, `id`, `attributes`,
 * `relationships` and `links`.
 */

export const UP_API_BASE_URL = 'https://api.up.com.au/api/v1';

// Shared building blocks

/** An ISO 8601 date-time string, for example "2026-11-12T09:30:00+11:00". */
export type DateTimeString = string;

export interface Money {
  /** ISO 4217 code. Always "AUD" except for `foreignAmount`. */
  currencyCode: string;
  /** Decimal string without a currency symbol, for example "-10.56". */
  value: string;
  /** Amount in cents (or the currency's smallest unit), for example -1056. Use this for maths. */
  valueInBaseUnits: number;
}

export interface ResourceIdentifier<TType extends string> {
  type: TType;
  id: string;
}

export interface RelatedLink {
  related: string;
}

export interface SelfLink {
  self: string;
}

export interface PageLinks {
  /** Follow this URL as given to load the previous page. `null` on the first page. */
  prev: string | null;
  /** Follow this URL as given to load the next page. `null` on the last page. */
  next: string | null;
}

/** A list response. Paginated lists include `links`; the categories list doesn't. */
export interface ListResponse<TResource> {
  data: TResource[];
  links: PageLinks;
}

export interface SingleResponse<TResource> {
  data: TResource;
}

export interface UpErrorObject {
  /** The HTTP status code as a string, for example "401". */
  status: string;
  title: string;
  detail: string;
  source?: {
    parameter?: string;
    pointer?: string;
  };
}

export interface UpErrorResponse {
  errors: UpErrorObject[];
}

// Accounts

export type AccountType = 'SAVER' | 'TRANSACTIONAL' | 'HOME_LOAN';

/** `JOINT` means a 2Up account. */
export type OwnershipType = 'INDIVIDUAL' | 'JOINT';

export interface AccountResource {
  type: 'accounts';
  id: string;
  attributes: {
    displayName: string;
    accountType: AccountType;
    ownershipType: OwnershipType;
    /** Available balance, after amounts on hold. */
    balance: Money;
    createdAt: DateTimeString;
  };
  relationships: {
    transactions: { links?: RelatedLink };
  };
  links?: SelfLink;
}

export interface ListAccountsParams {
  'page[size]'?: number;
  'filter[accountType]'?: AccountType;
  'filter[ownershipType]'?: OwnershipType;
}

// Transactions

export type TransactionStatus = 'HELD' | 'SETTLED';

export type CardPurchaseMethod =
  | 'BAR_CODE'
  | 'OCR'
  | 'CARD_PIN'
  | 'CARD_DETAILS'
  | 'CARD_ON_FILE'
  | 'ECOMMERCE'
  | 'MAGNETIC_STRIPE'
  | 'CONTACTLESS';

export interface TransactionResource {
  type: 'transactions';
  id: string;
  attributes: {
    status: TransactionStatus;
    rawText: string | null;
    /** Usually the merchant name for purchases. */
    description: string;
    message: string | null;
    isCategorizable: boolean;
    /** The amounts while the transaction was held, if it ever was. */
    holdInfo: {
      amount: Money;
      foreignAmount: Money | null;
    } | null;
    roundUp: {
      /** Total Round Up, including any boost. Negative. */
      amount: Money;
      /** The boosted part of `amount`. Negative, or `null` without a boost. */
      boostPortion: Money | null;
    } | null;
    cashback: {
      description: string;
      /** Positive. */
      amount: Money;
    } | null;
    /** In AUD. Negative for money out, positive for money in. */
    amount: Money;
    /** The original foreign currency amount, or `null` for domestic transactions. */
    foreignAmount: Money | null;
    cardPurchaseMethod: {
      method: CardPurchaseMethod;
      cardNumberSuffix: string | null;
    } | null;
    /** `null` while the transaction is held. */
    settledAt: DateTimeString | null;
    createdAt: DateTimeString;
    /** For example "Purchase" or "BPAY Payment". */
    transactionType: string | null;
    note: { text: string } | null;
    /** Who made the transaction. On 2Up accounts, this tells the two people apart. */
    performingCustomer: { displayName: string } | null;
    deepLinkURL: string;
  };
  relationships: {
    account: { data: ResourceIdentifier<'accounts'>; links?: RelatedLink };
    /** Set when the transaction is a transfer between accounts. */
    transferAccount: { data: ResourceIdentifier<'accounts'> | null; links?: RelatedLink };
    category: {
      data: ResourceIdentifier<'categories'> | null;
      links?: SelfLink & Partial<RelatedLink>;
    };
    parentCategory: { data: ResourceIdentifier<'categories'> | null; links?: RelatedLink };
    tags: { data: ResourceIdentifier<'tags'>[]; links?: SelfLink };
    attachment: { data: ResourceIdentifier<'attachments'> | null; links?: RelatedLink };
  };
  links?: SelfLink;
}

export interface ListTransactionsParams {
  /** At most 100. */
  'page[size]'?: number;
  'filter[status]'?: TransactionStatus;
  /** RFC 3339 date-time. For narrowing a date range, not for paging. */
  'filter[since]'?: DateTimeString;
  /** RFC 3339 date-time. For narrowing a date range, not for paging. */
  'filter[until]'?: DateTimeString;
  /** A parent or child category ID. */
  'filter[category]'?: string;
  'filter[tag]'?: string;
}

// Categories

export interface CategoryResource {
  type: 'categories';
  /** Human-readable, for example "restaurants-and-cafes". */
  id: string;
  attributes: {
    name: string;
  };
  relationships: {
    /** `null` for top-level (parent) categories. */
    parent: { data: ResourceIdentifier<'categories'> | null; links?: RelatedLink };
    children: { data: ResourceIdentifier<'categories'>[]; links?: RelatedLink };
  };
  links?: SelfLink;
}

/** The categories list isn't paginated, so it has no `links`. */
export interface ListCategoriesResponse {
  data: CategoryResource[];
}

// Tags

export interface TagResource {
  type: 'tags';
  /** The tag's label, which is also its ID. */
  id: string;
  relationships: {
    transactions: { links?: RelatedLink };
  };
}

// Webhooks (read only: Upshot lists them so people can spot ones they don't recognise)

export interface WebhookResource {
  type: 'webhooks';
  id: string;
  attributes: {
    url: string;
    description: string | null;
    createdAt: DateTimeString;
  };
  relationships: {
    logs: { links?: RelatedLink };
  };
  links?: SelfLink;
}

// Utility

export interface PingResponse {
  meta: {
    /** The authenticated customer's ID. */
    id: string;
    statusEmoji: string;
  };
}

// Responses by endpoint

export type ListAccountsResponse = ListResponse<AccountResource>;
export type GetAccountResponse = SingleResponse<AccountResource>;
export type ListTransactionsResponse = ListResponse<TransactionResource>;
export type GetTransactionResponse = SingleResponse<TransactionResource>;
export type GetCategoryResponse = SingleResponse<CategoryResource>;
export type ListTagsResponse = ListResponse<TagResource>;
export type ListWebhooksResponse = ListResponse<WebhookResource>;
