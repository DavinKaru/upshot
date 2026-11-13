import { createRandom, type Random } from '@/lib/random';

/**
 * Particle layouts for Upshot's charts, in the style of Up's Saver Insights.
 *
 * A chart is an invisible line (or ring) traced by a string of small particles, with a sparse
 * scatter underneath:
 *
 *  - the **line**: one small bead per column, so the shape reads clearly, with the odd bigger
 *    particle hugging it;
 *  - the **scatter**: a few particles per column that thin out quickly with depth, getting
 *    smaller, dimmer and further apart the further they fall.
 *
 * Layouts are deterministic for a given seed, so a chart doesn't shimmer between renders.
 * Plain maths only, no React or Skia, so it can be unit tested.
 */

export interface Particle {
  x: number;
  y: number;
  r: number;
  /** 0–1. Used to bucket particles into a few opacity levels for drawing. */
  alpha: number;
}

export interface BandOptions {
  /** Distance between columns along the line, in points. Each column puts a bead on the line. */
  spacing: number;
  /** How far below the line scattered particles fall on average, in points. */
  spread: number;
  /** No particle falls further below the line than this, in points. */
  maxDepth: number;
  /** Scattered particles per column, on average. */
  scatter: number;
  /** The chance, per column, of a cluster of big particles starting there. Defaults to 0.04. */
  clusterChance?: number;
  seed?: number;
}

export const DEFAULT_BAND: BandOptions = {
  spacing: 4.4,
  spread: 28,
  maxDepth: 140,
  scatter: 5,
  seed: 7,
};

interface Sample {
  /** Distance under the line. */
  depth: number;
  r: number;
  alpha: number;
}

/**
 * Decides, column by column, where the big particles gather. Every so often a short stretch of
 * the line becomes a cluster, so big beads turn up in little groups rather than evenly spaced.
 */
function clusterer(random: Random, chance = 0.04): () => boolean {
  let left = 0;
  return () => {
    if (left > 0) {
      left -= 1;
      return true;
    }
    if (random.chance(chance)) left = random.int(3, 8);
    return false;
  };
}

/**
 * One column of particles at a single point along the line, from the edge downwards.
 * `clustered` columns sit in a cluster of big particles.
 */
export function sampleColumn(
  random: Random,
  maxDepth: number,
  band: BandOptions,
  clustered = false,
): Sample[] {
  const samples: Sample[] = [];
  const limit = Math.min(maxDepth, band.maxDepth);

  // The line itself: a string of separate beads of varying size. Columns are spaced so that
  // neighbouring beads never touch, and the beads under them sit clear of them too.
  const edgeR = random.chance(0.15) ? random.between(1.6, 1.9) : random.between(1, 1.6);
  samples.push({ depth: edgeR, r: edgeR, alpha: 1 });
  let floor = edgeR * 2;
  for (const chance of [0.6, 0.3]) {
    if (!random.chance(chance)) break;
    const r = random.between(0.8, 1.4);
    const depth = floor + r + random.between(0.9, 3);
    samples.push({ depth, r, alpha: 1 });
    floor = depth + r;
  }

  // Big particles hugging the line: common inside a cluster, rare outside one.
  if (random.chance(clustered ? 0.5 : 0.025)) {
    const r = clustered ? random.between(2.6, 5) : random.between(2.2, 3.4);
    samples.push({ depth: r * 0.7 + random.between(0, 4), r, alpha: 1 });
  }

  // The scatter. Depth falls off exponentially, so particles are common just under the line and
  // get further apart as they fall. Deeper particles are also smaller and dimmer.
  const count = Math.floor(band.scatter + random.next());
  for (let i = 0; i < count; i++) {
    const depth = 3 - Math.log(1 - random.next() * 0.999) * band.spread;
    if (depth >= limit) continue;
    const ease = 1 - depth / limit;
    // Now and then a scattered particle is a big one too, more so under a cluster.
    const big = random.chance(clustered ? 0.18 : 0.04);
    samples.push({
      depth,
      r: big
        ? random.between(1.8, 1.8 + 1.6 * ease)
        : random.between(0.5, 0.8 + 1.9 * ease * Math.sqrt(ease)),
      alpha: 0.35 + 0.65 * ease,
    });
  }
  return samples;
}

