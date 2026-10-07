# Deploy ChinaLife through Git

## Quick update on the live server

After a change is pushed to `main`, run this on the hafrik.com server to pull it and copy the files into place:

```sh
cd /www/chinalife-source
./scripts/update-server.sh \
  /www/wwwroot/hafrik.com \
  /www/wwwroot/china-life.hafrik.com/public
/www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/migrate.php
```

Run the migration with PHP 8.4, the version the Hafrik site uses. The plain `php` command on this server is PHP 8.3, which Hafrik's Composer packages reject with "require a PHP version >= 8.4.1". If the path above does not exist, `ls /www/server/php/` lists the installed versions.

The migration step is safe to repeat; run it whenever an update changes the database. Then hard-refresh the game (or reopen it in the Hafrik app) to load the new files.

## 1. First server checkout

Choose a private source directory outside your websites' public document roots:

```sh
git clone https://github.com/theglitzhub8/CHINA-LIFE.git /path/to/chinalife-source
cd /path/to/chinalife-source
```

If the repository is private, configure GitHub access on the server using your normal SSH key or credential helper. Keep credentials out of URLs and files in this repo.

## 2. Deploy the two components

Replace both paths with your actual server directories:

```sh
./scripts/deploy-php.sh /path/to/hafrik-root /path/to/china-life-document-root
php /path/to/hafrik-root/api/v4/chinalife/migrate.php
```

The first directory contains Hafrik's existing `api/v4/db.php` and `helpers.php`. The second is the document root serving the ChinaLife URL, such as the root for `china-life.hafrik.com` or Hafrik's `china-life` subdirectory. They may be different websites on the same server.

The deploy script copies only the game and its API folder. It does not delete other host files, replace host-specific `.user.ini` settings, change existing Hafrik configuration, or run migrations automatically. Run it as the deployment user with access to those two target directories.

Back up the Hafrik database before the first schema upgrade. `migrate.php` checks whether `users.user_id` is INT UNSIGNED or BIGINT UNSIGNED, creates all required game tables, and adds missing revision/appearance/session columns. It is repeatable and preserves existing rows. Run it from the CLI. `.htaccess` blocks browser access to migrations and schema files on Apache; configure equivalent restrictions if using nginx.

Do not rely on `migration-all.sql` alone when upgrading an older installation: `CREATE TABLE IF NOT EXISTS` cannot add columns to existing tables. Use `migrate.php` instead. Legacy SQL files are retained for historical reference.

## 3. Future updates

```sh
cd /path/to/chinalife-source
./scripts/update-server.sh /path/to/hafrik-root /path/to/china-life-document-root
php /path/to/hafrik-root/api/v4/chinalife/migrate.php
```

The update script uses a fast-forward pull from `main`. A dirty or diverged checkout should be resolved before pulling; it will not reset or discard server edits.

## Admin panel

The Hafrik account `hafrik` sees an **Admin** app on the in-game phone (Overview, Players, Events, Reports). Every admin request is checked on the server. To change who is an admin, create `/www/wwwroot/hafrik.com/api/v4/chinalife/admin-config.php` (not in git):

```php
<?php return ['usernames' => ['hafrik']];
```

Admin events and the admin log need the migration after updating.

## Daily reminder notifications (when the game is closed)

Run once on the server to create this server's push keys (kept in `push-config.php`, not in git):

```sh
/www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/push-setup.php mailto:admin@hafrik.com
chown www:www /www/wwwroot/hafrik.com/api/v4/chinalife/push-config.php
```

Then add a daily cron job (aaPanel → Cron → Shell script), for example at 10:00:

```sh
/www/server/php/84/bin/php /www/wwwroot/hafrik.com/api/v4/chinalife/push-daily.php
```

Players turn it on in Settings → Turn on notifications. It works in Chrome, Edge, Firefox and Android, and on iPhone when the game is added to the Home Screen. It does not work inside the Hafrik app's built-in browser.

## Voice relay (Cloudflare TURN)

Voice connects players directly when it can and relays through Cloudflare TURN when mobile data or strict Wi-Fi blocks a direct connection. The API token must stay on the server only. Create the config once (the deploy script never overwrites or deletes it):

```sh
cp /www/chinalife-source/chinalife-api/turn-config.example.php /www/wwwroot/hafrik.com/api/v4/chinalife/turn-config.php
nano /www/wwwroot/hafrik.com/api/v4/chinalife/turn-config.php   # fill in key_id and api_token
chmod 640 /www/wwwroot/hafrik.com/api/v4/chinalife/turn-config.php && chown www:www /www/wwwroot/hafrik.com/api/v4/chinalife/turn-config.php
```

Without this file, `ice.php` returns STUN only and voice works on simple networks. If the token is ever exposed, create a new one in the Cloudflare dashboard and update this file.

## 4. Native Hafrik authentication

Copy `integrations/hafrik-mobile/ChinaLifeScreen.jsx` and `chinaLifeConfig.js` into `src/pages/chinaLife/` in the Hafrik app and rebuild/distribute it. These changes are already applied in the local `Hafrik 5 ` app project.

The screen reads the app's authenticated token/user from `useAuth()` and injects `window.HafrikSession` only into the configured HTTPS game origin and mounted path. Tokens are not put into the launch URL. The game obtains the verified account ID from the PHP save response, restores the account's character before setup, and keeps separate device backups per account. Native session tokens remain in page memory; browser users can optionally sign in manually and remember that login. iOS incognito mode is disabled so device backups persist.

