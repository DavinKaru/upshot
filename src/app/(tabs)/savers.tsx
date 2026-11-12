import { useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BalanceChart } from '@/charts/BalanceChart';
import { Chips } from '@/components/Chips';
import { MonthCards } from '@/components/MonthCards';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAccounts, useBankData } from '@/data/DemoDataProvider';
import { balanceHistory, samplePoints, sumHistories } from '@/insights/balanceHistory';
import { saverMonths } from '@/insights/saverMonths';
import { colors, spacing, type } from '@/theme/tokens';

type Range = '1M' | '3M' | '6M' | '1Y';

const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 91 },
  { value: '6M', label: '6M', days: 182 },
  { value: '1Y', label: '1Y', days: 365 },
];

const ALL = 'all';

export default function SaversScreen() {
  const { transactions, generatedAt } = useBankData();
  const { savers } = useAccounts();
  const navigation = useNavigation();
  const [selected, setSelected] = useState<string>(ALL);
  const [range, setRange] = useState<Range>('6M');
  const [scrubbing, setScrubbing] = useState(false);

  const days = RANGES.find((r) => r.value === range)?.days ?? 182;
  const selectedIds = useMemo(
    () => (selected === ALL ? savers.map((s) => s.id) : [selected]),
    [savers, selected],
  );

  const points = useMemo(() => {
    const histories = savers
      .filter((s) => selectedIds.includes(s.id))
      .map((s) => balanceHistory(s, transactions, days, generatedAt));
    return samplePoints(sumHistories(histories));
  }, [savers, selectedIds, transactions, days, generatedAt]);

  const months = useMemo(
    () => saverMonths(transactions, selectedIds, 7, generatedAt),
    [transactions, selectedIds, generatedAt],
  );

  // While a finger is on the chart, neither the page nor the tabs should move under it.
  const onScrubbingChange = useCallback(
    (active: boolean) => {
      setScrubbing(active);
      navigation.setOptions({ swipeEnabled: !active });
    },
    [navigation],
  );

  const chips = [{ id: ALL, label: 'All Savers' }].concat(
    savers.map((s) => ({ id: s.id, label: s.attributes.displayName })),
  );

  return (
    <Screen scrollEnabled={!scrubbing}>
      <Chips items={chips} selected={selected} onSelect={setSelected} />

      <View style={styles.chart}>
        <BalanceChart points={points} onScrubbingChange={onScrubbingChange} />
      </View>

      <SegmentedControl
        options={RANGES}
        value={range}
        onChange={setRange}
        accessibilityLabel="Time range"
      />

      <View style={styles.cards}>
        <MonthCards months={months} />
      </View>

      <Text style={styles.footnote}>Drag across the chart to see your balance on any day.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  cards: {
    marginTop: spacing.xl,
  },
  footnote: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
