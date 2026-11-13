import { TopTabs } from 'expo-router/js-top-tabs';

import { BackgroundTintProvider } from '@/components/BackgroundTint';
import { TopNav } from '@/components/TopNav';
import { colors } from '@/theme/tokens';

// Upshot's own page sits on the far left, but the app opens on Home.
export const unstable_settings = { anchor: 'index' };

export default function TabLayout() {
  return (
    <BackgroundTintProvider>
      <TopTabs
        tabBar={(props) => <TopNav {...props} />}
        screenOptions={{
          swipeEnabled: true,
          lazy: true,
          lazyPreloadDistance: 1,
          sceneStyle: { backgroundColor: colors.base },
        }}
      >
        <TopTabs.Screen name="upshot" options={{ title: 'Upshot' }} />
        <TopTabs.Screen name="index" options={{ title: 'Home' }} />
        <TopTabs.Screen name="insights" options={{ title: 'Insights' }} />
        <TopTabs.Screen name="savers" options={{ title: 'Savers' }} />
      </TopTabs>
    </BackgroundTintProvider>
  );
}
