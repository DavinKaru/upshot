import { barLayers, drained, drainLayers, DRAIN_SPAN, sloshX, sloshY } from '../drain';

describe('drainLayers', () => {
  // A column from 100% at y = 20 down to what was kept at y = 120, with zero at y = 180.
  const layers = drainLayers(10, 50, 20, 120, 180);
  const all = layers.flatMap((l) =>
    l.xs.map((x, i) => ({ x, y: l.ys[i] ?? 0, start: l.starts[i] ?? 0, dy: l.dys[i] ?? 0 })),
  );

  it('fills the spent part of the column, between the top and what was kept', () => {
    expect(all.length).toBeGreaterThan(30);
    for (const p of all) {
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(120);
    }
  });

  it('lets particles near the top go first, and all of them float upwards', () => {
    const top = all.filter((p) => p.y < 40);
    const low = all.filter((p) => p.y > 100);
    const mean = (ps: typeof all) => ps.reduce((s, p) => s + p.start, 0) / ps.length;
    expect(mean(top)).toBeLessThan(mean(low));
    for (const p of all) {
      expect(p.start).toBeGreaterThanOrEqual(0);
      expect(p.start + DRAIN_SPAN).toBeLessThanOrEqual(1 + 1e-9);
      expect(p.dy).toBeLessThan(0);
    }
  });

  it('gives the same layout every time', () => {
    expect(drainLayers(10, 50, 20, 120, 180)).toEqual(layers);
  });
});

describe('drained', () => {
  it('stays put before its start, eases out, and is gone by the end of its span', () => {
    expect(drained(0.1, 0.2)).toBe(0);
    const early = drained(0.2 + DRAIN_SPAN * 0.25, 0.2);
    const late = drained(0.2 + DRAIN_SPAN * 0.75, 0.2);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early * 2);
    expect(drained(0.2 + DRAIN_SPAN, 0.2)).toBe(1);
    expect(drained(1, 0.5)).toBe(1);
  });
});

describe('slosh', () => {
  it('leaves particles alone when the phone is level', () => {
    expect(sloshX(30, 1, 0, 10, 50)).toBe(30);
    expect(sloshY(60, 45, 1, 0, 30, 180)).toBe(60);
  });

  it('drifts loose particles towards the low side, but never out of the bar', () => {
    expect(sloshX(30, 1, 0.5, 10, 50)).toBeGreaterThan(30);
    expect(sloshX(30, 1, -0.5, 10, 50)).toBeLessThan(30);
    expect(sloshX(49, 1, 1, 10, 50)).toBe(50);
    expect(sloshX(11, 1, -1, 10, 50)).toBe(10);
  });

  it('raises the surface on the low side and lowers it on the high side', () => {
    // Right side down: the right of the bar rises (smaller y), the left falls.
    expect(sloshY(60, 45, 1, 0.5, 30, 180)).toBeLessThan(60);
    expect(sloshY(60, 15, 1, 0.5, 30, 180)).toBeGreaterThan(60);
    // Particles deep in the bar barely move.
    expect(sloshY(170, 45, 0, 0.5, 30, 180)).toBe(170);
  });

  it('never lets a particle cross zero', () => {
    expect(sloshY(175, 10, 1, 1, 30, 180)).toBeLessThanOrEqual(180);
    expect(sloshY(185, 50, 1, 1, 30, 180)).toBeGreaterThanOrEqual(180);
  });
});

describe('barLayers', () => {
  it('weights particles by how near the end of the bar they are', () => {
    const layers = barLayers(10, 50, 40, 140);
    for (const layer of layers) {
      layer.ys.forEach((y, i) => {
        const w = layer.weights[i] ?? 0;
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
        expect(w).toBeCloseTo(1 - (y - 40) / 100, 5);
      });
    }
  });
});
