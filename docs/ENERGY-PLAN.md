# Energy plan: every place feels alive (8 Nov 2026)

The owner asked for: the same bottom dock as the club and Gossip Centre in Hafrik HQ, the hospital, the football
pitch and the voting booth; a better football first screen; a better voting screen; music everywhere with play and
pause; a clearer Gossip Centre; nicer Link Up tabs; and more action and energy so players come back (retention).

## What is there today (checked on a phone-size screen)

- **Football pitch:** the place bar has Play a match, Kick-about and Watch. "Play a match" opens a flat green page:
  team-size chips, Quick match and New match, an empty Tournaments box, and half the screen empty. Nothing shows
  your record, who is playing now or why to play today.
- **Voting booth:** two place-bar rows (Open the ballot, Read election notices). City Hall has a good dark
  countdown card, but under it is a plain filter row, a search box and a list.
- **Hafrik HQ:** five long rows (CEO appointment, Work at HQ, Services, Co-work, Meetup). **Hospital:** two rows.
- **Gossip Centre, why it is confusing:** the same things are offered three times. The dock has Room, Hot Seat,
  Spill, TV and News. The Room screen repeats Hot Seat, the wall, TV and News. "More" then shows the old place-bar
  rows ("Read today's city gossip", "Share a useful tip"), which are the News and the wall again under other names.
  A player cannot tell which button is the "real" one.
- **Music:** ChinaLife Radio plays approved artists' songs, but its button only shows when songs exist, and it is
  hidden in docked places (club, home, gossip). There is no simple play and pause that is always there.
- **Link Up:** three plain icon tabs (Places, Chats, Friends) and a list of identical rows with a Go button. No live
  counts, no "hot now", nothing pulls you in.

## Phases (each one ships on its own; each has a switch in Hafrik integrations, default on)

**Phase 1: Docks for every place.** One row of big buttons at the bottom, same look as the club:
- Football: ⚡ Play · 🏆 Cups · ⚽ Kick-about · 🎽 Watch · 🎤 Mic · ••• More
- Voting: 🗳 Vote · 👤 Candidates · 📊 Results · 📜 Notices · 🎤 Mic · ••• More
- Hafrik HQ: 💼 Work · 🧾 Services · 📅 CEO · 💻 Co-work · 🤝 Meetup · 🎤 Mic · ••• More
- Hospital: 🩺 Doctor · 🛏 Rest · ❤️ Health · 🎤 Mic · ••• More

✅ Built 8 Nov 2026 (club-dock.js `SPOTS`, switch `place_docks`, default on). As built: Football ⚡ Play · 🏆 Cups ·
⚽ Kick · 🎽 Watch · Mic · More; Voting 🗳 Vote · 📜 Notices · 💬 Chat · Mic · More (Candidates and Results wait for
Phase 5, because today they are the same ballot screen); HQ 🧾 Services · 💼 Work · 📅 CEO · 💻 Co-work · 🤝 Meetup · Mic ·
More; Hospital 🩺 Doctor · 🛏 Rest · ❤️ Health · 💬 Chat · Mic · More. A button whose place-bar item is missing (for
example HQ Services when its switch is off) is hidden. The place bar and the round mic button are hidden there.

**Phase 2: Music everywhere.** A small "now playing" pill that is always on screen (map, every place, home):
song name, ▶ / ⏸ and ⏭. It remembers if you paused. Tapping it opens the full radio. When no artist songs are
approved yet it plays the game's own beats, so it is never empty.

✅ Built 8 Nov 2026 (public/music-pill.js, switch `music_everywhere`, default on). Found on the way: the old radio button
was never visible, because a style rule (ios.css) hides it whenever the club ▶ button exists, and that button always
exists. As built: a round coral button above the bottom bar on the left in every place and at home. Tap = play / pause;
the song name slides out for 4.5 s with ⏭; tap the name for the full radio (or the list of beats). Artist songs play
when approved; until then the five catalog beats play one after another (2½ minutes each). It steps aside in clubs (the
club DJ plays there) and on the approved city map (the music keeps playing there), goes quiet for the mic, in the
library and in the background, remembers a pause, and otherwise starts on the first tap.

**Phase 3: Football first screen.** A stadium-style top (floodlights, scoreboard look): one huge ⚡ PLAY NOW
button, your record (wins, goals, win streak), who is on the pitch right now, today's challenge with a cash reward
("Score 3 goals today: +¥300"), and cups as cards with a countdown. Goal and win moments get confetti and sound.

