/**
 * A small seeded random number generator, so demo data is the same on every run and in tests.
 * Uses mulberry32, which is plenty for made-up data and isn't meant for anything else.
 */
export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** A float in [min, max). */
  between(min: number, max: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** A random ID in the shape of a UUID. */
  id(): string;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('');

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    between: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    pick: (items) => {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    id: () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`,
  };
}
