# Gossip Room upgrade plan (29 Oct 2026)

The second of the seven one-city places to get a major upgrade, after University. Goal: the Gossip Room is the
lively social heart of ChinaLife, where you go every evening to hear and spill the latest gist, play True or Cap,
and see what happened around the city. It should be one clear place, not three separate features.

Same rules as University Years: every phase sits behind an appadmin switch (default OFF), ships to live switched off,
and the admin can tune it from a Gossip tab. The approved map look does not change; the room's 3D interior can.

## Today

| Feature | What it is | Code |
|---|---|---|
| Gossip wall ("Gist Night") | Anonymous posts (hidden handle), reached from the "Tea table · spill it" | `gist-night.php`, game.js `gistNightScreen` |
| Hot Seat | One player posts an anonymous gist; the room votes True or Cap in 45 s; coins for the majority | `hot-seat.js`, `hot-seat.php`, `docs/HOT-SEAT.md` |
| Gossip TV | The room's TV and a phone app; shows today's most-voted Hot Seat gist | `rooms.js`, game.js `gossipTv` |
| City news | Admin-published news and links ("Gossip" tab in appadmin) | `gist.php` |
| Room | China Gossip Center: 2 actions (read gossip, share a tip), a host, the TV, the tea table | world.js / rooms.js |

Problems: three names for one idea, separate doors (phone folder, tea table, hot-seat card, TV), and nothing that
makes the room feel alive when you walk in.

## Phases

**Phase 0 · One Gossip Room (switch `gossip_room`).** One "Gossip Room" screen, opened from the room's place bar,
the phone's Gossip tile and the tea table: tonight's Hot Seat (live round, or "take the seat"), the Gossip wall,
Gossip TV's pick, and City news, in that order. The phone's Gossip folder becomes one app. Plain names everywhere:
Gossip wall, Hot Seat, Gossip TV.
✅ Done 29 Oct (`public/gossip-room.js`): the screen opens from the phone's Gossip tile (one app while on), the
place bar's "🫖 Gossip Room" card (first in the room; the duplicate "🤫 Gossip" card is hidden while on) and the tea
table. Hot Seat shows "Live now: N votes · Ns left" with Vote now, or Take the seat; away from the room it starts
the Where to? trip, and when the room is closed it says when it opens. City news (the admin's posts, which had no
player door) shows the latest three with "See all". Fixed on the way: the old Hot Seat and Gossip TV apps' "Go to"
buttons did nothing in one-city mode; they now start the Where to? trip. Names: "Hot Seat" and "Gossip wall".

**Phase 1 · Hot Seat Hour.** A nightly show at set Beijing times (default 20:00–22:00): the room's host runs it,
players queue for the seat, the TV shows the live round and the audience count, and the phone buzzes players who
opted in when it starts. Outside the hour Hot Seat works as today.
✅ Done 29 Oct (switch `gossip_show`, off): 20:00–22:00 Beijing (`HS_SHOW_START/END` in hot-seat-lib.php). During it a
busy seat queues gists (one per player, 10 in all); after each reveal the next goes live; at the end the queue is
dropped, never shown. The sheet and the Gossip Room screen show "🔴 Hot Seat Hour until 22:00 · N in the room · M
waiting" (or the nightly times), the host calls each round, and "Join the queue" opens the composer. One reminder a
night at 20:00 while the game is open (a phone push for closed games is not built). **Found and fixed:** the game
never exposed `ChinaLifeCloud.api`, so Hot Seat has always run offline (simulated voters) in the real game; with
`gossip_show` on it now uses the signed-in request and is truly multiplayer. Football has the same problem and still
runs offline (not changed here). Before switching `gossip_show` on, the Hot Seat tables must exist on the server
(`migration-hot-seat.sql`, run by `migrate.php`).

