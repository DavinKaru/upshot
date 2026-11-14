import { barLayers, fallenY, fallProgress, FALL_SHARE, sloshX, sloshY } from '../pour';

describe('fallProgress', () => {
  it('fills the floor first and lands the surface last', () => {
    expect(fallProgress(0, 0)).toBe(0);
    expect(fallProgress(1, 0)).toBeLessThan(0);
    expect(fallProgress(1, 1 - FALL_SHARE)).toBe(0);
    expect(fallProgress(0, 0.2)).toBeGreaterThan(fallProgress(0.5, 0.2));
  });

  it('has every particle landed by the end', () => {
    for (const depth of [0, 0.3, 0.7, 1]) expect(fallProgress(depth, 1)).toBe(1);
  });
});

describe('fallenY', () => {
  it('starts at the top, ends at rest, and speeds up as it falls', () => {
    expect(fallenY(20, 120, 0)).toBe(20);
    expect(fallenY(20, 120, 1)).toBe(120);
    // Less than halfway down at half the time, like something dropped.
    expect(fallenY(20, 120, 0.5)).toBeLessThan(70);
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
