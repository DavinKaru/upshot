import Feather from '@expo/vector-icons/Feather';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radii, spacing, type } from '@/theme/tokens';

const REPO = 'https://github.com/DavinKaru/upshot';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function RowIcon({ name }: { name: FeatherName }) {
  return (
    <View style={styles.icon}>
      <Feather name={name} size={18} color={colors.textMuted} />
    </View>
  );
}

export default function SettingsScreen() {
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen>
      <SectionHeader title="Your Up account" />
      <Card style={styles.listCard}>
        <ListRow
          title="Connect your Up account"
          subtitle="Coming soon. Upshot is showing demo data for now."
          leading={<RowIcon name="link" />}
        />
      </Card>

      <SectionHeader title="About" />
      <Card style={styles.listCard}>
        <ListRow
          title="Version"
          leading={<RowIcon name="info" />}
          trailing={<Text style={styles.value}>{version}</Text>}
        />
        <ListRow
          title="Source code"
          subtitle="Free and open source under the GPL"
          leading={<RowIcon name="github" />}
          onPress={() => void Linking.openURL(REPO)}
          showChevron
        />
        <ListRow
          title="Privacy"
          subtitle="No Upshot server. Your data stays on your phone."
          leading={<RowIcon name="shield" />}
          onPress={() => void Linking.openURL(`${REPO}/blob/main/PRIVACY.md`)}
          showChevron
        />
      </Card>

      <Text style={styles.disclaimer}>
        Upshot is an independent project. It isn&apos;t affiliated with, endorsed by or supported by
        Up or Bendigo and Adelaide Bank.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.body,
    color: colors.textMuted,
  },
  disclaimer: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
  },
});
