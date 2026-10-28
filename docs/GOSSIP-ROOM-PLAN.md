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

**Phase 2 · A better Gossip wall.** Reactions (😂 🔥 🫢 👀 🧢), short replies, and "Gist of the day" chosen by
reactions. Tags for the other places (#club #campus #football #hq) so the wall reads like the city's feed.

**Phase 3 · The city makes gossip.** Things that happen elsewhere post to the wall automatically, always as
"someone", never a player's name: a club VIP night, a football result, a graduation, a new rank, a Hot Seat streak.

**Phase 4 · A room that feels alive.** The crowd reacts to Hot Seat reveals (cheer for True, boo for Cap), the TV
shows the live round, sitting at the tea table opens the wall, and the room fills up during Hot Seat Hour.

**Phase 5 · Gist reputation.** Posts that the room calls True, and wall posts with many reactions, raise your gist
rep; Cap verdicts lower it. A weekly "Truth teller" award for the top three: badge + ¥1,000 / ¥500 / ¥250, paid
on the server. Rep shows on profiles (as a number, never tied to which posts were yours).

**Phase 6 · Admin and safety.** A Gossip tab in appadmin: Hot Seat Hour times, rewards, daily caps, the word list,
and one moderation queue for reports from the wall and Hot Seat (hide, restore, warn). Anonymous stays anonymous to
players; admins can see who posted a reported item.

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
