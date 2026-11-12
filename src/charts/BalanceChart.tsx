import { Canvas, Circle, Group, Line, rect, vec } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Money } from '@/components/Money';
import type { BalancePoint } from '@/insights/balanceHistory';
import { formatLongDate, parseDayKey } from '@/insights/dates';
import { tick } from '@/lib/haptics';
import { formatMoney, formatMoneyRounded } from '@/lib/money';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { buildLineChart, nearestIndex } from './geometry';
import { DotGrid, ParticleField } from './ParticleField';
import { DEFAULT_BAND, particlesUnderLine } from './particles';

interface BalanceChartProps {
  points: readonly BalancePoint[];
  height?: number;
  /** Called with `true` from the moment a finger lands on the chart until it lifts. */
  onScrubbingChange?: (scrubbing: boolean) => void;
}

/** Room above the line for the scrub handle. */
const TOP = 26;

/**
 * A Saver's balance over time, drawn as particles packed under an invisible line. Drag across
 * it to read the balance on any day, with a haptic tick as you pass each point.
 */
export function BalanceChart({ points, height = 280, onScrubbingChange }: BalanceChartProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const geometry = useMemo(
    () =>
      buildLineChart(
        points.map((p) => p.balance),
        width,
        height,
        // Leave the lower part of the chart for the particles to fall away into.
        { top: TOP, bottom: height * 0.3, left: 0, right: 0 },
      ),
    [points, width, height],
  );
  const particles = useMemo(
    () => particlesUnderLine(geometry.xs, geometry.ys, height, DEFAULT_BAND),
    [geometry, height],
  );

  // Reveal the particles from the left, rising slightly, whenever the data changes.
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.chart, easing: Easing.out(Easing.cubic) });
  }, [particles, progress, reduceMotion]);
  const clip = useDerivedValue(() => rect(0, 0, width * progress.value + 8, height));
  const rise = useDerivedValue(() => [{ translateY: (1 - progress.value) * 14 }]);

  const cursor = useSharedValue(-1);
  const cursorOpacity = useSharedValue(0);
  const { xs } = geometry;
  const cursorX = useDerivedValue(() => xs[cursor.value] ?? 0);
  const lineStart = useDerivedValue(() => vec(cursorX.value, TOP / 2));
  const lineEnd = useDerivedValue(() => vec(cursorX.value, height));

  const onIndexChange = useCallback((index: number) => {
    setActiveIndex(index < 0 ? null : index);
    if (index >= 0) tick();
  }, []);
  const onScrubbing = useCallback(
    (scrubbing: boolean) => onScrubbingChange?.(scrubbing),
    [onScrubbingChange],
  );

  const pan = usePanGesture({
    // Horizontal drags scrub; vertical drags are left for the page to scroll.
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onBegin: (event) => {
      'worklet';
      const index = nearestIndex(xs, event.x);
      cursor.value = index;
      cursorOpacity.value = withTiming(1, { duration: motion.fast });
      scheduleOnRN(onIndexChange, index);
      scheduleOnRN(onScrubbing, true);
    },
    onUpdate: (event) => {
      'worklet';
      const index = nearestIndex(xs, event.x);
      if (index !== cursor.value) {
        cursor.value = index;
        scheduleOnRN(onIndexChange, index);
      }
    },
    onFinalize: () => {
      'worklet';
      cursorOpacity.value = withTiming(0, { duration: motion.fast }, (finished) => {
        if (finished) cursor.value = -1;
      });
      scheduleOnRN(onIndexChange, -1);
      scheduleOnRN(onScrubbing, false);
    },
  });

  const latest = points[points.length - 1];
  const first = points[0];
  const shown = activeIndex !== null ? points[activeIndex] : latest;
  const change = latest && first ? latest.balance - first.balance : 0;
  const values = points.map((p) => p.balance);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View>
      <View style={styles.header}>
        <Money cents={shown?.balance ?? 0} size="large" color={colors.accent} />
        <Text style={styles.caption}>
          {activeIndex !== null && shown
            ? formatLongDate(parseDayKey(shown.day))
            : `${change >= 0 ? 'Up' : 'Down'} ${formatMoney(Math.abs(change))} in this period`}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={{ height }}
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            latest && first
              ? `Balance chart. ${formatMoney(first.balance)} on ${formatLongDate(parseDayKey(first.day))}, ${formatMoney(latest.balance)} today.`
              : 'Balance chart'
          }
        >
          {width > 0 ? (
            <Canvas style={StyleSheet.absoluteFill}>
              <DotGrid
                width={width}
                height={height - 1}
                rows={3}
                columns={5}
                color={colors.border}
              />
              <Group clip={clip} transform={rise}>
                <ParticleField particles={particles} color={colors.accent} />
              </Group>
              <Group opacity={cursorOpacity}>
                <Line
                  p1={lineStart}
                  p2={lineEnd}
                  color="rgba(246, 243, 238, 0.7)"
                  strokeWidth={1.5}
                />
                <Circle cx={cursorX} cy={TOP / 2} r={5.5} color={colors.text} />
              </Group>
            </Canvas>
          ) : null}
          <Text style={[styles.axis, styles.axisTop]}>{formatMoneyRounded(max)}</Text>
          <Text style={[styles.axis, styles.axisBottom]}>{formatMoneyRounded(min)}</Text>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  caption: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  axis: {
    ...type.caption,
    position: 'absolute',
    right: 0,
    color: colors.textFaint,
    fontSize: 11,
  },
  axisTop: {
    top: TOP - 6,
  },
  axisBottom: {
    bottom: spacing.xs,
  },
});
