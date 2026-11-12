# Upshot

**An unofficial, open-source insights app for Up customers.** Connect your own Up personal access
token and see where your money goes. Your token and your data stay on your device.

> [!IMPORTANT]
> Upshot is an independent project. It isn't affiliated with, endorsed by or supported by Up or
> Bendigo and Adelaide Bank. "Up" is used only to say which bank Upshot works with.

> [!NOTE]
> Upshot is in early development and isn't ready to use yet. Follow progress on the
> [roadmap](ROADMAP.md) and the [project board](https://github.com/users/DavinKaru/projects/2).

## What it will do

- Show how your Savers grow over time, and where your spending goes each month.
- Give you insights Up's app doesn't, such as spending pace, category trends, top merchants, Round
  Ups and interest totals, and who spent what on a 2Up account.
- Run on iOS and Android.

## How it keeps your data safe

- **No Upshot server.** The app talks directly to Up's API from your phone. There's nowhere for your
  token or transactions to leak to, because we never receive them.
- **Your token stays in your phone's secure storage** (the iOS Keychain or Android Keystore), and
  opening the app needs Face ID or your fingerprint.
- **Your data is cached in an encrypted database** that's excluded from cloud backups.
- **Analytics are off unless you turn them on**, and even then they never include amounts,
  merchants or anything else from your account.

Up's terms say personal access tokens are for personal use and mustn't be shared with anyone else.
Upshot's design follows that: you create your own token, and it never leaves your device.

## Run it locally

You'll need:

- Node.js (the current LTS release or newer)
- Xcode, for the iOS simulator, or Android Studio, for the Android emulator

```bash
npm install
npm run ios       # or: npm run android
```

The first run builds the native app, which takes a few minutes. Upshot uses
[development builds](https://docs.expo.dev/develop/development-builds/introduction/), not Expo Go.

Until the app can connect to Up, it runs on made-up demo data, so you don't need an Up account to
work on it.

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm run format:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more.

## Built with

Expo and React Native, TypeScript, Expo Router, and react-native-skia for charts. The reasons for
each choice are in [docs/decisions](docs/decisions).

## Licence

Upshot is free software under the [GNU GPL version 3](LICENSE), with an
[additional permission](APP-STORE-EXCEPTION.md) that allows distribution through app stores.
