# R3 (r3-onboard) - ready, not shipped

Client-only. No new polling, no schema, no coin changes.

## Changelog draft (for RELEASES.md after founder go)

## R3 (r3-onboard): shipped [DATE], ~[TIME] China time (founder-approved, outside the Friday slot)
- First-time onboarding: one coach card at a time (walk, map, café, order, say hi, phone), skippable, saved in `state.onboard` / localStorage. Only brand-new players (day 1, low XP) get the tour.
- One "Next step" pill in the HUD instead of the chip stack (needs, daily reward, events, goal).
- Room sheet follows the finger, then snaps to peek / half / near-full.
- Phone reduced to one page of 10 apps (Wallet, Travel, Study, Work, Events, Chats, Store, Home, Profile, Settings), with Study as a folder.
- Staging audit at 390×844: no overlaps, no covered controls, no sub-12 px text after the pass.

## Deploy notes
1. Front end: `node scripts/build-r1.mjs` already run. Copy `index.html`, the hashed `styles.*.css`, `core-a.*.js`, `core-b.*.js`, `app.*.js`, plus source `r3.js` / `r3.css` / `ios.js` if the vhost serves them unbundled (dev). Production uses the hashed bundles (r3 is inlined into styles + core-b).
2. Current local hashes (2026-10-14 ~06:46 CST): `styles.ae5007fa63.css`, `core-a.19697aeb8f.js`, `core-b.b2998e3eab.js`, `app.bd252e9fce.js`.
3. Live still serves `styles.8e742747a9.css` and `core-b.31934fb418.js` (R2-era). `r3.js` on live returns 404.
4. Backup before write-in-place. Cache-bust by the new hashes. Smoke: new-player coach, Next step pill, sheet drag, Phone 10 apps. No migrate.php.
5. Audit shots: `/workspace/r3/audit-after.json` (clean) and pair/after screenshots in `/workspace/r3/`.
