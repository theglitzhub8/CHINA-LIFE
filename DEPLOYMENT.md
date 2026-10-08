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

The Hafrik accounts `hafrik` and `horlaarsman` see an **Admin** app on the in-game phone (Overview, Players, Events, Reports). Every admin request is checked on the server. These two product admins remain enabled. To authorize additional admins, create `/www/wwwroot/hafrik.com/api/v4/chinalife/admin-config.php` (not in git):

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

Voice remains opt-in; Join & talk starts with the microphone on. Add a TURN relay for networks where STUN-only peer connections fail. The game economy remains a local simulation synchronized as saves; it is not yet a server-authoritative competitive economy.

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

## Shenyang universities, nightlife, dining and social invitations

Deploy PHP API and public files together using the normal update-server script. This release reuses the existing shared-activities table; no new schema migration is required if the previous shared-activities migration has already run. Reopen the game or hard-refresh after updating.

All 15 requested universities are in character setup and **Profile → Your university**. Selecting a university updates the student profile and future story destinations without resetting story progress or teleporting the player. They have separate locations on the compressed Shenyang game map, campus activities and wall signs. The former Dongbei venue ID remains a Northeastern study annex to preserve existing character locations; Dongbei University of Finance and Economics is no longer offered as a Shenyang university choice. These are reusable campus scenes, not detailed reproductions of each real campus. Additional Shenyang venues are not offered on other city maps.

The catalogue's `shenyang` section defines university identity, focus and map positions; clubs define their names, positions, accents, room styles and preferred music. Map placement is a game layout, not real street coordinates. Universities share campus logic, restaurants share food/menu logic, and clubs share DJ queues. Existing BLOOD & EMBERS and SKYLIGHT remain available.

| Club | ChinaLife atmosphere |
| --- | --- |
| 007 Club | Largest room and map building; main stage, speakers and side lounge areas; existing open-mic/drinks retained |
| Youle Singing & Dancing Club | Pink karaoke and sing-along stage |
| EX PLAYMALL | Cyan neon and arcade cabinets |
| REX MUSIC CLUB | Amber live-band stage and drum props |
| Orangutan Bunker | Green industrial bass room and pillars |
| Taxi Club | Yellow street-style lounge |
| BEST ONE CLUB | Gold VIP seating |
| CAT'S EYE | Purple intimate lounge |
| Silver Knight | Silver-blue electronic hall with light bars |

Each club has a wall name, evening opening hours, activities and its own PHP music queue. Music remains the existing original instrumental loop system. Game atmospheres are creative interpretations, not claims about real venue interiors or music policies.

Black Sheep Restaurant & Bar and Tank have separate dining locations, wall signs, different decor and game menus. Food is ordered and paid for through each venue's Menu. Their dinner invitations do not automatically purchase meals or charge another player.

Travel now offers Walk, Shared bike, Metro, Bus, Cab, DiDi Economy and DiDi Premium. Central travel options define virtual fares, game minutes and energy costs; payment happens once on arrival, and cancelling the animation costs nothing. Bikes, buses and ride-hailing have travel props/status messages. Metro and bus currently use the existing simulated street journey; real stations, timetables, bookings and a DiDi service integration are not part of this release.

**People → player profile** now offers girlfriend/boyfriend requests, a date, dinner at either restaurant, and a club invitation. These extend **Phone → Together**. Requests alert the invited player; they can accept or decline. Date/dinner/club sessions require both players at the destination, ready and participating. Partnership requests become a saved relationship only when the invited player accepts. Both see their partner in Together after reconnecting; either can end it. Blocking ends the relationship and cancels invitations. Romantic requests grant no money or XP. Relationship state is stored server-side in the existing invitation records rather than a client-editable character field.

