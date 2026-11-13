import { Canvas, Group, Path, Skia, usePathValue } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
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

import { motion } from '@/theme/tokens';

import {
  donutSegments,
  gapsAt,
  inSegment,
  planGapMoves,
  ringGaps,
  segmentAt,
  wipeSegment,
  type Segment,
} from './geometry';
import {
  ALPHA_LEVELS,
  DEFAULT_BAND,
  ringLayers,
  type BandOptions,
  type RingLayer,
} from './particles';

export interface DonutItem {
  id: string;
  value: number;
  color: string;
}

interface CategoryDonutProps {
  items: readonly DonutItem[];
  /** The item opened up to fill the ring, if any. */
  focusedId?: string | null;
  /** What the focused item is made of, drawn in the ring once it has filled it. */
  focusItems?: readonly DonutItem[];
  size?: number;
  onSelect?: (id: string) => void;
  /** Shown in the middle, usually the total. */
  children?: React.ReactNode;
  accessibilityLabel: string;
}

const RING_BAND: BandOptions = {
  ...DEFAULT_BAND,
  spacing: 4,
  spread: 7,
  maxDepth: 38,
  scatter: 3.4,
};
const GAP = 5;
const EXPAND = { duration: 520, easing: Easing.inOut(Easing.cubic) };
const SWAP = { duration: 220, easing: Easing.out(Easing.quad) };

/**
 * A ring of particles split by category, dense at the outer edge and thinning towards the
 * middle. Tapping a segment calls `onSelect`. When `focusedId` is set, that segment's colour
 * sweeps clockwise round the ring from the segment's far end while the splits slide round to
 * where `focusItems` will divide it, then the parts' shades fade in. Clearing it plays that
 * backwards.
 */
