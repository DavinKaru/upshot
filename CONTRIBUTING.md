# Contributing to Upshot

Thanks for helping. Upshot is early, so the most useful thing is often to pick up an item from the
[project board](https://github.com/users/DavinKaru/projects/2) and say in an issue that you're
working on it.

## Before you start

- **Read the [roadmap](ROADMAP.md)** and the [decision records](docs/decisions). They explain what
  we're building and why.
- **For anything bigger than a small fix, open an issue first**, so we can agree on the approach
  before you spend time on it.
- **Security problems** go through [SECURITY.md](SECURITY.md), not public issues.

## Setting up

Follow [Run it locally](README.md#run-it-locally) in the README. You don't need an Up account,
because the app runs on demo data.

## Keeping data private

- **Never commit, paste or screenshot a real personal access token**, whether in code, issues, pull
  requests or logs.
- **Use demo data in screenshots and bug reports.** If you have to show real data, blur every
  amount, merchant, name and account number first.
- **No new network requests or third-party SDKs** without discussion. Everything the app talks to
  is listed in PRIVACY.md, and that list should stay short.

## Design

Upshot is inspired by Up's style, not a copy of it. Please don't add Up's logo, illustrations,
icons, fonts or other assets, or use Up's name in a way that suggests Upshot is part of Up.

## Making changes

1. Branch from `main`.
2. Keep each commit to one focused change. Write commit messages in
   [Conventional Commits](https://www.conventionalcommits.org/) style, for example
   `feat: add spending pace chart` or `fix: handle 429 responses`.
3. Add packages with `npx expo install <package>`, which picks versions that work with our Expo SDK.
4. Before opening a pull request, check that these pass:

   ```bash
   npm run lint
   npm run typecheck
   npm run format:check
   ```

5. In the pull request, say what changed and why. For visual changes, include before and after
   screenshots from demo mode, on both iOS and Android.

## Licence of your contribution

By contributing, you agree that your work is licensed under the GNU GPL version 3, together with
the [additional permission for app stores](APP-STORE-EXCEPTION.md).
