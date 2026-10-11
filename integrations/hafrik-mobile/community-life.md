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

The migration adds the reward, visits, community, case and launch tables. Deploy files, then run `migrate.php`. City launch alerts queue for existing saved accounts. Configure this CLI worker once in the server's cron panel, every minute:

```sh
php /www/wwwroot/hafrik.com/api/v4/chinalife/dispatch-life-notifications.php
```

Each run processes up to 50 recipients, honors the admin notification switch, skips closed/expired launches and avoids duplicating existing Hafrik inbox alerts. It uses Hafrik's existing push helper; no new secrets or push credentials. New players see city launch information in the game.

The native helper in `/Users/mac/Documents/Hafrik 5 /src/pages/chinaLife/chinaLifeExperience.js` has been updated locally, with a reference copy in this repository. Rebuild/reload Hafrik to route `chinalife_case` and `chinalife_city` taps; a game server pull cannot update installed native code.
