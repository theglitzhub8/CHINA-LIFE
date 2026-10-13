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

## Next release: world-v8 (proposed for Fri 16 Oct 2026, 20:00)
- 🚁 An advert helicopter circles the city towing a banner that rotates live ads, partner venues and "Your ad here".
- 🎓 Jobs you aren't qualified for show your level and a **Get skilled** button that takes you to the nearest place that trains that skill.
- 🎨 **Floors & wallpaper** for your home: 8 floors and 8 wallpapers (Panda party, Lucky dragon red, Big Laoban gold…). Preview for free, buy once, use in all your homes. Saved on the server.
- 🪳 **Golden Roach Farm** opens on the outskirts, with tours, cockroach naming, roach-protein snacks and investor pitches. New jobs: Cockroach farm hand, Cockroach farm shift manager, Jianbing cart chef, Square dance auntie DJ.
- 📱 Back buttons inside phone apps now step back through the app, then return to the phone home screen.

## world-v7 (13 Oct 2026)
- Club music waits until the venue join finishes, phone widgets wrap to two lines, a "This isn't your home" toast, and election winners are stored.

## world-v6 (13 Oct 2026)
- Slower street walking with hold-to-jog, ambient pedestrians, crosswalks, car accidents with an ambulance to City Hospital (¥800, with a cooldown), the rebuilt profile, and device earnings capped per hour.
