import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

import { categoryColorKey } from '@/components/CategoryBadge';
import { ListRow } from '@/components/ListRow';
import { ListSection } from '@/components/ListSection';
import { Money } from '@/components/Money';
import { Sheet } from '@/components/Sheet';
import { formatMonth, previousMonth } from '@/insights/dates';
import type { CategorySpend, MonthlySpending } from '@/insights/spendingByCategory';
import { tap } from '@/lib/haptics';
import { formatMoney, percentChange } from '@/lib/money';
import { shades, tinted } from '@/theme/color';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { CategoryDonut, type DonutItem } from './CategoryDonut';

interface CategoryBreakdownProps {
  spending: MonthlySpending;
  /** Any date in the month being shown, used for labels. */
  month: Date;
  /** Shown at the bottom of the sheet, under the list. */
  footer?: ReactNode;
  /** Called with a category's colour when it's opened, and `null` when it's closed. */
  onCategoryChange?: (color: string | null) => void;
}

/**
 * This month's spending by category. Tap a category, on the ring or in the list, to see its
 * sub-categories; each row compares with last month.
 */
export function CategoryBreakdown({
  spending,
  month,
  footer,
  onCategoryChange,
}: CategoryBreakdownProps) {
  const [parentId, setParentId] = useState<string | null>(null);
  const parent = spending.parents.find((p) => p.id === parentId) ?? null;
  const lastMonthName = formatMonth(previousMonth(month)).slice(0, 3);

  const topRows = useMemo(
    () => spending.parents.map((p) => ({ ...p, color: colors.category[categoryColorKey(p.id)] })),
    [spending.parents],
  );
  const childRows = useMemo(() => {
    if (!parent) return [];
    // Only parts with spending show in the ring, so only they need telling apart. Shades are
    // checked against the lighter, tinted sheet, the harder of the two backgrounds to pass.
    const hex = colors.category[categoryColorKey(parent.id)];
    const spent = parent.children.filter((child) => child.total > 0);
    const tints = shades(hex, spent.length, tinted(colors.sheet, hex));
    return parent.children.map((child) => {
      const index = spent.indexOf(child);
      return { ...child, color: index >= 0 ? (tints[index] ?? hex) : colors.textFaint };
    });
  }, [parent]);
  const rows: (CategorySpend & { color: string })[] = parent ? childRows : topRows;

  // The ring always holds the top-level categories; a chosen one opens up to show its parts.
  const donutItems: DonutItem[] = useMemo(
    () => topRows.map((r) => ({ id: r.id, value: r.total, color: r.color })),
    [topRows],
  );
  const focusItems: DonutItem[] = useMemo(
    () => childRows.map((r) => ({ id: r.id, value: r.total, color: r.color })),
    [childRows],
  );

  const total = parent ? parent.total : spending.total;
  const previous = parent ? parent.lastMonth : spending.lastMonth;

  const drillInto = (id: string) => {
    if (!parent && spending.parents.some((p) => p.id === id)) {
      tap();
      setParentId(id);
      onCategoryChange?.(colors.category[categoryColorKey(id)]);
    }
  };

  const goBack = () => {
    tap();
    setParentId(null);
    onCategoryChange?.(null);
  };

  return (
    <>
      <View style={styles.titleRow}>
        {parent ? (
          <Pressable
            onPress={goBack}
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
          focusedId={parentId}
          focusItems={focusItems}
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

      <Sheet>
        <ListSection
          title={
            parent ? (
              <>
                <Text style={styles.crumb} onPress={goBack} accessibilityRole="link">
                  Categories
                </Text>
                {'  ›  '}
                {parent.name}
              </>
            ) : (
              'Categories'
            )
          }
        >
          {/* Opening a category pushes its list in from the right; going back slides it out the
              same way. The first render doesn't animate. */}
          <LayoutAnimationConfig skipEntering>
            <Animated.View
              key={parentId ?? 'all'}
              entering={(parent ? SlideInRight : SlideInLeft).duration(motion.normal)}
              exiting={(parent ? SlideOutRight : SlideOutLeft).duration(motion.normal)}
            >
              {rows.map((row, i) => (
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
                  separator={i < rows.length - 1}
                  accessibilityHint={parent ? undefined : 'Shows sub-categories'}
                />
              ))}
            </Animated.View>
          </LayoutAnimationConfig>
        </ListSection>
        {footer}
      </Sheet>
    </>
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
    minHeight: 24,
    alignItems: 'center',
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
    marginTop: spacing.lg,
  },
  centerLabel: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxs,
  },
  crumb: {
    color: colors.accent,
  },
  change: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
