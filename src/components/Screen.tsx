import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { BackgroundTint } from './BackgroundTint';

interface ScreenProps {
  children: ReactNode;
  /** Turn off while a chart is being scrubbed, so the page doesn't scroll under the finger. */
  scrollEnabled?: boolean;
}

/**
 * A scrolling page under the top navigation. Put the page's headline content first, then a
 * `Sheet` holding its lists.
 */
export function Screen({ children, scrollEnabled = true }: ScreenProps) {
  return (
    <View style={styles.page}>
      <BackgroundTint />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    // Lets a `Sheet` at the end fill the rest of the screen.
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
