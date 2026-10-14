# ChinaLife release schedule

**One release slot a week: Friday 20:00 China time (UTC+8).**
Friday evening is the start of the weekend peak. An evening release keeps us online during the busiest hours to watch and fix things, and doesn't touch weekday routines.

| When (China time) | What |
|---|---|
| Mon–Wed | Build on a `world-vN` branch. Staging only. |
| Thu 18:00 | Code freeze. The release branch is tested on staging with personas (390×844), `npm test` at baseline, and the changelog drafted. |
| Thu 21:00 | Founder go/no-go on the changelog. |
| Fri 20:00 | Deploy: back up, write in place, check turn-config/push-config, cache-bust, smoke test (headless load, persona economy call, profile), error log + load. Restore on any failure. |
| Fri 20:30 | The changelog is posted in game (notice board) and on Hafrik. |
| Sat–Sun | Watch the error logs and economy ledger. Hotfixes only. |

**Hotfix exception:** an exploit, data loss or a broken login/save can ship at any time with founder approval. It gets a one-line changelog entry.

Every server-side money change goes through the ledger (`chinalife_economy_actions`) and is listed in the changelog.

# Changelog

## R3 (r3-onboard): shipped Wed 14 Oct 2026, ~09:08 China time (founder-approved, outside the Friday slot)
- New players get a 6-step tour (walk, map, café, order, say hi, phone), one card at a time with Skip. Existing players never see it. No new coins.
- Phone: 10 apps on one page (Wallet, Travel, Study, Work, Events, Chats, Store, Home, Profile, Settings); apps with several parts open a short list.
- One "Next step" pill replaces the HUD chips (daily reward, low needs, what's due, events, goal).
- The room sheet follows the finger and snaps to peek / half / near-full. More outline icons replace leftover emoji.
- Front end only, no new polling. Old bundles kept.
- Backup: /root/backups/r3-20261014-010828 (server time).

## Hotfix r2a: shipped Wed 14 Oct 2026, ~06:29 China time (founder-approved)
- Club music no longer gets a 403 on entry: presence is sent (or an in-flight send awaited) before the first music request in a room, with one retry after a "join first" refusal. No new polling.
- Backups: /root/backups/hotfix-r2a-20261013-222057 and /root/backups/hotfix-r2a-step2-20261013-222931 (server time).

## R2 (r2-ios): shipped Wed 14 Oct 2026, ~06:14 China time (founder-approved, outside the Friday slot)
- Hafrik iOS design: Hafrik colours, an iOS type scale (min 12 px), 8 pt spacing, and one outline icon set for controls.
- Single-row top bar, docked 4-tab bar, 88 px joystick and 56 px jump.
- Sheets with peek / half / near-full heights and one × close; the phone opens as a full sheet with no drawn frame.
- One Party button in clubs (Dance, Toast, Hype, Spray, Drinks); decluttered map labels; labels never cover controls.
- Press-and-spring animations that respect reduced motion. Front end only, no new polling.
- Backup: /root/backups/r2-20261013-221409 (server time).

## R1 (r1-load): shipped Wed 14 Oct 2026, ~05:21 China time (founder-approved, outside the Friday slot)
- Lighter on the server: notifications are checked every 5–20 s and pause while the tab is hidden; presence every 20 s; saves at most once a minute and only when something changed; voice and home-visit checks run only while in use; one combined feed call a minute.
- Music streams as AAC (.m4a, 225 MB down to 11 MB) with year-long caching. The .wav originals are kept.
- The page loads 4 cached bundles instead of about 20 files.
- Switched off for now, with flags only (no data removed): politics, police, court, Cantaball, spaces, journal, cloud, City openings, marketplace, AI, tasks and Hafrik Events apps; park, game centre, roach farm, K11, party pier, ex, orangutan and three campuses. The voting centre is view-only.
- Staging, per player over 5 min: 509 → 113 requests, 691 → 261 KB.
- Backup: /root/backups/r1-20261013-212058 (server time).

## world-v10a hotfix: shipped Wed 14 Oct 2026, ~03:34 China time (founder-approved)
- The joystick and jump button stay visible above the open room panel, so you can always walk.
- Clubs: the action column sits above the jump button; music and mic move to the left above the joystick. No overlaps at 390×844 with the panel open or closed.
- Street performance: pixel ratio capped at 1.5, shadow map refreshed every 3rd frame, camera collision against building boxes instead of 90k triangles, far cars hidden and frozen, far pedestrians not animated, labels refreshed at 30 Hz, no per-frame allocations, smoothed frame time, MSAA off on high-DPI phones. Street walk at 4× CPU throttle: 7.3 → 13.4 fps (headless, software GL).
- Backup: /root/backups/worldv10a-20261013-193430 (server time).

## world-v10: shipped Wed 14 Oct 2026, ~03:06 China time (founder-approved, outside the Friday slot)
- A: room panel opens when you enter; voting centre wall board and ballot panel with candidate photos.
- B: themed clubs; money spray (¥100/500/2000, 20 s cooldown, ¥20k/day cap, server ledger) with money rain; the voting card starts folded.
- C: Hafrik hosts Amara, Kwame, Fatou, Tunde and Zainab with canned chat (no paid AI calls).
- D: themed gossip room, hospital, school, restaurant and airport; school day with timetable, classes, homework, Friday exams and grades (server-capped rewards); furniture moved off club dance floors.
- E: cabin view on flights, server-priced private jet (¥6,000 + ¥2,500 per grid step, airport only, 1 a minute), driver's-seat camera in your own car.
- No schema changes. Backup and chinalife DB dump: /root/backups/worldv10-20261013-190616 (server time).

## world-v9: shipped Wed 14 Oct 2026, ~01:30 China time (founder-approved, outside the Friday slot)
- 🍾 **ChampagnePappi** hosts 007 Club: gold suit, big shades, chains and a bottle. He walks the club avoiding furniture and guests, greets you and new arrivals by name, hypes the DJ and calls dance-offs.
- 🥂 **Pappi's bar**: Pappi Fizz ¥120 (+10 XP), Gold Rush ¥300 (+25 XP), Zero Proof ¥40 (+5 XP), Water free. Paid on the server (`club-drink`, in the ledger); one drink per 90 s, XP for the first 8 a day.
- 🪩 Neon club: 007 entrance arch with a bouncer and rope, beat-synced dance floor and light beams, neon bar and VIP, party meter, Dance/Toast/Hype buttons, smooth enter and leave fades.

## world-v8: shipped Tue 13 Oct 2026, ~23:55 China time (founder-approved early release, outside the Friday slot)
- 🚁 An advert helicopter circles the city towing a banner that rotates live ads, partner venues and "Your ad here". It is big and lit at night, and labels under the banner fade so it stays readable.
- 🎓 Jobs you aren't qualified for show your level and a **Get skilled** button that takes you to the nearest place that trains that skill.
- 🎨 **Floors & wallpaper** for your home: 8 floors and 8 wallpapers (Panda party, Lucky dragon red, Big Laoban gold…). Preview for free, buy once, use in all your homes. Saved on the server.
- 🪳 **Golden Roach Farm** opens on the outskirts, with tours, cockroach naming, roach-protein snacks and investor pitches. New jobs: Cockroach farm hand, Cockroach farm shift manager, Jianbing cart chef, Square dance auntie DJ.
- 📱 Back buttons inside phone apps now step back through the app, then return to the phone home screen.

## world-v7 (13 Oct 2026)
- Club music waits until the venue join finishes, phone widgets wrap to two lines, a "This isn't your home" toast, and election winners are stored.

## world-v6 (13 Oct 2026)
- Slower street walking with hold-to-jog, ambient pedestrians, crosswalks, car accidents with an ambulance to City Hospital (¥800, with a cooldown), the rebuilt profile, and device earnings capped per hour.

## R4 · polish (branch r4-polish, built, not deployed)
- The joystick, jump and mic buttons hold still while the sheet is dragged and settle after release.
- The Election week banner hides while the sheet is open or being dragged.
- One-time intro tips (Got it) for phone, people, map, club, voting, home and street.
- Empty states: street, chats, homes, tasks and courses, each with one action.
- Banner toast at the top (2.5 s), collapsing large titles, 12px minimum for People names.
- Club music sync now runs every 15 s (5 s with the DJ booth open, instantly on a room change) instead of every 2.5 s. Club idle traffic drops from 57 to 17 requests/min. The music 403 fix is unchanged.
- Tests: tests/r4.mjs (6 tests). npm test: 158 pass / 131 fail (the 131 failures predate this work).

## R4b · founder redesign (r4-polish 4745df7) — LIVE 2026-10-14 11:00 CST, backup /root/backups/r4-20261014-025907
- Street: one small chip plus two round icon buttons (Live map, Map view) in a single row.
- Every sheet and the phone: 85% height with the game visible above, a close button, swipe down to close, and Back closes the top sheet.
- Map opens a "Where to?" picker first (search plus popular places, then rides); "Open the city map" is still there.
- Joystick on the right; jump, mic, music and Party on the left.
- Colourful gradient tiles for the phone apps, the right-side buttons and the ride list (walk, bike, metro, bus, cab, DiDi).
- Floating glass tab bar with a gradient active pill; glassier room sheet and HUD.
- Also: iOS action sheets (block, end relationship, clear AI chat, purchases of ¥1,000+), one music timer (15 s, 5 s with the DJ booth open, paused when hidden), the feed skips the 15 KB activity catalog when unchanged, and controls fade during a sheet drag.
- API (staging only; see deploy/r4b-api.md): a short-TTL cache for online, leaderboard and Hafrik map pins (APCu is not installed, so it uses /dev/shm files), plus feed.php skipping the catalog.
- Deploy notes: the front end and API went live together. The first front-end write missed 2 renamed bundles, so the page failed to load for about 2 minutes (11:00–11:02 CST). I restored index.html from backup, redeployed with --no-renames, and the smoke test passed.
- The cache runs from /tmp/chinalife-cache (open_basedir blocks /dev/shm). Checked live: MISS, then HIT. partners.css and partners.html were left untouched (they differ from the repo by design).

## R4c · floating layout (r4-polish 7617b65), LIVE 2026-10-14 11:20 CST, backup /root/backups/r4c-20261014-032009
- "Where to?" is now a compact floating card above the tab bar: search, a horizontal row of popular places, max 40% height, game visible.
- Every sheet, the phone and the room card keep 12px margins plus safe areas and are rounded on all sides. The tab bar is narrower (max 340px).
- Deploy: live md5 matched 4745df7; the new styles bundle was added and the old ones kept; all 4 referenced bundles returned 200 before index.html was switched.
- Smoke test: 0 overlaps, saves 200, no modal, no music 403, no JS errors or 4xx/5xx; load 1.2.
