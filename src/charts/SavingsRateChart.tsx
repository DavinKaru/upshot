import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  Path,
  rect,
  usePathValue,
  vec,
} from '@shopify/react-native-skia';
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
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { formatMonth, formatShortMonth, parseMonthKey } from '@/insights/dates';
import type { MonthFlow, SavingsRate } from '@/insights/savingsRate';
import { tick } from '@/lib/haptics';
import { formatMoneyRounded } from '@/lib/money';
import { useTilt } from '@/lib/useTilt';
import { colors, motion, spacing, type } from '@/theme/tokens';

import { barLayers, sloshX, sloshY, sunkRadius, type BarLayer } from './drain';
import { barAt, buildBarChart, type BarSlot } from './geometry';
import { ALPHA_LEVELS, DEFAULT_BAND, type BandOptions } from './particles';

interface SavingsRateChartProps {
  rate: SavingsRate;
  height?: number;
  /** Called with `true` from the moment a finger lands on the chart until it lifts. */
  onScrubbingChange?: (scrubbing: boolean) => void;
  /**
   * Whether the chart is on screen. The months drain each time it comes into view, and the
   * particles only slosh with the phone's tilt while it's showing.
   */
  visible?: boolean;
}

const TOP = 14;
const BOTTOM = 6;
/** Room on the right for the average's label. */
const LABEL_WIDTH = 40;
/** How far the months you're not looking at fade back. */
const DIMMED = 0.28;
/** How long a month's column takes to sink to what was kept. */
const DRAIN_MS = 1300;
/** A month where more went out than came in shows its grey bar once its column is this far gone. */
const NEGATIVE_FROM = 0.7;
/** Months drain one after another on first showing, this far apart. */
const DRAIN_STAGGER = 110;

const barBand = (seed: number): BandOptions => ({
  ...DEFAULT_BAND,
  spacing: 3.8,
  scatter: 8,
  // A bar is only a few beads wide, so one cluster of big beads would swamp it.
  clusterChance: 0.01,
  seed,
});

interface MonthBar {
  slot: BarSlot;
  /** A full column of everything that came in, from zero up to 100%, which sinks as it drains. */
  column: BarLayer[];
  /** How far the column sinks: from 100% down to what was kept, or all the way to zero. */
  drop: number;
  /** The grey bar below zero, when more went out than came in. Empty otherwise. */
  overspent: BarLayer[];
}

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
 *
 * Each month starts as a full column of everything that came in, then sinks as one bar until
 * it rests at what was kept. The headline is the average; tap a month to read it (and watch
 * it drain again), drag across to compare, and tap it again to go back to the average. Tilt the
 * phone and the particles slosh.
 */
