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

import { donutSegments, expandSegments, inSegment, segmentAt, type Segment } from './geometry';
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

const RING_BAND: BandOptions = { ...DEFAULT_BAND, capWidth: 12, falloffWidth: 36, spacing: 3 };
const GAP = 5;
const EXPAND = { duration: 460, easing: Easing.inOut(Easing.cubic) };
const SWAP = { duration: 220, easing: Easing.out(Easing.quad) };

/**
 * A ring of particles split by category, dense at the outer edge and thinning towards the
 * middle. Tapping a segment calls `onSelect`. When `focusedId` is set, that segment's colour
 * floods round the whole ring and then splits into `focusItems`; clearing it plays that backwards.
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

  // Keep the last focused item (and its parts) while the ring closes back up, so it can shrink
  // back into the right place.
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

  // 0 → 1: the focused segment grows to fill the ring. Then 0 → 1: its parts fade in over it.
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

  const layout = useDerivedValue(() => expandSegments(segments, anchor, expand.value));
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
            <Group opacity={topOpacity}>
              {items.map((item, i) =>
                layers.map((layer, level) => (
                  <MovingSegment
                    key={`${item.id}-${level}`}
                    layer={layer}
                    layout={layout}
                    index={i}
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

interface MovingSegmentProps {
  layer: RingLayer;
  layout: SharedValue<Segment[]>;
  index: number;
  color: string;
  opacity: number;
}

/** One segment at one opacity level, rebuilt on the UI thread as the ring expands. */
function MovingSegment({ layer, layout, index, color, opacity }: MovingSegmentProps) {
  const { xs, ys, rs, angles } = layer;
  const path = usePathValue((builder) => {
    'worklet';
    const segment = layout.value[index];
    if (!segment || segment.sweep <= 0) return;
    for (let i = 0; i < angles.length; i++) {
      if (inSegment(angles[i] ?? 0, segment.start, segment.sweep)) {
        builder.addCircle(xs[i] ?? 0, ys[i] ?? 0, rs[i] ?? 1);
      }
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
