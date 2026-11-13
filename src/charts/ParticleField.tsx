import { Path, Skia, usePathValue } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import {
  ALPHA_LEVELS,
  bucketByAlpha,
  pushFromTouch,
  TOUCH_PUSH,
  TOUCH_RADIUS,
  type Particle,
} from './particles';

interface ParticleFieldProps {
  particles: readonly Particle[];
  color: string;
}

/**
 * Draws particles inside a Skia `Canvas`. Particles are grouped into a few opacity levels and
 * each group is drawn as one path, so thousands of particles cost only a handful of draw calls.
 */
export function ParticleField({ particles, color }: ParticleFieldProps) {
  const paths = useMemo(
    () =>
      bucketByAlpha(particles).map((bucket) => {
        const builder = Skia.PathBuilder.Make();
        for (const p of bucket) builder.addCircle(p.x, p.y, p.r);
        return builder.detach();
      }),
    [particles],
  );

  return (
    <>
      {paths.map((path, i) => (
        <Path key={i} path={path} color={color} opacity={ALPHA_LEVELS[i] ?? 1} />
      ))}
    </>
  );
}

interface TouchParticleFieldProps {
  particles: readonly Particle[];
  color: string;
  /** Where the finger is, in the canvas's coordinates. */
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  /** 0 when nothing touches the chart, 1 while a finger is down. Spring it for a liquid feel. */
  strength: SharedValue<number>;
}

/**
 * Particles that move out of the way of a finger, like the liquid in Up's Saver Insights. The
 * particle paths are rebuilt on the UI thread whenever the finger moves, so it never waits on
 * JavaScript. Each opacity level is still a single path, so it's a handful of draw calls.
 */
export function TouchParticleField({
  particles,
  color,
  touchX,
  touchY,
  strength,
}: TouchParticleFieldProps) {
  const buckets = useMemo(() => bucketByAlpha(particles), [particles]);
  return (
    <>
      {buckets.map((bucket, i) =>
        bucket.length > 0 ? (
          <TouchLayer
            key={i}
            particles={bucket}
            color={color}
            opacity={ALPHA_LEVELS[i] ?? 1}
            touchX={touchX}
            touchY={touchY}
            strength={strength}
          />
        ) : null,
      )}
    </>
  );
}

interface TouchLayerProps extends TouchParticleFieldProps {
  opacity: number;
}

function TouchLayer({ particles, color, opacity, touchX, touchY, strength }: TouchLayerProps) {
  // Plain number arrays copy to the UI thread cheaply.
  const xs = useMemo(() => particles.map((p) => p.x), [particles]);
  const ys = useMemo(() => particles.map((p) => p.y), [particles]);
  const rs = useMemo(() => particles.map((p) => p.r), [particles]);
  const radius = TOUCH_RADIUS;
  const push = TOUCH_PUSH;

  const path = usePathValue((builder) => {
    'worklet';
    const tx = touchX.value;
    const ty = touchY.value;
    const s = strength.value;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] ?? 0;
      const y = ys[i] ?? 0;
      const r = rs[i] ?? 1;
      // Most particles are nowhere near the finger. Skip them before doing any maths, so a
      // frame doesn't create thousands of throwaway objects.
      if (s === 0 || Math.abs(x - tx) > radius || Math.abs(y - ty) > radius) {
        builder.addCircle(x, y, r);
        continue;
      }
      const { dx, dy } = pushFromTouch(x, y, tx, ty, s, radius, push);
      builder.addCircle(x + dx, y + dy, r);
    }
  });

  return <Path path={path} color={color} opacity={opacity} />;
}
