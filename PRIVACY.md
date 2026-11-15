# Privacy

> [!NOTE]
> This is an early draft. Upshot doesn't connect to anything yet. A full version, listing every host
> the app talks to, is a roadmap item for M2 and will be finished before the first release.

## The short version

Upshot has no server. Your Up personal access token and your banking data stay on your device. We
never see them.

## What the app will store, and where

| What | Where | Why |
|---|---|---|
| Your Up personal access token | The iOS Keychain or Android Keystore, unlocked with Face ID or your fingerprint | To call Up's API for you |
| Your accounts and transactions | An encrypted database on your device, excluded from cloud backups | So charts load quickly and work offline |

Disconnecting in the app deletes both.

## What the app reads from your phone

| What | When | Why |
|---|---|---|
| The motion sensor (accelerometer) | Only while the Savers screen is showing | So the chart's particles slosh when you tilt your phone. Readings are used on the spot and never stored or sent anywhere. |

Upshot doesn't ask for Motion & Fitness access, as it never reads your steps or activity.

## Who the app will talk to

| Host | Why |
|---|---|
| `api.up.com.au` | Up's API, to fetch your accounts and transactions |

More hosts will only be added if they're listed here first.

## Analytics and tracking

None. Upshot doesn't collect analytics, crash reports or any other data about how you use the app,
and there's no setting to turn them on.
