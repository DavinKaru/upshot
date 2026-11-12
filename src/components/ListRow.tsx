import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { colors, radii, spacing, type } from '@/theme/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Usually a `CategoryBadge`. */
  leading?: ReactNode;
  /** Usually a `Money`. */
  trailing?: ReactNode;
  /** Small text under the trailing content, such as a change from last month. */
  trailingCaption?: ReactNode;
  onPress?: () => void;
  /** Show a chevron, for rows that drill in. */
  showChevron?: boolean;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  trailingCaption,
  onPress,
  showChevron = false,
  accessibilityHint,
}: ListRowProps) {
  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && styles.pressed]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {trailing}
        {typeof trailingCaption === 'string' ? (
          <Text style={styles.subtitle}>{trailingCaption}</Text>
        ) : (
          trailingCaption
        )}
      </View>
      {showChevron ? (
        <Feather name="chevron-right" size={18} color={colors.textFaint} style={styles.chevron} />
      ) : null}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.raised,
  },
  leading: {
    flexShrink: 0,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  subtitle: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  chevron: {
    marginLeft: -spacing.xs,
  },
});
