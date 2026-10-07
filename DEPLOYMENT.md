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
