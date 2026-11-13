import Feather from '@expo/vector-icons/Feather';
import { useIsFocused, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRate, SavingsRateChart } from '@/charts/SavingsRateChart';
import { CategoryBadge } from '@/components/CategoryBadge';
import { EmojiBadge } from '@/components/EmojiBadge';
import { ListRow } from '@/components/ListRow';
import { ListSection } from '@/components/ListSection';
import { Money } from '@/components/Money';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useAccounts, useBankData } from '@/data/DemoDataProvider';
import { formatMonth } from '@/insights/dates';
import { saverMonths } from '@/insights/saverMonths';
import { savingsRate } from '@/insights/savingsRate';
import { formatMoney } from '@/lib/money';
import { splitLeadingEmoji } from '@/lib/text';
import { colors, spacing, type } from '@/theme/tokens';

/** Whole months shown on the chart, and averaged in the headline. */
const MONTHS = 6;

export default function SaversScreen() {
  const { transactions, generatedAt } = useBankData();
  const { savers } = useAccounts();
  const navigation = useNavigation();
  // The months drain as the screen comes into view, and only slosh while it's showing.
  const focused = useIsFocused();
  const [scrubbing, setScrubbing] = useState(false);

  const rate = useMemo(
    () => savingsRate(transactions, MONTHS, generatedAt),
    [transactions, generatedAt],
  );
  const { thisMonth } = rate;
  const totalSaved = savers.reduce((sum, s) => sum + s.attributes.balance.valueInBaseUnits, 0);

  // How much each Saver has grown or shrunk this month, Round Ups and interest included.
  const saverChange = useMemo(
    () =>
      new Map(
        savers.map((s) => [s.id, saverMonths(transactions, [s.id], 1, generatedAt)[0]?.net ?? 0]),
      ),
    [savers, transactions, generatedAt],
  );

  // While a finger is on the chart, neither the page nor the tabs should move under it.
  const onScrubbingChange = useCallback(
    (active: boolean) => {
      setScrubbing(active);
      navigation.setOptions({ swipeEnabled: !active });
    },
    [navigation],
  );

  return (
    <Screen scrollEnabled={!scrubbing}>
      <View style={styles.chart}>
        <SavingsRateChart rate={rate} onScrubbingChange={onScrubbingChange} visible={focused} />
      </View>

      <Sheet>
        <ListSection title={`${formatMonth(generatedAt)} so far`}>
          <ListRow
            title="Came in"
            subtitle="Pay, refunds and interest"
            leading={<Feather name="arrow-down-left" size={22} color={colors.textMuted} />}
            trailing={<Money cents={thisMonth.moneyIn} />}
          />
          <ListRow
            title="Went out"
            subtitle="Everything you spent"
            leading={<Feather name="arrow-up-right" size={22} color={colors.textMuted} />}
            trailing={<Money cents={thisMonth.spent} />}
          />
          <ListRow
            title={thisMonth.kept < 0 ? 'Overspent' : 'Kept'}
            subtitle={
              thisMonth.rate === null
                ? 'Nothing has come in yet'
                : `${formatRate(thisMonth.rate)} of what came in, so far`
            }
            leading={<Feather name="archive" size={22} color={colors.textMuted} />}
            trailing={<Money cents={Math.abs(thisMonth.kept)} />}
            separator={false}
          />
        </ListSection>

        <ListSection title="Your Savers">
          {savers.map((saver) => {
            const { emoji, label } = splitLeadingEmoji(saver.attributes.displayName);
            const change = saverChange.get(saver.id) ?? 0;
            return (
              <ListRow
                key={saver.id}
                title={label}
                subtitle={
                  change === 0
                    ? 'No change this month'
                    : `${change > 0 ? '+' : '-'}${formatMoney(Math.abs(change))} this month`
                }
                leading={
                  emoji ? (
                    <EmojiBadge emoji={emoji} />
                  ) : (
                    <CategoryBadge parentId={null} icon="target" />
                  )
                }
                trailing={<Money cents={saver.attributes.balance.valueInBaseUnits} />}
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

        <Text style={styles.footnote}>
          Moving money between your own accounts, like into a Saver, doesn&apos;t count as coming in
          or going out. Tap a month to watch it drain again, or tilt your phone.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  footnote: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    textAlign: 'center',
  },
});
