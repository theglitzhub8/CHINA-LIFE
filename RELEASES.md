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
