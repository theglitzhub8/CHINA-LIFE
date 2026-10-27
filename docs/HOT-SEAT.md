# Gossip hot seat

A party game in the Gossip Room (`gist`). One player at a time takes the hot seat and posts a short
anonymous gist. Everyone else in the venue has **45 seconds** to vote **True** or **Cap**. Then the
verdict is revealed with a stamp, the split bar and confetti. Voters who matched the majority get coins.
Today's most-voted gist is shown on **Gossip TV** (every other slot, and straight away when it changes).

## Rules (same in `public/hot-seat.js` and `chinalife-api/hot-seat-lib.php`; tests check they match)

| Rule | Value |
| --- | --- |
| Gist length | 10–140 characters, whitespace collapsed |
| Blocked | swearing and insults (English, Pidgin, Chinese; leetspeak and s.p.a.c.e.d letters), links, emails, @handles, phone numbers |
| Voting window | 45 s (`HS_SECONDS`) |
| Rewards | +¥20 for voting with the majority; +¥10 to the author when the room says True |
| No rewards | ties, or fewer than 3 votes (stops two friends farming) |
| Daily cap | 10 paid votes per player per Beijing day |
| Reports | ⚑ Report on every gist; 3 reports hide it until an admin looks |
| Rate limits | take the seat 3/hour, vote 30/min, report 10/hour |

## Where it lives

- `public/hot-seat.js` + `hot-seat.css`: rules, the mobile bottom sheet (composer, voting, reveal), the
  offline simulation, the Gossip TV painter, and the admin card. Exposed as `window.ChinaLifeHotSeat`.
- Entry points: the red hot seat by the mic in the Gossip Room (3D label "🔥 Hot seat · True or Cap?") and
  the "🔥 Hot seat" card in the venue panel (`world.js`).
- `rooms.js`: Gossip TV calls `ChinaLifeHotSeat.paintTV` for the featured gist. The TV moved up and left
  (x −3, y 2.6) so the shop awning and the "See latest gossip" sign no longer cover it.

## Offline (preview folders, or not signed in)

No API calls. The venue's AI host (`ChinaLifeAI.agentsAt('gist')`), Tunde and the regulars vote at random
moments in the window. They lean Cap on big claims ("everyone", "million", "!!") and True on small,
specific ones ("last night", "I saw"). "Watch someone else & vote" starts an NPC round. Coins go to the
local save. History and the featured gist are kept in local storage (prefixed in previews).
For testing, local storage `chinalife-hotseat-seconds` (5–120) shortens the window.

## Production API: `chinalife-api/hot-seat.php`

- `GET ?city=&place=gist` → `{enabled, limits, round, featured}`. The True/Cap split stays hidden until the reveal.
- `POST {action:'take', city, place, body}`: you must be in the venue (`cl_presence`). There is one live round
  per venue; the seat row is locked `FOR UPDATE`, and a busy seat returns 409.
- `POST {action:'vote', id, vote:'true'|'cap'}`: once per player, not on your own gist, only while open.
- `POST {action:'report', id, reason}`: once per player, auto-hides at 3 reports.
- Closed rounds are settled lazily by the next request for that venue. This happens in a transaction: the
  status flips `voting → revealed` once, then the coins are paid with `cl_credit` and recorded in `rewarded`.

Admin (`admin.php`, in the Admin Cities tab and in admin.html):
- `hot_seat` lists the gists, reported ones first.
- `set_hot_seat {enabled}` is the on/off switch.
- `hot_seat_moderate {id, op:hide|unhide|delete}`.

Everything is logged in `chinalife_admin_log`.

## Feature flag

- `events.php` sends `hot_seat: true|false` from `chinalife_settings` (`name='hot_seat'`). If there is no row,
  for example before the migration, it is **off**. `cloud.js` passes it to `ChinaLifeHotSeat.setEnabled`.
- When it is off, the seat, the label, the venue card and the TV slot all disappear.
- `ChinaLifeFlags.off('hotseat')` is a second, client-side kill switch.
- In previews, the admin switch is stored on the device only.

## Migration (not run)

`chinalife-api/migration-hot-seat.sql` creates `chinalife_hot_seat`, `chinalife_hot_seat_votes` and
`chinalife_hot_seat_reports`, then inserts the `hot_seat` setting as on. `migrate.php` picks it up. Run it
only when going live.
