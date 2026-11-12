import {
  ALPHA_LEVELS,
  bucketByAlpha,
  DEFAULT_BAND,
  particlesInRing,
  particlesUnderLine,
  pushFromTouch,
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

  it('packs particles densely near the line and sparsely further down', () => {
    const { capWidth, falloffWidth } = DEFAULT_BAND;
    const near = particles.filter((p) => p.x > 120 && p.x < 180 && p.y < 60 + capWidth).length;
    const far = particles.filter(
      (p) =>
        p.x > 120 &&
        p.x < 180 &&
        p.y > 60 + capWidth + falloffWidth * 0.6 &&
        p.y < 60 + capWidth + falloffWidth * 0.6 + capWidth,
    ).length;
    expect(near).toBeGreaterThan(far * 3);
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
      { ...DEFAULT_BAND, capWidth: 12, falloffWidth: 30 },
    );
    expect(rings).toHaveLength(2);
    expect(rings[0]?.length).toBeGreaterThan(50);
    expect(rings[1]).toEqual([]);
    for (const p of rings[0] ?? []) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThanOrEqual(90.5);
      // The first segment is the right-hand half of the ring.
      expect(p.x).toBeGreaterThanOrEqual(98);
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
