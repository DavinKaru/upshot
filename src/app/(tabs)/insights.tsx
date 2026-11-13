import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { CategoryBreakdown } from '@/charts/CategoryBreakdown';
import { useBackgroundTint } from '@/components/BackgroundTint';
import { Screen } from '@/components/Screen';
import { useBankData } from '@/data/DemoDataProvider';
import { spendingByCategory } from '@/insights/spendingByCategory';
import { colors, spacing, type } from '@/theme/tokens';

export default function InsightsScreen() {
  const { transactions, categories, generatedAt } = useBankData();
  const spending = useMemo(
    () => spendingByCategory(transactions, categories, generatedAt),
    [transactions, categories, generatedAt],
  );
  // While a category is open, the whole background takes on a hint of its colour. Only while
  // this page is showing, so swiping away clears it.
  const [tint, setTint] = useState<string | null>(null);
  const isFocused = useIsFocused();
  useBackgroundTint(isFocused ? tint : null);

  return (
    <Screen>
      <CategoryBreakdown
        spending={spending}
        month={generatedAt}
        onCategoryChange={setTint}
        footer={
          <Text style={styles.footnote}>
            Transfers between your accounts and money coming in aren&apos;t counted as spending.
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footnote: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
