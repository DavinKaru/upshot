import * as Haptics from 'expo-haptics';

/** A light tick, for scrubbing across chart points and changing a selection. */
export function tick(): void {
  void Haptics.selectionAsync();
}

/** A soft tap, for pressing a row or button that navigates or drills in. */
export function tap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
