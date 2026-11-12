import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { tick } from '@/lib/haptics';
import { colors, radii, spacing, type } from '@/theme/tokens';

interface ChipsProps {
  items: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}

/** A sideways-scrolling row of outlined choices. The chosen one gets an accent outline. */
export function Chips({ items, selected, onSelect }: ChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => {
        const active = item.id === selected;
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              if (!active) {
                tick();
                onSelect(item.id);
              }
            }}
            style={[styles.chip, active && styles.active]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -spacing.lg,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  active: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    ...type.caption,
    color: colors.textMuted,
  },
  activeLabel: {
    color: colors.text,
  },
});
