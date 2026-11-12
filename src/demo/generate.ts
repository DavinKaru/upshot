import type {
  AccountResource,
  AccountType,
  CardPurchaseMethod,
  CategoryResource,
  Money,
  TransactionResource,
} from '@/api/up/types';

import { buildCategories, parentOf } from './categories';
import { EMPLOYER, MERCHANT_PATTERNS, MONTHLY_BILLS } from './merchants';
import { createRandom, type Random } from '@/lib/random';

export interface DemoData {
  accounts: AccountResource[];
  /** Newest first, as Up's API returns them. */
  transactions: TransactionResource[];
  categories: CategoryResource[];
  /** The moment the data was generated "as at". */
  generatedAt: Date;
}

export interface DemoOptions {
  /** The same seed always gives the same data. */
  seed?: number;
  /** Generate history up to this moment. Defaults to now. */
  now?: Date;
  /** How much history to generate. */
  months?: number;
}

interface DemoAccount {
  id: string;
  name: string;
  type: AccountType;
  createdAt: Date;
  /** Running balance in cents while generating. */
  balance: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SAVER_INTEREST_RATE = 0.0485;
const PAY_CENTS = 378040;
const CARD_SUFFIX = '4821';
const CUSTOMER = 'Sam';

const toMoney = (cents: number): Money => ({
  currencyCode: 'AUD',
  value: (cents / 100).toFixed(2),
  valueInBaseUnits: cents,
});

const dollarsToCents = (dollars: number) => Math.round(dollars * 100);

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const isLastDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getDate() === 1;

/**
 * Generates a realistic, entirely made-up year of banking in the shape of Up's API.
 *
 * One person with a spending account and three Savers: they're paid fortnightly, pay rent and
 * bills, buy coffee and groceries, move money into Savers on payday, collect Round Ups and
 * monthly interest, and take one holiday funded from a Saver.
 */
export function generateDemoData(options: DemoOptions = {}): DemoData {
  const { seed = 2026, now = new Date(), months = 12 } = options;
  const random = createRandom(seed);
  const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - months, now.getDate()));

  const spending: DemoAccount = {
    id: random.id(),
    name: 'Spending',
    type: 'TRANSACTIONAL',
    createdAt: new Date(start.getTime() - 400 * DAY_MS),
    balance: 185000,
  };
  const rainyDay: DemoAccount = {
    id: random.id(),
    name: '🌧️ Rainy Day',
    type: 'SAVER',
    createdAt: new Date(start.getTime() - 380 * DAY_MS),
    balance: 320000,
  };
  const japanTrip: DemoAccount = {
    id: random.id(),
    name: '🗾 Japan Trip',
    type: 'SAVER',
    createdAt: new Date(start.getTime() - 60 * DAY_MS),
    balance: 60000,
  };
  const homeDeposit: DemoAccount = {
    id: random.id(),
    name: '🏡 Home Deposit',
    type: 'SAVER',
    createdAt: new Date(start.getTime() - 700 * DAY_MS),
    balance: 1240000,
  };
  const accounts = [spending, rainyDay, japanTrip, homeDeposit];
  const savers = [rainyDay, japanTrip, homeDeposit];

  /** How much each Saver receives on payday, in cents. */
  const paydayTransfers = new Map<DemoAccount, number>([
    [rainyDay, 25000],
    [japanTrip, 30000],
    [homeDeposit, 40000],
  ]);

  const transactions: TransactionResource[] = [];

  const add = (
    account: DemoAccount,
    cents: number,
    at: Date,
    details: {
      description: string;
      category?: string | null;
      transactionType?: string | null;
      transferAccount?: DemoAccount;
      roundUpCents?: number;
      cardMethod?: CardPurchaseMethod;
      message?: string | null;
    },
  ) => {
    if (at > now) return;
    account.balance += cents;
    transactions.push(
      buildTransaction(random, now, {
        accountId: account.id,
        cents,
        at,
        description: details.description,
        category: details.category ?? null,
        transactionType: details.transactionType ?? null,
        transferAccountId: details.transferAccount?.id ?? null,
        roundUpCents: details.roundUpCents ?? 0,
        cardMethod: details.cardMethod ?? null,
        message: details.message ?? null,
      }),
    );
  };

  const transfer = (
    from: DemoAccount,
    to: DemoAccount,
    cents: number,
    at: Date,
    label?: string,
  ) => {
    add(from, -cents, at, {
      description: label ?? `Transfer to ${to.name}`,
      transactionType: 'Transfer',
      transferAccount: to,
    });
    add(to, cents, new Date(at.getTime() + 1000), {
      description: label ?? `Transfer from ${from.name}`,
      transactionType: 'Transfer',
      transferAccount: from,
    });
  };

  // Pay day is every second Thursday, starting from the first Thursday in range.
  const firstPayday = new Date(start);
  while (firstPayday.getDay() !== 4) firstPayday.setDate(firstPayday.getDate() + 1);

  // The holiday happens about four months before "now".
  const holidayStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 4, 8));
  const holidayDays = 10;

  for (let day = new Date(start); day <= now; day = new Date(day.getTime() + DAY_MS)) {
    const at = (hour: number, minute = random.int(0, 59)) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, random.int(0, 59));

    const daysSincePayday = Math.round((day.getTime() - firstPayday.getTime()) / DAY_MS);
    const isPayday = daysSincePayday >= 0 && daysSincePayday % 14 === 0;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const daysIntoHoliday = Math.round((day.getTime() - holidayStart.getTime()) / DAY_MS);
    const onHoliday = daysIntoHoliday >= 0 && daysIntoHoliday < holidayDays;

    if (isPayday) {
      add(spending, PAY_CENTS, at(6, 5), {
        description: EMPLOYER,
        transactionType: 'Salary',
        message: 'Fortnightly pay',
      });
      for (const [saver, cents] of paydayTransfers) {
        transfer(spending, saver, cents, at(9, 30));
      }
    }

    for (const bill of MONTHLY_BILLS) {
      if (day.getDate() === bill.day) {
        const cents = dollarsToCents(random.between(bill.amount[0], bill.amount[1]));
        add(spending, -cents, at(7), {
          description: bill.name,
          category: bill.category,
          transactionType: bill.transactionType,
          cardMethod: bill.transactionType === 'Purchase' ? 'CARD_ON_FILE' : undefined,
        });
      }
    }

    // Flights and the hotel are paid from the trip Saver the week before leaving.
    if (daysIntoHoliday === -7) {
      transfer(japanTrip, spending, Math.min(japanTrip.balance, 380000), at(10, 15));
      add(spending, -dollarsToCents(1486.4), at(10, 40), {
        description: 'Skyward Airlines',
        category: 'holidays-and-travel',
        transactionType: 'Purchase',
        cardMethod: 'ECOMMERCE',
      });
      add(spending, -dollarsToCents(1312.75), at(11, 5), {
        description: 'Sakura Stay Hotels',
        category: 'holidays-and-travel',
        transactionType: 'Purchase',
        cardMethod: 'ECOMMERCE',
      });
    }

    let roundUpsToday = 0;
    for (const pattern of MERCHANT_PATTERNS) {
      const goodLife = parentOf(pattern.category) === 'good-life';
      const rate =
        (pattern.perWeek / 7) * (isWeekend && goodLife ? 1.5 : 1) * (onHoliday ? 0.2 : 1);
      // Allow more than one purchase a day for frequent patterns, like coffee.
      let expected = rate;
      while (expected > 0) {
        if (random.chance(Math.min(expected, 1))) {
          const cents = dollarsToCents(random.between(pattern.amount[0], pattern.amount[1]));
          const roundUp = (100 - (cents % 100)) % 100;
          roundUpsToday += roundUp;
          add(spending, -cents, at(random.int(7, 21)), {
            description: random.pick(pattern.names),
            category: pattern.category,
            transactionType: pattern.transactionType ?? 'Purchase',
            roundUpCents: roundUp,
            cardMethod: random.chance(0.85) ? 'CONTACTLESS' : 'ECOMMERCE',
          });
        }
        expected -= 1;
      }
    }

    if (onHoliday) {
      const cents = dollarsToCents(random.between(40, 160));
      add(spending, -cents, at(random.int(10, 21)), {
        description: random.pick([
          'Kyoto Night Market',
          'Shibuya Ramen House',
          'Lantern Rail Pass',
        ]),
        category: 'holidays-and-travel',
        transactionType: 'Purchase',
        cardMethod: 'CONTACTLESS',
      });
    }

    if (roundUpsToday > 0) transfer(spending, rainyDay, roundUpsToday, at(23, 50), 'Round Ups');

    if (isLastDayOfMonth(day)) {
      for (const saver of savers) {
        const interest = Math.round((saver.balance * SAVER_INTEREST_RATE) / 12);
        if (interest > 0) {
          add(saver, interest, at(23, 55), {
            description: 'Interest',
            transactionType: 'Interest',
          });
        }
      }
    }
  }

  transactions.sort((a, b) => b.attributes.createdAt.localeCompare(a.attributes.createdAt));

  return {
    accounts: accounts.map(toAccountResource),
    transactions,
    categories: buildCategories(),
    generatedAt: now,
  };
}

