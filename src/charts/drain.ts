import { createRandom } from '@/lib/random';

import { bucketByAlpha, DEFAULT_BAND, particlesInBar, type BandOptions } from './particles';

/**
 * Motion for the savings-rate bars, kept free of React and Skia so it can be unit tested.
 *
 *  - **Draining**: each month starts as a full column of everything that came in. The part that
 *    was spent leaves as particles floating up and away, top first, so the level drops to what
 *    was kept.
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

/** A layer of the spent part of a column, which drains away. */
export interface DrainLayer extends BarLayer {
  /** When, from 0 to 1 through the drain, each particle starts to leave. */
  starts: number[];
  /** How far each particle floats while leaving. */
  dxs: number[];
  dys: number[];
}

/** How much of the drain each particle takes to leave once it starts. */
export const DRAIN_SPAN = 0.42;
/** The last particle starts leaving at this point, so the drain ends cleanly at 1. */
const LAST_START = 1 - DRAIN_SPAN;
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
 * The spent part of a column, from `topY` (everything that came in) down to `floorY` (what was
 * kept, or zero if nothing was), ready to drain. Particles nearer the top leave first.
 */
export function drainLayers(
  x0: number,
  x1: number,
  topY: number,
  floorY: number,
  zeroY: number,
  band: BandOptions = DEFAULT_BAND,
): DrainLayer[] {
  const random = createRandom((band.seed ?? 7) * 31 + 5);
  const length = Math.abs(floorY - topY) || 1;
  return bucketByAlpha(particlesInBar(x0, x1, topY, floorY, band)).map((bucket) => {
    const layer = toLayer(bucket, topY, zeroY);
    const starts = bucket.map((p) => {
      const fromTop = Math.min(Math.abs(p.y - topY) / length, 1);
      return Math.min(
        fromTop * LAST_START * 0.85 + random.between(0, LAST_START * 0.15),
        LAST_START,
      );
    });
    return {
      ...layer,
      starts,
      dxs: bucket.map(() => random.between(-14, 14)),
      dys: bucket.map(() => -random.between(16, 44)),
    };
  });
}

/** How far a particle has gone, from 0 (in place) to 1 (gone), at point `t` of the drain. */
export function drained(t: number, start: number): number {
  'worklet';
  const local = (t - start) / DRAIN_SPAN;
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  // Ease in, so particles lift off gently and then float away.
  return local * local;
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
