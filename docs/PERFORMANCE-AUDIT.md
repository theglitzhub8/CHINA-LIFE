# ChinaLife server performance audit

Date: 2026-10-10 · Scope: ChinaLife frontend (`public/`) and PHP API (`chinalife-api/`) · Status: **audit and
proposal only. No production behaviour has been changed.** Changes below wait for approval.

## 1. Summary

ChinaLife is a pure PHP polling system. There is no WebSocket anywhere (the `worker/` folder is an old, unused
Cloudflare backend). Every open game sends about **180 PHP requests per minute** (3 per second), even when the
player is idle on the map, and about **7 database queries per request**. Each request also pays Hafrik's full PHP
bootstrap and Sngine token check, which our benchmark cannot measure but is likely the largest per-request cost on
production.

The request mix in a controlled benchmark of today's timers matches the production access log almost exactly
(notifications > presence > voice > activities > music > save > home visits), so the cause is clear: **polling
intervals, not slow queries.** Most requests return "nothing changed".

Projected effect of the proposed schedule (same benchmark, 30 players): **179.6 → ~26 requests per player per
minute (−85%)**, and **37,826 → 6,432 database queries per minute (−83%)**, before any query or Redis work.
The final design keeps fast updates where players are together (see §5), so the real reduction will be a little
smaller: we target 70–85%.

## 2. Measured baseline (controlled benchmark)

Tool: `node tests/load/bench.mjs --players 30 --seconds 60 --schedule current` (private MySQL + PHP built-in server
with 4 workers, 30 players with ~16 KB saves, 25% in a club, 40% in voice). Never touches production.

Per player, today's timers:

| Endpoint | Requests / player / min | Median ms (30 players) | DB queries / request |
|---|---:|---:|---:|
| notifications.php (every 1 s) | 59.7 | 2.5 | 5.2 |
| presence.php POST (every 2.5 s) | 23.8 | 16.2 | 9.2 |
| presence.php GET (every 2.5 s) | 23.8 | 13.8 | 5.2 |
| activities.php (every 3 s) | 20.0 | 2.6 | 4.2 |
| save.php GET "transfer check" (every 5 s) | 11.9 | 2.2 | 3.2 (returns the whole 16 KB save) |
| voice.php + voice-signal.php (every 1.8 s, voice players only) | 11.1 + 11.1 (28 each per voice player) | 3.7 / 2.3 | — |
| music.php (every 2.5 s, in clubs only) | 8.7 (35 per club player) | 2.8 | — |
| home-visits.php (every 10 s) | 6.0 | 2.3 | 3.2 |
| save.php POST (every 30 s game tick) | 2.0 | 3.5 | — |
| events.php (every 45 s) | 1.4 | 3.7 | 11.2 |
| **Total** | **179.6** (89.8 req/s for 30 players) | | **7.0 average** |

Presence is the slowest endpoint under load (median 14–16 ms vs 3–5 ms when idle) because it scales with the number
of online players (see root cause 4).

To reproduce the same picture on production (read-only), run on the server:

```
# Requests per ChinaLife endpoint in the last 20,000 log lines, and over what time span
tail -n 20000 /www/wwwlogs/hafrik.com-access_log | grep -o 'chinalife/[a-z-]*\.php' | sort | uniq -c | sort -rn
tail -n 20000 /www/wwwlogs/hafrik.com-access_log | head -1 | cut -d'[' -f2 | cut -d']' -f1
tail -n 1     /www/wwwlogs/hafrik.com-access_log | cut -d'[' -f2 | cut -d']' -f1
# Is OPcache on for PHP-FPM 8.4? (look for opcache.enable => On)
/www/server/php/84/bin/php -d opcache.enable_cli=1 -i | grep -E 'opcache.enable |opcache.memory'
grep -E '^pm|^pm\.' /www/server/php/84/etc/php-fpm.conf
```

## 3. Root causes, ranked by measured impact

1. **Notifications every second (33% of all requests).** `notifications.js` polls `notifications.php` every
   1 s for every open game, only to learn whether a new venue or private message arrived. Almost always empty.
2. **Presence every 2.5 s, as two requests (26%).** `cloud.js presenceHeartbeat` sends a POST (my position)
   and then a GET (everyone in the city) every 2.5 s, whether or not the player moved and whether or not anyone
   else is around. The POST also writes a rate-limit row each time.
3. **Shared activities every 3 s (11%).** `shared-activities.js` polls `activities.php` all the time, only to
   catch rare invitations.
4. **Presence reads every online player's whole save, for every request (slowest endpoint, grows with
   players).** `presence.php` joins `chinalife_saves` and runs `JSON_EXTRACT` on each online player's full save
   (up to 300 rows) to get their outfit and XP. Every player does this every 2.5 s, so the work grows with the
   square of the number of players online.
