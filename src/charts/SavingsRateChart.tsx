import { Canvas, DashPathEffect, Group, Line, rect, vec } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { formatMonth, formatShortMonth, parseMonthKey } from '@/insights/dates';
import type { MonthFlow, SavingsRate } from '@/insights/savingsRate';
import { tick } from '@/lib/haptics';
import { formatMoneyRounded } from '@/lib/money';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { barAt, buildBarChart } from './geometry';
import { ParticleField } from './ParticleField';
import { DEFAULT_BAND, particlesInBar, type Particle } from './particles';

interface SavingsRateChartProps {
  rate: SavingsRate;
  height?: number;
  /** Called with `true` from the moment a finger lands on the chart until it lifts. */
  onScrubbingChange?: (scrubbing: boolean) => void;
}

const TOP = 14;
const BOTTOM = 6;
/** Room on the right for the average's label. */
const LABEL_WIDTH = 40;
/** How far the months you're not looking at fade back. */
const DIMMED = 0.28;

/** "29%", or "-9%" when more went out than came in. */
export function formatRate(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

/** What a month's bar says, for the caption and screen readers. */
function describeMonth(month: MonthFlow): string {
  const name = formatMonth(parseMonthKey(month.month));
  if (month.moneyIn === 0) return `Nothing came in during ${name}`;
  if (month.kept < 0) {
    return `${name}: ${formatMoneyRounded(-month.kept)} more went out than came in`;
  }
  return `${name}: kept ${formatMoneyRounded(month.kept)} of ${formatMoneyRounded(month.moneyIn)}`;
}

/**
 * How much of what came in you kept, month by month, as particle bars against your average.
 * The headline is the average; tap or drag across a month to read it, and tap it again to go
 * back to the average.
 */
export function SavingsRateChart({ rate, height = 190, onScrubbingChange }: SavingsRateChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const { months, average } = rate;

  const geometry = useMemo(
    () =>
      buildBarChart(
        months.map((m) => m.rate),
        width,
        height,
        { top: TOP, bottom: BOTTOM, left: 0, right: LABEL_WIDTH },
        average,
      ),
    [months, average, width, height],
  );
  const bars = useMemo(
    () =>
      geometry.bars.map((bar, i) =>
        particlesInBar(bar.x0, bar.x1, bar.y, geometry.zeroY, {
          ...DEFAULT_BAND,
          spacing: 3.8,
          scatter: 8,
          // A bar is only a few beads wide, so one cluster of big beads would swamp it.
          clusterChance: 0.01,
          seed: 7 + i,
        }),
      ),
    [geometry],
  );

  // Bars grow out of the zero line, up or down, whenever the data changes.
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.chart, easing: Easing.out(Easing.cubic) });
  }, [bars, progress, reduceMotion]);
  const { zeroY } = geometry;
  const labelsClash = geometry.referenceY !== null && Math.abs(geometry.referenceY - zeroY) < 14;
  const clip = useDerivedValue(() =>
    rect(0, zeroY * (1 - progress.value), width, height * progress.value),
  );

  const active = useSharedValue(-1);
  const slots = geometry.bars;

  const onSelect = useCallback((index: number) => {
    setSelected(index < 0 ? null : index);
    tick();
  }, []);
  const onScrubbing = useCallback(
    (scrubbing: boolean) => onScrubbingChange?.(scrubbing),
    [onScrubbingChange],
  );

  const pan = usePanGesture({
    // Sideways drags move between months; up and down is left for the page to scroll.
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onBegin: () => {
      'worklet';
      scheduleOnRN(onScrubbing, true);
    },
    onUpdate: (event) => {
      'worklet';
      const index = barAt(slots, event.x);
      if (index !== active.value) {
        active.value = index;
        scheduleOnRN(onSelect, index);
      }
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(onScrubbing, false);
    },
  });
  const tap = useTapGesture({
    onActivate: (event) => {
      'worklet';
      const index = barAt(slots, event.x);
      // Tapping the month you're on goes back to the average.
      const next = index === active.value ? -1 : index;
      active.value = next;
      scheduleOnRN(onSelect, next);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const month = selected !== null ? months[selected] : undefined;
  const shownRate = month ? month.rate : average;
  const first = months[0];
  const last = months[months.length - 1];
  const caption = month
    ? describeMonth(month)
    : first && last
      ? `Kept of what came in, ${formatShortMonth(parseMonthKey(first.month))} to ${formatShortMonth(parseMonthKey(last.month))}`
      : 'Kept of what came in';

  return (
    <View>
      <View style={styles.header}>
        <Text
          style={[styles.rate, (shownRate ?? 0) < 0 && { color: colors.negative }]}
          accessibilityLiveRegion="polite"
        >
          {formatRate(shownRate)}
        </Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={{ height }}
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Savings rate by month. Average ${formatRate(average)}. ${months
            .map((m) => `${describeMonth(m)}, ${formatRate(m.rate)}`)
            .join('. ')}.`}
        >
          {width > 0 ? (
            <Canvas style={StyleSheet.absoluteFill}>
              {/* Break even: above it you kept money, below it more went out than came in. */}
              <Line
                p1={vec(0, zeroY)}
                p2={vec(width - LABEL_WIDTH + 4, zeroY)}
                color={colors.textMuted}
                strokeWidth={1}
              />
              <Group clip={clip}>
                {bars.map((particles, i) => (
                  <Bar
                    key={months[i]?.month ?? i}
                    index={i}
                    active={active}
                    particles={particles}
                    color={(months[i]?.kept ?? 0) < 0 ? colors.textMuted : colors.accent}
                  />
                ))}
              </Group>
              {geometry.referenceY !== null ? (
                <Line
                  p1={vec(0, geometry.referenceY)}
                  p2={vec(width - LABEL_WIDTH + 4, geometry.referenceY)}
                  color={colors.textFaint}
                  opacity={0.6}
                  strokeWidth={1}
                >
                  {/* The average is a guide, so it stays quieter than the break-even line. */}
                  <DashPathEffect intervals={[2, 4]} />
                </Line>
              ) : null}
            </Canvas>
          ) : null}
          {geometry.referenceY !== null ? (
            <Text style={[styles.lineLabel, styles.averageLabel, { top: geometry.referenceY - 8 }]}>
              Avg
            </Text>
          ) : null}
          <Text
            style={[
              styles.lineLabel,
              // Tuck under the line if the average sits right on top of it.
              { top: zeroY - (labelsClash ? -2 : 8) },
            ]}
          >
            0%
          </Text>
        </View>
      </GestureDetector>
      <View style={styles.months}>
        {months.map((m, i) => (
          <Text
            key={m.month}
            style={[
              styles.month,
              { left: (slots[i]?.cx ?? 0) - 20 },
              selected === i && styles.monthSelected,
            ]}
          >
            {formatShortMonth(parseMonthKey(m.month))}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** One month's bar, faded back while another month is chosen. */
function Bar({
  index,
  active,
  particles,
  color,
}: {
  index: number;
  active: SharedValue<number>;
  particles: readonly Particle[];
  color: string;
}) {
  const opacity = useDerivedValue(() => (active.value < 0 || active.value === index ? 1 : DIMMED));
  return (
    <Group opacity={opacity}>
      <ParticleField particles={particles} color={color} />
    </Group>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rate: {
    ...type.moneyLarge,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  lineLabel: {
    ...type.caption,
    position: 'absolute',
    right: 0,
    width: LABEL_WIDTH - 8,
    color: colors.textMuted,
    fontSize: 11,
  },
  averageLabel: {
    color: colors.textFaint,
  },
  months: {
    height: 20,
    marginTop: spacing.sm,
  },
  month: {
    ...type.caption,
    position: 'absolute',
    width: 40,
    textAlign: 'center',
    color: colors.textFaint,
  },
  monthSelected: {
    color: colors.text,
    fontWeight: '600',
  },
});
