import { TopTabs } from 'expo-router/js-top-tabs';

import { TopNav } from '@/components/TopNav';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <TopTabs
      tabBar={(props) => <TopNav {...props} />}
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        lazyPreloadDistance: 1,
        sceneStyle: { backgroundColor: colors.base },
      }}
    >
      <TopTabs.Screen name="index" options={{ title: 'Home' }} />
      <TopTabs.Screen name="insights" options={{ title: 'Insights' }} />
      <TopTabs.Screen name="savers" options={{ title: 'Savers' }} />
      <TopTabs.Screen name="settings" options={{ title: 'Settings' }} />
    </TopTabs>
  );
}
