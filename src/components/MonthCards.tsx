import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { formatMonth, parseDayKey } from '@/insights/dates';
import type { SaverMonth } from '@/insights/saverMonths';
import { formatMoney } from '@/lib/money';
import { colors, radii, spacing, type } from '@/theme/tokens';

interface MonthCardsProps {
  /** Newest first. */
  months: readonly SaverMonth[];
}

/** Sideways-swiping cards summarising each month: saves, interest and withdrawals. */
export function MonthCards({ months }: MonthCardsProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.lg * 2 - spacing.xxl, 340);
  // The last card has nothing to compare with, so it's only used for comparison.
  const shown = months.slice(0, -1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + spacing.md}
      decelerationRate="fast"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {shown.map((month, i) => {
        const previous = months[i + 1];
        const difference = previous ? month.net - previous.net : 0;
        return (
          <View key={month.month} style={[styles.card, { width: cardWidth }]}>
            <Text style={styles.title}>
              {i === 0 ? 'This month' : formatMonth(parseDayKey(`${month.month}-01`))}
            </Text>
            {i === 0 ? (
              <Text style={[styles.summary, styles.neutral]}>
                {month.net >= 0 ? 'Up' : 'Down'} {formatMoney(Math.abs(month.net))} so far
              </Text>
            ) : (
              <Text style={[styles.summary, difference >= 0 ? styles.up : styles.down]}>
                Saved {formatMoney(Math.abs(difference))} {difference >= 0 ? 'more' : 'less'} than
                the month before
              </Text>
            )}
            <Row label="Saves" count={month.saves.count} cents={month.saves.total} />
            <Row label="Interest earned" cents={month.interest} />
            <Row
              label="Withdrawals"
              count={month.withdrawals.count}
              cents={-month.withdrawals.total}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

function Row({ label, count, cents }: { label: string; count?: number; cents: number }) {
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowLabel}>
        {label}
        {count !== undefined ? <Text style={styles.count}> {count}</Text> : null}
      </Text>
      <Text style={styles.rowValue}>{formatMoney(cents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    padding: spacing.lg,
  },
  title: {
    ...type.heading,
    color: colors.text,
  },
  summary: {
    ...type.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  neutral: {
    color: colors.textMuted,
  },
  up: {
    color: colors.positive,
  },
  down: {
    color: colors.negative,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  rowLabel: {
    ...type.body,
    color: colors.textMuted,
  },
  count: {
    color: colors.textFaint,
  },
  rowValue: {
    ...type.bodyStrong,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
