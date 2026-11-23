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
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
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

import { barAt, buildBarChart, type BarSlot } from './geometry';
import { LINE_LABEL_HEIGHT, placeLineLabels } from './lineLabels';
import { ALPHA_LEVELS, DEFAULT_BAND, type BandOptions } from './particles';
import { barLayers, fallenY, fallProgress, sloshX, sloshY, type BarLayer } from './pour';

interface SavingsRateChartProps {
  rate: SavingsRate;
  height?: number;
  /** Called with `true` from the moment a finger lands on the chart until it lifts. */
  onScrubbingChange?: (scrubbing: boolean) => void;
  /**
   * Whether the chart is on screen. The months fill each time it comes into view, and the
   * particles only slosh with the phone's tilt while it's showing.
   */
  visible?: boolean;
}

const TOP = 14;
const BOTTOM = 6;
/** Room on the right for the line labels. */
const LABEL_WIDTH = 40;
/** How far the months you're not looking at fade back. */
const DIMMED = 0.28;
/** How long a month takes to fill with what was kept. */
const POUR_MS = 1400;
/** Months fill one after another on first showing, this far apart. */
const POUR_STAGGER = 110;
/** Corner radius of the track that shows what came in. */
const TRACK_RADIUS = 4;
/** How strongly the track shows: enough to see the top of what came in, no more. */
const TRACK_OPACITY = 0.07;

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
  /** SVG path of the faint track from zero up to what came in, or '' if nothing did. */
  track: string;
  /** Screen y of the top of what came in, where the beads pour in from. */
  inY: number;
  /** What was kept, from zero up. Empty when nothing was. */
  kept: BarLayer[];
  /** The grey bar below zero, when more went out than came in. Empty otherwise. */
  overspent: BarLayer[];
}

/** "29%", or "-9%" when more went out than came in. */
export function formatRate(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

/** "+$2,049", "-$258" or "$0", in whole dollars. */
export function formatSaved(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars === 0) return '$0';
  return dollars > 0 ? `+${formatMoneyRounded(cents)}` : formatMoneyRounded(cents);
}

/** The line under the headline when a month is chosen. */
function describeMonth(month: MonthFlow): string {
  const name = formatMonth(parseMonthKey(month.month));
  if (month.rate === null) return `Nothing came in during ${name}`;
  const cameIn = formatMoneyRounded(month.moneyIn);
  return month.rate < 0
    ? `${name}: spent ${formatRate(-month.rate)} more than the ${cameIn} that came in`
    : `${name}: saved ${formatRate(month.rate)} of ${cameIn}`;
}

/** The line under the headline for the average month. */
function describeAverage(rate: SavingsRate): string {
  const { months, average } = rate;
  const first = months[0];
  const last = months[months.length - 1];
  const span =
    first && last
      ? `, ${formatShortMonth(parseMonthKey(first.month))} to ${formatShortMonth(parseMonthKey(last.month))}`
      : '';
  if (average === null) return `Nothing came in${span}`;
  return average < 0
    ? `A month on average${span}: spent ${formatRate(-average)} more than came in`
    : `A month on average${span}: saved ${formatRate(average)}`;
}

/** A month in full, for screen readers. */
function speakMonth(month: MonthFlow): string {
  return `${formatMonth(parseMonthKey(month.month))}: ${formatSaved(month.kept)} of ${formatMoneyRounded(month.moneyIn)} that came in`;
}

/** A track from zero up to `topY`, its top corners rounded. */
function trackPath(x0: number, x1: number, topY: number, zeroY: number): string {
  if (zeroY - topY < 0.5) return '';
  const r = Math.min(TRACK_RADIUS, (x1 - x0) / 2, zeroY - topY);
  return `M ${x0} ${zeroY} V ${topY + r} Q ${x0} ${topY} ${x0 + r} ${topY} H ${x1 - r} Q ${x1} ${topY} ${x1} ${topY + r} V ${zeroY} Z`;
}

