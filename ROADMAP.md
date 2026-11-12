# Upshot roadmap

> **Status:** all open questions are decided (see [Decisions](#decisions)). This file is the source
> for the Upshot GitHub Project, and `scripts/seed-project.py` loads it. Each milestone becomes a
> value in the project's *Phase* field, and each item becomes a draft issue, then a real issue once
> the repo exists.

Upshot is an unofficial, open-source mobile app that gives Up customers insights into their banking.
Each user connects their own Up personal access token, and everything stays on their device.

## How the GitHub Project will be organised

- **Owner:** the `DavinKaru` user account. The project and the repo are **public from the start**.
- **Views:**
  - **Roadmap:** grouped by Phase.
  - **Board:** grouped by Status.
  - **Decisions:** filtered to Kind = Decision.
- **Fields:**

| Field | Values |
|---|---|
| Status | Todo · In progress · Done (GitHub's built-in field; add Ready and In review in the UI if we need them) |
| Phase | M1 Shell · M2 Connect · M3 Real data · M4 Insights · M5 Release · Later (named Phase because *Milestone* is GitHub's built-in field for repository milestones) |
| Kind | Feature · Design · Chore · Decision · Docs · Security (named Kind because *Type* is reserved for GitHub's issue types) |
| Size | XS · S · M · L |

---

## M1 — Shell app with signature charts

**Goal:** a working app on iOS and Android that looks and feels like it belongs next to Up. It has a
navigation shell and one or two charts done properly, all running on realistic **demo data**. There
is no token and no network yet.

**Why demo data first:** Up's look comes mostly from motion, scrubbing and haptics, so we want to get
that right before adding plumbing. Demo data also stays useful for good after M1. Contributors
without an Up account can still run the app, App Store reviewers can try it, and we can take
screenshots without leaking real data.

**Done when:**
- The app runs on both an iOS simulator and an Android emulator from a fresh clone, with one command.
  Both platforms reach each milestone together.
- Two charts render demo data and support scrubbing and haptics.
- Someone who uses Up would say it "feels like Up" without it copying Up's logo, name or screens.

| Item | Kind |
|---|---|
| Add the LICENSE file: GPL-3.0 plus an additional permission (section 7) allowing app store distribution | Docs |
| Confirm the stack: Expo + TypeScript, expo-router, development builds | Decision |
| Pick the chart approach: Victory Native XL or custom drawing with react-native-skia | Decision |
| Create the public repo `DavinKaru/upshot`: branch protection on `main`, secret scanning and push protection, Dependabot alerts | Chore |
| Collect a design reference board: screenshots of Up's app (Saver Insights, home, transaction feed) to work from | Design |
| Design tokens for a **dark-only** theme: colour palette inspired by Up (dark base, warm coral accent), type scale, spacing, corner radii, motion timings | Design |
| Scaffold the Expo app: TypeScript strict mode, ESLint/Prettier, path aliases | Chore |
| CI pipeline: type-check, lint and unit tests on each PR, building both iOS and Android; Renovate for dependency updates | Chore |
| Repo docs: README, LICENSE, PRIVACY.md stub, SECURITY.md, CONTRIBUTING.md, issue templates, an "Unofficial, not affiliated with Up" disclaimer | Docs |
| Up API types generated from Up's OpenAPI spec | Chore |
| Demo data generator: a realistic year of accounts, Savers and transactions in Up's API format | Feature |
| Navigation shell: tabs for Home, Insights, Savers and Settings | Feature |
| Core components: card, list row, money display (large dollars, smaller cents), category badge, section header | Feature |
| **Chart 1: Saver balance over time.** An area chart with a smooth line, a gradient fill and drag-to-scrub. A label shows the date and balance, and haptic ticks fire as you scrub. Modelled on Saver Insights. | Feature |
| **Chart 2: Spending by category this month.** Tap a category to drill into its sub-categories and see a comparison with last month. | Feature |
| Motion and haptics: chart transitions, scrub feedback, press states | Design |

## M2 — Connect your Up account

**Goal:** a user can safely connect their own token, and the app proves it works. This milestone
doesn't fetch or store any transactions yet; that's M3.

**Done when:**
- A first-time user goes from install to "connected" by following in-app guidance.
- The token sits only in the Keychain or Keystore, and opening the app requires Face ID or a
  fingerprint.

| Item | Kind |
|---|---|
| Threat model doc: risks of a leaked token (data exposure, tag and category edits, webhook exfiltration), and how we mitigate them | Security |
| Onboarding walkthrough: what a personal access token is, how to create one in the Up app (Data Sharing → Personal Access Token), and choosing how long it lasts | Feature |
| Token entry: paste it in, check it against `/util/ping`, then clear the clipboard | Feature |
| Store the token with `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `requireAuthentication`), and handle biometrics changing, which wipes the token | Security |
| App privacy protections: app lock, a blurred app-switcher preview, and screenshot blocking on sensitive screens | Security |
| Up API client: typed requests, following `links.next`, retrying with backoff on 429, error mapping | Feature |
| Disconnect: forget the token, wipe local data, and link to where the user can revoke the token in Up | Feature |
| PRIVACY.md: list the hosts the app talks to, matching Lint's level of detail | Docs |

## M3 — Real data and local cache

**Goal:** the M1 charts run on the user's own data, stored in an encrypted local database.

**Done when:**
- A user with several years of history can sync fully and then keep their data up to date.
- The database is shown to be encrypted on disk.

| Item | Kind |
|---|---|
| Encrypted SQLite (expo-sqlite with SQLCipher) and Drizzle schema; generate a key and keep it in SecureStore | Feature |
| Startup check: `PRAGMA cipher_version`, refusing to run if the database isn't encrypted | Security |
| Exclude the database from iCloud and Android backups | Security |
| First-run sync: download the full history, with a progress UI | Feature |
| Ongoing sync: re-fetch from 7 days before the last sync to catch transactions that settled or were deleted; sync when the app opens and on pull-to-refresh | Feature |
| Balance history: rebuild past balances from the current balance and the transaction history (this feeds Chart 1) | Feature |
| Charts on real data: switch from demo data, keeping demo mode available | Feature |

## M4 — Insights for V1

**Goal:** a small set of insights you can't get in Up's own app. Keep V1 basic.

| Item | Kind |
|---|---|
| Monthly summary: money in, money out, net, and the change from last month | Feature |
| Spending pace: cumulative spending this month vs last month, with scrubbing (reuses the Chart 1 component) | Feature |
| Category trends: spending per category over 6–12 months | Feature |
| Top merchants: by total spent and by how often you buy | Feature |
| Round Ups, interest and cashback totals | Feature |
| 2Up split: who spent what on joint accounts (`performingCustomer`) | Feature |
| Insights engine as a plain TypeScript package with fixture-based tests | Chore |

## M5 — V1.0 release

**Goal:** Upshot is publicly available on TestFlight and in Google Play internal testing.

| Item | Kind |
|---|---|
| Choose the analytics provider (Aptabase or Plausible Events API), off by default | Decision |
| Opt-in analytics: a few anonymous events, never amounts or merchants | Feature |
| Webhook audit screen: list webhooks and flag any you don't recognise | Security |
| Brand assets: app icon, splash screen, store screenshots taken from demo mode | Design |
| Store listings: "Unofficial · works with Up" wording and a privacy policy | Docs |
| TestFlight and Google Play internal testing pipelines; versioning per platform, following Lint's convention | Chore |
| Look into F-Droid: building Expo from source, no Firebase Cloud Messaging | Chore |

## Later (after V1)

- Subscription and recurring payment detection
- Pay day detection and "safe to spend"
- Automatic tagging and recategorising rules (the API allows writes)
- Tax-time export: a tag plus its receipts, as CSV or ZIP
- Home-screen widgets
- Background sync and local notifications
- Optional self-hostable webhook relay for real-time alerts (it never sees the token)
- Particle-physics chart effects, in the style of Saver Insights
- Spending heatmaps, foreign-currency and exchange-rate insights, payment-method breakdown

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Licence | **GPL-3.0 with an app store exception.** The exception has to be in place before the first outside contribution |
| 2 | Platforms | **iOS and Android together** at every milestone |
| 3 | Theme | **Dark only** |
| 4 | Chart 2 | **Category breakdown.** The spending pace chart (this month vs last month) goes into M4 |
| 5 | Visibility | **Public from the start**, for both the repo and the GitHub Project |

### Public from day one: implications

- Nothing secret is ever committed. Analytics keys are designed to be public, and test tokens are never committed.
- `llms.txt` is Up's API reference, not our content. Don't commit it: add it to `.gitignore` and
  link to developer.up.com.au.
- Demo data has to be clearly made up, with no real merchants that could be traced back to a person.
