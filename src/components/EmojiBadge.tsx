import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** A round badge showing an emoji, used for Savers named with one. */
export function EmojiBadge({ emoji, size = 40 }: { emoji: string; size?: number }) {
  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
});
