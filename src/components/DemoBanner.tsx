import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

/** A small marker that the numbers on screen are made up. Shown until Up is connected. */
export function DemoBanner() {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Feather name="eye" size={13} color={colors.amber} />
      <Text style={styles.text}>Demo mode · made-up data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs + 2,
    backgroundColor: 'rgba(255, 193, 94, 0.12)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  text: {
    ...type.caption,
    color: colors.amber,
    fontWeight: '500',
  },
});
