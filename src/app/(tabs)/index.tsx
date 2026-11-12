import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TransactionResource } from '@/api/up/types';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DemoBanner } from '@/components/DemoBanner';
import { EmojiBadge } from '@/components/EmojiBadge';
import { ListRow } from '@/components/ListRow';
import { ListSection } from '@/components/ListSection';
import { Money } from '@/components/Money';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
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
      <View style={styles.hero}>
        <Text style={styles.greeting}>{greeting(generatedAt)}</Text>
        <Money cents={spending?.attributes.balance.valueInBaseUnits ?? 0} size="large" />
        <Text style={styles.caption}>
          Available in {spending?.attributes.displayName ?? 'Spending'}
        </Text>
        <View style={styles.banner}>
          <DemoBanner />
        </View>
      </View>

      <Sheet>
        <ListSection
          title={`Spent in ${formatMonth(generatedAt)}`}
          actionLabel="Insights"
          onAction={() => router.navigate('/insights')}
        >
          <ListRow
            title="So far this month"
            subtitle={`By this time in ${formatMonth(previousMonth(generatedAt))} you'd spent ${formatMoney(month.lastMonth)}`}
            leading={<Feather name="pie-chart" size={22} color={colors.text} />}
            trailing={<Money cents={month.total} />}
            separator={false}
            onPress={() => router.navigate('/insights')}
          />
        </ListSection>

        <ListSection
          title="Savers"
          actionLabel="See all"
          onAction={() => router.navigate('/savers')}
        >
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
          <ListRow
            title="Total saved"
            leading={<Feather name="layers" size={22} color={colors.textMuted} />}
            trailing={<Money cents={totalSaved} />}
            separator={false}
          />
        </ListSection>

        <ListSection title="Recent activity">
          {recent.map((tx, i) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              categoryNames={categoryNames}
              last={i === recent.length - 1}
            />
          ))}
        </ListSection>
      </Sheet>
    </Screen>
  );
}

function TransactionRow({
  tx,
  categoryNames,
  last,
}: {
  tx: TransactionResource;
  categoryNames: Map<string, string>;
  last: boolean;
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
      separator={!last}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  greeting: {
    ...type.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  caption: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  banner: {
    marginTop: spacing.md,
  },
});
