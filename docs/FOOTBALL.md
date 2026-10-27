# Football Field: real matches and tournaments

Status (27 Oct 2026): first playable version. **Preview only.** It is not on the live game, the migration has not been run, and the switch stays off until approved.

## What players get
- At the Football Field, a **⚽ Play a match** button (the venue menu) opens a full-screen match screen.
- **Matches:** 1v1 up to 5v5 and 3 minutes long, with kick-off, goals, the score, the clock and a full-time card with the scorers.
  - Controls are a joystick plus **Pass** and **Shoot** buttons. On a computer, use WASD or the arrow keys, J to pass and K or Space to shoot.
  - Your team always attacks up the screen.
- **Lobby:**
  - Choose the size, then **Quick match** (join an open match or start one) or **New match**.
  - Pick Team A or B. The host kicks off.
  - Bots fill every empty spot, so a match is always playable, including solo.
- **Tournaments:**
  - Anyone can create one with a name, team size, start time and max teams (4/8/16).
  - Players register a team or join one.
  - At the start time, a knockout bracket is drawn. Top seeds get byes when the team count isn't a power of two.
  - Each pair of teams gets a match. Results move the winners on until a champion is decided.
  - A tournament match level at full time goes to 1 minute of golden-goal extra time, then seeded penalties.
  - Prize coins are optional and admin-only. They are split equally between the champion team's members.

## How multiplayer works (host-authoritative)
ChinaLife has no websocket server. Its realtime runs on PHP polling (presence) and WebRTC voice. The `tempo-api` Node service on the box belongs to a different product. So v1 relays matches through a new endpoint, `chinalife-api/football.php`:
1. The **host** is whoever created the lobby, or the first player to arrive for a tournament match.
   - The host's phone runs the match simulation (`public/football-engine.js`) 30 times a second.
   - About 5 times a second it sends a small snapshot (under 2 KB) and gets back everyone else's latest joystick and button input.
2. **Other players** send their input about 7 times a second, and each reply carries the host's latest snapshot.
   - Between replies they draw players moving along their last known velocity, so movement looks smooth.
   - Expect about 0.2–0.4 s of lag for guests.
3. **Results are checked by the server** (`fb_check_result` in `football-lib.php`). The host reports the score and goal list at full time.
   - The server rejects the report when:
     - the match isn't 3 minutes old;
     - the goals don't add up to the score;
     - a scorer wasn't in the match;
     - goal times are out of range;
     - the winner is wrong, including the seeded penalty winner.
   - Every other player sends the score they saw. A tournament result counts once a player on the other side agrees.
   - Any mismatch becomes a **dispute** that an admin settles.
   - A casual result stands after 2 minutes if nobody objects.
4. **One match at a time:** you can't create, join or quick-match while you're in another lobby, live match or unconfirmed result.
5. Lobbies expire after 15 minutes. A live match whose host goes quiet for 45 s is cancelled. If the host leaves, another player becomes host.

Later upgrade: move the snapshot and input stream to a WebRTC data channel, reusing the voice signalling and the TURN server. This would cut guest lag to roughly the network ping. The server would still validate results.

## Match v2 (arcade polish)

Files: `public/football-engine.js` (rules + physics, no DOM), `public/football-render.js` (canvas camera, stadium, sound), `public/football.js` (UI, input, network).

- **Look:** tilted broadcast camera that follows the ball (look-ahead, shake, zoom on replays); striped pitch with full markings, goals with nets/posts/bar; stands with a batched crowd that jumps on goals, roof floodlights, ad boards; kits with numbers, name tags for humans, YOU marker, ball shadow + spin + trail; minimap.
- **Controls:** floating joystick; **Pass** (tap = pass to the teammate in the stick direction, hold > 0.26 s = lob); **Shoot** (hold to fill the power ring, aim with the stick, over-hit balls fly over the bar); **Sprint** (drains stamina). Without the ball the buttons become **Switch** and **Tackle** (slide). Keys: WASD/arrows, J pass, K/Space shoot, Shift/L sprint. Auto-switch to the player nearest the ball.
- **Physics/rules:** acceleration and turn rate, close dribbling, steals and slide tackles, ball gravity/bounce/friction, posts and crossbar, keepers that position, dive, catch or parry and distribute; kick-ins, corners and goal kicks; 3-2-1 kickoff countdown. No half-time switch (matches are 3 minutes).
- **Bots:** roles (keeper/defender/midfield/attacker), pressing, cover, passing (lob over blocked lanes), shooting in range. Difficulty Easy / Normal / Hard (host or offline picks it in the lobby).
- **Juice:** GOAL! splash, scorer banner, slow-mo, confetti, crowd cheer/ooh, whistles (WebAudio synth, mute button), haptics, 4-second instant replay; full-time card with man of the match, possession and shots.
- **Network:** guests send `{mx,my,sprint,pass,shoot,act:{n,type,power}}` every 120 ms and re-send an action for ~0.4 s; the host applies each action number once. Guests interpolate snapshots (delay adapts to round-trip) and predict their own player. Works on the v1 relay (pass/shoot booleans, rising edge); `chinalife-api/football.php` in the repo also stores `sprint` and `act` (backward compatible) — deploying it touches the shared API and needs approval.
- **Performance:** one canvas, crowd drawn in 7 batched fills, adaptive quality (lower DPR and half crowd when frames are slow). `ChinaLifeFootball._drawMs` shows the average draw cost.

## Offline / preview
In the preview sandbox everything runs on the device:
- you plus bots;
- local tournaments that you fill with local teams;
- **Play out the other matches** fast-simulates the bot-vs-bot games, and the bracket advances.

Data is stored under the sandbox prefix in localStorage.

## Server pieces
| File | What it does |
|---|---|
| `chinalife-api/football.php` | Lobby, join/team/leave/start, input/snap relay, result/confirm, tournaments (create, register, join, leave, play) |
| `chinalife-api/football-lib.php` | Pure helpers (bracket, penalties RNG identical to the JS engine, result check, settle rules) plus DB helpers |
| `chinalife-api/football-admin.php` | Admin actions, included from `admin.php`: `football`, `set_football`, `football_tournament_save`, `football_tournament_cancel`, `football_match_resolve` |
| `chinalife-api/pending/migration-football.sql` | 5 tables plus the `football_matches` switch row (**off**). It sits in `pending/` so `migrate.php` does not pick it up. |

Admin UI: the **⚽ Football matches** card in the admin panel and the in-game admin sheet. It has the on/off switch, create/edit/cancel tournaments, prize coins, and disputed results.

## Going live checklist
1. Back up the DB, run `pending/migration-football.sql` once, and upload the three PHP files plus the `admin.php` hook.
2. Deploy the front end (football-engine.js, football.js, football.css, world.js/game.js/admin.js hooks, rebuilt bundles).
3. Test with two seed accounts on two phones: a lobby, a full match, the result confirm, and a 2-team tournament.
4. Turn it on in Admin > Football matches.

## Tests
- `tests/football.mjs` (in the normal suite) covers the engine, the bracket, the report check and PHP/JS parity through the php CLI.
- `tests/php-api-football.mjs` runs the real API against a throwaway local MariaDB/MySQL: switch, lobby rules, relay, results and disputes, a full tournament with a prize, and two clients steering over the API. Run it on its own: `node --test tests/php-api-football.mjs`.