/** Linear interpolation of the line's y at `x`. `xs` must be sorted. */
function lineYAt(xs: readonly number[], ys: readonly number[], x: number): number {
  if (xs.length === 0) return 0;
  if (x <= (xs[0] ?? 0)) return ys[0] ?? 0;
  for (let i = 1; i < xs.length; i++) {
    const x1 = xs[i] ?? 0;
    if (x <= x1) {
      const x0 = xs[i - 1] ?? 0;
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return (ys[i - 1] ?? 0) + ((ys[i] ?? 0) - (ys[i - 1] ?? 0)) * t;
    }
  }
  return ys[ys.length - 1] ?? 0;
}

/** How steep the line is at `x`, as the change in y per point across. */
function slopeAt(xs: readonly number[], ys: readonly number[], x: number): number {
  return (lineYAt(xs, ys, x + 1) - lineYAt(xs, ys, x - 1)) / 2;
}

/**
 * Packs particles under a line through (`xs`, `ys`), down to `height`.
 * Columns are evenly spaced across the line's width, with a little jitter so it looks organic.
 */
export function particlesUnderLine(
  xs: readonly number[],
  ys: readonly number[],
  height: number,
  band: BandOptions = DEFAULT_BAND,
): Particle[] {
  if (xs.length < 2) return [];
  const random = createRandom(band.seed ?? 7);
  const start = xs[0] ?? 0;
  const end = xs[xs.length - 1] ?? 0;
  const particles: Particle[] = [];
  const inCluster = clusterer(random, band.clusterChance);

  // Step along the line by its length, not just across, so steep stretches get as many beads.
  for (let x = start; x <= end; x += band.spacing / Math.sqrt(1 + slopeAt(xs, ys, x) ** 2)) {
    const top = lineYAt(xs, ys, x);
    for (const s of sampleColumn(random, height - top, band, inCluster())) {
      // Beads on the line stay put so they don't touch their neighbours; scattered particles
      // drift sideways a little, more the further they fall.
      const drift = s.depth < 6 ? 0.2 : Math.min(0.8 + s.depth * 0.08, 4);
      const px = Math.min(Math.max(x + random.between(-drift, drift), start), end);
      particles.push({ x: px, y: top + s.depth, r: s.r, alpha: s.alpha });
    }
  }
  return particles;
}

/**
 * Packs particles into a bar from `x0` to `x1`, beaded along its end at `edgeY` and thinning
 * towards zero at `zeroY`. Works both ways: a bar above zero hangs down from its top, and one
 * below zero rises up from its bottom. The scatter is scaled to the bar, so short and tall bars
 * both read as solid towards their end.
 */
export function particlesInBar(
  x0: number,
  x1: number,
  edgeY: number,
  zeroY: number,
  band: BandOptions = DEFAULT_BAND,
): Particle[] {
  const length = Math.abs(zeroY - edgeY);
  if (x1 <= x0 || length < 0.5) return [];
  const scaled: BandOptions = {
    ...band,
    spread: Math.max(6, length * 0.6),
    maxDepth: length,
  };
  const down = edgeY <= zeroY;
  // Beads hugging the end can sit deeper than a very short bar; leave those out so nothing
  // crosses zero.
  return particlesUnderLine([x0, x1], [0, 0], length, scaled)
    .filter((p) => p.y <= length)
    .map((p) => ({ ...p, y: down ? edgeY + p.y : edgeY - p.y }));
}

export interface RingSegment {
  /** Degrees clockwise from 12 o'clock. */
  start: number;
  sweep: number;
}

/**
 * Packs particles inwards from the outer edge of a ring, one segment at a time.
 * Returns one list per segment, so each can be drawn in its own colour.
 */
