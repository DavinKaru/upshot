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

/** `count` shades of `hex`, from full strength to quite dark, for child categories. */
export function shades(hex: string, count: number, background: string): string[] {
  return Array.from({ length: count }, (_, i) =>
    mix(hex, background, count > 1 ? (i / (count - 1)) * 0.72 : 0),
  );
}
