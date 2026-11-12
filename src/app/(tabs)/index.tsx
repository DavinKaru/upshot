import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TransactionResource } from '@/api/up/types';
import { Card } from '@/components/Card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DemoBanner } from '@/components/DemoBanner';
import { EmojiBadge } from '@/components/EmojiBadge';
import { ListRow } from '@/components/ListRow';
import { Money } from '@/components/Money';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAccounts, useBankData } from '@/data/DemoDataProvider';
import { formatMonth, formatShortDate, previousMonth } from '@/insights/dates';
import { spendingByCategory } from '@/insights/spendingByCategory';
import { formatMoney } from '@/lib/money';
import { splitLeadingEmoji } from '@/lib/text';
import { colors, spacing, type } from '@/theme/tokens';

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { transactions, categories, generatedAt } = useBankData();
  const { spending, savers } = useAccounts();
  const categoryNames = useMemo(
    () => new Map(categories.map((c) => [c.id, c.attributes.name])),
    [categories],
  );

  const month = useMemo(
    () => spendingByCategory(transactions, categories, generatedAt),
    [transactions, categories, generatedAt],
  );
  const recent = useMemo(
    () =>
      transactions.filter((tx) => tx.relationships.account.data.id === spending?.id).slice(0, 8),
    [transactions, spending],
  );
  const totalSaved = savers.reduce((sum, s) => sum + s.attributes.balance.valueInBaseUnits, 0);

  return (
    <Screen>
      <Text style={styles.greeting}>{greeting(generatedAt)}</Text>
      <DemoBanner />

      <Card style={styles.balanceCard}>
        <Text style={styles.cardLabel}>{spending?.attributes.displayName ?? 'Spending'}</Text>
        <Money cents={spending?.attributes.balance.valueInBaseUnits ?? 0} size="large" />
        <Text style={styles.caption}>Available to spend</Text>
      </Card>

      <SectionHeader
        title={`Spent in ${formatMonth(generatedAt)}`}
        actionLabel="Insights"
        onAction={() => router.navigate('/insights')}
      />
      <Card>
        <Money cents={month.total} size="large" />
        <Text style={styles.caption}>
          So far this month. By this time in {formatMonth(previousMonth(generatedAt))} you&apos;d
          spent {formatMoney(month.lastMonth)}.
        </Text>
      </Card>

      <SectionHeader
        title="Savers"
        actionLabel="See all"
        onAction={() => router.navigate('/savers')}
      />
      <Card style={styles.listCard}>
        {savers.map((saver) => {
          const { emoji, label } = splitLeadingEmoji(saver.attributes.displayName);
          return (
            <ListRow
              key={saver.id}
              title={label}
              leading={
                emoji ? (
                  <EmojiBadge emoji={emoji} />
                ) : (
                  <CategoryBadge parentId={null} icon="target" />
                )
              }
              trailing={<Money cents={saver.attributes.balance.valueInBaseUnits} />}
              onPress={() => router.navigate('/savers')}
            />
          );
        })}
        <View style={styles.totalRow}>
          <Text style={styles.caption}>Total saved</Text>
          <Money cents={totalSaved} />
        </View>
      </Card>

      <SectionHeader title="Recent activity" />
      <Card style={styles.listCard}>
        {recent.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} categoryNames={categoryNames} />
        ))}
      </Card>
    </Screen>
  );
}

function TransactionRow({
  tx,
  categoryNames,
}: {
  tx: TransactionResource;
  categoryNames: Map<string, string>;
}) {
  const amount = tx.attributes.amount.valueInBaseUnits;
  const isTransfer = tx.relationships.transferAccount.data !== null;
  const categoryId = tx.relationships.category.data?.id;
  const label = isTransfer
    ? 'Transfer'
    : categoryId
      ? (categoryNames.get(categoryId) ?? 'Uncategorised')
      : amount > 0
        ? 'Money in'
        : 'Uncategorised';
  const when =
    tx.attributes.status === 'HELD'
      ? 'Pending'
      : formatShortDate(new Date(tx.attributes.createdAt));

  return (
    <ListRow
      title={tx.attributes.description}
      subtitle={`${label} · ${when}`}
      leading={
        <CategoryBadge
          parentId={tx.relationships.parentCategory.data?.id}
          icon={isTransfer ? 'repeat' : amount > 0 && !categoryId ? 'arrow-down-left' : undefined}
        />
      }
      trailing={<Money cents={amount} tintPositive showPlus />}
    />
  );
}

const styles = StyleSheet.create({
  greeting: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  balanceCard: {
    paddingVertical: spacing.xl,
  },
  cardLabel: {
    ...type.bodyStrong,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  caption: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  listCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
