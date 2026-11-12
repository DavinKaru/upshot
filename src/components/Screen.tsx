import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Turn off while a chart is being scrubbed, so the page doesn't scroll under the finger. */
  scrollEnabled?: boolean;
}

/** A scrolling page under the top navigation. The navigation names the page, so there's no title. */
export function Screen({ children, scrollEnabled = true }: ScreenProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl * 1.5,
  },
});
