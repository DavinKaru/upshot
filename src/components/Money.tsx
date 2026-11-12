import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatMoney, moneyParts } from '@/lib/money';
import { colors, type } from '@/theme/tokens';

interface MoneyProps {
  cents: number;
  /** `large` and `medium` split dollars and cents, like a balance. `inline` is plain text. */
  size?: 'large' | 'medium' | 'inline';
  /** Colour positive amounts green, as for money coming in. */
  tintPositive?: boolean;
  /** Show a leading "+" on positive amounts. */
  showPlus?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Money({
  cents,
  size = 'inline',
  tintPositive = false,
  showPlus = false,
  color,
  style,
}: MoneyProps) {
  const textColor = color ?? (tintPositive && cents > 0 ? colors.positive : colors.text);
  const plus = showPlus && cents > 0 ? '+' : '';

  if (size === 'inline') {
    return (
      <Text style={[styles.inline, { color: textColor }]} accessibilityLabel={formatMoney(cents)}>
        {plus}
        {formatMoney(cents)}
      </Text>
    );
  }

  const { sign, dollars, cents: c } = moneyParts(cents);
  const medium = size === 'medium';
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={formatMoney(cents)}
    >
      <Text style={[styles.symbol, medium && styles.symbolMedium, { color: textColor }]}>
        {plus}
        {sign}$
      </Text>
      <Text style={[styles.dollars, medium && styles.dollarsMedium, { color: textColor }]}>
        {dollars}
      </Text>
      <Text style={[styles.cents, medium && styles.centsMedium, { color: textColor }]}>.{c}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    ...type.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  symbol: {
    ...type.moneyCents,
    marginTop: 6,
    marginRight: 2,
  },
  dollars: {
    ...type.moneyLarge,
    fontVariant: ['tabular-nums'],
  },
  cents: {
    ...type.moneyCents,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  symbolMedium: {
    fontSize: 16,
    marginTop: 4,
  },
  dollarsMedium: {
    fontSize: 32,
    letterSpacing: -0.8,
  },
  centsMedium: {
    fontSize: 16,
    marginTop: 4,
  },
});
