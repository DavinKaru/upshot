import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { colors, spacing, type } from '@/theme/tokens';

interface ListSectionProps {
  /** Usually a string; can be nested `Text`, for a breadcrumb. */
  title: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

/** A full-width band naming a group of rows, followed by the rows themselves. */
export function ListSection({ title, actionLabel, onAction, children }: ListSectionProps) {
  return (
    <View>
      <View style={styles.band}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={() => {
              tap();
              onAction();
            }}
            hitSlop={12}
            accessibilityRole="button"
          >
            {({ pressed }) => (
              <Text style={[styles.action, pressed && styles.pressed]}>{actionLabel}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.band,
    paddingHorizontal: spacing.lg + spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
  title: {
    ...type.label,
    color: colors.textMuted,
  },
  action: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