`EXPO_PUBLIC_CHINA_LIFE_ENABLED=true` enables the route. Set `EXPO_PUBLIC_CHINA_LIFE_URL` to the game URL without credentials or query parameters. Deploying browser files alone cannot update an already installed mobile app.

## 5. Verify after pulling

1. Open the game with two different authenticated Hafrik accounts.
2. Select the same city and venue, for example Shenyang → Hafrik Square.
3. After a heartbeat, each should see the other avatar. Nearby lists players throughout the current city; venue avatars and chat use the current venue.
4. Exchange a venue message, accept a friend request, and send a private message.
5. Move one player to a different venue and verify the old room no longer displays that avatar.
6. Reopen the game. Existing characters should restore without repeating setup.
7. With two tabs for the same account, verify a stale save produces a conflict instead of replacing the newer character.

Inspect POST `/api/v4/chinalife/presence.php` if players do not appear. The account dialog shows the actual error. A 503 generally needs checking PHP logs, migrations, database permissions and required PHP extensions. A 401 requires a valid Hafrik session. Being signed into Hafrik without opening the game does not create game presence.

## API routes

All routes authenticate with Hafrik's existing helpers. Responses use `{status,message,data}`. Player IDs are strings; message timestamps are milliseconds; muted/own/outgoing flags are booleans.

| Route | Methods | Purpose |
| --- | --- | --- |
| `save.php` | GET, POST, PUT, DELETE | Account character and revision checks. Writes send `{revision,save:{character,game}}`. |
| `presence.php` | GET, POST, DELETE | City/venue presence; appearance and coordinates; 20-second expiry. |
| `social.php` | GET | Friends, pending requests and blocked players. |
| `friends.php` | POST | Request, accept, decline, cancel and remove friendship. |
| `messages.php` | GET, POST, DELETE | Venue chat or accepted-friend direct messages. |
| `block.php` | POST | Block/unblock; remove friendship and hide interactions. |
| `report.php` | POST | Store reason and message snapshot for review. |
| `voice.php` | POST, DELETE | Join/pulse/leave, up to four active room participants. |
| `voice-signal.php` | GET, POST | Validated WebRTC signaling for current source/target sessions. |
| `music.php` | GET, POST | Shared club track and request queue. |

Voice remains opt-in and starts muted. Add a TURN relay for networks where STUN-only peer connections fail. The game economy remains a local simulation synchronized as saves; it is not yet a server-authoritative competitive economy.

### Messages, club audio and promotion placements

The PHP release includes `chinalife-api/notifications.php`. Deploy it with the client; no schema migration is required. The client checks for new private and current-venue messages every three seconds while the game is visible, even with chat closed. Tapping an alert opens the conversation. Notifications respect friendships, blocking and venue presence. This is in-game messaging notification support, not operating-system push when the game is closed.

People checks the current authenticated session after restoration. An expired remembered browser token can fall back to an available Hafrik website session; a failed character restore never triggers replacement of that character.

Club audio uses the existing original instrumental loops and shared DJ queue. It begins on the first club tap permitted by the browser, remembers explicit mute on the device, pauses in the background, and stops outside clubs. Wall signs use each city's configured club name.

`public/catalog.js` contains the promotion campaign titles, links, venue lists and map coordinates. Current boards are labeled Hafrik house promotions, not paid advertiser campaigns. Replace their content and destination URLs when advertiser assets are ready.

## Shared student activities — Shenyang

Update the PHP API and public files together, then run the PHP 8.4 migration. It adds `chinalife_shared_activities` and preserves existing saves.

Players open **People → player profile → Do something together** to invite a teammate. **Phone → Together** reopens the current invitation/session and shows recent shared memories. Invitations appear as in-game alerts without requiring chat to be open.

The first activities are Study together (University Quarter), Campus basketball (Heping Gym), and Share a warm meal (African Kitchen). Both players accept the activity, travel to its venue, mark themselves ready, choose a response, and complete it after its real-time duration. Both must have fresh presence at the venue to start, respond and finish. Decline/cancel is supported; unanswered invites expire after five minutes and accepted sessions after thirty minutes. Reopening/reconnecting resumes an unexpired session.

The server's `shared-config.php` defines venues, prompts, durations and modest XP/money rewards. Completion and shared memories are server-side; each pair can earn a reward for each activity once per server calendar day. Completion retries cannot pay twice. XP uses the server-issued `sharedXP` marker and money uses the existing transfer reconciliation, so open clients receive rewards without replacing their character's ongoing progress.

Verify with two different Hafrik accounts: invite, accept, meet at the venue, ready both, choose responses, complete, and reopen both accounts. Test decline/cancel and leaving the venue before completion. The current activity layer uses short choices and existing animations; it does not introduce a physics basketball match or a full academic-performance system.

## Shift feedback

Steady and Focused shift now show availability inside the shift window, including next-day start, one shift per game day, and minimum energy/hunger. Both buttons show their energy cost. This is a client-only update: run the normal update-server script; no database migration is needed for this fix. Verified both shift buttons across all eight jobs and visible feedback for blocked shifts.

## Nearby player ranks

Real-player name labels now show the existing XP rank icon/title beneath the name. Presence reads XP from each account's saved game state, rather than accepting a client-supplied rank. Labels update on presence refresh and persist across map/venue rebuilds. Deploy the API and public files together using update-server.sh; no schema migration is required. Verified with two-account API tests and rank-label update tests.
