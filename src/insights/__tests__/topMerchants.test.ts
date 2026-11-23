import { makeTransaction } from '@/test/fixtures';
import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { monthRange, monthToDate } from '../dates';
import { merchantKey, topMerchants, UNKNOWN_MERCHANT } from '../topMerchants';

const november = monthRange(new Date(2026, 10, 1));
const buy = (description: string, cents: number, day = 10, hour = 12) =>
  makeTransaction({
    cents: -cents,
    at: new Date(2026, 10, day, hour),
    description,
    id: `${description}-${day}-${hour}-${cents}`,
  });

describe('merchantKey', () => {
  it('ignores case and spacing', () => {
    const keys = ['Bean There', 'BEAN THERE', ' bean  there ', 'BeanThere', 'Bean\tThere\u00A0'];
    expect(new Set(keys.map(merchantKey))).toEqual(new Set(['beanthere']));
  });

  it('folds Unicode compatibility forms together, and zero-width spaces', () => {
    expect(merchantKey('Ｂｅａｎ Ｔｈｅｒｅ')).toBe('beanthere');
    expect(merchantKey('Bean\u200BThere')).toBe('beanthere');
    expect(merchantKey('Café Lumo')).toBe(merchantKey('Cafe\u0301 Lumo'));
  });

  it('keeps names apart when they differ by more than case or spacing', () => {
    expect(merchantKey('Bean There 2')).not.toBe(merchantKey('Bean There'));
    expect(merchantKey('Bean-There')).not.toBe(merchantKey('Bean There'));
  });

  it('treats curly apostrophes and quotes as straight ones', () => {
    expect(merchantKey('Dan\u2019s Deli')).toBe(merchantKey("Dan's Deli"));
    expect(merchantKey('The \u201CCorner\u201D')).toBe(merchantKey('The "Corner"'));
  });

  it('keeps the joiners that emoji and some scripts need', () => {
    const chef = '\u{1F469}\u200D\u{1F373} Kitchen';
    const twoPeople = '\u{1F469}\u{1F373} Kitchen';
    expect(merchantKey(chef)).not.toBe(merchantKey(twoPeople));
    expect(merchantKey('Bean\u200CThere')).not.toBe(merchantKey('BeanThere'));
  });

  it('folds case fully, so German sharp s and Greek final sigma match', () => {
    expect(merchantKey('STRASSE CAFE')).toBe(merchantKey('Stra\u00DFe Cafe'));
    // Capital sigma becomes final sigma before a space, so spacing mustn't change the key.
    const spaced = '\u039A\u0391\u03A6\u0395\u03A3 \u039C\u03A0\u0391\u03A1';
    const unspaced = '\u039A\u0391\u03A6\u0395\u03A3\u039C\u03A0\u0391\u03A1';
    expect(merchantKey(spaced)).toBe(merchantKey(unspaced));
    expect(merchantKey('\u03BA\u03B1\u03C6\u03B5\u03C2')).toBe(
      merchantKey('\u039A\u0391\u03A6\u0395\u03A3'),
    );
  });

  it('gives an empty key for a name with nothing visible in it', () => {
    for (const blank of ['\u00AD', '\u200E', '\u200D', '\u200B\u200C', ' \u2060 ']) {
      expect(merchantKey(blank)).toBe('');
    }
  });
});