✅ Built 8 Nov 2026 (football.js `stadium()`, switch `football_home`, default on). As built: a floodlit "Matchday" card
with a pulsing ⚡ PLAY NOW (quick match at the chosen size), team sizes and "New match with friends"; your record (wins,
goals, 🔥 win streak, played), kept in the save as `state.football` and counted for every match (on this phone or
online); today's challenge, the same for everyone and rotating daily (score 3 goals / win 2 / play 3), with a progress
bar and Collect ¥300 (+30 XP), also shown on the full-time card; open matches; cups. The prize is paid by economy.php
`football-daily`, once a Beijing day per player. Trust note: the game counts the goals and wins, and the server only
checks once a day (football results are not on the live server), so a cheater could collect ¥300 a day unplayed.
Confetti on a win was already there.

**Phase 4: Gossip Centre, one clear layout.** The dock is the menu, and nothing is offered twice:
- Room becomes **Tonight**: what is live now (Hot Seat round, newest tips, TV pick) with one big action.
- The old rows ("Read today's city gossip", "Share a useful tip") are folded into News and Spill.
- One "Today here" strip with three small tasks and rewards (post a tip, vote a round, react to 5 tips).

✅ Built 8 Nov 2026 (gossip-room.js `tonight()`, chinalife-api/gossip-today.php, switch `gossip_tonight`, default on;
needs the existing `gossip_room` switch on, as live). In the room, Room opens "🫖 Tonight": 🔥 Hot Seat (live status and
one button), ✅ Today here, 🤫 Fresh on the wall (the two newest tips, Open Spill ›), 📺 On Gossip TV, and your rep.
Today here: Drop a tip (1), Vote on a Hot Seat round (1), React to 5 tips, each ¥100 + 10 XP once a Beijing day. The
server counts them from the real tables (your own tips, not Hafrik's or the city's; your Hot Seat votes; your
reactions), refuses an unfinished one and pays each once. Unfinished tasks have Go (to the wall or the Hot Seat).
City news is not repeated in the room (the dock has News); opened from the phone, away from the room, it is one row.
The dock's More no longer repeats "Read today's city gossip" and "Share a useful tip".

**Phase 5: Voting, same family as the gossip screens.** Countdown top card stays; candidates become big cards
with photo, slogan and a live vote bar; one tap to vote; an "I voted" sticker and a small reward; results reveal
with a drumroll at close.

✅ Built 8 Nov 2026 (game.js politicsScreen + votingV2 helpers, theme.css, politics.php, switch `voting_v2`, default
on). As built: candidates show their Hafrik photo (initials when none) and the leader gets 👑 and a gold ring; a ballot
with no candidates is one "Nobody is on the ballot yet · Stand for election" card plus "Who won last time" (not four
empty offices, no tabs); search only shows with more than six candidates; each vote stamps a big "🗳️ I VOTED · +¥50 ·
+10 XP" and the hero keeps an I VOTED sticker once every open ballot is done; politics.php pays ¥50 + 10 XP per vote
(server ledger, once per office per election, only for players with a saved character; the vote counts either way);
a new winner is revealed once per election on each device: "🥁 China has decided · And the new Governor is…", the
name pops after a drumroll. The confirm step stays, because a vote cannot be changed.
Found: voting itself is paused for every player. The whole `politics` feature is OFF in flags.js and can only be
turned on per device (localStorage `chinalife-flags-on`), so live players see "Voting is paused" and no Vote buttons.
Opened 8 Nov 2026 at the owner's request: flags.js `off('politics')` now follows the appadmin switch `voting_open`
(default ON); with it off, the game says "Voting is paused" and politics.php refuses votes and nominations (409).

**Phase 6: Link Up.** Bold pill tabs with live badges ("12 online", unread chats). Places become cards with the
live head count, open or closed, and a 🔥 Hot now tag on the busiest one. Friends show where they are with
a Join button.

**Phase 7: Energy and coming back.** Shared across every place: a daily streak with a reward, a first-visit-of-the-day
bonus per place, "live now" pulses on the dock buttons, and a celebration effect for wins and rewards.

Map look is untouched in every phase: the docks and the music pill sit in the same layer as the club dock.
