import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Path,
  rect,
  vec,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Money } from '@/components/Money';
import { formatMonth, formatShortDate, previousMonth } from '@/insights/dates';
import type { SpendingPace } from '@/insights/spendingPace';
import { tick } from '@/lib/haptics';
import { formatMoney, formatMoneyRounded } from '@/lib/money';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { buildPaceChart, nearestIndex } from './geometry';
import { TouchParticleField } from './ParticleField';
import { DEFAULT_BAND, particlesUnderLine } from './particles';

interface PaceChartProps {
  pace: SpendingPace;
  /** Any moment in the month being shown, usually now. */
  month: Date;
  height?: number;
  /** Called with `true` from the moment a finger lands on the chart until it lifts. */
  onScrubbingChange?: (scrubbing: boolean) => void;
}

/** Room above the lines for the scrub handle. */
const TOP = 26;
const TOUCH_IN = { damping: 30, stiffness: 1000 };
const TOUCH_OUT = { damping: 18, stiffness: 480 };

/**
 * This month's spending as it has built up day by day, in particles, over a faint line of last
 * month's. The headline says whether you're ahead of or behind last month at the same point.
 * Drag across it to compare any day so far.
 */
export function PaceChart({ pace, month, height = 210, onScrubbingChange }: PaceChartProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const lastMonthName = formatMonth(previousMonth(month));

  const geometry = useMemo(
    () =>
      buildPaceChart(pace.thisMonth, pace.lastMonth, pace.daysInMonth, width, height, {
        top: TOP,
        bottom: height * 0.14,
        left: 0,
        right: 0,
      }),
    [pace, width, height],
  );
  const particles = useMemo(
    () => particlesUnderLine(geometry.xs, geometry.ys, height, DEFAULT_BAND),
    [geometry, height],
  );

  // Reveal this month from the left, rising slightly, whenever the data changes.
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
  const touchX = useSharedValue(-1000);
  const touchY = useSharedValue(-1000);
  const touchStrength = useSharedValue(0);
  const { xs, ys, refYs } = geometry;
  const cursorX = useDerivedValue(() => xs[cursor.value] ?? 0);
  const cursorY = useDerivedValue(() => ys[cursor.value] ?? 0);
  const cursorRefY = useDerivedValue(() => refYs[cursor.value] ?? -100);
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
      // Only days so far can be scrubbed; past today, the cursor stays on today.
      const index = nearestIndex(xs, event.x);
      cursor.value = index;
      cursorOpacity.value = withTiming(1, { duration: motion.fast });
      touchX.value = event.x;
      touchY.value = event.y;
      touchStrength.value = reduceMotion ? 0 : withSpring(1, TOUCH_IN);
      scheduleOnRN(onIndexChange, index);
      scheduleOnRN(onScrubbing, true);
    },
    onUpdate: (event) => {
      'worklet';
      touchX.value = event.x;
      touchY.value = event.y;
      const index = nearestIndex(xs, event.x);
      if (index !== cursor.value) {
        cursor.value = index;
        scheduleOnRN(onIndexChange, index);
      }
    },
    onFinalize: () => {
      'worklet';
      touchStrength.value = withSpring(0, TOUCH_OUT);
      cursorOpacity.value = withTiming(0, { duration: motion.fast }, (finished) => {
        if (finished) cursor.value = -1;
      });
      scheduleOnRN(onIndexChange, -1);
      scheduleOnRN(onScrubbing, false);
    },
  });

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const lastMonthTotal = pace.lastMonth[pace.lastMonth.length - 1] ?? 0;
  const refEndY = refYs[refYs.length - 1] ?? TOP;
  const difference = pace.total - pace.lastMonthSoFar;

  let headline = pace.total;
  let caption: ReactNode;
  if (activeIndex !== null) {
    const day = new Date(month.getFullYear(), month.getMonth(), activeIndex + 1);
    headline = pace.thisMonth[activeIndex] ?? 0;
    const then = pace.lastMonth[Math.min(activeIndex, pace.lastMonth.length - 1)] ?? 0;
    caption = `By ${formatShortDate(day)} · ${lastMonthName} was ${formatMoney(then)}`;
  } else if (difference === 0) {
    caption = `The same as by this time in ${lastMonthName}`;
  } else {
    const less = difference < 0;
    caption = (
      <>
        <Text style={{ color: less ? colors.positive : colors.negative }}>
          {formatMoney(Math.abs(difference))} {less ? 'less' : 'more'}
        </Text>{' '}
        than by this time in {lastMonthName}
      </>
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <Money cents={headline} size="large" />
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.chart, { height }]}
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Spending this month: ${formatMoney(pace.total)} so far, against ${formatMoney(pace.lastMonthSoFar)} by this time in ${lastMonthName}. ${lastMonthName} came to ${formatMoney(lastMonthTotal)} in all.`}
        >
          {width > 0 ? (
            <Canvas style={StyleSheet.absoluteFill}>
              {/* $0, the floor of the chart. */}
              <Line
                p1={vec(0, geometry.zeroY)}
                p2={vec(width, geometry.zeroY)}
                color={colors.border}
                strokeWidth={1}
              >
                <DashPathEffect intervals={[4, 5]} />
              </Line>
              {/* Last month, as a faint line to measure against. */}
              <Path
                path={geometry.reference}
                style="stroke"
                strokeWidth={1.5}
                strokeCap="round"
                color={colors.textFaint}
                opacity={0.7}
              />
              <Group clip={clip} transform={rise}>
                <TouchParticleField
                  particles={particles}
                  color={colors.accent}
                  touchX={touchX}
                  touchY={touchY}
                  strength={touchStrength}
                />
              </Group>
              <Group opacity={cursorOpacity}>
                <Line
                  p1={lineStart}
                  p2={lineEnd}
                  color="rgba(246, 243, 238, 0.7)"
                  strokeWidth={1.5}
                />
                <Circle cx={cursorX} cy={cursorRefY} r={3.5} color={colors.textMuted} />
                <Circle cx={cursorX} cy={cursorY} r={4.5} color={colors.text} />
              </Group>
            </Canvas>
          ) : null}
          <Text style={[styles.axis, { top: Math.max(refEndY - 20, 0) }]}>
            {lastMonthName} {formatMoneyRounded(lastMonthTotal)}
          </Text>
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
  chart: {
    // Edge to edge, past the screen's side padding.
    marginHorizontal: -spacing.lg,
  },
  axis: {
    ...type.caption,
    position: 'absolute',
    right: spacing.lg,
    color: colors.textFaint,
    fontSize: 11,
  },
});
