import Feather from '@expo/vector-icons/Feather';
import type { MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { tick } from '@/lib/haptics';
import { colors, spacing } from '@/theme/tokens';

/** Routes shown as an icon at the right of the bar rather than as a text tab. */
const ICON_ROUTES: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  settings: 'settings',
};

/**
 * The app's navigation: plain text tabs along the top. Pages also swipe left and right from
 * anywhere, and the labels brighten and dim with the swipe.
 */
export function TopNav({
  state,
  descriptors,
  navigateToTab,
  position,
  insets,
}: MaterialTopTabBarProps) {
  const go = (key: string, index: number) => {
    if (index !== state.index) {
      tick();
      navigateToTab(key);
    }
  };

  const textRoutes = state.routes.filter((route) => !(route.name in ICON_ROUTES));
  const iconRoutes = state.routes.filter((route) => route.name in ICON_ROUTES);

  // Fade each label in as its page comes into view.
  const opacityFor = (index: number) =>
    position.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [0.38, 1, 0.38],
      extrapolate: 'clamp',
    });

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]} accessibilityRole="tablist">
      <View style={styles.tabs}>
        {textRoutes.map((route) => {
          const index = state.routes.indexOf(route);
          const focused = index === state.index;
          const title = descriptors[route.key]?.options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              onPress={() => go(route.key, index)}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
            >
              <Animated.Text style={[styles.label, { opacity: opacityFor(index) }]}>
                {title}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
      {iconRoutes.map((route) => {
        const index = state.routes.indexOf(route);
        const focused = index === state.index;
        const name = ICON_ROUTES[route.name] ?? 'circle';
        return (
          <Pressable
            key={route.key}
            onPress={() => go(route.key, index)}
            hitSlop={12}
            accessibilityRole="tab"
            accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
            accessibilityState={{ selected: focused }}
          >
            <Animated.View style={{ opacity: opacityFor(index) }}>
              <Feather name={name} size={22} color={colors.text} />
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.base,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xl,
  },
  label: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
});
