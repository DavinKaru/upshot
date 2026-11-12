import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

/** Tells people the numbers on screen are made up. Shown until a real Up account is connected. */
export function DemoBanner() {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Feather name="eye" size={16} color={colors.amber} />
      <Text style={styles.text}>Demo mode. Everything here is made up, so explore freely.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 193, 94, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  text: {
    ...type.caption,
    color: colors.amber,
    flex: 1,
  },
});
