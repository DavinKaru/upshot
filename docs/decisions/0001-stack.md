# 0001: App stack

- **Status:** accepted
- **Date:** 2026-11-12
- **Roadmap item:** M1, "Confirm the stack"

## Decision

| Concern | Choice |
|---|---|
| Framework | Expo SDK 58 (React Native 0.88, React 19.3), TypeScript in strict mode |
| Navigation | Expo Router, file-based routes in `src/app/` |
| Builds | Development builds (`expo run:ios`, `expo run:android`), not Expo Go |
| Native projects | Generated with Continuous Native Generation; `ios/` and `android/` aren't committed |
| Package manager | npm |
| Animation and gestures | Reanimated 4 and Gesture Handler (both ship with the Expo template) |
| Linting and formatting | ESLint through `expo lint`, plus Prettier |
| Unit tests | Jest with the `jest-expo` preset |

Library versions follow whatever `npx expo install` picks for the current SDK.

## Why

- **One codebase for iOS and Android.** Both platforms reach each milestone together (decision 2 in
  the roadmap), and Expo is the most direct way to do that with one small team.
- **The security pieces we need exist as Expo modules:** `expo-secure-store` for the token (Keychain
  and Keystore, with biometrics), `expo-sqlite` with SQLCipher for the encrypted cache,
  `expo-screen-capture` for screenshot blocking, and `expo-background-task` for later.
- **Development builds from day one.** SQLCipher (M3) needs a config plugin, which Expo Go can't
  load. Starting with development builds means nobody's setup changes halfway through.
- **Generated native projects** keep the repo small and make SDK upgrades a config change, not a
  merge of two native projects.
- **npm** is what most contributors already have. Bun and Yarn are faster, but the speed doesn't
  matter at this size.

## Trade-offs

- Running the app needs Xcode (for iOS) or Android Studio (for Android) locally. CI builds both.
- Expo ships breaking changes in each SDK. We'll upgrade one SDK at a time, using `npx expo-doctor`.