Validation: full 152-test suite passed, including two actual game-client sessions against local PHP/MySQL, consent/refusal, relationship reconnect/block, both restaurants and every club invitation, all university presence endpoints, university selection/save reload, seven transportation payment/cancellation paths, and reachable activities in every venue. This is local integration testing; the live server still needs deployment and a two-device smoke test.

Reference checks: [Northeastern University](https://english.neu.edu.cn/index.htm), [Shenyang Aerospace University](https://en.sau.edu.cn/index.htm), [Shenyang club listings](https://sg.trip.com/toplist/tripbest/recommend/shenyang/best-clubs/100900006707/), and [Black Sheep listing](https://5ishenyang.com/2024/08/15/black-sheep-western-restaurant/). Tank's specific real-world details and 007's real-world size were not verified; Tank uses the supplied name and a game-designed dining room, and 007 is largest specifically within ChinaLife. Other venue opening times, prices and interiors are game settings.

## Home portfolios, fortunes and gender-based invitations

Players can set **male/female in Profile → Edit appearance**, or during character creation. Existing accounts keep their character and start with unset gender. Opposite-gender romantic requests show the matching boyfriend/girlfriend label, and dates use the same rule. Both players must have set their gender; the PHP API checks invitations and acceptance. Friendships, dinners and club invitations stay available independently of gender. Existing relationships are preserved.

**Admin → Players** automatically lists saved ChinaLife characters, online first, with wallet, XP and last location. It has 25-player pages and an optional username filter. Existing wallet grants and server-side admin authorization remain.

**Phone → Homes** lists owned home types and five purchasable Shenyang addresses, also shown on the map. Home types now include penthouse and mansion. Buying another type retains earlier purchases; switching back costs nothing. A selected address becomes the Home navigation destination. Older single-home saves populate the portfolio automatically. Different home types change the map building and interior floor, scenery and signage. New furniture: television, dining set, gaming station, piano, aquarium and safe. All purchased items render in owned residences, with fixed positions and saved finishes.

**Phone → Fortunes** contains three hidden progression opportunities worth ¥250,000, ¥1,000,000 and ¥2,500,000 in virtual currency. Exploring relevant locations reveals rewards; skills, activities, studio orders and career progress unlock claims. Values and requirements live in `chinalife-api/fortune-config.php`. PHP verifies the saved requirements and records each reward once per account in `chinalife_fortune_claims`. Wallet revision/transfer synchronization keeps rewarded balances across reconnects. Progression still uses the existing client-save model with server growth caps; this is not a fully server-authoritative economy.

Other players' profiles show a wealth tier, estimated virtual net worth, homes and owned furniture. The authenticated profile endpoint exposes only these public fields, honors blocks and excludes the private save. Asset valuation is configured in `chinalife-api/assets.json`.

Scope: city addresses currently represent personal game homes at shared venue coordinates. Furniture inventory is shared across your owned residences; per-address decoration layouts, exclusive ownership of a city plot, selling homes and private visitor instances are future work. Housing purchases extend the existing saved-character purchase system.

Deploy with the usual update script **and run the migration** for the new reward-claim table:

```bash
cd /www/chinalife-source
./scripts/update-server.sh \
  /www/wwwroot/hafrik.com \
  /www/wwwroot/china-life.hafrik.com/public
/www/server/php/84/bin/php \
  /www/wwwroot/hafrik.com/api/v4/chinalife/migrate.php
```

After deployment, reload both devices. Set gender on existing profiles, test a request/acceptance with two accounts, buy a home and furniture, then reconnect and inspect that account from the other player's profile. Verify Admin → Players loads without typing a username. The local integration suite covers two client sessions, persisted consent, rejected mismatched requests, once-only fortunes, public wealth, automatic admin listing, portfolio reloads, furniture rendering and reachable home activities. Live server/device validation remains necessary.

## Bank-style wallet and home switching

The wallet now includes a Hafrik card with available virtual-yuan balance, account holder and wealth tier. It shows net worth, owned-home count, asset value, rent and the last 20 player transfers, with usernames and incoming/outgoing amounts. **Show off your wallet** opens a clean brag card; **Copy my brag card** copies its text for sharing, with a selectable-text fallback. The card clearly identifies all values as virtual game currency.

`hafrik` and `horlaarsman` are the two built-in product admin usernames, checked by the PHP API. The server-only `admin-config.php` can authorize additional usernames and no longer replaces these two. Updating the API is sufficient; reconnect/reload each admin account to refresh the phone's Admin app.

Switching to a purchased city address while inside a residence now moves the active scene to that address. Selecting a different owned home type while inside an address-based house now returns to the main home and renders the selected type. The selected house and location are saved together; selecting an already-owned home does not charge again. When outside a residence, selecting a home changes the Home destination while preserving your current venue. Switching during an unfinished movement/activity is blocked.

Use the normal server update command. No new schema migration is required specifically for this wallet/admin/home-switch update; run the existing migration if the earlier fortune-claims update has not been migrated yet.

Validation: full 162-test suite passed, PHP syntax checks passed, and the subsequent Home-map navigation fix passed the focused 28-test world/wallet suite. Tests cover both built-in admins, unauthorized access rejection, escaped transfer names and directions, stale response handling, wallet copying, immediate house changes and travel to the chosen home. Live server deployment/device smoke testing remains outstanding.

## Simpler voice and redesigned Hafrik login

The wallet, showcase and copied brag text no longer display “Virtual game currency · no cash value”. Currency behavior is unchanged.

Voice now has one **Join & talk** action. Its introductory text explains that this enables the microphone; the permission request starts directly from the tap. Successful joining enables talking immediately. Joined players see **Mute/Unmute** and **Leave voice**. Incoming audio plays automatically, with **Hear players** shown only when playback is blocked. The outdated experimental/TURN footer is removed. Permission-denied, missing-microphone and busy-microphone failures give short recovery instructions. Leaving, changing venues or backgrounding still stops the microphone. A late permission response after leaving cannot activate voice.

Voice still depends on browser/app microphone permissions and the existing TURN configuration for restrictive networks. A UI update cannot grant native app microphone permissions or configure a relay on the production server. The existing Voice relay section above describes the server configuration; keep its tokens private.

The Hafrik account dialog now uses a dedicated card layout. Browser players see **Continue with Hafrik** and manual email/username login together, with Show/Hide password, a Hafrik account link and **Keep exploring**. Inside the app, native Hafrik authentication remains primary, with manual login as a fallback. Connected, conflicting-save and failed-character-load states retain their existing safeguards and controls.

Validation: full 166-test suite passed, including two voice clients, one-tap unmuted joining, mute/leave, playback-blocked recovery, late permission cancellation, manual login visibility and password toggling, existing authentication/restoration cases, and wallet copy text. Live microphone playback must still be tested on two actual devices after deployment. Use the standard update script; this release adds no schema migration.

## Studio feedback, home chooser and active-city lists

Studio launch/expansion failures now explain their requirements inside the open studio panel, with current skill levels, balance and order counts. Successful launch changes the panel to the working studio and confirms the result. Starting a client-order animation closes the panel so the player can see their character working. Location and needs failures stay in the panel. The current city's hub name is used for order-travel feedback.

**Home** in the main navigation and phone opens **Which home in [city]?**. It lists only that city's owned home types and addresses; players with no purchased homes get their starter home. Selecting a home costs nothing, saves the selection and offers the existing transport flow when travel is needed. The main home keeps routines/furnishing controls separate from this destination chooser.

Home interior presets now distinguish starter homes, apartments, townhouses, villas, penthouses and mansions. Higher tiers include richer fixtures and decor, with different finishes, signs, garden/courtyard details, skyline windows/terraces, pools and premium lighting. Mansion and penthouse camera framing reveals their grounds/terrace. Fixtures included with the property are rendered without adding free objects to the separate furniture inventory; purchased furniture and finishes still appear. The traversable living-room footprint remains compatible with multiplayer coordinates; multi-floor rooms and editable decoration layouts are future work.

The city picker and airport departures show only server-activated cities. Admin city management retains all cities so admins can activate them. Existing tickets to a subsequently disabled city remain visible for refunds, but boarding is blocked. Profile/origin information can still describe a player's real-world city independently of playable destinations.

No new schema migration is required. Deploy using the standard update script and reload both devices. Check studio launch feedback, one client order, Home's current-city choices, a premium residence, and city/flight lists with only Shenyang enabled.

Validation: full 173-test suite passed, including panel-visible studio requirements/results, visible client-order animation, current-city-only home choices, home switching without purchase charges, premium fixtures with reachable activities, inactive-city filtering and refunds for disabled-city flight tickets. Live server/device smoke testing remains outstanding.

## Studio client contracts

**Phone → Studio → Client contract board** extends the existing daily studio order. Three fictional clients offer poster, photo-campaign and project-launch briefs. Contracts specify studio level, skill requirements, base fee and a deadline in game days. One contract can be active at a time; accepting has no upfront cost, and withdrawing pays nothing.

Work at the current city's business hub. Choose quick, balanced or polished delivery; effort changes time, needs cost, payment and rating. Delivery after the deadline (including work that finishes after the final day) earns half the effort-adjusted fee and a 2/5 rating. Contracts share the ordinary studio order's one-delivery-per-game-day limit. Completing contracts contributes to existing order counts, expansion, business earnings, skills and XP.

Two deliveries rated at least 4/5 for a client unlock a 10% repeat-client quote. Client trust persists beyond the last 20 reviews. Active contracts, accepted base-fee quote, deadlines, reviews and client trust save with the character, including account saves and the legacy Worker validator. Existing studios need no reset. The original daily order remains available.

Client briefs, pricing, deadlines, effort options and repeat bonuses are centralized in `chinalife-api/studio-config.php`, loaded through authenticated, read-only `studio.php`. Contract-board access requires Hafrik sign-in; guest studios can still use their original order system. This extends the current client-driven progression/save model and server growth caps; contract deliveries are not fully server-authoritative or real commercial services. Quotes keep their accepted base fee while later effort/late rules come from the current catalogue.

Deploy with the normal update script. No database migration is required. Reload, open the contract board, accept a brief, reconnect to verify its deadline, then travel to the business hub and deliver. Verify the review, payment and daily limit.

Validation: full 185-test suite and PHP syntax checks passed. Tests cover eligibility, quote/deadline restoration, once-only completion, shared daily limits, late delivery, ratings, repeat-client trust, location/needs feedback, visible work animation with stale-character callback protection, authenticated catalogue access and PHP account-save restoration. Live server/device smoke testing remains outstanding.


## Private player homes

Starter homes and all purchased residence addresses now use private room instances derived from the authenticated owner plus the home address. Players can own the same property type without sharing an interior. Presence, room chat, message notifications and voice/signaling are isolated server-side; saved city/place IDs remain unchanged, so existing characters, selected homes and furnishings are preserved. Public venues still share multiplayer presence normally.

Other players' private home coordinates are excluded from city presence. Friends retain online status with a private-home location label. The generic venue invitation asks homeowners to choose a public venue; permission-based home visits are future work.

Deploy using the standard update script, then reload both devices. No schema migration is required. Test two different Hafrik accounts at the same home address: neither should see or hear the other; return both to the plaza and verify they appear together. Existing shared-home chat history remains stored but is excluded from the new private rooms.

Validation: full 190-test suite and PHP syntax checks passed, including two-owner PHP and Worker home isolation, blocked cross-home voice signaling and notifications, public-venue reunion, saved-home restoration and client protection against legacy shared-home responses. Live two-device verification remains to be done after deployment.
