import { StyleSheet, Text, View } from 'react-native';

// Placeholder until the navigation shell and design tokens land.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upshot</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '600',
  },
});
