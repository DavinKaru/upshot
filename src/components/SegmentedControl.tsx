import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tick } from '@/lib/haptics';
import { colors, spacing, type } from '@/theme/tokens';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** A row of plain text choices, such as a chart's time range. The chosen one is brightest. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.option}
            hitSlop={8}
            onPress={() => {
              if (!selected) {
                tick();
                onChange(option.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.selected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  option: {
    paddingVertical: spacing.xs,
  },
  label: {
    ...type.bodyStrong,
    color: colors.textFaint,
  },
  selected: {
    color: colors.text,
  },
});
