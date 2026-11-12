/**
 * Upshot's design tokens. The app is dark only (decision 3 in ROADMAP.md).
 *
 * The palette is inspired by the warm-on-dark feel of modern Australian banking apps, but the
 * colours are Upshot's own: a near-black base, warm off-white text and a coral accent.
 */

export const colors = {
  /** App background. */
  base: '#0E0E12',
  /** Cards and grouped lists. */
  surface: '#17171D',
  /** Raised elements on a card: pressed rows, chips, segmented controls. */
  raised: '#22222A',
  border: '#2C2C36',

  text: '#F6F3EE',
  textMuted: '#A19FAA',
  textFaint: '#6E6C77',

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

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const type = {
  /** Screen titles. */
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '500' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '500' },
  /** Small capitals above sections. */
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  /** The dollars part of large money displays; cents use `moneyCents`. */
  moneyLarge: { fontSize: 44, fontWeight: '700', letterSpacing: -1.2 },
  moneyCents: { fontSize: 22, fontWeight: '700' },
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
