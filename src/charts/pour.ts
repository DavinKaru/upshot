import { bucketByAlpha, DEFAULT_BAND, particlesInBar, type BandOptions } from './particles';

/**
 * Motion for the savings bars, kept free of React and Skia so it can be unit tested.
 *
 *  - **Pouring**: each month's beads fall in from the top of what came in and pile up from the
 *    bottom, the beaded surface landing last at what was kept. Nothing shows where the pile
 *    will stop until it gets there.
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

/** The share of the pour each particle spends falling; the rest staggers them, bottom first. */
export const FALL_SHARE = 0.4;
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
 * How far a particle is through its fall at `t` (0–1) of the pour: below 0 before it has started,
 * then 0 to 1, and 1 once it has landed. `depth` is how far up the pile it rests, 0 on the floor
 * and 1 at the surface, so the floor fills first and the surface lands last.
 */
export function fallProgress(depth: number, t: number): number {
  'worklet';
  const start = depth * (1 - FALL_SHARE);
  if (t < start) return -1;
  return Math.min((t - start) / FALL_SHARE, 1);
}

/** Where a falling particle is, `fall` (0–1) of the way from `fromY` to `restY`, speeding up as it goes. */
export function fallenY(fromY: number, restY: number, fall: number): number {
  'worklet';
  return fromY + (restY - fromY) * fall * fall;
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