/**
 * What you kept each month, in dollars, against what came in.
 *
 * Each month has a faint track up to what came in. Beads pour in from its top and pile up from
 * zero to what was kept; a month where more went out than came in pours a grey bar below zero
 * instead. The headline is the average month; tap a month to read it (and watch it fill again),
 * drag across to compare, and tap it again to go back to the average. Tilt the phone and the
 * particles slosh.
 */
export function SavingsRateChart({
  rate,
  height = 230,
  onScrubbingChange,
  visible = true,
}: SavingsRateChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  // How many times each month has been tapped, to fill it again.
  const [replays, setReplays] = useState<Record<number, number>>({});
  // The month last tapped, which fills on its own straight away.
  const [tapped, setTapped] = useState<number | null>(null);
  // How many times the chart has come into view; the months fill again each time.
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
  const { months, averageKept } = rate;

  const geometry = useMemo(
    () =>
      buildBarChart(
        months.map((m) => m.kept),
        width,
        height,
        { top: TOP, bottom: BOTTOM, left: 0, right: LABEL_WIDTH },
        // Room for the tracks: everything that came in.
        {
          reference: months.length > 0 ? averageKept : null,
          include: months.map((m) => m.moneyIn),
        },
      ),
    [months, averageKept, width, height],
  );
  const bars: MonthBar[] = useMemo(
    () =>
      geometry.bars.map((slot, i) => {
        const month = months[i];
        const { zeroY } = geometry;
        const kept = month?.kept ?? 0;
        const inY = geometry.y(month?.moneyIn ?? 0);
        return {
          slot,
          track: trackPath(slot.x0, slot.x1, inY, zeroY),
          inY,
          kept: kept > 0 ? barLayers(slot.x0, slot.x1, slot.y, zeroY, barBand(101 + i)) : [],
          overspent: kept < 0 ? barLayers(slot.x0, slot.x1, slot.y, zeroY, barBand(7 + i)) : [],
        };
      }),
    [geometry, months],
  );

  // The tracks grow out of the zero line the first time they're seen, and whenever the data
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
  // The labels grow with the system text size, so the room they need does too.
  const { fontScale } = useWindowDimensions();
  const labelTops = placeLineLabels(
    zeroY,
    geometry.referenceY,
    height,
    LINE_LABEL_HEIGHT * Math.max(1, fontScale),
  );
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
      // Tapping a month fills it again.
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
  const shownKept = month ? month.kept : averageKept;
  const caption = month ? describeMonth(month) : describeAverage(rate);

  return (
    <View>
      <View style={styles.header}>
        <Text
          style={[styles.saved, Math.round(shownKept / 100) < 0 && { color: colors.negative }]}
          accessibilityLiveRegion="polite"
        >
          {formatSaved(shownKept)}
        </Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={{ height }}
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`What you kept each month. Average ${formatSaved(averageKept)}. ${months
            .map(speakMonth)
            .join('. ')}.`}
        >
          {width > 0 ? (
            <Canvas style={StyleSheet.absoluteFill}>
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
                      tapped === i ? 80 : (visits > 1 ? 250 : motion.chart * 0.7) + i * POUR_STAGGER
                    }
                    reduceMotion={reduceMotion}
                  />
                ))}
              </Group>
              {/* Break even: above it you kept money, below it more went out than came in. */}
              <Line
                p1={vec(0, zeroY)}
                p2={vec(width - LABEL_WIDTH + 4, zeroY)}
                color={colors.textMuted}
                strokeWidth={1}
              />
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
          {labelTops.average !== null ? (
            <Text style={[styles.lineLabel, styles.averageLabel, { top: labelTops.average }]}>
              Avg
            </Text>
          ) : null}
          {/* Pushed apart from "Avg" when the average sits close to zero, above or below. */}
          <Text style={[styles.lineLabel, { top: labelTops.zero }]}>$0</Text>
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
  /** False until the chart has been on screen, so the months wait, empty, to be seen. */
  ready: boolean;
  /** Changes whenever the month should fill again: the chart coming into view, or a tap. */
  trigger: string;
  /** How long to wait before filling. */
  delay: number;
  reduceMotion: boolean;
}

