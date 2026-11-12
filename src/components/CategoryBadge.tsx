import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { colors, type CategoryColorKey } from '@/theme/tokens';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const ICONS: Record<CategoryColorKey, FeatherName> = {
  'good-life': 'coffee',
  home: 'home',
  personal: 'user',
  transport: 'navigation',
  uncategorised: 'circle',
};

/** Maps any category ID to the colour key of its parent, falling back to uncategorised. */
export function categoryColorKey(parentId: string | null | undefined): CategoryColorKey {
  return parentId && parentId in colors.category ? (parentId as CategoryColorKey) : 'uncategorised';
}

interface CategoryBadgeProps {
  /** The parent category ID, for example "good-life". */
  parentId: string | null | undefined;
  size?: number;
  /** Override the icon, for rows that aren't purchases (transfers, income). */
  icon?: FeatherName;
}

/** A round, tinted icon that marks a transaction's parent category. */
export function CategoryBadge({ parentId, size = 40, icon }: CategoryBadgeProps) {
  const key = categoryColorKey(parentId);
  const tint = colors.category[key];
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}26` },
      ]}
    >
      <Feather name={icon ?? ICONS[key]} size={size * 0.45} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
