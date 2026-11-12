import { Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { ALPHA_LEVELS, bucketByAlpha, type Particle } from './particles';

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

interface DotGridProps {
  width: number;
  height: number;
  rows: number;
  columns: number;
  color: string;
  /** Distance between dots along each grid line. */
  gap?: number;
}

/** A faint grid drawn as dotted lines, behind the particles. */
export function DotGrid({ width, height, rows, columns, color, gap = 7 }: DotGridProps) {
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (let r = 0; r < rows; r++) {
      const y = rows === 1 ? height / 2 : (r / (rows - 1)) * height;
      for (let x = 0; x <= width; x += gap) builder.addCircle(x, y, 0.75);
    }
    for (let c = 0; c < columns; c++) {
      const x = columns === 1 ? width / 2 : (c / (columns - 1)) * width;
      for (let y = 0; y <= height; y += gap) builder.addCircle(x, y, 0.75);
    }
    return builder.detach();
  }, [width, height, rows, columns, gap]);

  return <Path path={path} color={color} />;
}
