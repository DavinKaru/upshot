import { bucketByAlpha, DEFAULT_BAND, particlesInBar, type BandOptions } from './particles';

/**
 * Motion for the savings-rate bars, kept free of React and Skia so it can be unit tested.
 *
 *  - **Draining**: each month starts as one full column of everything that came in. The whole
 *    column sinks, its beaded surface dropping like a level, until it rests at what was kept.
 *    Particles that reach zero sink into it and disappear, so where the level will stop isn't
 *    given away until it gets there.
 *  - **Sloshing**: tilt the phone and the particles in each bar lean the way of gravity, like
 *    liquid in a glass: the surface rises on the low side and loose particles drift across.
 */

/** One opacity level of a bar's particles, as plain arrays that copy cheaply to the UI thread. */
export interface BarLayer {
  xs: number[];
  ys: number[];
  rs: number[];
  /** 1 at the bar's end, falling to 0 at zero. The surface moves most as it sloshes. */
  weights: number[];
  /** How freely a particle drifts sideways: beads on the edge barely, the scatter more. */
  loose: number[];
}

/** How far above zero, in points, a sinking particle starts to shrink into the line. */
export const SINK_FADE = 6;
/** How steeply the surface tilts per g of sideways gravity. */
export const SLOSH_SLOPE = 0.9;
/** How far, in points, the loosest particles drift per g of sideways gravity. */
export const SLOSH_SHIFT = 10;

const toLayer = (
  particles: { x: number; y: number; r: number; alpha: number }[],
  edgeY: number,
  zeroY: number,
): BarLayer => {
  const length = Math.abs(zeroY - edgeY) || 1;
  return {
    xs: particles.map((p) => p.x),
    ys: particles.map((p) => p.y),
    rs: particles.map((p) => p.r),
    weights: particles.map((p) => Math.max(0, 1 - Math.abs(p.y - edgeY) / length)),
    loose: particles.map((p) => 0.25 + (1 - p.alpha)),
  };
};

/** A bar from zero to `edgeY`, split into opacity layers ready for sloshing. */
export function barLayers(
  x0: number,
  x1: number,
  edgeY: number,
  zeroY: number,
  band: BandOptions = DEFAULT_BAND,
): BarLayer[] {
  return bucketByAlpha(particlesInBar(x0, x1, edgeY, zeroY, band)).map((bucket) =>
    toLayer(bucket, edgeY, zeroY),
  );
}

/**
 * A particle's radius as its column sinks: full size above zero, shrinking over the last
 * `SINK_FADE` points, and gone once it reaches zero at `zeroY`.
 */
export function sunkRadius(y: number, r: number, zeroY: number): number {
  'worklet';
  const above = zeroY - y;
  if (above <= 0) return 0;
  return above >= SINK_FADE ? r : (r * above) / SINK_FADE;
}

/** A particle's x once sloshed by `tilt` (sideways gravity in g, right side down positive). */
export function sloshX(x: number, loose: number, tilt: number, x0: number, x1: number): number {
  'worklet';
  const moved = x + tilt * SLOSH_SHIFT * loose;
  return moved < x0 ? x0 : moved > x1 ? x1 : moved;
}

/**
 * A particle's y once sloshed: the surface rises on the low side and dips on the high side,
 * pivoting on the bar's centre `cx`. Nothing crosses zero.
 */
export function sloshY(
  y: number,
  x: number,
  weight: number,
  tilt: number,
  cx: number,
  zeroY: number,
): number {
  'worklet';
  const moved = y - tilt * (x - cx) * SLOSH_SLOPE * weight;
  // A bar above zero hangs down to it; one below zero rises up to it.
  return y <= zeroY ? Math.min(moved, zeroY) : Math.max(moved, zeroY);
}
