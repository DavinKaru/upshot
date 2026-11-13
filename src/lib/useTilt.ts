import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

/** Loose and wobbly, so a quick tilt overshoots and settles like liquid. */
const SLOSH_SPRING = { damping: 7, stiffness: 110, mass: 1 };
/** Changes smaller than this, in g, are hand tremor; ignoring them lets the chart rest. */
const DEAD_BAND = 0.02;

/**
 * How far the phone is tilted sideways, as the share of gravity along its width: 0 held level,
 * towards 1 with the right side down and -1 with the left side down. Sprung, so it sloshes.
 *
 * Only listens while `enabled`, so the sensor is off when the screen isn't showing. Nothing is
 * stored or sent anywhere, and on devices without an accelerometer it stays at 0.
 */
export function useTilt(enabled: boolean): SharedValue<number> {
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;
    let last = 0;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(1000 / 30);
        subscription = Accelerometer.addListener(({ x }) => {
          // iOS reports gravity itself; Android reports the force holding the phone up, which
          // points the other way.
          const g = Math.max(-1, Math.min(1, Platform.OS === 'android' ? -x : x));
          if (Math.abs(g - last) < DEAD_BAND) return;
          last = g;
          tilt.value = withSpring(g, SLOSH_SPRING);
        });
      })
      .catch(() => {
        // No sensor, no slosh.
      });

    return () => {
      cancelled = true;
      subscription?.remove();
      tilt.value = withSpring(0, SLOSH_SPRING);
    };
  }, [enabled, tilt]);

  return tilt;
}
