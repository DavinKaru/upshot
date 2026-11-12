import type { MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { tick } from '@/lib/haptics';
import { colors, spacing, type } from '@/theme/tokens';

interface LabelLayout {
  x: number;
  width: number;
}

/**
 * The app's navigation: plain text tabs along the top, with the current tab always centred on
 * screen, even the first and last. Pages swipe left and right from anywhere, and the row of
 * labels slides with the swipe so the next tab glides into the centre.
 */
export function TopNav({
  state,
  descriptors,
  navigateToTab,
  position,
  insets,
}: MaterialTopTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [layouts, setLayouts] = useState<(LabelLayout | undefined)[]>([]);
  const routes = state.routes;
  const measured = routes.length > 0 && routes.every((_, i) => layouts[i] !== undefined);

  const go = (key: string, index: number) => {
    if (index !== state.index) {
      tick();
      navigateToTab(key);
    }
  };

  // How far to shift the row so tab `i` sits in the middle of the screen.
  const offsetFor = (i: number) => {
    const layout = layouts[i];
    return layout ? screenWidth / 2 - (layout.x + layout.width / 2) : 0;
  };

  const translateX =
    measured && routes.length > 1
      ? position.interpolate({
          inputRange: routes.map((_, i) => i),
          outputRange: routes.map((_, i) => offsetFor(i)),
          extrapolate: 'clamp',
        })
      : offsetFor(state.index);

  // Fade each label in as its page comes into view.
  const opacityFor = (index: number) =>
    position.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [0.45, 1, 0.45],
      extrapolate: 'clamp',
    });

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]} accessibilityRole="tablist">
      <Animated.View
        style={[styles.row, { opacity: measured ? 1 : 0, transform: [{ translateX }] }]}
      >
        {routes.map((route, index) => {
          const focused = index === state.index;
          const title = descriptors[route.key]?.options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              onPress={() => go(route.key, index)}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setLayouts((current) => {
                  const next = [...current];
                  next[index] = { x, width };
                  return next;
                });
              }}
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: spacing.md,
    backgroundColor: colors.base,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    gap: spacing.xl + spacing.xs,
  },
  label: {
    ...type.nav,
    color: colors.text,
  },
});
