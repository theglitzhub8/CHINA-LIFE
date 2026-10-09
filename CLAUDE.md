# Instructions for AI assistants working on ChinaLife

## The city map is approved: do not change how it looks

The owner approved the city map exactly as it is at git tag `map-approved-2026-10-10`. Several AI sessions work on
this repository at the same time. **Do not change the map's look or layout unless the owner explicitly asks for that
specific change in your own conversation.** Building features that add to the map (a new venue, a stall for a new
partner type) is fine only when asked, and must follow the rules below.

What the approved map is:
- Isometric 3D city with the City Centre (Hafrik Square, fountain, Heping Grand Hotel), districts in their
  map-data styles, rivers, streets, trees, lamps, traffic, and the huge gold-based Hafrik HQ in every city.
- A clean screen: top HUD pill (clock, mood, online count, money, +), city/day chip and Hafrik chip; only three
  round map buttons on the right (search, label mode, locate); the place bar at the bottom is collapsed until
  tapped; the Home / Map / People / Phone dock; the radio and mic buttons bottom right.
- Labels are decluttered by priority and zoom (clubs, landmarks, partners and artists stay visible at normal zoom).
- Day and night: a fast shared sky (full cycle every 2 real hours, `SKY_CYCLE` in world.js); lit windows and lamps
  at night; weather per city per day. The clock, dates and daily limits stay on Beijing time.
- Partner stalls (1.7× size) next to their venue or a default spot; artists get a small stage; paid ads show on the
  venue's walls, rooftop billboards and the street billboards.

Protected files (map look): `public/world.js` (city(), applyLighting, labels/declutter, map controls),
`public/world.css` (map and HUD rules), `public/city-kit.js`, `public/districts.js`, `public/china-city.js`,
`public/district-centre.js`, `public/map-data.js`, `public/city-layout.js`, `public/skyline.js`, `public/models.js`,
and the map markup in `public/index.html`.

If a change you were asked for touches these files, keep the edit as small as possible, do not restyle or remove
existing map elements, run `npm test`, and tell the owner what changed on the map.

To restore the approved map files: `git checkout map-approved-2026-10-10 -- <file>`.

## Deploying to the server
Read `docs/DEPLOY.md` before preparing any deploy: server paths, the update and migration commands, backups,
verification, rollback, the polling switch, and how to write commands the owner pastes into the server terminal.
Only `main` is deployed; keep unapproved features on their own branch.

## Working in this repository
- Other sessions may have uncommitted work: never commit files you did not change, and commit your own work promptly.
- Never commit secrets: `chinalife-api/turn-config.php`, `admin-config.php`, `push-config.php`, `ai-config.php`,
  `music-config.php` stay on the server only.
- Run `npm test` before every commit; keep the suite green.
