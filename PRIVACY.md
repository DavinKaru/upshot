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

## Who the app will talk to

| Host | Why |
|---|---|
| `api.up.com.au` | Up's API, to fetch your accounts and transactions |

More hosts, such as an analytics provider, will only be added if they're listed here first.

## Analytics

None today. If we add analytics later, they'll be off unless you turn them on, and they'll never
include amounts, merchants, account details or anything else from your bank data.
