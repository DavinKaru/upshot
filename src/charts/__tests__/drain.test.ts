import { barLayers, SINK_FADE, sloshX, sloshY, sunkRadius } from '../drain';

describe('sunkRadius', () => {
  it('keeps particles full size until they near zero', () => {
    expect(sunkRadius(100, 2, 180)).toBe(2);
    expect(sunkRadius(180 - SINK_FADE, 2, 180)).toBe(2);
  });

  it('shrinks them into the zero line, and hides them once they reach it', () => {
    expect(sunkRadius(180 - SINK_FADE / 2, 2, 180)).toBeCloseTo(1, 5);
    expect(sunkRadius(180, 2, 180)).toBe(0);
    expect(sunkRadius(200, 2, 180)).toBe(0);
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
