import * as fc from 'fast-check';

import { buildBarChart } from '../geometry';
import { LINE_LABEL_GAP, LINE_LABEL_HEIGHT, placeLineLabels } from '../lineLabels';

const H = LINE_LABEL_HEIGHT;
const apart = (a: number, b: number) => Math.abs(a - b) >= H + LINE_LABEL_GAP - 1e-9;
const middle = (top: number) => top + H / 2;

/** The Savers chart's layout: 14 points above the bars, 6 below, 40 for the labels. */
function savingsChart(kept: number[], moneyIn: number[], height = 230) {
  const averageKept = Math.round(kept.reduce((sum, k) => sum + k, 0) / kept.length);
  return buildBarChart(
    kept,
    360,
    height,
    { top: 14, bottom: 6, left: 0, right: 40 },
    { reference: averageKept, include: moneyIn },
  );
}

describe('placeLineLabels', () => {
  it('centres each label on its line when the lines are far apart', () => {
    expect(placeLineLabels(200, 60, 230)).toEqual({ zero: 192, average: 52 });
    expect(placeLineLabels(60, 200, 230)).toEqual({ zero: 52, average: 192 });
  });

  it('centres "$0" on its line when there is no average', () => {
    expect(placeLineLabels(224, null, 230)).toEqual({ zero: 216, average: null });
  });

  it('puts "Avg" above "$0" when the average is just above zero', () => {
    const tops = placeLineLabels(150, 145, 230);
    expect(tops.average).toBeLessThan(tops.zero);
    expect(apart(tops.zero, tops.average ?? NaN)).toBe(true);
  });

  it('puts "Avg" below "$0" when the average is just below zero', () => {
    const tops = placeLineLabels(150, 155, 230);
    expect(tops.average).toBeGreaterThan(tops.zero);
    expect(apart(tops.zero, tops.average ?? NaN)).toBe(true);
  });

  it('puts "Avg" on top when the average is exactly zero', () => {
    const tops = placeLineLabels(150, 150, 230);
    expect(tops).toEqual({ zero: 151, average: 133 });
  });

  it('keeps the labels apart for an average of -$528 on the Savers chart', () => {
    // Six months that kept -$1,000, $600, -$800, $400, -$900 and -$1,468: -$528 on average.
    const kept = [-100000, 60000, -80000, 40000, -90000, -146800];
    const geometry = savingsChart(kept, [800000, 850000, 780000, 820000, 800000, 810000]);
    const { zeroY, referenceY } = geometry;
    expect(referenceY).not.toBeNull();
    // The average line is below zero, close enough that the old 14-point guard kicked in.
    expect((referenceY ?? 0) - zeroY).toBeGreaterThan(0);
    expect((referenceY ?? 0) - zeroY).toBeLessThan(14);
    // The old placement tucked "$0" under its line and left "Avg" centred, right on top of it.
    const oldAverageTop = (referenceY ?? 0) - 8;
    const oldZeroTop = zeroY + 2;
    expect(apart(oldZeroTop, oldAverageTop)).toBe(false);

    const tops = placeLineLabels(zeroY, referenceY, 230);
    expect(apart(tops.zero, tops.average ?? NaN)).toBe(true);
    expect(tops.average).toBeGreaterThan(tops.zero);
  });

  it('keeps both labels within the chart when the lines are at its very top or bottom', () => {
    const bottom = placeLineLabels(230, 229, 230);
    expect(middle(bottom.zero)).toBeLessThanOrEqual(230);
    expect(apart(bottom.zero, bottom.average ?? NaN)).toBe(true);
    const top = placeLineLabels(0, 1, 230);
    expect(middle(top.zero)).toBeGreaterThanOrEqual(0);
    expect(middle(top.average ?? NaN)).toBeGreaterThanOrEqual(0);
    expect(apart(top.zero, top.average ?? NaN)).toBe(true);
  });

  it('stacks the labels from the top of a chart too short to fit both', () => {
    const tops = placeLineLabels(10, 8, 12);
    expect(tops).toEqual({ average: -H / 2, zero: -H / 2 + H + LINE_LABEL_GAP });
    // With the average below zero, "$0" is the upper label.
    expect(placeLineLabels(2, 8, 10)).toEqual({
      zero: -H / 2,
      average: -H / 2 + H + LINE_LABEL_GAP,
    });
  });

  it('never overlaps labels made taller for large text, at any font scale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 4, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (scale, height, zeroAt, averageAt) => {
          const labelHeight = H * scale;
          const tops = placeLineLabels(zeroAt * height, averageAt * height, height, labelHeight);
          return Math.abs(tops.zero - (tops.average ?? NaN)) >= labelHeight + LINE_LABEL_GAP - 1e-9;
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('never overlaps the labels, for any lines and chart height', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: null }),
        (height, zeroAt, averageAt) => {
          const zeroY = zeroAt * height;
          const averageY = averageAt === null ? null : averageAt * height;
          const tops = placeLineLabels(zeroY, averageY, height);
          if (averageY === null) return tops.average === null && tops.zero === zeroY - H / 2;
          const average = tops.average as number;
          if (!apart(tops.zero, average)) return false;
          // The label of the higher line stays on top, with "Avg" on top at exactly zero.
          if (averageY <= zeroY !== average < tops.zero) return false;
          // Labels whose lines are far enough apart stay centred on them.
          if (Math.abs(averageY - zeroY) >= H + LINE_LABEL_GAP) {
            return tops.zero === zeroY - H / 2 && average === averageY - H / 2;
          }
          // With room for both, the labels' middles stay within the chart.
          if (height >= H + LINE_LABEL_GAP) {
            const ok = (top: number) => middle(top) >= -1e-9 && middle(top) <= height + 1e-9;
            return ok(tops.zero) && ok(average);
          }
          return true;
        },
      ),
      { numRuns: 5000 },
    );
  });

  it('never overlaps the labels on the Savers chart, for any months and chart height', () => {
    const cents = fc.integer({ min: -2_000_000, max: 2_000_000 });
    fc.assert(
      fc.property(
        fc.array(fc.tuple(cents, fc.integer({ min: 0, max: 2_000_000 })), {
          minLength: 1,
          maxLength: 12,
        }),
        fc.integer({ min: 40, max: 600 }),
        (months, height) => {
          const geometry = savingsChart(
            months.map(([kept]) => kept),
            months.map(([, moneyIn]) => moneyIn),
            height,
          );
          const tops = placeLineLabels(geometry.zeroY, geometry.referenceY, height);
          return tops.average !== null && apart(tops.zero, tops.average);
        },
      ),
      { numRuns: 2000 },
    );
  });
});
