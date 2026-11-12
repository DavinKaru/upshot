import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { categoryColorKey } from '@/components/CategoryBadge';
import { ListRow } from '@/components/ListRow';
import { Money } from '@/components/Money';
import { formatMonth, previousMonth } from '@/insights/dates';
import type { CategorySpend, MonthlySpending } from '@/insights/spendingByCategory';
import { tap } from '@/lib/haptics';
import { formatMoney, percentChange } from '@/lib/money';
import { shades } from '@/theme/color';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { CategoryDonut, type DonutItem } from './CategoryDonut';

interface CategoryBreakdownProps {
  spending: MonthlySpending;
  /** Any date in the month being shown, used for labels. */
  month: Date;
}

/**
 * This month's spending by category. Tap a category, on the ring or in the list, to see its
 * sub-categories; each row compares with last month.
 */
export function CategoryBreakdown({ spending, month }: CategoryBreakdownProps) {
  const [parentId, setParentId] = useState<string | null>(null);
  const parent = spending.parents.find((p) => p.id === parentId) ?? null;
  const lastMonthName = formatMonth(previousMonth(month)).slice(0, 3);

  const rows: (CategorySpend & { color: string })[] = useMemo(() => {
    if (parent) {
      const tints = shades(
        colors.category[categoryColorKey(parent.id)],
        parent.children.length,
        colors.base,
      );
      return parent.children.map((child, i) => ({ ...child, color: tints[i] ?? colors.textMuted }));
    }
    return spending.parents.map((p) => ({ ...p, color: colors.category[categoryColorKey(p.id)] }));
  }, [parent, spending.parents]);

  const donutItems: DonutItem[] = useMemo(
    () => rows.map((r) => ({ id: r.id, value: r.total, color: r.color })),
    [rows],
  );

  const total = parent ? parent.total : spending.total;
  const previous = parent ? parent.lastMonth : spending.lastMonth;

  const drillInto = (id: string) => {
    if (!parent && spending.parents.some((p) => p.id === id)) {
      tap();
      setParentId(id);
    }
  };

  return (
    <View>
      <View style={styles.titleRow}>
        {parent ? (
          <Pressable
            onPress={() => {
              tap();
              setParentId(null);
            }}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to all spending"
          >
            <Feather name="chevron-left" size={20} color={colors.accent} />
            <Text style={styles.backLabel}>All spending</Text>
          </Pressable>
        ) : (
          <Text style={styles.title}>Spending in {formatMonth(month)}</Text>
        )}
      </View>

      <View style={styles.donutWrap}>
        <CategoryDonut
          items={donutItems}
          onSelect={drillInto}
          accessibilityLabel={`${parent ? parent.name : 'Spending'} by category: ${rows
            .filter((r) => r.total > 0)
            .map((r) => `${r.name} ${formatMoney(r.total)}`)
            .join(', ')}`}
        >
          <Text style={styles.centerLabel}>{parent ? parent.name : 'Spent this month'}</Text>
          <Money cents={total} size="medium" />
          <ChangeLabel current={total} previous={previous} monthLabel={lastMonthName} />
        </CategoryDonut>
      </View>

      <Animated.View key={parentId ?? 'all'} entering={FadeIn.duration(motion.normal)}>
        {rows.map((row) => (
          <ListRow
            key={row.id}
            title={row.name}
            leading={<View style={[styles.dot, { backgroundColor: row.color }]} />}
            trailing={<Money cents={row.total} />}
            trailingCaption={
              <ChangeLabel
                current={row.total}
                previous={row.lastMonth}
                monthLabel={lastMonthName}
              />
            }
            onPress={parent ? undefined : () => drillInto(row.id)}
            showChevron={!parent}
            accessibilityHint={parent ? undefined : 'Shows sub-categories'}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/** "▲ 12% vs Oct". More spending is shown in red, less in green. */
function ChangeLabel({
  current,
  previous,
  monthLabel,
}: {
  current: number;
  previous: number;
  monthLabel: string;
}) {
  const change = percentChange(current, previous);
  if (change === null) return <Text style={styles.change}>Nothing in {monthLabel}</Text>;
  if (change === 0) return <Text style={styles.change}>Same as {monthLabel}</Text>;
  const up = change > 0;
  return (
    <Text style={[styles.change, { color: up ? colors.negative : colors.positive }]}>
      {up ? '▲' : '▼'} {Math.abs(change)}% vs {monthLabel}
    </Text>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    minHeight: 28,
    justifyContent: 'center',
  },
  title: {
    ...type.heading,
    color: colors.text,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  backLabel: {
    ...type.bodyStrong,
    color: colors.accent,
  },
  donutWrap: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  centerLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxs,
  },
  change: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: spacing.sm,
  },
});