/**
 * One month: the track of what came in, with what was kept pouring in from its top, faded back
 * while another month is chosen. A month where more went out than came in pours its grey bar
 * down from zero instead.
 */
function Bar({ index, bar, zeroY, active, tilt, ready, trigger, delay, reduceMotion }: BarProps) {
  const pour = useSharedValue(reduceMotion ? 1 : 0);
  const { track, inY, kept, overspent, slot } = bar;

  useEffect(() => {
    if (reduceMotion) {
      pour.value = 1;
      return;
    }
    pour.value = 0;
    if (!ready) return;
    pour.value = withDelay(delay, withTiming(1, { duration: POUR_MS, easing: Easing.linear }));
    // `delay` is left out on purpose: it changes with the tap that also changes `trigger`, and
    // a new delay alone shouldn't fill the month again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trigger, kept, overspent, reduceMotion, pour]);

  const opacity = useDerivedValue(() => (active.value < 0 || active.value === index ? 1 : DIMMED));

  return (
    <Group opacity={opacity}>
      {track ? <Path path={track} color={colors.text} opacity={TRACK_OPACITY} /> : null}
      {kept.map((layer, level) =>
        layer.xs.length > 0 ? (
          <PouredLayer
            key={`kept-${level}`}
            layer={layer}
            slot={slot}
            zeroY={zeroY}
            fromY={inY}
            pour={pour}
            tilt={tilt}
            color={colors.accent}
            opacity={ALPHA_LEVELS[level] ?? 1}
          />
        ) : null,
      )}
      {overspent.map((layer, level) =>
        layer.xs.length > 0 ? (
          <PouredLayer
            key={`overspent-${level}`}
            layer={layer}
            slot={slot}
            zeroY={zeroY}
            fromY={zeroY}
            // Below zero the floor is the bar's far end, so that end fills first.
            fromFarEnd
            pour={pour}
            tilt={tilt}
            color={colors.textMuted}
            opacity={ALPHA_LEVELS[level] ?? 1}
          />
        ) : null,
      )}
    </Group>
  );
}

interface PouredLayerProps {
  layer: BarLayer;
  slot: BarSlot;
  zeroY: number;
  /** Where the particles fall from. */
  fromY: number;
  /** True when the pile rests on the bar's far end rather than on zero. */
  fromFarEnd?: boolean;
  pour: SharedValue<number>;
  tilt: SharedValue<number>;
  color: string;
  opacity: number;
}

/**
 * One opacity level of a bar, pouring in: each particle falls from `fromY` to its place, the
 * bottom of the pile first and the beaded surface last, then sloshes as the phone tilts.
 */
function PouredLayer({
  layer,
  slot,
  zeroY,
  fromY,
  fromFarEnd = false,
  pour,
  tilt,
  color,
  opacity,
}: PouredLayerProps) {
  const { xs, ys, rs, weights, loose } = layer;
  const { x0, x1, cx } = slot;
  const path = usePathValue((builder) => {
    'worklet';
    const t = pour.value;
    const g = tilt.value;
    for (let i = 0; i < xs.length; i++) {
      const weight = weights[i] ?? 0;
      // Weight is 1 at the bar's end and 0 at zero, which is how far up the pile it rests.
      const fall = fallProgress(fromFarEnd ? 1 - weight : weight, t);
      if (fall < 0) continue;
      const x = xs[i] ?? 0;
      const y = fall >= 1 ? (ys[i] ?? 0) : fallenY(fromY, ys[i] ?? 0, fall);
      // Particles grow to full size over the start of their fall, rather than popping in.
      const r = (rs[i] ?? 1) * Math.min(1, 0.4 + fall * 3);
      if (g === 0) {
        builder.addCircle(x, y, r);
        continue;
      }
      builder.addCircle(sloshX(x, loose[i] ?? 0, g, x0, x1), sloshY(y, x, weight, g, cx, zeroY), r);
    }
  });
  return <Path path={path} color={color} opacity={opacity} />;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saved: {
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