export function CategoryDonut({
  items,
  focusedId = null,
  focusItems = [],
  size = 260,
  onSelect,
  children,
  accessibilityLabel,
}: CategoryDonutProps) {
  const reduceMotion = useReducedMotion();
  const center = size / 2;
  const outer = center - 4;
  const layers = useMemo(() => ringLayers(center, center, outer, RING_BAND), [center, outer]);
  const segments = useMemo(
    () =>
      donutSegments(
        items.map((i) => i.value),
        GAP,
      ),
    [items],
  );

  // Keep the last focused item (and its parts) while the ring closes back up, so the colour can
  // retreat to the right place.
  const [anchorId, setAnchorId] = useState(focusedId);
  if (focusedId && focusedId !== anchorId) setAnchorId(focusedId);
  const [parts, setParts] = useState(focusItems);
  if (focusItems.length > 0 && focusItems !== parts) setParts(focusItems);
  const anchor = items.findIndex((i) => i.id === anchorId);
  const partSegments = useMemo(
    () =>
      donutSegments(
        parts.map((p) => p.value),
        GAP,
      ),
    [parts],
  );

  // 0 → 1: the focused segment fills the ring. Then 0 → 1: its parts fade in over it.
  const expand = useSharedValue(focusedId ? 1 : 0);
  const detail = useSharedValue(focusedId ? 1 : 0);
  const focused = focusedId !== null;
  useEffect(() => {
    if (reduceMotion) {
      expand.value = focused ? 1 : 0;
      detail.value = focused ? 1 : 0;
    } else if (focused) {
      expand.value = withTiming(1, EXPAND);
      detail.value = withDelay(EXPAND.duration - 80, withTiming(1, SWAP));
    } else {
      detail.value = withTiming(0, SWAP);
      expand.value = withDelay(SWAP.duration - 80, withTiming(0, EXPAND));
    }
  }, [focused, expand, detail, reduceMotion]);

  // Colours fill the ring edge to edge; the splits between them are cut out separately, so they
  // can move on their own.
  const colours = useMemo(() => {
    const pad = ringGaps(segments).width / 2;
    return segments.map((s) =>
      s.sweep > 0 ? { start: s.start - pad, sweep: s.sweep + pad * 2 } : s,
    );
  }, [segments]);

  // The focused segment's colour, sweeping clockwise from its far end. It paints over the other
  // segments where they are, and uncovers them again on the way back.
  const anchorColour = colours[anchor];
  const wipe = useDerivedValue(() =>
    anchorColour ? wipeSegment(anchorColour, expand.value) : { start: 0, sweep: 0 },
  );

  // Meanwhile the splits slide clockwise to where the parts' splits will be, merging or starting
  // fresh from 12 o'clock when the counts differ. By the time the parts fade in, the splits are
  // already in place.
  const moves = useMemo(
    () => planGapMoves(ringGaps(segments), ringGaps(partSegments)),
    [segments, partSegments],
  );
  const gaps = useDerivedValue(() => gapsAt(moves, expand.value));
  const topOpacity = useDerivedValue(() => 1 - detail.value);

  // Fade in while turning gently into place, when the chart first appears or its data changes.
  const settle = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      settle.value = 1;
      return;
    }
    settle.value = 0;
    settle.value = withTiming(1, { duration: motion.chart, easing: Easing.out(Easing.cubic) });
  }, [segments, settle, reduceMotion]);
  const opacity = useDerivedValue(() => settle.value);
  const transform = useDerivedValue(() => [
    { rotate: (1 - settle.value) * -0.35 },
    { scale: 0.94 + 0.06 * settle.value },
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
      if (focused) return;
      const index = segmentAt(
        segments,
        event.x,
        event.y,
        center,
        center,
        outer - RING_BAND.maxDepth,
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
            <Group opacity={topOpacity}>
              {items.map((item, i) =>
                layers.map((layer, level) => (
                  <WipedSegment
                    key={`${item.id}-${level}`}
                    layer={layer}
                    segment={colours[i]}
                    wipe={wipe}
                    gaps={gaps}
                    isWiping={i === anchor}
                    color={item.color}
                    opacity={ALPHA_LEVELS[level] ?? 1}
                  />
                )),
              )}
            </Group>
            <Group opacity={detail}>
              {parts.map((part, i) =>
                layers.map((layer, level) => (
                  <StillSegment
                    key={`${part.id}-${level}`}
                    layer={layer}
                    segment={partSegments[i]}
                    color={part.color}
                    opacity={ALPHA_LEVELS[level] ?? 1}
                  />
                )),
              )}
            </Group>
          </Group>
        </Canvas>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      </View>
    </GestureDetector>
  );
}

interface WipedSegmentProps {
  layer: RingLayer;
  /** Where this segment's colour sits, splits included. */
  segment: Segment | undefined;
  /** The focused segment's colour as it sweeps round the ring. */
  wipe: SharedValue<Segment>;
  /** The splits cut out of the ring, wherever they are right now. */
  gaps: SharedValue<Segment[]>;
  /** Whether this is the focused segment, drawn across the whole wipe. */
  isWiping: boolean;
  color: string;
  opacity: number;
}

/**
 * One segment at one opacity level, rebuilt on the UI thread while the ring changes. The focused
 * segment draws everywhere the wipe has reached; every other segment draws where it always is,
 * except where the wipe has painted over it. Nothing draws inside a split.
 */
function WipedSegment({ layer, segment, wipe, gaps, isWiping, color, opacity }: WipedSegmentProps) {
  const { xs, ys, rs, angles } = layer;
  const start = segment?.start ?? 0;
  const sweep = segment?.sweep ?? 0;
  const path = usePathValue((builder) => {
    'worklet';
    const w = wipe.value;
    const cuts = gaps.value;
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i] ?? 0;
      const covered = inSegment(angle, w.start, w.sweep);
      if (isWiping ? !covered : !inSegment(angle, start, sweep) || covered) continue;
      let inGap = false;
      for (const cut of cuts) {
        if (inSegment(angle, cut.start, cut.sweep)) {
          inGap = true;
          break;
        }
      }
      if (!inGap) builder.addCircle(xs[i] ?? 0, ys[i] ?? 0, rs[i] ?? 1);
    }
  });
  return <Path path={path} color={color} opacity={opacity} />;
}

interface StillSegmentProps {
  layer: RingLayer;
  segment: Segment | undefined;
  color: string;
  opacity: number;
}

/** One segment at one opacity level that doesn't move, built once. */
function StillSegment({ layer, segment, color, opacity }: StillSegmentProps) {
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    if (segment && segment.sweep > 0) {
      const { xs, ys, rs, angles } = layer;
      for (let i = 0; i < angles.length; i++) {
        if (inSegment(angles[i] ?? 0, segment.start, segment.sweep)) {
          builder.addCircle(xs[i] ?? 0, ys[i] ?? 0, rs[i] ?? 1);
        }
      }
    }
    return builder.detach();
  }, [layer, segment]);
  return <Path path={path} color={color} opacity={opacity} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
