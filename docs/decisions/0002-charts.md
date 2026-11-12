# 0002: Chart approach

- **Status:** accepted
- **Date:** 2026-11-12
- **Roadmap item:** M1, "Pick the chart approach"

## Decision

Draw our own charts with **react-native-skia**, using **d3-shape** and **d3-scale** for the maths,
**Reanimated** for animation and **Gesture Handler** for scrubbing. We won't use Victory Native XL.

The chart code lives in one module (`src/charts/`) with small parts we can reuse: scales, path
building, a scrub gesture that snaps to the nearest point, and a haptic tick when the point changes.
The maths is plain TypeScript with unit tests.

## Options considered

| | Victory Native XL | Custom Skia (chosen) |
|---|---|---|
| What it is | A chart library built on Skia, Reanimated and Gesture Handler | The same three libraries, used directly |
| Getting started | Faster: axes, scales and press state come built in | Slower: we write scrubbing and axes ourselves (a few hundred lines) |
| Control over look and motion | Limited to what the library exposes | Full control |
| Chart 2 (category drill-down) | Its pie and bar charts would still need custom transitions | Built for exactly what we want |
| Later particle effects | Would need a second approach anyway | Same tools |
| Upgrades | Another package that has to keep up with each Expo SDK | Only the libraries Expo already supports |

## Why

- Up's charts feel the way they do because of their motion: the smooth line, a scrub label that
  follows your finger, haptic ticks and drill-down transitions. That's the part of the work we most
  need to control, and it's where a general chart library limits us most.
- Chart 2 isn't a standard pie chart. A library would hand us a starting point we'd mostly rewrite.
- Both options run on the same Skia, Reanimated and Gesture Handler underneath, so the custom route
  doesn't add any native dependencies. It removes one JavaScript dependency.
- "Particle-physics chart effects" is on the Later list, and Skia is the right tool for that.

## Trade-offs

- We own the accessibility work: each chart needs a text summary for screen readers, and scrub
  positions need to be read out.
- If the custom code grows past what two or three charts need, we'll look at this decision again.
