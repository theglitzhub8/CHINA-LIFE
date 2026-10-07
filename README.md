# ChinaLife · Hafrik

A persistent 3D life simulation across seven Chinese cities, with character creation, needs, careers, homes, flights and shared venues. Hafrik accounts authenticate the PHP deployment and native app integration.

## Repository layout

- `public/`: canonical browser game and bundled Three.js.
- `chinalife-api/`: production PHP/MySQL routes installed under Hafrik's existing `/api/v4/chinalife/`.
- `integrations/hafrik-mobile/`: ChinaLife screen and configuration to apply in the Hafrik React Native app.
- `worker/`, `db/`, `drizzle/`: separate original Worker/D1 implementation. It uses ChatGPT headers and is not the PHP authentication backend.
- `tests/`: gameplay, client, Worker and actual PHP/MySQL integration tests.
- `docs/REFERENCE-ANALYSIS.md`: Lagos Life reference study and ChinaLife product direction.

The older `china-life.hafrik.com/` copy and tar archives are local delivery artifacts excluded from Git. Edit `public/` and `chinalife-api/` for future updates.

## Development and checks

Requires Node 24, PHP 8.1+ with mysqli and mbstring, and MySQL tools including `mysql` and `mysqld`.

```sh
npm ci
npm run lint:php
npm test
```

`npm test` builds the original Worker and runs all tests. PHP tests start an isolated MySQL instance using a temporary directory and Unix socket, with network listeners disabled. They use fake test accounts and never connect to your Hafrik database. Tests cover upgrading an existing schema, save conflicts, presence, venue/private chat, friendship, blocking, reports, voice sessions and DJ queues. Test logs remain in the temporary directory for diagnosis.

`npm run build` produces `dist/server/index.js` for the separate Worker deployment. Apache/PHP hosting serves `public/` directly and does not need that bundle.

## Deploy from Git

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Clone this repo into a source directory separate from either website's public document root, then deploy the game and API files to their respective directories. Existing Hafrik database configuration, helpers, secrets and authentication remain outside this repository.

## Current limits

The native app must be rebuilt with the included session bridge. Server migrations must be run after deployment. Voice uses direct WebRTC/STUN and needs a TURN service on restrictive networks. Uploaded game currency is client-controlled; competitive wealth rankings and paid economic features need server-authoritative game transactions. Reports are stored for operators to review; an administration interface is not included yet.
