# Club experience plan (30 Oct 2026)

The owner's brief: experience a real club vibe. Every club option right in your face without crowding the screen; a
straight, natural character; sitting properly (especially in the VIP lounge) with someone bringing you a drink; the mic
back; ads and the playing song on the walls without mixing; no see-through "shadow" when you walk behind things; tap
anything to use it.

## What we found (30 Oct, local play-through and code)

| Problem | Cause |
|---|---|
| Character leans back, head pokes forward | realism.js:327-338 "posture fix" rotates the spine and neck back by up to 0.45 rad (26°) on every clip |
| Club options hidden | 11 options in one sideways-scrolling strip inside a collapsed place bar (world.js:346), plus a separate Party fan (ios.js:37), a ▶ music button, a "DJ is ready / Now playing" chip and the radio |
| Every option covers the club | Entry, Bar, etc. open full-screen sheets |
| Joystick covers the place bar | Both sit in the bottom-right corner |
| Mic gone | UI task 4 (f84ac29, 29 Oct) hides 🎙 unless someone else is in voice (r4.css:240) and collapsed the bar holding "🎙 Voice". "Go to open mic" is only a 2-hour activity |
| Sitting is wrong | The VIP sofa (world.js:319) and club sofas (models.js:71) aren't seats; `vipSeat` sits you wherever you stop (~0.75 m in front, any direction); the real body ignores seat height; NPC sitters sink 0.22 m |
| "Shadow" through walls | A deliberate see-through ghost copy of the player (realism.js:420-437, `depthFunc: GreaterDepth`) |
| Ads and song mix | Paid ad spot 1 (x −4.6) and the Now playing screen (x −3.5) overlap on the back wall; spot 3 covers the BAR neon |
| "Advertise here" pop-up | `adPlacement` (world.js:108-114, 337) puts a yellow "📣 Advertise here" board whose tap opens WhatsApp |
| Tapping things does nothing | Taps only hit people and the floor (world.js:368-374) |

## Owner's decisions (30 Oct 2026)

1. **Mic:** just bring the voice button back (always visible in the club).
2. **VIP drinks:** the waiter's first drink of the night is free with a VIP pass; after that, bar prices.
3. **See-through shadow:** remove it everywhere (venues and the city map).
4. **Order:** Phase 0 (the body) first.

## Phases

**Phase 0 · The body.** Stand straight (fix the posture correction so the spine is upright and the head level). Sit
properly: club sofas, VIP sofa, bar stools and chairs become real seats; you walk to the seat, turn and sit at the
right height facing the room; NPCs sit on seats too. Remove the see-through ghost.

**Phase 1 · The club dock.** One row of big round buttons, always visible inside a club, just above Home/Map/People/
Phone: 🎟 Door & VIP · 🍸 Bar · 💃 Dance · 💸 Spray · 🎧 Music · 🎤 Mic · ••• More (jobs, missions, dice, play with
people). It replaces the Party fan, the ▶ button, the music chip and the place-bar strip in clubs. Options open as
half-height cards so the club stays visible behind them. The joystick moves clear of the dock.

**Phase 2 · The mic.** Bring the 🎙 voice button back: always visible inside a club again (owner's choice, not a new
mic-stand feature).

**Phase 3 · Tap anything.** Sofa or chair → sit. Bar counter → order. DJ booth → request a song. Dance floor → dance.
Mic stand → take the mic. Door / guard → entry and VIP. Wall ad → the advertiser's card. People → as now.

**Phase 4 · VIP service.** Take your VIP seat and a waiter walks over with a tray, puts the drink down and you sip it
(first one on the house with a VIP pass, then order from your seat). Bottle service with sparklers for the VIP table.

**Phase 5 · The walls.** The big screen above the DJ shows only the song playing and who requested it. Paid ads get
their own frames on the side walls and rotate. No "Advertise here" pop-up.

Each phase: tests, a local play-through on a phone-sized screen, its own commit; live when the owner says. The city
map's look does not change (club interior and character code only; edits to protected files kept minimal and reported).