export function SavingsRateChart({
  rate,
  height = 230,
  onScrubbingChange,
  visible = true,
}: SavingsRateChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  // How many times each month has been tapped, to drain it again.
  const [replays, setReplays] = useState<Record<number, number>>({});
  // The month last tapped, which drains on its own straight away.
  const [tapped, setTapped] = useState<number | null>(null);
  // How many times the chart has come into view; the months drain again each time.
  const [visits, setVisits] = useState(0);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setVisits((v) => v + 1);
      setTapped(null);
    }
  }
  const reduceMotion = useReducedMotion();
  const tilt = useTilt(visible && !reduceMotion);
  const { months, average } = rate;

  const geometry = useMemo(
    () =>
      buildBarChart(
        months.map((m) => m.rate),
        width,
        height,
        { top: TOP, bottom: BOTTOM, left: 0, right: LABEL_WIDTH },
        // Room for a full column: everything that came in.
        { reference: average, include: [1] },
      ),
    [months, average, width, height],
  );
  const bars: MonthBar[] = useMemo(
    () =>
      geometry.bars.map((slot, i) => {
        const month = months[i];
        const { zeroY } = geometry;
        const negative = (month?.kept ?? 0) < 0;
        const cameIn = (month?.moneyIn ?? 0) > 0;
        const topY = geometry.y(1);
        return {
          slot,
          column: cameIn ? barLayers(slot.x0, slot.x1, topY, zeroY, barBand(101 + i)) : [],
          drop: (negative ? zeroY : slot.y) - topY,
          overspent: negative ? barLayers(slot.x0, slot.x1, slot.y, zeroY, barBand(7 + i)) : [],
        };
      }),
    [geometry, months],
  );

  // Columns grow out of the zero line the first time they're seen, and whenever the data
  // changes after that.
  const progress = useSharedValue(0);
  const seen = visits > 0;
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    if (!seen) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.chart, easing: Easing.out(Easing.cubic) });
  }, [bars, seen, progress, reduceMotion]);
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
  const onTap = useCallback(
    (index: number) => {
      onSelect(index);
      // Tapping a month plays its drain again.
      if (index < 0) return;
      setTapped(index);
      setReplays((r) => ({ ...r, [index]: (r[index] ?? 0) + 1 }));
    },
    [onSelect],
  );
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
      scheduleOnRN(onTap, next);
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
                {bars.map((bar, i) => (
                  <Bar
                    key={months[i]?.month ?? i}
                    index={i}
                    bar={bar}
                    zeroY={zeroY}
                    active={active}
                    tilt={tilt}
                    ready={seen}
                    trigger={`${visits}:${replays[i] ?? 0}`}
                    delay={
                      tapped === i
                        ? 80
                        : (visits > 1 ? 250 : motion.chart * 0.7) + i * DRAIN_STAGGER
                    }
                    reduceMotion={reduceMotion}
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

interface BarProps {
  index: number;
  bar: MonthBar;
  zeroY: number;
  /** The chosen month, or -1. */
  active: SharedValue<number>;
  tilt: SharedValue<number>;
  /** False until the chart has been on screen, so the columns wait, full, to be seen. */
  ready: boolean;
  /** Changes whenever the month should drain again: the chart coming into view, or a tap. */
  trigger: string;
  /** How long to wait before draining. */
  delay: number;
  reduceMotion: boolean;
}

/**
 * One month: a full column that sinks to what was kept, faded back while another month is
 * chosen. A month where more went out than came in sinks away completely, and its grey bar
 * below zero appears as the last of it goes.
 */
function Bar({ index, bar, zeroY, active, tilt, ready, trigger, delay, reduceMotion }: BarProps) {
  const drain = useSharedValue(reduceMotion ? 1 : 0);
  const { column, drop, overspent, slot } = bar;

  useEffect(() => {
    if (reduceMotion) {
      drain.value = 1;
      return;
    }
    drain.value = 0;
    if (!ready) return;
    drain.value = withDelay(
      delay,
      withTiming(1, { duration: DRAIN_MS, easing: Easing.inOut(Easing.cubic) }),
    );
    // `delay` is left out on purpose: it changes with the tap that also changes `trigger`, and
    // a new delay alone shouldn't drain the month again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trigger, column, reduceMotion, drain]);

  const opacity = useDerivedValue(() => (active.value < 0 || active.value === index ? 1 : DIMMED));
  const overspentOpacity = useDerivedValue(() =>
    Math.min(Math.max((drain.value - NEGATIVE_FROM) / (1 - NEGATIVE_FROM), 0), 1),
  );

  return (
    <Group opacity={opacity}>
      {column.map((layer, level) =>
        layer.xs.length > 0 ? (
          <ColumnLayer
            key={`column-${level}`}
            layer={layer}
            slot={slot}
            zeroY={zeroY}
            drop={drop}
            drain={drain}
            tilt={tilt}
            opacity={ALPHA_LEVELS[level] ?? 1}
          />
        ) : null,
      )}
      {overspent.length > 0 ? (
        <Group opacity={overspentOpacity}>
          {overspent.map((layer, level) =>
            layer.xs.length > 0 ? (
              <OverspentLayer
                key={`overspent-${level}`}
                layer={layer}
                slot={slot}
                zeroY={zeroY}
                tilt={tilt}
                opacity={ALPHA_LEVELS[level] ?? 1}
              />
            ) : null,
          )}
        </Group>
      ) : null}
    </Group>
  );
}

interface LayerProps {
  slot: BarSlot;
  zeroY: number;
  tilt: SharedValue<number>;
  opacity: number;
}

/** The grey bar below zero at one opacity level, sloshing as the phone tilts. */
function OverspentLayer({ layer, slot, zeroY, tilt, opacity }: LayerProps & { layer: BarLayer }) {
  const { xs, ys, rs, weights, loose } = layer;
  const { x0, x1, cx } = slot;
  const path = usePathValue((builder) => {
    'worklet';
    const t = tilt.value;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] ?? 0;
      const y = ys[i] ?? 0;
      const r = rs[i] ?? 1;
      if (t === 0) {
        builder.addCircle(x, y, r);
        continue;
      }
      builder.addCircle(
        sloshX(x, loose[i] ?? 0, t, x0, x1),
        sloshY(y, x, weights[i] ?? 0, t, cx, zeroY),
        r,
      );
    }
  });
  return <Path path={path} color={colors.textMuted} opacity={opacity} />;
}

/**
 * One opacity level of a month's column, sunk `drop` points by the end of the drain. Particles
 * shrink into the zero line as they reach it, and the rest slosh as the phone tilts.
 */
function ColumnLayer({
  layer,
  slot,
  zeroY,
  drop,
  drain,
  tilt,
  opacity,
}: LayerProps & { layer: BarLayer; drop: number; drain: SharedValue<number> }) {
  const { xs, ys, rs, weights, loose } = layer;
  const { x0, x1, cx } = slot;
  const path = usePathValue((builder) => {
    'worklet';
    const sunk = drop * drain.value;
    const t = tilt.value;
    for (let i = 0; i < xs.length; i++) {
      const y = (ys[i] ?? 0) + sunk;
      const r = sunkRadius(y, rs[i] ?? 1, zeroY);
      if (r <= 0) continue;
      const x = xs[i] ?? 0;
      if (t === 0) {
        builder.addCircle(x, y, r);
        continue;
      }
      builder.addCircle(
        sloshX(x, loose[i] ?? 0, t, x0, x1),
        sloshY(y, x, weights[i] ?? 0, t, cx, zeroY),
        r,
      );
    }
  });
  return <Path path={path} color={colors.accent} opacity={opacity} />;
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
