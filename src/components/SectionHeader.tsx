import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { colors, spacing, type } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...type.label,
    color: colors.textMuted,
  },
  action: {
    ...type.caption,
    color: colors.accent,
  },
  pressed: {
    opacity: 0.6,
  },
});
