/**
 * Upshot's design tokens. The app is dark only (decision 3 in ROADMAP.md).
 *
 * Upshot sits on deep navy rather than black, with warm off-white text and a coral accent.
 * Screens follow one layout: a dark header area, then a slightly lighter **sheet** with rounded
 * top corners that holds full-width lists split by section bands.
 */

export const colors = {
  /** App background and the header area of each screen. */
  base: '#1F1E2B',
  /** The sheet that rises over the header and holds lists. */
  sheet: '#282736',
  /** Section bands across the sheet, like "Savers" or "About". */
  band: '#23222F',
  /** Cards that sit on the sheet or header. */
  surface: '#302F40',
  /** Pressed rows, chips and other raised states. */
  raised: '#38374A',
  /** Hairline separators and outlines. */
  border: '#3B3A4E',

  text: '#F4F2F7',
  textMuted: '#A9A6B8',
  textFaint: '#7A778C',

  accent: '#FF8A5B',
  accentStrong: '#FF6F3C',
  /** Accent at low opacity, for selected states and chart fills. */
  accentSoft: 'rgba(255, 138, 91, 0.16)',
  amber: '#FFC15E',

  positive: '#6FD6A0',
  negative: '#FF7A7A',

  /** One colour per parent category, matching Up's four top-level categories. */
  category: {
    'good-life': '#FFB547',
    home: '#6EC5FF',
    personal: '#C49BFF',
    transport: '#5FE0C1',
    uncategorised: '#8A8894',
  },
} as const;

export type CategoryColorKey = keyof typeof colors.category;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corners are kept tight. Only the sheet and pills are properly round. */
export const radii = {
  sm: 4,
  md: 6,
  lg: 10,
  sheet: 18,
  pill: 999,
} as const;

/** A compact scale: regular-weight body text, with weight kept for numbers and headings. */
export const type = {
  /** Tabs in the top navigation. */
  nav: { fontSize: 17, fontWeight: '500', letterSpacing: -0.2 },
  /** A name under an avatar, or a page's main heading. */
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  heading: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 12.5, fontWeight: '400' },
  /** Small capitals on section bands. */
  label: { fontSize: 11.5, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  /** The dollars part of large money displays; cents use `moneyCents`. */
  moneyLarge: { fontSize: 38, fontWeight: '700', letterSpacing: -1 },
  moneyCents: { fontSize: 18, fontWeight: '700' },
} as const;

export const motion = {
  /** Short transitions: press states, small fades. */
  fast: 160,
  /** Default UI transitions. */
  normal: 280,
  /** Chart drawing and drill-down. */
  chart: 650,
  spring: { damping: 18, stiffness: 180, mass: 1 },
} as const;
