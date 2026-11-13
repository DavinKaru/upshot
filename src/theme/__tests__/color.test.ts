import {
  contrast,
  GRAPHIC_CONTRAST,
  luminance,
  mix,
  shades,
  tinted,
  TINT_STRENGTH,
} from '../color';
import { colors } from '../tokens';

describe('luminance and contrast', () => {
  it('match the WCAG reference values', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('shades', () => {
  const backgrounds = [colors.base, colors.sheet];

  it.each(Object.entries(colors.category))(
    'keeps every %s shade at WCAG graphic contrast, evenly spaced',
    (_, hex) => {
      for (const count of [2, 3, 4, 5, 6]) {
        const list = shades(hex, count, tinted(colors.sheet, hex));
        expect(list).toHaveLength(count);
        for (const shade of list) {
          for (const background of backgrounds) {
            expect(contrast(shade, tinted(background, hex))).toBeGreaterThanOrEqual(3);
          }
        }
        // Neighbours are clearly apart, and light runs to dark.
        for (let i = 1; i < list.length; i++) {
          expect(luminance(list[i - 1]!)).toBeGreaterThan(luminance(list[i]!));
          expect(contrast(list[i - 1]!, list[i]!)).toBeGreaterThan(1.2);
        }
      }
    },
  );

  it('returns the colour itself for a single part, and nothing for none', () => {
    expect(shades('#6EC5FF', 1, colors.base)).toEqual(['#6EC5FF']);
    expect(shades('#6EC5FF', 0, colors.base)).toEqual([]);
  });

  it('aims a little above the WCAG minimum', () => {
    expect(GRAPHIC_CONTRAST).toBeGreaterThan(3);
  });
});

describe('tinted', () => {
  it('washes a little of the colour over the background', () => {
    const blue = tinted(colors.base, '#6EC5FF');
    expect(blue).not.toBe(colors.base);
    expect(contrast(blue, colors.base)).toBeLessThan(1.1);
    expect(blue).toBe(mix(colors.base, '#6EC5FF', TINT_STRENGTH));
  });
});
