import { makeTransaction } from '@/test/fixtures';

import { saverMonths } from '../saverMonths';

const today = new Date(2026, 10, 20);
const nov = (day: number) => new Date(2026, 10, day, 12);
const oct = (day: number) => new Date(2026, 9, day, 12);

const deposit = (cents: number, at: Date, accountId = 'trip') =>
  makeTransaction({ accountId, cents, at, transferAccountId: 'spending' });

describe('saverMonths', () => {
  it('totals saves, withdrawals and interest per month, newest first', () => {
    const interest = makeTransaction({ accountId: 'trip', cents: 1234, at: oct(31) });
    interest.attributes.transactionType = 'Interest';

    const result = saverMonths(
      [
        deposit(30000, nov(5)),
        deposit(30000, nov(19)),
        deposit(-5000, nov(10)),
        deposit(25000, oct(8)),
        interest,
        deposit(99999, nov(5), 'someone-else'),
      ],
      ['trip'],
      3,
      today,
    );

    expect(result.map((m) => m.month)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(result[0]).toEqual({
      month: '2026-11',
      saves: { count: 2, total: 60000 },
      withdrawals: { count: 1, total: 5000 },
      interest: 0,
      net: 55000,
    });
    expect(result[1]?.interest).toBe(1234);
    expect(result[1]?.net).toBe(26234);
    expect(result[2]?.net).toBe(0);
  });

  it('ignores transfers between two of the selected Savers', () => {
    const result = saverMonths(
      [
        makeTransaction({ accountId: 'a', cents: -1000, at: nov(3), transferAccountId: 'b' }),
        makeTransaction({ accountId: 'b', cents: 1000, at: nov(3), transferAccountId: 'a' }),
      ],
      ['a', 'b'],
      1,
      today,
    );
    expect(result[0]?.net).toBe(0);
    expect(result[0]?.saves.count).toBe(0);
  });
});
