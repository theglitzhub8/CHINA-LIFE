# Community life

The phone includes Your first day, Community activities, Police, Court and City openings. All use the authenticated Hafrik account. The approved map geometry and layout are unchanged.

## First day

A welcome notification opens a five-step checklist: visit HQ, explore three public venues, explore Hafrik Services, make an accepted friend, and claim a daily reward. Presence records public visits. Services is skipped when admin disables it. Completing the checklist grants ¥300 and 50 XP once per account; claims and balances are saved on the server.

## Elections

Existing weekly ballots retain other-player voting and personal campaign sharing. The board shows the previous completed election's winner, tied results, term countdowns, and current vote ranking. Counts refresh every 30 seconds while the board is open and the candidate search is not focused. A pending refresh cannot revert a submitted vote. Beijing weekly election boundaries are unchanged.

## Community activities

Community meetup is available all day at Hafrik Square; lunch runs 12:00–14:00 at the market, study runs 18:00–20:00 at campus, all in Beijing time. Two joined, unblocked players must be present. Claiming requires at least one minute of continuous venue attendance after joining. Each activity grants ¥100 and 30 XP once per Beijing date. This is real participation, not simulated online users.

## Police and Court

Players file private cases only against their own recorded outgoing game transfers. Both parties can submit up to five statements; game advisers provide writing guidance. Phone admin and the full admin dashboard can review evidence, schedule a hearing within 30 days and resolve/dismiss the case. Refunds cannot exceed the recorded transfer or available defendant funds and move funds between the two accounts once. An admin cannot rule on their own case. No automatic guilt, arrest or real-world legal action is implied. Harassment reporting still uses player-profile reporting.

Case notifications reuse Hafrik inbox/push and open the recipient's case after server authorization. Private statements stay out of notification previews. Device delivery depends on the existing Hafrik push provider and permissions; local tests record provider payloads, not real device delivery.

## City launches

Opening a city through admin creates one 48-hour celebration per city, global game announcement, free train/flight travel into the new city, and a ¥200 / 40 XP reward for visiting its Hafrik Square. Closing/reopening does not restart rewards or announcements. Old saves stay in their existing city. Current celebration availability refreshes with the existing event poll.

The migration adds the reward, visits, community, case and launch tables. The deployment script now selects a PHP CLI compatible with Hafrik’s Composer platform check, checks autoload, uploads the API, runs `migrate.php`, and only then publishes client files. If migration fails, the new client is not published. Override selection with `PHP_BIN=/absolute/path/to/php` if needed. City launch alerts queue for existing saved accounts. Configure this CLI worker once in the server's cron panel, every minute:

```sh
bash /www/chinalife-security-release/scripts/run-life-notifications.sh /www/wwwroot/hafrik.com
```

Each run processes up to 50 recipients, honors the admin notification switch, skips closed/expired launches and avoids duplicating existing Hafrik inbox alerts. It uses Hafrik's existing push helper; no new secrets or push credentials. New players see city launch information in the game.

The native helper in `/Users/mac/Documents/Hafrik 5 /src/pages/chinaLife/chinaLifeExperience.js` has been updated locally, with a reference copy in this repository. Rebuild/reload Hafrik to route `chinalife_case` and `chinalife_city` taps; a game server pull cannot update installed native code.

## Recovery after an interrupted deployment

Hafrik currently requires PHP 8.4.1 or newer. A server whose shell `php` resolves to 8.3 cannot load Composer, migrate the database, or send queued city notices. `scripts/hafrik-php.sh` checks the installed Composer minimum and finds a compatible CLI (including BaoTa 8.4/8.5). It does not alter dependencies or disable platform validation. If none is available, install/update a compatible PHP version in the server panel. Ensure Hafrik's website runtime also meets the installed dependency requirements. The scheduled-job wrapper uses the same selector.

Optional first-day visit tracking and city-launch reads now tolerate only missing-table errors so core presence and existing events keep working while an interrupted migration is repaired. New community screens report that the migration is required. Other database errors still surface normally.

Matching Hafrik businesses for existing game clubs use their canonical club map location. The place sheet keeps Go/Enter and adds View Hafrik business; it opens the synced business details, with the existing native Hafrik handoff. No new stall is generated for that same business. Matching is limited to unique names in the current city, with punctuation/case normalization; ambiguous listings stay separate. Existing approved club buildings and layouts are preserved. Meet People requests the Hafrik API's random sort on each discovery refresh, retains relevant search, and offers Shuffle people.
