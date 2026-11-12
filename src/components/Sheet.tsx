import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

interface SheetProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The lighter panel that rises over a screen's dark header, with rounded top corners. It runs
 * edge to edge and fills the rest of the screen, so lists inside it are full width.
 */
export function Sheet({ children, style }: SheetProps) {
  return <View style={[styles.sheet, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  sheet: {
    flexGrow: 1,
    // Break out of the screen's side padding so the sheet runs edge to edge.
    marginHorizontal: -spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingBottom: spacing.xxxl * 2,
  },
});
