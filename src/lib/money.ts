/** Formatting for amounts held in cents, as Up's `valueInBaseUnits` provides them. */

const groupFormatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

export interface MoneyParts {
  /** "-" for negative amounts, "" otherwise. */
  sign: '-' | '';
  /** Whole dollars with thousands separators, without a currency symbol. */
  dollars: string;
  /** Always two digits. */
  cents: string;
}

export function moneyParts(cents: number): MoneyParts {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return {
    sign,
    dollars: groupFormatter.format(Math.floor(abs / 100)),
    cents: String(abs % 100).padStart(2, '0'),
  };
}

/** "$1,234.56", or "-$1,234.56" for negative amounts. */
export function formatMoney(cents: number): string {
  const { sign, dollars, cents: c } = moneyParts(cents);
  return `${sign}$${dollars}.${c}`;
}

/** Whole dollars only, for tight spaces: "$1,235". */
export function formatMoneyRounded(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${groupFormatter.format(Math.round(Math.abs(cents) / 100))}`;
}

/** Percentage change from `previous` to `current`, or `null` when there's nothing to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