describe('topMerchants', () => {
  it('is empty with no transactions', () => {
    expect(topMerchants([], november)).toEqual({ byTotal: [], byCount: [], total: 0, count: 0 });
  });

  it('ranks by total spent and by how often you buy', () => {
    const result = topMerchants(
      [
        buy('Bean There', 450, 1),
        buy('Bean There', 450, 2),
        buy('Bean There', 500, 3),
        buy('Fernleaf Grocer', 12000, 4),
        buy('Fernleaf Grocer', 8000, 11),
        buy('Pixel Cinema', 2200, 5),
      ],
      november,
    );
    expect(result.byTotal.map((m) => [m.name, m.spent, m.count])).toEqual([
      ['Fernleaf Grocer', 20000, 2],
      ['Pixel Cinema', 2200, 1],
      ['Bean There', 1400, 3],
    ]);
    expect(result.byCount.map((m) => m.name)).toEqual([
      'Bean There',
      'Fernleaf Grocer',
      'Pixel Cinema',
    ]);
    expect(result.total).toBe(23600);
    expect(result.count).toBe(6);
  });

  it('groups names that differ only by case or spacing, showing the most common spelling', () => {
    const result = topMerchants(
      [
        buy('Bean There', 400, 1),
        buy('BEAN THERE', 400, 2),
        buy('  Bean   There ', 400, 3),
        buy('BeanThere', 400, 4),
      ],
      november,
    );
    expect(result.byTotal).toEqual([
      { key: 'beanthere', name: 'Bean There', spent: 1600, count: 4 },
    ]);
  });

  it('breaks a tie between spellings the same way whatever the order', () => {
    const txs = [buy('bean there', 100, 1), buy('Bean There', 100, 2)];
    expect(topMerchants(txs, november).byTotal[0]?.name).toBe('Bean There');
    expect(topMerchants([...txs].reverse(), november).byTotal[0]?.name).toBe('Bean There');
  });

  it('breaks ties between merchants by count, then spending, then name', () => {
    const result = topMerchants(
      [
        buy('Zinc Bakery', 500, 1),
        buy('Acorn Deli', 500, 2),
        buy('Mint Bar', 250, 3),
        buy('Mint Bar', 250, 4),
      ],
      november,
    );
    expect(result.byTotal.map((m) => m.name)).toEqual(['Mint Bar', 'Acorn Deli', 'Zinc Bakery']);
    expect(result.byCount.map((m) => m.name)).toEqual(['Mint Bar', 'Acorn Deli', 'Zinc Bakery']);
  });

  it('keeps only the top few when asked, with totals over everything', () => {
    const result = topMerchants(
      [buy('Acorn Deli', 500), buy('Mint Bar', 300), buy('Zinc Bakery', 100)],
      november,
      2,
    );
    expect(result.byTotal.map((m) => m.name)).toEqual(['Acorn Deli', 'Mint Bar']);
    expect(result.byCount).toHaveLength(2);
    expect(result.total).toBe(900);
    expect(topMerchants([buy('Acorn Deli', 500)], november, 0).byTotal).toEqual([]);
    expect(topMerchants([buy('Acorn Deli', 500)], november, NaN).byTotal).toHaveLength(1);
    // Plain JavaScript callers can pass null, which isn't a number either.
    const noLimit = null as unknown as number;
    expect(topMerchants([buy('Acorn Deli', 500)], november, noLimit).byTotal).toHaveLength(1);
  });

  it('groups blank descriptions as an unknown merchant', () => {
    const result = topMerchants([buy('', 100, 1), buy('   ', 200, 2)], november);
    expect(result.byTotal).toEqual([{ key: '', name: UNKNOWN_MERCHANT, spent: 300, count: 2 }]);
    const invisible = topMerchants([buy('\u00AD', 100, 3), buy('\u200E', 100, 4)], november);
    expect(invisible.byTotal.map((m) => m.name)).toEqual([UNKNOWN_MERCHANT]);
  });

  it('counts held purchases once, in dollars, and leaves out transfers, refunds and Round Ups', () => {
    const result = topMerchants(
      [
        makeTransaction({
          cents: -2000,
          at: new Date(2026, 10, 3),
          description: 'Fernleaf Grocer',
          status: 'HELD',
          roundUpCents: 0,
        }),
        makeTransaction({
          cents: -4567,
          at: new Date(2026, 10, 4),
          description: 'Kite Air',
          foreign: { currencyCode: 'NZD', cents: -5000 },
        }),
        // A refund is money in, not a negative purchase.
        makeTransaction({ cents: 2000, at: new Date(2026, 10, 5), description: 'Fernleaf Grocer' }),
        makeTransaction({
          cents: -60,
          at: new Date(2026, 10, 3),
          description: 'Round Up',
          transferAccountId: 'saver',
        }),
        makeTransaction({
          cents: -10000,
          at: new Date(2026, 10, 6),
          description: 'Transfer to Rainy Day',
          transferAccountId: 'saver',
        }),
      ],
      november,
    );
    expect(result.byTotal.map((m) => [m.name, m.spent, m.count])).toEqual([
      ['Kite Air', 4567, 1],
      ['Fernleaf Grocer', 2000, 1],
    ]);
  });

  it('shows names with emoji as written, and groups curly and straight apostrophes', () => {
    const chef = '\u{1F469}\u200D\u{1F373} Kitchen';
    const result = topMerchants(
      [buy(chef, 500, 1), buy("Dan's Deli", 300, 2), buy('Dan\u2019s Deli', 300, 3)],
      november,
    );
    expect(result.byTotal.map((m) => [m.name, m.count])).toEqual([
      ["Dan's Deli", 2],
      [chef, 1],
    ]);
  });

  it('leaves out purchases after now for the month so far', () => {
    const now = new Date(2026, 10, 20, 18);
    const txs = [buy('Acorn Deli', 500, 20, 17), buy('Mint Bar', 900, 20, 19)];
    expect(topMerchants(txs, monthToDate(now)).total).toBe(500);
  });

  it('includes the start of the range and leaves out its end', () => {
    const result = topMerchants(
      [
        makeTransaction({ cents: -100, at: new Date(2026, 10, 1), description: 'Start' }),
        makeTransaction({ cents: -200, at: new Date(2026, 11, 1), description: 'End' }),
        makeTransaction({ cents: -400, at: new Date(2026, 9, 31, 23, 59), description: 'Before' }),
      ],
      november,
    );
    expect(result.byTotal.map((m) => m.name)).toEqual(['Start']);
  });

  describe('in Sydney', () => {
    useTimeZone(SYDNEY);

    it('uses Sydney months, including the day clocks go forward', () => {
      const october = monthRange(new Date(2026, 9, 15));
      const result = topMerchants(
        [
          makeTransaction({ cents: -100, at: new Date(2026, 9, 1, 0, 0), description: 'A' }),
          makeTransaction({ cents: -200, at: new Date(2026, 9, 4, 3, 0), description: 'B' }),
          makeTransaction({ cents: -400, at: new Date(2026, 10, 1, 0, 30), description: 'C' }),
          makeTransaction({ cents: -800, at: new Date(2026, 8, 30, 23, 30), description: 'D' }),
        ],
        october,
      );
      expect(result.byTotal.map((m) => m.name)).toEqual(['B', 'A']);
    });
  });
});
