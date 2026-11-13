import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';

/** Chart maths kept free of React and Skia, so it can be unit tested. */

export interface LineChartGeometry {
  /** SVG path for the line. */
  line: string;
  /** SVG path for the filled area under the line. */
  area: string;
  /** Screen x of each point. */
  xs: number[];
  /** Screen y of each point. */
  ys: number[];
}

export interface ChartInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Lays out a series of values as a smooth line chart filling `width` × `height`.
 * The y range is padded so the line never touches the top or bottom edge.
 */
export function buildLineChart(
  values: readonly number[],
  width: number,
  height: number,
  insets: ChartInsets = { top: 12, bottom: 12, left: 0, right: 0 },
): LineChartGeometry {
  if (values.length === 0 || width <= 0 || height <= 0) {
    return { line: '', area: '', xs: [], ys: [] };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padding = (max - min) * 0.08;

  const x = scaleLinear()
    .domain([0, Math.max(values.length - 1, 1)])
    .range([insets.left, width - insets.right]);
  const y = scaleLinear()
    .domain([min - padding, max + padding])
    .range([height - insets.bottom, insets.top]);

  const xs = values.map((_, i) => x(i));
  const ys = values.map((v) => y(v));
  const points = values.map((_, i) => [xs[i] ?? 0, ys[i] ?? 0] as [number, number]);

  return {
    line: line().curve(curveMonotoneX)(points) ?? '',
    area:
      area()
        .curve(curveMonotoneX)
        .y0(height)
        .y1((p) => p[1])(points) ?? '',
    xs,
    ys,
  };
}

/** The index of the point whose x is closest to `x`. `xs` must be sorted. */
export function nearestIndex(xs: readonly number[], x: number): number {
  'worklet';
  if (xs.length === 0) return -1;
  let low = 0;
  let high = xs.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if ((xs[mid] ?? 0) < x) low = mid;
    else high = mid;
  }
  return Math.abs((xs[low] ?? 0) - x) <= Math.abs((xs[high] ?? 0) - x) ? low : high;
}

export interface Segment {
  /** Start angle in degrees, clockwise from 12 o'clock. */
  start: number;
  /** Length of the arc in degrees, after the gap is taken out. */
  sweep: number;
}

/**
 * Splits a ring into segments proportional to `values`, with a small gap between each.
 * Values of zero or less get no segment (sweep 0).
 */
export function donutSegments(values: readonly number[], gapDegrees = 3): Segment[] {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
  const visible = values.filter((v) => v > 0).length;
  if (total === 0) return values.map(() => ({ start: 0, sweep: 0 }));

  const gap = visible > 1 ? gapDegrees : 0;
  const available = 360 - gap * visible;
  let cursor = 0;
  return values.map((v) => {
    if (v <= 0) return { start: cursor, sweep: 0 };
    const sweep = (v / total) * available;
    const segment = { start: cursor + gap / 2, sweep };
    cursor += sweep + gap;
    return segment;
  });
}

/**
 * Which segment a touch at (`x`, `y`) lands on, for a ring centred at (`cx`, `cy`).
 * Returns -1 for touches in the middle hole or outside the ring.
 */
export function segmentAt(
  segments: readonly Segment[],
  x: number,
  y: number,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
): number {
  'worklet';
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < innerRadius || distance > outerRadius) return -1;
  // Angle clockwise from 12 o'clock, in degrees.
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s && s.sweep > 0 && angle >= s.start - 2 && angle <= s.start + s.sweep + 2) return i;
  }
  return -1;
}

/**
 * One segment part way through filling the ring. Its start stays put and its far (clockwise) end
 * sweeps on round the ring: at `t` = 0 it's the segment as it is, at 1 it covers all 360°.
 */
export function wipeSegment(segment: Segment, t: number): Segment {
  'worklet';
  const progress = Math.min(Math.max(t, 0), 1);
  return { start: segment.start, sweep: segment.sweep + (360 - segment.sweep) * progress };
}

/** Whether an angle (degrees clockwise from 12 o'clock) falls inside `segment`, wrapping at 360. */
export function inSegment(angle: number, start: number, sweep: number): boolean {
  'worklet';
  if (sweep <= 0) return false;
  if (sweep >= 360) return true;
  const offset = (((angle - start) % 360) + 360) % 360;
  return offset < sweep;
}

/** A split between two segments moving round the ring, in degrees clockwise from 12 o'clock. */
export interface GapMove {
  from: number;
  to: number;
  fromWidth: number;
  toWidth: number;
}

/** The splits between a ring's visible segments: their centres, clockwise from 12, and width. */
export function ringGaps(segments: readonly Segment[]): { centres: number[]; width: number } {
  const visible = segments.filter((s) => s.sweep > 0);
  if (visible.length < 2) return { centres: [], width: 0 };
  const width = (360 - visible.reduce((sum, s) => sum + s.sweep, 0)) / visible.length;
  const centres = visible
    .map((s) => (((s.start - width / 2) % 360) + 360) % 360)
    .map((c) => (c > 359.99 ? 0 : c))
    .sort((a, b) => a - b);
  return { centres, width };
}

/**
 * How one ring's splits move to become another's. Every split moves clockwise to the nearest new
 * split at or after it, so several can arrive together and merge. New splits nobody reaches start
 * at 12 o'clock and open up as they travel. A split with nowhere to go closes as it reaches 12.
 */
export function planGapMoves(
  from: { centres: readonly number[]; width: number },
  to: { centres: readonly number[]; width: number },
): GapMove[] {
  const reached = new Set<number>();
  const moves: GapMove[] = from.centres.map((centre) => {
    const next = to.centres.findIndex((c) => c >= centre - 0.01);
    if (next >= 0) {
      reached.add(next);
      return { from: centre, to: to.centres[next] ?? 0, fromWidth: from.width, toWidth: to.width };
    }
    // Past the last new split: carry on round to 12 o'clock, where the ring may already split.
    const top = to.centres.findIndex((c) => c < 0.01);
    if (top >= 0) reached.add(top);
    return {
      from: centre,
      to: 360,
      fromWidth: from.width,
      toWidth: top >= 0 ? to.width : 0,
    };
  });
  to.centres.forEach((centre, i) => {
    if (!reached.has(i)) moves.push({ from: 0, to: centre, fromWidth: 0, toWidth: to.width });
  });
  return moves;
}

/** Where each split is at `t` (0–1) of its move, as a thin segment centred on it. */
export function gapsAt(moves: readonly GapMove[], t: number): Segment[] {
  'worklet';
  const result: Segment[] = [];
  for (const m of moves) {
    const centre = m.from + (m.to - m.from) * t;
    const width = m.fromWidth + (m.toWidth - m.fromWidth) * t;
    if (width > 0) result.push({ start: centre - width / 2, sweep: width });
  }
  return result;
}
