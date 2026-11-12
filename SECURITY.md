# Security policy

Upshot handles access to people's bank data, so we take security reports seriously.

## Reporting a vulnerability

Please **don't open a public issue.** Report it privately through GitHub instead:

1. Go to the [Security tab](https://github.com/DavinKaru/upshot/security) of this repo.
2. Select **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a
reply within 7 days. Once a fix is out, we're happy to credit you, if you'd like.

**Never include a real Up personal access token or real transaction data in a report.** Use made-up
values or the app's demo data.

## What's in scope

- The Upshot app and the code in this repo.
- Anything that could expose a user's token or banking data: how the token is stored, the local
  database, logs, screenshots, backups, network traffic and analytics.

Up's own app and API are out of scope. Report problems with those to Up directly.

## If your token has leaked

If you think your Up personal access token has been exposed, revoke it in the Up app and create a
new one. A token can read your accounts and transactions, change tags and categories, and set up
webhooks that send your transaction events to another server. It can't move money.

## Supported versions

Upshot hasn't been released yet. Once it is, only the latest version will get security fixes.
