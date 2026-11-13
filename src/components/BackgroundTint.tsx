import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TINT_STRENGTH } from '@/theme/color';
import { motion } from '@/theme/tokens';

interface TintState {
  color: string | null;
  setColor: (color: string | null) => void;
}

const TintContext = createContext<TintState>({ color: null, setColor: () => {} });

/** Holds the colour the app's background is tinted with, if any. Wrap the tabs in it. */
export function BackgroundTintProvider({ children }: { children: ReactNode }) {
  const [color, setColor] = useState<string | null>(null);
  return <TintContext value={{ color, setColor }}>{children}</TintContext>;
}

/** Tints the app's background with `color` while it's set, and clears it on unmount. */
export function useBackgroundTint(color: string | null) {
  const { setColor } = useContext(TintContext);
  useEffect(() => {
    setColor(color);
    return () => setColor(null);
  }, [color, setColor]);
}

const FADE = { duration: motion.chart };

/**
 * A faint wash of the current tint colour. Put it first inside anything with a background of its
 * own (the top bar, a screen, a sheet), so the whole background shifts together.
 */
export function BackgroundTint() {
  const { color } = useContext(TintContext);
  const reduceMotion = useReducedMotion();
  // Keep the last colour while fading out, so it doesn't drop to nothing mid-fade.
  const [shown, setShown] = useState(color);
  if (color && color !== shown) setShown(color);

  const strength = useSharedValue(color ? 1 : 0);
  useEffect(() => {
    const target = color ? 1 : 0;
    strength.value = reduceMotion ? target : withTiming(target, FADE);
  }, [color, strength, reduceMotion]);
  const fade = useAnimatedStyle(() => ({ opacity: strength.value * TINT_STRENGTH }));

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: shown }, fade]}
    />
  );
}
