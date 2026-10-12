# Activities and Tasks: first release

The game phone now has Activities (replaces the generic Community activities entry) and Tasks. Activities provides Today, Calendar, My events and Tasks. The existing daily community screen is still accessible through Daily meetups. The approved city map, Three.js renderer, current multiplayer and all existing feature entry points remain unchanged.

## Launch activities

Schedules repeat in Beijing time. Defaults use every admin-enabled city, including China; Guangzhou gets matching campus/train/club aliases. Upcoming events are generated on dashboard access, with one unique occurrence per template/city/date, so scheduling does not require a new daemon. The first four templates are enabled:

- Monday City Mystery, 19:00–21:00: three distinct public venue clues. RSVP and check in at the first stop after ten seconds, then verify each clue at its actual venue after ten seconds. Checkpoints must be completed in order; the server grants ¥60 / 20 XP once at the final stop.
- Wednesday Gist Night, 20:00–22:00: a discussion topic, one minute of participation and a Gist post created during the event and approved by an admin. Reward: ¥40 / 20 XP. Sending many messages does not earn rewards. Approval and claiming currently must happen while the event is live.
- Friday Party Night, 20:00–23:00: visit the club, participate for one minute and answer the event music question. Reward: ¥50 / 20 XP. The answer is absent from the player response. Existing music, chat, voice and dance routes remain separate and operational; this release does not introduce a synchronized 3D dance competition.
- Sunday City Hall, 20:00–21:30: one minute of attendance and a community preference response. Reward: ¥30 / 15 XP. Aggregated responses appear in the activity details. This is separate from the existing election ballot and does not grant leadership/account-management permissions.

Campus Clash, Business Day and City Showdown are visible as coming soon and cannot be enabled before their competitive gameplay is implemented. Existing study/lunch/social sessions retain their participation, rewards and completion records; their schedules/venues are now configurable in the same editor.

## Admin

Phone Admin → Weekly activities, or full Admin → Weekly activities. Edit title, day, city, public venue, time and bounded rewards. Mystery clue routes, topics, options and correct trivia answers use form controls. Templates have revision checks so one admin cannot silently overwrite another's changes. Future occurrence snapshots update from the latest template revision; already-started snapshots keep their instructions and reward amounts. A specific occurrence can be cancelled. Disabling a template immediately blocks participation and reminders, without deleting completed records. Daily community session rewards remain ¥100 / 30 XP.

This first release edits the curated launch templates; arbitrary new activity types, delegated host permissions, anonymous submissions, automatic Feed publishing and competitive city/university leaderboards are later work.

## Tasks and economy

Today: claim the existing daily reward, explore two public venues, complete a featured activity or daily community session, and make a new accepted friendship. This week: complete two activities, explore five public venues and claim three daily rewards.

Progress comes from authenticated server receipts. Public visits require at least ten seconds; a new friendship is recorded once per pair on acceptance, not on sending a request. Task rewards use unique account/period/task claim keys. Chests require every task to be claimed. Claims serialize against the player's save and reuse the existing reward ledger and save revision mechanism. A task's client-supplied progress is never accepted.

The reward calendar preserves the existing daily streak formula: ¥50 and 20 XP per streak day, capped at day seven. It grants no extra calendar reward. Migration preserves today's previously claimed daily reward as a receipt; it does not invent prior attendance history.

## Sharing, reminders and privacy

RSVP is independent from joining a venue. Registered counts and friends registered come from real memberships, with blocked accounts excluded from friend names. Solo players can finish the launch challenges; no fabricated companions are counted.

Share invitation uses the device share sheet, or copies an activity link for manual sharing. It does not automatically publish a Hafrik post. Activity links open the relevant dashboard occurrence after login; another-city links require the player to move to that city rather than silently changing their save.

An optional RSVP checkbox enables a Hafrik reminder and result notice for that occurrence. The existing CLI worker creates a reminder during the ten minutes before start or first five minutes after start. Delivery is deduplicated across retries. Notification type `chinalife_activity` is already recognized by the native helper; the server authorizes the recipient's membership and the game inbox opens the matching Activities detail. Delivery still depends on the installed Hafrik push provider, device permission and the compatible existing native helper. Integration-wide notification off switches are respected.

No timed screen rebuilds: countdowns update text only, Refresh is explicit, network failures keep inputs, duplicate buttons are locked and account changes clear private views.

## Deployment

Use the existing release checkout and deployment script:

```sh
cd /www/chinalife-security-release &&
git fetch origin release/security-politics &&
git merge --ff-only origin/release/security-politics &&
./scripts/check-hafrik-integration.sh /www/wwwroot/hafrik.com &&
./scripts/deploy-php.sh /www/wwwroot/hafrik.com /www/wwwroot/china-life.hafrik.com/public
```

The script selects a Composer-compatible PHP CLI and runs the repeatable database migration before publishing client files. Do not run plain PHP 8.3 against the installed Hafrik dependencies.

Keep or configure this existing job every minute for reminders:

```sh
bash /www/chinalife-security-release/scripts/run-life-notifications.sh /www/wwwroot/hafrik.com
```

The worker still sends city-launch notices; weekly delivery adds a separately bounded batch of up to 50 opted-in recipients. No new service, credentials or native rebuild is required for clients already supporting the existing activity notification route.

## Verification and remaining production checks

Automated tests cover permissions, schedule revision conflicts, hidden answers, future/live windows, ordered attendance, duplicate event/task claims, Gist approval, solo challenge completion, civic responses, reminder opt-in/delivery deduplication, inbox ownership, stale account/admin responses and failed-save draft retention. Existing regression tests cover the map, multiplayer, voice, authentication and economy. Mobile previews use fixture data and are layout checks, not evidence of production attendance.

After deployment: use two Hafrik accounts to RSVP, check in at the same event, complete independently and verify one reward each. Check a reminder on a real iOS/Android device, edit a future schedule, cancel one occurrence, and confirm old features and daily sessions still work. Competitive minigames, 3D controller/camera milestones and production device load measurements remain separate planned releases.
