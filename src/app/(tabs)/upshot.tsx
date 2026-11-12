import Feather from '@expo/vector-icons/Feather';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { ListRow } from '@/components/ListRow';
import { ListSection } from '@/components/ListSection';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { colors, radii, spacing, type } from '@/theme/tokens';

const REPO = 'https://github.com/DavinKaru/upshot';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function RowIcon({ name }: { name: FeatherName }) {
  return <Feather name={name} size={22} color={colors.text} />;
}

/** Upshot's own page: the app, your connection to Up, and everything about the project. */
export default function UpshotScreen() {
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen>
      {/* Up's API has no profile picture or $handle, so this is about Upshot, not you. */}
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Feather name="trending-up" size={34} color={colors.accent} />
        </View>
        <Text style={styles.name}>Upshot</Text>
        <Text style={styles.tagline}>Insights for your Up account</Text>
      </View>

      <Sheet>
        <ListSection title="Your Up account">
          <ListRow
            title="Connect your Up account"
            subtitle="Coming soon. Upshot is showing demo data for now."
            leading={<RowIcon name="link" />}
            separator={false}
          />
        </ListSection>

        <ListSection title="About">
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
            separator={false}
          />
        </ListSection>

        <Text style={styles.disclaimer}>
          Upshot is an independent project. It isn&apos;t affiliated with, endorsed by or supported
          by Up or Bendigo and Adelaide Bank.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...type.title,
    color: colors.text,
    marginTop: spacing.lg,
  },
  tagline: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  value: {
    ...type.body,
    color: colors.textMuted,
  },
  disclaimer: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
