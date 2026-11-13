/** Blends `hex` towards `target` by `amount` (0 = unchanged, 1 = target). Both are "#RRGGBB". */
export function mix(hex: string, target: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(target);
  return `#${a
    .map((channel, i) => Math.round(channel + ((b[i] ?? channel) - channel) * amount))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG relative luminance of a "#RRGGBB" colour, from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG 2.2 (SC 1.4.11) asks for 3:1 between a graphic and what's around it. Aim a little higher,
 * so shades still pass on a tinted background.
 */
export const GRAPHIC_CONTRAST = 3.3;

/** How far the light end of a shade range is pushed towards white. */
const LIGHTEST = 0.6;

/**
 * `count` shades of `hex`, light to dark, for the parts of one category. Every shade keeps at
 * least `GRAPHIC_CONTRAST` against `background`, and neighbouring shades are spaced evenly by
 * contrast, so each step is as distinct as the range allows.
 */
export function shades(hex: string, count: number, background: string): string[] {
  if (count <= 1) return count === 1 ? [hex] : [];

  // Walk from a light tint (s = -1), through the colour itself (0), to near black (1).
  const at = (s: number) => (s < 0 ? mix(hex, '#ffffff', -s * LIGHTEST) : mix(hex, '#000000', s));
  const lightest = luminance(at(-1));
  const darkest = (luminance(background) + 0.05) * GRAPHIC_CONTRAST - 0.05;
  const ratio = ((darkest + 0.05) / (lightest + 0.05)) ** (1 / (count - 1));

  return Array.from({ length: count }, (_, i) => {
    const target = (lightest + 0.05) * ratio ** i - 0.05;
    // Luminance falls as s rises, so a binary search finds the shade.
    let lo = -1;
    let hi = 1;
    for (let step = 0; step < 24; step++) {
      const mid = (lo + hi) / 2;
      if (luminance(at(mid)) > target) lo = mid;
      else hi = mid;
    }
    return at(lo);
  });
}

/** How strongly an open category tints the background: barely there, an ambient glow. */
export const TINT_STRENGTH = 0.02;

/** `background` with a light wash of `hex` over it, as the tint draws it. */
export function tinted(background: string, hex: string): string {
  return mix(background, hex, TINT_STRENGTH);
}
