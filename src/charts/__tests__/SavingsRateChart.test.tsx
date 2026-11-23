import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { MonthFlow, SavingsRate } from '@/insights/savingsRate';

import { SavingsRateChart } from '../SavingsRateChart';
import { LINE_LABEL_GAP, LINE_LABEL_HEIGHT } from '../lineLabels';

function month(key: string, moneyIn: number, kept: number): MonthFlow {
  return { month: key, moneyIn, spent: moneyIn - kept, kept, rate: kept / moneyIn };
}

/** Six months that kept -$528 on average, which drew "Avg" on top of "$0". */
const months = [
  month('2026-05', 800000, -100000),
  month('2026-06', 850000, 60000),
  month('2026-07', 780000, -80000),
  month('2026-08', 820000, 40000),
  month('2026-09', 800000, -90000),
  month('2026-10', 810000, -146800),
];
const rate: SavingsRate = {
  months,
  thisMonth: month('2026-11', 400000, 100000),
  average: -316800 / 4860000,
  averageKept: -52800,
};

const topOf = (text: string) => {
  const style = StyleSheet.flatten(screen.getByText(text).props.style) as { top?: number };
  return style.top ?? NaN;
};

async function renderChart() {
  await render(
    <GestureHandlerRootView>
      <SavingsRateChart rate={rate} />
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByRole('image'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 230 } },
  });
}

describe('SavingsRateChart', () => {
  const original = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(original));

  it('draws the "Avg" and "$0" labels apart when the average is just below zero', async () => {
    // React Native's Jest setup reports large text (a font scale of 2), so set the usual size.
    Dimensions.set({
      window: { ...original.window, fontScale: 1 },
      screen: { ...original.screen, fontScale: 1 },
    });
    await renderChart();
    const zero = topOf('$0');
    const average = topOf('Avg');
    expect(Math.abs(average - zero)).toBeGreaterThanOrEqual(LINE_LABEL_HEIGHT + LINE_LABEL_GAP);
    // The average line is below zero, so its label is too.
    expect(average).toBeGreaterThan(zero);
  });

  it('keeps the labels apart with large system text', async () => {
    const fontScale = 2;
    Dimensions.set({
      window: { ...original.window, fontScale },
      screen: { ...original.screen, fontScale },
    });
    await renderChart();
    expect(Math.abs(topOf('Avg') - topOf('$0'))).toBeGreaterThanOrEqual(
      LINE_LABEL_HEIGHT * fontScale + LINE_LABEL_GAP,
    );
  });
});
