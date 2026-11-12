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
