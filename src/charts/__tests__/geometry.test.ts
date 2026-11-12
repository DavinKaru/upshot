import { buildLineChart, donutSegments, nearestIndex, segmentAt } from '../geometry';

describe('buildLineChart', () => {
  it('spreads points across the width and keeps them inside the insets', () => {
    const chart = buildLineChart([10, 20, 15, 30], 300, 100);
    expect(chart.xs).toEqual([0, 100, 200, 300]);
    for (const y of chart.ys) {
      expect(y).toBeGreaterThanOrEqual(12);
      expect(y).toBeLessThanOrEqual(88);
    }
    // Higher values sit higher on screen (smaller y).
    expect(chart.ys[3]).toBeLessThan(chart.ys[0] as number);
    expect(chart.line.startsWith('M0,')).toBe(true);
    expect(chart.area.length).toBeGreaterThan(chart.line.length);
  });

  it('draws a flat line through the middle when every value is the same', () => {
    const chart = buildLineChart([5, 5, 5], 200, 100);
    expect(new Set(chart.ys).size).toBe(1);
    expect(chart.ys[0]).toBeCloseTo(50);
  });

  it('returns empty paths when there is nothing to draw', () => {
    expect(buildLineChart([], 200, 100)).toEqual({ line: '', area: '', xs: [], ys: [] });
    expect(buildLineChart([1, 2], 0, 100).xs).toEqual([]);
  });
});

describe('nearestIndex', () => {
  const xs = [0, 10, 20, 30];

  it('finds the closest point', () => {
    expect(nearestIndex(xs, 0)).toBe(0);
    expect(nearestIndex(xs, 14)).toBe(1);
    expect(nearestIndex(xs, 16)).toBe(2);
    expect(nearestIndex(xs, 29)).toBe(3);
  });

  it('clamps touches outside the chart to the ends', () => {
    expect(nearestIndex(xs, -50)).toBe(0);
    expect(nearestIndex(xs, 500)).toBe(3);
  });

  it('returns -1 with no points', () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe('donutSegments', () => {
  it('splits the ring in proportion, leaving gaps between segments', () => {
    const segments = donutSegments([75, 25], 4);
    expect(segments[0]?.sweep).toBeCloseTo(264);
    expect(segments[1]?.sweep).toBeCloseTo(88);
    const end = (segments[1]?.start ?? 0) + (segments[1]?.sweep ?? 0);
    expect(end + 2).toBeCloseTo(360);
  });

  it('uses the whole ring for a single segment', () => {
    expect(donutSegments([42])).toEqual([{ start: 0, sweep: 360 }]);
  });

  it('gives zero values no segment', () => {
    const segments = donutSegments([10, 0, 10], 0);
    expect(segments.map((s) => s.sweep)).toEqual([180, 0, 180]);
  });
});

describe('segmentAt', () => {
  const segments = donutSegments([50, 50], 0);

  it('finds the segment under a touch on the ring', () => {
    // Right of centre is 90°, in the first half; left of centre is 270°, in the second.
    expect(segmentAt(segments, 190, 100, 100, 100, 70, 100)).toBe(0);
    expect(segmentAt(segments, 10, 100, 100, 100, 70, 100)).toBe(1);
  });

  it('ignores touches in the hole or outside the ring', () => {
    expect(segmentAt(segments, 100, 100, 100, 100, 70, 100)).toBe(-1);
    expect(segmentAt(segments, 250, 100, 100, 100, 70, 100)).toBe(-1);
  });
});
