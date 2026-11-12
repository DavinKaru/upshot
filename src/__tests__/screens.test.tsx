import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(tabs)/index';
import InsightsScreen from '@/app/(tabs)/insights';
import SaversScreen from '@/app/(tabs)/savers';
import SettingsScreen from '@/app/(tabs)/settings';
import { DemoDataProvider } from '@/data/DemoDataProvider';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderScreen(ui: ReactElement) {
  return render(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={metrics}>
        <DemoDataProvider>{ui}</DemoDataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
}

describe('screens render with demo data', () => {
  it('Home shows the balance, Savers and recent activity', async () => {
    await renderScreen(<HomeScreen />);
    expect(screen.getByText(/^Good (morning|afternoon|evening)$/)).toBeTruthy();
    expect(screen.getByText(/Demo mode/)).toBeTruthy();
    expect(screen.getByText('Rainy Day')).toBeTruthy();
    expect(screen.getByText('Recent activity')).toBeTruthy();
  });

  it('Insights shows this month by category and drills into one', async () => {
    await renderScreen(<InsightsScreen />);
    expect(screen.getByText(/^Spending in /)).toBeTruthy();

    await fireEvent.press(screen.getByText('Home'));
    expect(await screen.findByText('All spending')).toBeTruthy();
    expect(screen.getByText('Groceries')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Back to all spending'));
    expect(await screen.findByText(/^Spending in /)).toBeTruthy();
  });

  it('Savers shows the chart, Saver chips, time ranges and monthly cards', async () => {
    await renderScreen(<SaversScreen />);
    expect(screen.getByText('All Savers')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getAllByText('Interest earned').length).toBeGreaterThan(1);

    await fireEvent.press(screen.getByText('🗾 Japan Trip'));
    await fireEvent.press(screen.getByText('1Y'));
    expect(screen.getByLabelText(/^Balance chart\./)).toBeTruthy();
  });

  it('Settings explains demo mode and the disclaimer', async () => {
    await renderScreen(<SettingsScreen />);
    expect(screen.getByText('Connect your Up account')).toBeTruthy();
    expect(screen.getByText(/isn't affiliated with/)).toBeTruthy();
  });
});