**Phase 2 · A better Gossip wall.** Reactions (😂 🔥 🫢 👀 🧢), short replies, and "Gist of the day" chosen by
reactions. Tags for the other places (#club #campus #football #hq) so the wall reads like the city's feed.
✅ Done 29 Oct (switch `gossip_wall`, off; `public/gossip-wall.js`, gist-night.php, `migration-gist-wall.sql`): six
reactions (😂 🔥 🫢 👀 🧢 ❤️, one per player per tip as before); anonymous replies, 2–140 characters, checked with
the Hot Seat word list and the no-names/links/numbers rule, 20 an hour, the latest three shown ("Tipster" marks the
tip's author, admins can trace who replied); "🏆 Gist of the day" is today's most-reacted tip (3 or more), lifted
under any pinned Hafrik post; a place tag written in a tip (#club #campus #football #hq #hospital #voting #gossip)
shows on it, and place chips filter the wall. Needs the replies table: run `migrate.php` before switching it on.

**Phase 3 · The city makes gossip.** Things that happen elsewhere post to the wall automatically, always as
"someone", never a player's name: a club VIP night, a football result, a graduation, a new rank, a Hot Seat streak.
✅ Done 29 Oct (switch `gossip_city`, off; `chinalife-api/gossip-city-lib.php`): the server posts "🏙️ City buzz" tips
where each thing really happens: a new rank (cl_move_totals), a graduation (university.php), a football full-time
score (football.php), and an author the Hot Seat room believed three times today (hot-seat.php). Always "Someone",
never pinned or "yours"; admins can trace it; at most 4 of each kind per city per hour. A club VIP night is left out:
VIP is bought on the device, so the server can't vouch for it. **Owner's answer (29 Oct): when a gossip is posted,
players in the Gossip Room get a banner** ("🫖 New gist on the wall", checked every 30 s with gist-night.php?latest).

**Phase 4 · A room that feels alive.** The crowd reacts to Hot Seat reveals (cheer for True, boo for Cap), the TV
shows the live round, sitting at the tea table opens the wall, and the room fills up during Hot Seat Hour.
✅ Done 29 Oct (same switch): Gossip TV shows a live round ("🔴 LIVE · HOT SEAT HOUR", the gist and the vote count;
the split stays hidden); every reveal sends a burst over the room (👏🎉 for True, 😂🧢 for Cap, 🤔 for a tie), bigger
with a bigger audience; the Gossip Room uses its full crowd during the Hour (one-city.js). The tea table opens the
Gossip Room (Phase 0), not a sit-down; NPCs don't animate (only the player has emotes), so the reaction is the burst.

**Phase 5 · Gist reputation.** Posts that the room calls True, and wall posts with many reactions, raise your gist
rep; Cap verdicts lower it. A weekly "Truth teller" award for the top three: badge + ¥1,000 / ¥500 / ¥250, paid
on the server. Rep shows on profiles (as a number, never tied to which posts were yours).
✅ Done 29 Oct (switch `gossip_rep`, off; `chinalife-api/gossip-rep-lib.php`, `gossip-rep.php`): rep is worked out from
what happened, nothing new stored: Hot Seat gists the room believed +10, called Cap −5 (rounds with 3+ votes); every
5 reactions on your wall tips +1, at most +5 a tip. The first rep request after a Beijing Monday pays last week's top
three once (cl_credit on the ledger, 🥇🥈🥉 "Truth teller · week of …" badges), recorded in settings `gossip_award`.
**Changed from the plan for anonymity:** rep shows only to its owner (Gossip Room card, own profile), never on other
players' profiles, because a rep jump right after a True round would reveal who wrote it. The badge is public.

**Phase 6 · Admin and safety.** A Gossip tab in appadmin: Hot Seat Hour times, rewards, daily caps, the word list,
and one moderation queue for reports from the wall and Hot Seat (hide, restore, warn). Anonymous stays anonymous to
players; admins can see who posted a reported item.
✅ Done 29 Oct (appadmin 🫖 Gossip Room tab; `chinalife-api/gossip-settings.php`, admin.php `gossip_*`): Hot Seat Hour
start and end, queue size, the three Truth teller prizes, City buzz per hour, and extra blocked words (Hot Seat, wall
tips and replies, on top of the built-in list; the built-in list also applies to wall tips while the better wall is
on). Players can report a wall tip (⚑, with the better wall on; 3 reports hide it, like Hot Seat). One queue lists
reported or hidden Hot Seat gists and wall tips with their author, with Hide / Restore / Delete. Not built: per-item
Hot Seat reward amounts (the client and server share them, tests/hot-seat.mjs) and "warn a player". Needs
`migrate.php` (the reports table and the wall's hidden/reports columns).

**All seven phases are done** (0–6), each behind its own switch: gossip_room, gossip_show, gossip_wall, gossip_city,
gossip_rep (Phase 6 has no switch; its admin tab is always there and its reports follow gossip_wall).

## Owner's decisions (29 Oct 2026)

1. **Hot Seat Hour:** 20:00–22:00 Beijing time, every night (the admin can change it).
2. **Names:** gossip never uses a player's real name; it always says "someone". When the admin posts gossip, the
   admin chooses to post under their own name or as "someone", as it works now (official posts in `gist-night.php`).
   So Phase 3 has no "Mention me" setting: the city's automatic gossip is always "someone".
   *(The owner's answer continued "and when a gossip is posted," and was cut off; to confirm.)*
3. **Weekly Truth teller award:** badge + ¥1,000 / ¥500 / ¥250 for the top three (the admin can change it).

## Order

Phase 0 first (it fixes the "three names" problem from the UI review), then 1 and 4 together (the show), then 2,
3, 5 and 6. Each phase: tests, local play-through, its own commit, pushed to the feature branch; shipping to live
only when the owner says so, switches off.
