/**
 * The room a line label takes up, in points. The labels are 11-point text with no set line
 * height, which renders about 13 points tall on iOS and 15 on Android, so 16 leaves a margin.
 * This matches the 8 points the labels have always been lifted by to centre them on a line.
 */
export const LINE_LABEL_HEIGHT = 16;
/** The least space between the "Avg" and "$0" labels when they're pushed apart. */
export const LINE_LABEL_GAP = 2;

export interface LineLabelTops {
  /** Top of the "$0" label. */
  zero: number;
  /** Top of the "Avg" label, or `null` when there's no average line. */
  average: number | null;
}

/**
 * Where to put the "$0" and "Avg" labels beside a chart's zero and average lines, as the `top`
 * of each label.
 *
 * Each label is centred on its line. When the lines are too close for that, the labels are
 * pushed apart evenly about the point between the lines: the label of the higher line goes
 * above the other one, and when the average is exactly zero, "Avg" goes on top. A label's middle
 * stays within the chart, from 0 to `height`, while there's room for both; on a chart too short
 * to fit them, the upper label sits at the top and the other just below it, past the bottom of
 * the chart. Either way they never overlap.
 *
 * `labelHeight` is the room one label needs. Labels grow with the system text size, so pass
 * `LINE_LABEL_HEIGHT` times the font scale.
 */
export function placeLineLabels(
  zeroY: number,
  averageY: number | null,
  height: number,
  labelHeight = LINE_LABEL_HEIGHT,
  gap = LINE_LABEL_GAP,
): LineLabelTops {
  const half = labelHeight / 2;
  const zero = zeroY - half;
  if (averageY === null) return { zero, average: null };

  // Work with the labels in order down the screen.
  const averageFirst = averageY <= zeroY;
  let upper = (averageFirst ? averageY : zeroY) - half;
  let lower = (averageFirst ? zeroY : averageY) - half;
  const apart = labelHeight + gap;

  if (!(lower - upper >= apart)) {
    const middle = (upper + lower) / 2;
    upper = middle - apart / 2;
    lower = middle + apart / 2;
  }
  // Keep the middles within the chart: up from the bottom, then down from the top, moving the
  // other label only as far as it needs to stay clear. The second step wins on a short chart.
  const lowest = height - half;
  if (lower > lowest) {
    lower = lowest;
    upper = Math.min(upper, lower - apart);
  }
  if (upper < -half) {
    upper = -half;
    lower = Math.max(lower, upper + apart);
  }

  return averageFirst ? { zero: lower, average: upper } : { zero: upper, average: lower };
}