5. **Save checked every 5 s and written every 30 s (8%).** `cloud.js syncTransfers` downloads the whole save every
   5 s to see whether money was received. The game tick in `game.js` saves the whole state every 30 s even when
   nothing meaningful changed.
6. **Voice every 1.8 s, as two requests, for everyone in a venue with others (12%).** Since speakers switch on
   automatically, every player in a busy venue polls `voice.php` + `voice-signal.php`, even long after the
   connections are set up and no signalling is happening.
7. **Club music every 2.5 s (5%).** `audio.js sync` polls `music.php` in clubs although the next track change time
   is known in advance.
8. **Home visits every 10 s (3%).** `home-visits.js` polls although visits change rarely.
9. **Rate limiting writes to the database on every request.** `cl_rate()` does an INSERT … ON DUPLICATE plus a
   SELECT for each call, so high-frequency endpoints also create constant write load (Redis would be cheaper).
10. **Idle and background games keep polling.** All loops pause when the page is hidden, but a game left open on a
    screen (or inside the Hafrik app, where background may not fire `visibilitychange`) polls forever at full
    speed. Two open tabs poll twice.

Not a cause: query plans. Every polling query is an indexed primary-key or `(city, place, seen_at)` lookup and runs
in a few milliseconds; the volume of requests is the problem.

## 4. Frontend → backend request map

| File · function | Endpoint | When | Interval today |
|---|---|---|---|
| notifications.js · pollMessages | notifications.php GET | signed in, visible | 1 s |
| cloud.js · presenceHeartbeat → refreshPresence | presence.php POST + GET | signed in, visible | 2.5 s |
| cloud.js · syncTransfers → loadRemote | save.php GET | signed in, visible | 5 s |
| cloud.js · scheduleSave/upload (from `chinalife:save`) | save.php POST | 1.5 s after any save; game tick saves every 30 s | 30 s + on actions |
| cloud.js · refreshOnline | online.php GET | always | 30 s |
| cloud.js · refreshEvents | events.php GET (events, ranks, partners, ads, songs, gist) | signed in, visible | 45 s |
| cloud.js · refreshGolden | golden.php GET | always | 60 s |
| cloud.js · gesture | gestures.php POST | on tap | — |
| shared-activities.js · poll | activities.php GET | signed in, visible | 3 s |
| home-visits.js · poll | home-visits.php GET | signed in, visible | 10 s |
| social.js · refresh | social.php + messages.php GET | People open | 3 s |
| social.js · backgroundCheck | social.php GET | People closed | 30 s |
| voice.js · pulse | voice.php POST + voice-signal.php GET | in voice (auto speakers) | 1.8 s |
| voice.js · signal | voice-signal.php POST | WebRTC set-up (offer/answer/ICE) | burst |
| voice.js · autoListen | (decides to join) | always | 4 s (no request) |
| audio.js · sync | music.php GET | in a club, visible | 2.5 s |
| radio.js | static song files | while playing | streamed |
| ai-agents.js | ai.php | on chat | — |
| game.js | studio, fortune, leaderboard, gist, politics, applications, transfers | on screens | on demand |
| world.js | messages.php (venue preview) | on venue card | on demand |

Timers with no network cost (fine): sound.js (170 ms, 2.5 s, 3 s, 1 s), audio.js tick (40 ms) and gain (300 ms),
world.js lighting (15 s), game.js reminders (60 s) and delivery check (4 s).

Duplicates and overlaps found: no loop can overlap itself (each has a `polling` guard), but several loops ask the
server the same question in different ways (notifications, social background check and activities all look for
"something new for me"; presence and voice both report where I am). Two tabs double everything.

## 5. Proposed changes (in small batches, each tested and measurable)

**Batch 1: one "anything new?" heartbeat (biggest win, small change).**
- Presence GET returns a tiny "inbox" block with change counters: latest message id for me and my venue, pending
  activity invitation, pending home visit, my transfer total and shared XP, and versions for events, partners,
  ads and songs. These are cheap single-row lookups.
- The game fetches details only when a counter changes: notifications.php, activities.php, home-visits.php,
  save.php (transfers) and events.php stop polling and become "on change" (with a slow safety poll of 60–120 s).
- Adaptive presence: every 3 s while other players are in your venue or you are moving, 15 s when you are alone
  or on the map, 30 s after 5 minutes without input. Position POST only when position or place changed (a
  keep-alive every 15 s), merged with the GET into one request.
- Expected: about −70% requests on its own.