export function particlesInRing(
  segments: readonly RingSegment[],
  cx: number,
  cy: number,
  outerRadius: number,
  band: BandOptions,
): Particle[][] {
  const random = createRandom(band.seed ?? 11);
  const inCluster = clusterer(random, band.clusterChance);
  return segments.map((segment) => {
    const particles: Particle[] = [];
    if (segment.sweep <= 0) return particles;
    // Space columns evenly along the outer edge.
    const stepDegrees = (band.spacing / outerRadius) * (180 / Math.PI);
    for (let a = segment.start; a <= segment.start + segment.sweep; a += stepDegrees) {
      for (const s of sampleColumn(random, outerRadius * 0.62, band, inCluster())) {
        const jitter = s.depth < 6 ? 0 : stepDegrees * Math.min(0.4 + s.depth * 0.05, 1.5);
        const angle = ((a + random.between(-jitter, jitter) - 90) * Math.PI) / 180;
        const radius = outerRadius - s.depth;
        particles.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          r: s.r,
          alpha: s.alpha,
        });
      }
    }
    return particles;
  });
}

/** Particles in one opacity level of a ring, as flat arrays that copy cheaply to the UI thread. */
export interface RingLayer {
  xs: number[];
  ys: number[];
  rs: number[];
  /** Each particle's angle, in degrees clockwise from 12 o'clock. */
  angles: number[];
}

/**
 * A whole ring of particles, grouped by opacity level. Segments are drawn by picking the particles
 * whose angle falls inside them, so the particles never move: a segment growing or shrinking just
 * changes which colour each particle is drawn in.
 */
export function ringLayers(
  cx: number,
  cy: number,
  outerRadius: number,
  band: BandOptions,
): RingLayer[] {
  const [ring = []] = particlesInRing([{ start: 0, sweep: 360 }], cx, cy, outerRadius, band);
  return bucketByAlpha(ring).map((bucket) => ({
    xs: bucket.map((p) => p.x),
    ys: bucket.map((p) => p.y),
    rs: bucket.map((p) => p.r),
    angles: bucket.map(
      (p) => ((((Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90) % 360) + 360) % 360,
    ),
  }));
}

/** The opacity levels particles are drawn at. Fewer levels means fewer draw calls. */
export const ALPHA_LEVELS = [0.3, 0.55, 0.8, 1] as const;

/** Groups particles by the nearest opacity level, for drawing each group as one path. */
export function bucketByAlpha(particles: readonly Particle[]): Particle[][] {
  const buckets: Particle[][] = ALPHA_LEVELS.map(() => []);
  for (const p of particles) {
    let best = 0;
    for (let i = 1; i < ALPHA_LEVELS.length; i++) {
      if (
        Math.abs((ALPHA_LEVELS[i] ?? 1) - p.alpha) < Math.abs((ALPHA_LEVELS[best] ?? 1) - p.alpha)
      ) {
        best = i;
      }
    }
    buckets[best]?.push(p);
  }
  return buckets;
}

/** How far from the finger particles react, and how far the closest ones are pushed, in points. */
export const TOUCH_RADIUS = 70;
export const TOUCH_PUSH = 36;

/**
 * How far a particle at (`px`, `py`) is pushed away from a finger at (`tx`, `ty`). Everything
 * well inside `radius` is pushed almost the full distance, then the push drops off quickly near
 * the edge, so the finger clears a crisp hole rather than a soft dent. `strength` (0–1) fades the
 * whole effect in and out, and springs past 0 briefly as particles settle back.
 */
export function pushFromTouch(
  px: number,
  py: number,
  tx: number,
  ty: number,
  strength: number,
  // No defaults here: worklets don't capture module constants used only in default values.
  radius: number,
  push: number,
): { dx: number; dy: number } {
  'worklet';
  const ox = px - tx;
  const oy = py - ty;
  if (strength === 0 || Math.abs(ox) > radius || Math.abs(oy) > radius) return { dx: 0, dy: 0 };
  const distance = Math.sqrt(ox * ox + oy * oy);
  if (distance >= radius) return { dx: 0, dy: 0 };
  const t = distance / radius;
  const falloff = 1 - t * t;
  const amount = falloff * falloff * push * strength;
  // Particles right under the finger have no direction; nudge them upwards.
  if (distance < 0.001) return { dx: 0, dy: -amount };
  return { dx: (ox / distance) * amount, dy: (oy / distance) * amount };
}
