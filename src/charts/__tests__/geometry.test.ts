import {
  buildLineChart,
  donutSegments,
  expandSegments,
  inSegment,
  nearestIndex,
  segmentAt,
} from '../geometry';

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

describe('expandSegments', () => {
  const base = donutSegments([50, 30, 20], 6);

  it('leaves the ring as it is before the animation starts', () => {
    expect(expandSegments(base, 1, 0)).toEqual(base);
  });

  it('grows the chosen segment to the whole ring and shrinks the rest to nothing', () => {
    const full = expandSegments(base, 1, 1);
    expect(full[1]?.sweep).toBeCloseTo(360);
    expect(full[0]?.sweep).toBeCloseTo(0);
    expect(full[2]?.sweep).toBeCloseTo(0);
  });

  it('keeps the chosen segment centred where it was', () => {
    const before = base[1] as { start: number; sweep: number };
    const half = expandSegments(base, 1, 0.5)[1] as { start: number; sweep: number };
    expect(half.start + half.sweep / 2).toBeCloseTo(before.start + before.sweep / 2);
  });

  it('always fills exactly one ring, gaps included', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const segments = expandSegments(base, 2, t);
      const sweeps = segments.reduce((sum, s) => sum + s.sweep, 0);
      const gaps = (360 - base.reduce((sum, s) => sum + s.sweep, 0)) * (1 - t);
      expect(sweeps + gaps).toBeCloseTo(360);
    }
  });

  it("ignores an anchor that isn't there", () => {
    expect(expandSegments(base, 7, 1)).toEqual(base);
  });
});

describe('inSegment', () => {
  it("matches angles inside the arc, wrapping past 12 o'clock", () => {
    expect(inSegment(10, 0, 90)).toBe(true);
    expect(inSegment(100, 0, 90)).toBe(false);
    expect(inSegment(5, 350, 20)).toBe(true);
    expect(inSegment(340, 350, 20)).toBe(false);
    expect(inSegment(123, 40, 360)).toBe(true);
    expect(inSegment(10, 0, 0)).toBe(false);
  });
});