**Batch 2: saves.**
- Dirty-state tracking: the 30 s tick only saves when meaningful fields changed (money, items, place, progress),
  not because the clock moved; debounce stays at 1.5 s; a checkpoint at most every 2 minutes while active.
- Saves already use revision numbers (409 on stale writes), and money, transfers, rewards and purchases that
  matter are server-authoritative. Keep both, and add `navigator.sendBeacon` for a last save on page hide
  (best effort, never relied on).

**Batch 3: voice and music.**
- Voice pulse at 1.8 s only while connecting or when someone joins, then 6 s once connections are up (signals
  are only needed during set-up); presence already tells us when someone new arrives.
- Club music: fetch on entering the club, when the current track should end, and every 20 s; queue requests
  trigger an immediate refresh.

**Batch 4: server-side cost.**
- presence.php: store the outfit, colours and XP in `chinalife_presence` when the player saves (one write), so
  presence reads never parse saves. Keep the response size bounded (nearest 100 players, venue first).
- Rate limits: use Redis (`INCR` + `EXPIRE`) when available, with the current database version as fallback.
- Optional short shared cache (1–2 s in Redis) for the per-city player list, filtered per player for blocks
  after reading (never caching private data across users).
- Add a `Server-Timing` header (time and query count) to every ChinaLife response so production timings can
  be read in the browser without logs.

**Batch 5: idle, tabs and the app.**
- After 5 minutes without input, every loop slows to 60 s and voice auto-speakers leave; the first tap restores
  normal speed.
- One tab leads: a `BroadcastChannel` lets only the visible tab poll; other tabs listen.
- Inside the Hafrik app, also pause on `pagehide`/`freeze` and when the app sends its background message.

**Batch 6 (later, behind a flag): WebSocket service.**
- A small Node.js service with Redis pub/sub for presence, movement, notifications and voice signalling. PHP
  keeps authentication, saves and all money operations.
- Auth: the game asks PHP for a short-lived signed ticket (60 s) and sends it as the first WebSocket message
  (never in the URL).
- Feature flag in `shared-config.php`; the polling path stays as the fallback until the service is proven.
- Only worth it after batches 1–5; with them, PHP polling should carry many more players comfortably.

**Static assets (separate, measured separately).** Files are gzip-compressed but sent with
`cache-control: no-cache`, so every load re-checks ~40 files (cheap 304s, not PHP). Proposal: versioned file names
(or `?v=<commit>`) with `max-age=1y, immutable` for scripts, the Three.js bundle, models and icons; keep `index.html`
`no-cache`. Static files do not run PHP, so this mainly helps phones on slow networks.

## 6. Code changes in this audit
- `tests/load/bench.mjs`: the controlled benchmark used for the numbers above (`--schedule current|optimized`).
- No game or API behaviour has been changed yet.

## 7. Remaining bottlenecks after the proposal
- Sngine bootstrap and token check on every request (unmeasured; the `Server-Timing` header will show it).
- WebRTC voice signalling still goes through PHP until the WebSocket service exists.
- `events.php` builds a large combined response (events, ranks, partners, ads, songs, gist); it becomes rare
  with change counters but could be split if it grows.

## 8. Testing plan for each batch
- Existing suite (`npm test`, 262 tests) plus new tests for each changed loop: no duplicate timers, no
  overlapping requests, slow-down when idle/hidden, immediate refresh when a counter changes.
- Scenarios: one player; two players in one venue (see each other move within 3 s, see each other leave within
  30 s); players in different venues; join/leave; voice connect/disconnect; messages and invitations arrive
  within the target time; club music and queue; saving, purchases and transfers (no lost progress, 409 on
  stale writes); network loss and reconnection with backoff and jitter; two tabs; the Hafrik app WebView.
- Benchmark before/after for each batch with `tests/load/bench.mjs` at 10, 30 and 60 players.

## 9. Deployment and rollback
- Each batch is its own commit; the server update stays `./scripts/update-server.sh …`.
- Before each deploy: `git tag perf-before-batch-N` and note the access-log counts from §2.
- Roll back a batch: `git revert <commit>` (or check out the previous tag) and run the update script again;
  no batch changes stored data, and any new database columns are additive.
- No PHP-FPM, Apache or MariaDB settings are changed by these batches. Separately, it is worth confirming that
  OPcache is enabled for PHP 8.4 FPM and that only the PHP version actually used by hafrik.com keeps a large worker
  pool (two pools of 150 workers each can over-commit 4 cores and 16 GB).
- Correction to an earlier note: the server runs **Apache**, not nginx. For 100 MB song uploads the Apache setting
  is `LimitRequestBody` (usually unlimited by default), not nginx's `client_max_body_size`.
