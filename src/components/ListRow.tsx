import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { colors, spacing, type } from '@/theme/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** An icon or badge on the left. */
  leading?: ReactNode;
  /** Usually a `Money`. */
  trailing?: ReactNode;
  /** Small text under the trailing content, such as a change from last month. */
  trailingCaption?: ReactNode;
  onPress?: () => void;
  /** Show a chevron, for rows that drill in. */
  showChevron?: boolean;
  /** Draw the hairline under this row. Turn off for the last row before a band. */
  separator?: boolean;
  accessibilityHint?: string;
}

/**
 * A full-width list row. The separator starts at the text, not the icon, so a column of icons
 * reads as one clean edge.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  trailingCaption,
  onPress,
  showChevron = false,
  separator = true,
  accessibilityHint,
}: ListRowProps) {
  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && styles.pressed]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={[styles.body, separator && styles.separator]}>
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
        {trailing || trailingCaption ? (
          <View style={styles.trailing}>
            {trailing}
            {typeof trailingCaption === 'string' ? (
              <Text style={styles.subtitle}>{trailingCaption}</Text>
            ) : (
              trailingCaption
            )}
          </View>
        ) : null}
        {showChevron ? <Feather name="chevron-right" size={17} color={colors.textFaint} /> : null}
      </View>
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
    paddingLeft: spacing.lg + spacing.xs,
  },
  pressed: {
    backgroundColor: colors.raised,
  },
  leading: {
    width: 36,
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingRight: spacing.lg + spacing.xs,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    marginTop: 3,
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
