import { Canvas, Group } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme/tokens';

import { donutSegments, segmentAt } from './geometry';
import { ParticleField } from './ParticleField';
import { DEFAULT_BAND, particlesInRing, type BandOptions } from './particles';

export interface DonutItem {
  id: string;
  value: number;
  color: string;
}

interface CategoryDonutProps {
  items: readonly DonutItem[];
  size?: number;
  onSelect?: (id: string) => void;
  /** Shown in the middle, usually the total. */
  children?: React.ReactNode;
  accessibilityLabel: string;
}

const RING_BAND: BandOptions = { ...DEFAULT_BAND, capWidth: 12, falloffWidth: 36, spacing: 3 };

/**
 * A ring of particles split by category, dense at the outer edge and thinning towards the
 * middle. It settles in whenever its items change, and tapping a segment calls `onSelect`.
 */
export function CategoryDonut({
  items,
  size = 260,
  onSelect,
  children,
  accessibilityLabel,
}: CategoryDonutProps) {
  const reduceMotion = useReducedMotion();
  const center = size / 2;
  const outer = center - 4;
  const segments = useMemo(
    () =>
      donutSegments(
        items.map((i) => i.value),
        5,
      ),
    [items],
  );
  const rings = useMemo(
    () => particlesInRing(segments, center, center, outer, RING_BAND),
    [segments, center, outer],
  );

  // Fade in while turning gently into place.
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.chart, easing: Easing.out(Easing.cubic) });
  }, [rings, progress, reduceMotion]);
  const opacity = useDerivedValue(() => progress.value);
  const transform = useDerivedValue(() => [
    { rotate: (1 - progress.value) * -0.35 },
    { scale: 0.94 + 0.06 * progress.value },
  ]);

  const select = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) onSelect?.(item.id);
    },
    [items, onSelect],
  );

  const tap = useTapGesture({
    onActivate: (event) => {
      'worklet';
      const index = segmentAt(
        segments,
        event.x,
        event.y,
        center,
        center,
        outer - RING_BAND.capWidth - RING_BAND.falloffWidth,
        outer + 8,
      );
      if (index >= 0) scheduleOnRN(select, index);
    },
  });

  return (
    <GestureDetector gesture={tap}>
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Group opacity={opacity} transform={transform} origin={{ x: center, y: center }}>
            {items.map((item, i) => (
              <ParticleField key={item.id} particles={rings[i] ?? []} color={item.color} />
            ))}
          </Group>
        </Canvas>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
