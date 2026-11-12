import { createRandom, type Random } from '@/lib/random';

/**
 * Particle layouts for Upshot's charts, in the style of Up's Saver Insights.
 *
 * A chart is an invisible line (or ring) with particles packed underneath it in two bands:
 *
 *  - the **cap**: a dense band hugging the line, so its shape reads clearly;
 *  - the **falloff**: below the cap, particles thin out and shrink until they fade away.
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
  /** Depth of the dense band under the line, in points. */
  capWidth: number;
  /** Depth of the thinning band below the cap, in points. */
  falloffWidth: number;
  /** Average distance between neighbouring particles in the cap, in points. */
  spacing: number;
  seed?: number;
}

export const DEFAULT_BAND: BandOptions = { capWidth: 24, falloffWidth: 150, spacing: 3.3, seed: 7 };

interface Sample {
  /** Distance under the line. */
  depth: number;
  r: number;
  alpha: number;
}

/** One column of particles at a single point along the line, from the edge downwards. */
function sampleColumn(random: Random, maxDepth: number, band: BandOptions): Sample[] {
  const samples: Sample[] = [];
  const { capWidth, falloffWidth, spacing } = band;
  const limit = Math.min(maxDepth, capWidth + falloffWidth);

  // The edge: a tight row of fuller particles that traces the line itself.
  const edgeR = random.between(1.1, 1.8);
  samples.push({ depth: edgeR, r: edgeR, alpha: 1 });

  for (
    let depth = edgeR * 2 + spacing * 0.5;
    depth < limit;
    depth += spacing * random.between(0.7, 1.3)
  ) {
    if (depth < capWidth) {
      // The cap: dense, with the odd bright, bigger particle.
      if (random.chance(0.035)) {
        samples.push({ depth, r: random.between(2.2, 3.4), alpha: 1 });
      } else if (random.chance(0.92)) {
        samples.push({ depth, r: random.between(0.7, 1.7), alpha: random.between(0.75, 1) });
      }
    } else {
      // The falloff: chance, size and brightness all ease away with depth.
      const t = (depth - capWidth) / falloffWidth;
      const ease = (1 - t) * (1 - t);
      if (random.chance(0.7 * ease + 0.04)) {
        const big = random.chance(0.02 * ease);
        samples.push({
          depth,
          r: big ? random.between(1.8, 2.8) : random.between(0.45, 0.45 + 1.1 * ease),
          alpha: 0.25 + 0.65 * ease,
        });
      }
    }
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

  for (let x = start; x <= end; x += band.spacing * 0.62) {
    const top = lineYAt(xs, ys, x);
    for (const s of sampleColumn(random, height - top, band)) {
      const px = Math.min(Math.max(x + random.between(-1.2, 1.2), start), end);
      particles.push({ x: px, y: top + s.depth, r: s.r, alpha: s.alpha });
    }
  }
  return particles;
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
  return segments.map((segment) => {
    const particles: Particle[] = [];
    if (segment.sweep <= 0) return particles;
    // Space columns evenly along the outer edge.
    const stepDegrees = ((band.spacing * 0.62) / outerRadius) * (180 / Math.PI);
    for (let a = segment.start; a <= segment.start + segment.sweep; a += stepDegrees) {
      for (const s of sampleColumn(random, outerRadius * 0.62, band)) {
        const angle = ((a + random.between(-stepDegrees, stepDegrees) * 0.4 - 90) * Math.PI) / 180;
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
