# Regression repair — 20 October 2026

The complete `npm test` suite now passes: **332 passed, 0 failed, 0 skipped**. PHP syntax checks pass. Frontend hashed bundles were rebuilt. Work remains on `codex/guangzhou-camera-foundation`; no push, merge or deployment was performed.

## Runtime fixes

- **Venue arrivals:** apply the existing safe-entry calculation after room dressing finishes. The airport placed arrival coordinates inside a row of seats, so the first movement step collided and cancelled activities. Covered entry points now move to a nearby free navigation cell; valid entry points stay unchanged. This changes indoor arrival recovery, not the approved city map's geometry or layout.
- **Shared activities:** open the dialog with a loading message before fetching its contents, activating the existing fresh-data path for an open dialog. Opening the screen no longer reuses an older background-feed snapshot. Existing background polling and cache intervals remain unchanged.
- **Admin rank changes:** invalidate the shared leaderboard cache after a rank change, suspension or suspension removal. Tests prewarm the cache and verify that suspended players disappear and return immediately when reinstated.
- **Cache isolation:** allow an optional `CL_CACHE_DIR` environment setting for the file-cache directory. Integration test servers each use a private temporary directory, avoiding stale data from another database/test run. Production defaults remain unchanged.

## Test repairs

- Bundle the real world module graph with the existing esbuild dependency; replace only the WebGL renderer. The old harness stripped imports and manually listed modules, so current imports could not load.
- Simulate all animation-frame callbacks instead of retaining only the last registered callback. Club entrance effects previously displaced the main render loop in tests.
- Supply browser timer APIs, a controllable elapsed clock, and the current account-picture schema in test fixtures.
- Configure Shenyang explicitly in the PHP test server, and separately assert that a fresh server defaults to China. Production starting-city permissions are unchanged.
- Align assertions with the current eight configured cities, ten phone folders, anonymous gossip UI, confirmation-based ballots, real-date weather, retained characters in closed cities, and placed-versus-stored home furniture.
- Test the current 20-second presence strategy, immediate room updates, hidden-page suspension and 4-second street-peer interval. Historical adaptive-inbox tests referenced an implementation no longer used by this revision. The deployment guide now identifies that obsolete switch accurately.
- Verify actual server rules for device earnings: capped income, the non-repeatable rolling-hour coin allowance, persisted ledger totals, and rank rewards. No income limits or production economy code were changed.
- Preserve transfer concurrency/idempotency, consent, privacy, authentication, voice, multiplayer and API coverage. The Worker contract adapter now includes room metadata in presence POST responses, matching the production PHP response consumed by the client.

## Validation

- `node scripts/build-r1.mjs`: successful frontend bundle generation, including a workspace path containing spaces.
- `npm test`: 332/332 pass, no skipped or cancelled tests.
- `npm run lint:php`: all PHP files pass syntax checks.
- `git diff --check`: passes.

The Guangzhou camera prototype still requires physical Android/iPhone performance and touch checks, plus owner acceptance before Phase 2. Local two-client PHP tests pass; these do not establish production-device or live-server performance.