function toAccountResource(account: DemoAccount): AccountResource {
  return {
    type: 'accounts',
    id: account.id,
    attributes: {
      displayName: account.name,
      accountType: account.type,
      ownershipType: 'INDIVIDUAL',
      balance: toMoney(account.balance),
      createdAt: account.createdAt.toISOString(),
    },
    relationships: {
      transactions: {
        links: { related: `https://api.up.com.au/api/v1/accounts/${account.id}/transactions` },
      },
    },
    links: { self: `https://api.up.com.au/api/v1/accounts/${account.id}` },
  };
}

interface TransactionInput {
  accountId: string;
  cents: number;
  at: Date;
  description: string;
  category: string | null;
  transactionType: string | null;
  transferAccountId: string | null;
  roundUpCents: number;
  cardMethod: CardPurchaseMethod | null;
  message: string | null;
}

function buildTransaction(random: Random, now: Date, input: TransactionInput): TransactionResource {
  const id = random.id();
  const isCardPurchase = input.cardMethod !== null;
  // Card purchases from the last day and a half are still held, like real pending payments.
  const held = isCardPurchase && now.getTime() - input.at.getTime() < 1.5 * DAY_MS;
  const settledAt = held ? null : new Date(input.at.getTime() + (isCardPurchase ? DAY_MS : 0));
  const amount = toMoney(input.cents);

  return {
    type: 'transactions',
    id,
    attributes: {
      status: held ? 'HELD' : 'SETTLED',
      rawText: isCardPurchase ? input.description.toUpperCase() : null,
      description: input.description,
      message: input.message,
      isCategorizable: input.transferAccountId === null && input.cents < 0,
      holdInfo: isCardPurchase ? { amount, foreignAmount: null } : null,
      roundUp:
        input.roundUpCents > 0
          ? { amount: toMoney(-input.roundUpCents), boostPortion: null }
          : null,
      cashback: null,
      amount,
      foreignAmount: null,
      cardPurchaseMethod: isCardPurchase
        ? { method: input.cardMethod as CardPurchaseMethod, cardNumberSuffix: CARD_SUFFIX }
        : null,
      settledAt:
        settledAt && settledAt <= now
          ? settledAt.toISOString()
          : held
            ? null
            : input.at.toISOString(),
      createdAt: input.at.toISOString(),
      transactionType: input.transactionType,
      note: null,
      performingCustomer: { displayName: CUSTOMER },
      deepLinkURL: `up://transaction/${id}`,
    },
    relationships: {
      account: { data: { type: 'accounts', id: input.accountId } },
      transferAccount: {
        data: input.transferAccountId ? { type: 'accounts', id: input.transferAccountId } : null,
      },
      category: {
        data: input.category ? { type: 'categories', id: input.category } : null,
        links: { self: `https://api.up.com.au/api/v1/transactions/${id}/relationships/category` },
      },
      parentCategory: {
        data: input.category ? { type: 'categories', id: parentOf(input.category) } : null,
      },
      tags: {
        data: [],
        links: { self: `https://api.up.com.au/api/v1/transactions/${id}/relationships/tags` },
      },
      attachment: { data: null },
    },
    links: { self: `https://api.up.com.au/api/v1/transactions/${id}` },
  };
}
