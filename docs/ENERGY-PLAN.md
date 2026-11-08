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

**Phase 3: Football first screen.** A stadium-style top (floodlights, scoreboard look): one huge ⚡ PLAY NOW
button, your record (wins, goals, win streak), who is on the pitch right now, today's challenge with a cash reward
("Score 3 goals today: +¥300"), and cups as cards with a countdown. Goal and win moments get confetti and sound.

**Phase 4: Gossip Centre, one clear layout.** The dock is the menu, and nothing is offered twice:
- Room becomes **Tonight**: what is live now (Hot Seat round, newest tips, TV pick) with one big action.
- The old rows ("Read today's city gossip", "Share a useful tip") are folded into News and Spill.
- One "Today here" strip with three small tasks and rewards (post a tip, vote a round, react to 5 tips).

**Phase 5: Voting, same family as the gossip screens.** Countdown top card stays; candidates become big cards
with photo, slogan and a live vote bar; one tap to vote; an "I voted" sticker and a small reward; results reveal
with a drumroll at close.

**Phase 6: Link Up.** Bold pill tabs with live badges ("12 online", unread chats). Places become cards with the
live head count, open or closed, and a 🔥 Hot now tag on the busiest one. Friends show where they are with
a Join button.

**Phase 7: Energy and coming back.** Shared across every place: a daily streak with a reward, a first-visit-of-the-day
bonus per place, "live now" pulses on the dock buttons, and a celebration effect for wins and rewards.

Map look is untouched in every phase: the docks and the music pill sit in the same layer as the club dock.
