import {
  ALPHA_LEVELS,
  bucketByAlpha,
  DEFAULT_BAND,
  particlesInBar,
  particlesInRing,
  particlesUnderLine,
  pushFromTouch,
  ringLayers,
  TOUCH_PUSH,
  TOUCH_RADIUS,
} from '../particles';

const xs = [0, 100, 200, 300];
const ys = [100, 60, 60, 20];
const height = 300;

describe('particlesUnderLine', () => {
  const particles = particlesUnderLine(xs, ys, height);

  it('gives the same layout every time for the same seed', () => {
    expect(particlesUnderLine(xs, ys, height)).toEqual(particles);
  });

  it('keeps every particle under the line and inside the chart', () => {
    const lineAt = (x: number) => {
      if (x <= 100) return 100 - 0.4 * x;
      if (x <= 200) return 60;
      return 60 - 0.4 * (x - 200);
    };
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(300);
      // Allow for the small sideways jitter on slopes.
      expect(p.y).toBeGreaterThanOrEqual(lineAt(p.x) - 1);
      expect(p.y).toBeLessThanOrEqual(height + 1);
    }
  });

  it('traces the line tightly and thins out further down', () => {
    // On the flat stretch the line sits at y = 60.
    const flat = particles.filter((p) => p.x > 120 && p.x < 180);
    const onLine = flat.filter((p) => p.y < 60 + 5).length;
    const middle = flat.filter((p) => p.y > 60 + 40 && p.y < 60 + 45).length;
    expect(onLine).toBeGreaterThan(20);
    expect(onLine).toBeGreaterThan(middle * 4);
  });

  it('spreads the scatter further apart the deeper it goes', () => {
    const flat = particles.filter((p) => p.x > 100 && p.x < 200);
    const band = (from: number) => flat.filter((p) => p.y >= 60 + from && p.y < 60 + from + 20);
    expect(band(5).length).toBeGreaterThan(band(45).length);
    expect(band(45).length).toBeGreaterThanOrEqual(band(85).length);
  });

  it('never drops a particle further than the band allows', () => {
    for (const p of particles) {
      const lineY = p.x <= 100 ? 100 - 0.4 * p.x : p.x <= 200 ? 60 : 60 - 0.4 * (p.x - 200);
      expect(p.y - lineY).toBeLessThan(DEFAULT_BAND.maxDepth + 2);
    }
  });

  it('gathers big particles into small clusters along the line', () => {
    const wide = particlesUnderLine([0, 1000], [60, 60], 300);
    const big = wide.filter((p) => p.r >= 2.6).map((p) => p.x);
    expect(big.length).toBeGreaterThan(5);
    // Most big particles have another big one close by.
    const grouped = big.filter((x) => big.some((other) => other !== x && Math.abs(other - x) < 25));
    expect(grouped.length).toBeGreaterThan(big.length / 2);
  });

  it('draws nothing without at least two points', () => {
    expect(particlesUnderLine([10], [10], height)).toEqual([]);
  });
});

describe('particlesInRing', () => {
  it('returns one list per segment, inside the ring, and none for empty segments', () => {
    const rings = particlesInRing(
      [
        { start: 0, sweep: 180 },
        { start: 180, sweep: 0 },
      ],
      100,
      100,
      90,
      { ...DEFAULT_BAND, spread: 8, maxDepth: 30 },
    );
    expect(rings).toHaveLength(2);
    expect(rings[0]?.length).toBeGreaterThan(50);
    expect(rings[1]).toEqual([]);
    for (const p of rings[0] ?? []) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThanOrEqual(90.5);
      // The first segment is the right-hand half of the ring.
      expect(p.x).toBeGreaterThanOrEqual(97);
    }
  });
});

describe('bucketByAlpha', () => {
  it('puts each particle in the nearest opacity level', () => {
    const buckets = bucketByAlpha([
      { x: 0, y: 0, r: 1, alpha: 0.31 },
      { x: 0, y: 0, r: 1, alpha: 0.95 },
      { x: 0, y: 0, r: 1, alpha: 0.6 },
    ]);
    expect(buckets).toHaveLength(ALPHA_LEVELS.length);
    expect(buckets.map((b) => b.length)).toEqual([1, 1, 0, 1]);
  });
});

describe('pushFromTouch', () => {
  it('pushes particles directly away from the finger', () => {
    const right = pushFromTouch(110, 100, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH);
    expect(right.dx).toBeGreaterThan(0);
    expect(right.dy).toBeCloseTo(0);
    const above = pushFromTouch(100, 90, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH);
    expect(above.dy).toBeLessThan(0);
  });

  it('pushes closer particles further, and leaves distant ones alone', () => {
    const near = pushFromTouch(105, 100, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH).dx;
    const far = pushFromTouch(150, 100, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH).dx;
    expect(near).toBeGreaterThan(far);
    expect(
      pushFromTouch(100 + TOUCH_RADIUS + 1, 100, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH),
    ).toEqual({ dx: 0, dy: 0 });
  });

  it('scales with strength and does nothing without a touch', () => {
    const full = pushFromTouch(110, 100, 100, 100, 1, TOUCH_RADIUS, TOUCH_PUSH).dx;
    expect(pushFromTouch(110, 100, 100, 100, 0.5, TOUCH_RADIUS, TOUCH_PUSH).dx).toBeCloseTo(
      full / 2,
    );
    expect(pushFromTouch(110, 100, 100, 100, 0, TOUCH_RADIUS, TOUCH_PUSH)).toEqual({
      dx: 0,
      dy: 0,
    });
  });
});

describe('ringLayers', () => {
  it('gives every particle an angle that matches where it sits', () => {
    const layers = ringLayers(100, 100, 90, { ...DEFAULT_BAND, spread: 8, maxDepth: 30, seed: 3 });
    expect(layers).toHaveLength(ALPHA_LEVELS.length);
    const all = layers.flatMap((l) => l.angles.map((a, i) => ({ a, x: l.xs[i]!, y: l.ys[i]! })));
    expect(all.length).toBeGreaterThan(100);
    for (const { a, x, y } of all) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
      const rad = ((a - 90) * Math.PI) / 180;
      const r = Math.hypot(x - 100, y - 100);
      expect(100 + Math.cos(rad) * r).toBeCloseTo(x, 3);
      expect(100 + Math.sin(rad) * r).toBeCloseTo(y, 3);
    }
  });
});

describe('particlesInBar', () => {
  it('fills a bar above zero from its top, densest at the top', () => {
    const particles = particlesInBar(20, 60, 40, 140);
    expect(particles.length).toBeGreaterThan(20);
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(60);
      expect(p.y).toBeGreaterThanOrEqual(40);
      expect(p.y).toBeLessThanOrEqual(140);
    }
    const top = particles.filter((p) => p.y < 65).length;
    const bottom = particles.filter((p) => p.y > 115).length;
    expect(top).toBeGreaterThan(bottom * 2);
  });

  it('fills a bar below zero from its bottom', () => {
    const particles = particlesInBar(20, 60, 140, 100);
    expect(particles.length).toBeGreaterThan(5);
    for (const p of particles) {
      expect(p.y).toBeGreaterThanOrEqual(100);
      expect(p.y).toBeLessThanOrEqual(140);
    }
  });

  it('draws nothing for a bar with no length', () => {
    expect(particlesInBar(20, 60, 100, 100)).toEqual([]);
  });
});
