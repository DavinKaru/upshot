import {
  barAt,
  buildBarChart,
  buildLineChart,
  buildPaceChart,
  donutSegments,
  gapsAt,
  planGapMoves,
  ringGaps,
  inSegment,
  nearestIndex,
  segmentAt,
  wipeSegment,
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

describe('wipeSegment', () => {
  const segment = { start: 100, sweep: 40 };

  it('is the segment itself before the animation starts', () => {
    expect(wipeSegment(segment, 0)).toEqual(segment);
  });

  it('keeps its start and sweeps clockwise until it covers the ring', () => {
    expect(wipeSegment(segment, 0.5)).toEqual({ start: 100, sweep: 200 });
    expect(wipeSegment(segment, 1)).toEqual({ start: 100, sweep: 360 });
    expect(wipeSegment(segment, 1.2).sweep).toBe(360);
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

describe('ringGaps', () => {
  it("finds the split before each visible segment, starting at 12 o'clock", () => {
    const { centres, width } = ringGaps(donutSegments([50, 0, 50], 6));
    expect(width).toBeCloseTo(6);
    expect(centres).toHaveLength(2);
    expect(centres[0]).toBeCloseTo(0);
    expect(centres[1]).toBeCloseTo(180);
  });

  it('has no splits for a ring of one segment', () => {
    expect(ringGaps(donutSegments([10], 6))).toEqual({ centres: [], width: 0 });
  });
});

describe('planGapMoves', () => {
  it('moves every split clockwise, to the nearest new split at or after it', () => {
    const moves = planGapMoves(
      { centres: [0, 100, 200], width: 5 },
      { centres: [0, 150, 250], width: 5 },
    );
    expect(moves).toEqual([
      { from: 0, to: 0, fromWidth: 5, toWidth: 5 },
      { from: 100, to: 150, fromWidth: 5, toWidth: 5 },
      { from: 200, to: 250, fromWidth: 5, toWidth: 5 },
    ]);
    for (const m of moves) expect(m.to).toBeGreaterThanOrEqual(m.from);
  });

  it('merges splits that head for the same place', () => {
    const moves = planGapMoves(
      { centres: [0, 100, 120], width: 5 },
      { centres: [0, 130], width: 5 },
    );
    expect(moves.map((m) => m.to)).toEqual([0, 130, 130]);
  });

  it("starts extra splits at 12 o'clock and opens them up on the way", () => {
    const moves = planGapMoves(
      { centres: [0, 300], width: 5 },
      { centres: [0, 90, 310], width: 5 },
    );
    expect(moves).toContainEqual({ from: 0, to: 90, fromWidth: 0, toWidth: 5 });
  });

  it("carries splits past the last new one round to 12 o'clock", () => {
    const moves = planGapMoves({ centres: [0, 300], width: 5 }, { centres: [0, 100], width: 5 });
    expect(moves).toContainEqual({ from: 300, to: 360, fromWidth: 5, toWidth: 5 });
    // With no split at 12 to join, it closes up as it arrives.
    const alone = planGapMoves({ centres: [0, 300], width: 5 }, { centres: [], width: 0 });
    expect(alone).toContainEqual({ from: 300, to: 360, fromWidth: 5, toWidth: 0 });
  });
});

describe('gapsAt', () => {
  it('places each split part way along its move', () => {
    const moves = [
      { from: 100, to: 200, fromWidth: 4, toWidth: 4 },
      { from: 0, to: 90, fromWidth: 0, toWidth: 6 },
    ];
    expect(gapsAt(moves, 0)).toEqual([{ start: 98, sweep: 4 }]);
    expect(gapsAt(moves, 0.5)).toEqual([
      { start: 148, sweep: 4 },
      { start: 43.5, sweep: 3 },
    ]);
  });
});

describe('buildPaceChart', () => {
  const insets = { top: 10, bottom: 20, left: 0, right: 0 };
  const chart = buildPaceChart([100, 300, 300], [0, 200, 400, 600], 30, 290, 200, insets);

  it('lines days up by date on a shared x scale, stopping this month at today', () => {
    expect(chart.xs).toEqual([0, 10, 20]);
    expect(chart.refXs).toEqual([0, 10, 20, 30]);
  });

  it('shares one y scale from $0 at the bottom', () => {
    expect(chart.zeroY).toBe(180);
    // Both months use the same scale: $300 sits half again as high as $200.
    expect(chart.ys[1]).toBeCloseTo(chart.refYs[1]! - (chart.zeroY - chart.refYs[1]!) / 2);
    expect(chart.refYs[3]).toBeGreaterThanOrEqual(insets.top);
    expect(chart.reference.startsWith('M')).toBe(true);
  });

  it('draws nothing before it has a size', () => {
    expect(buildPaceChart([1], [1], 30, 0, 200, insets).xs).toEqual([]);
  });
});

describe('buildBarChart', () => {
  const insets = { top: 10, bottom: 10, left: 0, right: 0 };

  it('gives each value an equal slot and grows bars from zero', () => {
    const chart = buildBarChart([0.2, 0.4], 200, 120, insets, null, 0.5);
    expect(chart.bars.map((b) => b.cx)).toEqual([50, 150]);
    expect((chart.bars[0]?.x1 ?? 0) - (chart.bars[0]?.x0 ?? 0)).toBeCloseTo(50);
    expect(chart.zeroY).toBeCloseTo(110);
    expect(chart.bars[1]?.y).toBeLessThan(chart.bars[0]?.y ?? 0);
    expect(chart.bars[1]?.y).toBeGreaterThanOrEqual(10);
  });

  it('makes room below zero for negative values and keeps the reference on the chart', () => {
    const chart = buildBarChart([-0.1, 0.3, null], 300, 120, insets, 0.5);
    expect(chart.zeroY).toBeLessThan(110);
    expect(chart.bars[0]?.y).toBeGreaterThan(chart.zeroY);
    expect(chart.bars[2]?.y).toBeCloseTo(chart.zeroY);
    expect(chart.referenceY).toBeGreaterThanOrEqual(10);
    expect(chart.referenceY).toBeLessThan(chart.bars[1]?.y ?? 0);
  });

  it('finds the slot under a touch, clamped to the chart', () => {
    const { bars } = buildBarChart([1, 2, 3], 300, 100, insets);
    expect(barAt(bars, 10)).toBe(0);
    expect(barAt(bars, 150)).toBe(1);
    expect(barAt(bars, 299)).toBe(2);
    expect(barAt(bars, -40)).toBe(0);
    expect(barAt(bars, 900)).toBe(2);
    expect(barAt([], 10)).toBe(-1);
  });
});
