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
✅ Done 30 Oct 2026 (no switch; bug fixes):
- **Straight stance.** The real cause was in realism.js. The R9d posture fix straightened the spine, but the Biped thighs
  hang off Bip01_Spine, so the legs swung forward (feet ~20 cm in front of the hips) and the body leaned back. The
  thighs now keep the clip's direction. Measured: hips 0–1 cm, head 6–9 cm in front of the feet when standing (it was
  −20 / −15 cm); walking head 1–4 cm ahead of the hips.
- **No see-through copy.** The ghost silhouette of the player is removed everywhere.
- **Sitting.**
  - Club sofas show at 0.7 scale with three seats each. The VIP sofa has three VIP seats.
  - Real bodies sit at the seat's height (seat − 0.42). The follow camera no longer pulls a seated player down to the
    floor.
  - Sit walks you to the nearest seat. You never sit on thin air (a toast asks you to tap a sofa or chair).
  - Tap a sofa to sit. Tapping the VIP sofa without a pass opens Entry & VIP.
  - "Take your VIP seat" walks you to a VIP seat.
  - Seated classroom crowds no longer sink into their chairs.
- **Local testing fix.** A localhost-only debug hook crashed the scene unless `?cldebug=1` was in the URL; it is now
  guarded. The live site was never affected.
- **Changes to the protected world.js** (room code only): the club seats; `sitAt`, `sitSpot` and the tap-to-sit check;
  the sit height; and one condition each in tpFrame and the debug hook. Nothing on the city map changes.

**Phase 1 · The club dock.** One row of big round buttons, always visible inside a club, just above Home/Map/People/
Phone: 🎟 Door & VIP · 🍸 Bar · 💃 Dance · 💸 Spray · 🎧 Music · 🎤 Mic · ••• More (jobs, missions, dice, play with
people). It replaces the Party fan, the ▶ button, the music chip and the place-bar strip in clubs. Options open as
half-height cards so the club stays visible behind them. The joystick moves clear of the dock.
✅ Done 30 Oct 2026 (switch `club_dock`, default **ON**; turn off in Hafrik integrations to get the old buttons back).
public/club-dock.js:
- **The buttons** press the club's own controls, so every club works as before:
  - Door → Entry & VIP.
  - Bar → the club bar (Pappi's menu), or the classic bar.
  - Dance, Spray → the club HUD buttons.
  - Music → the DJ booth; the button lights while a song plays.
  - Mic → the voice button (join / mute / unmute; shows 🔇 when muted). This also covers Phase 2.
- **More** shows Toast, Hype, Shout-out and Chat, then every other place-bar item (open mic, meet people, dance floor,
  dance competition, club jobs, night missions, play with people). Items already on the dock are left out.
- **Hidden in a club:** the Party fan, ▶, radio, "DJ is ready" chip, the old mic button and the place bar. They all come
  back outside the club.
- **Sheets:** Entry & VIP, the bar, More and the DJ booth open at about 62% height with no blur, so the club stays
  visible behind them.
- The joystick sits above the dock.

**Phase 2 · The mic.** Bring the 🎙 voice button back: always visible inside a club again (owner's choice, not a new
mic-stand feature).

**Phase 3 · Tap anything.** Sofa or chair → sit. Bar counter → order. DJ booth → request a song. Dance floor → dance.
Mic stand → take the mic. Door / guard → entry and VIP. Wall ad → the advertiser's card. People → as now.
✅ Done 30 Oct 2026 (no switch; world.js room code). Taps walk you to the spot, then act (`goDo` / `tapFrame`; a new
walk cancels it):
- **Bar:** the bar counter or bottle shelf (007 Club) → walk up, face the bar, the drinks menu opens.
- **DJ:** the DJ booth, the stage, the music screen or the DJ himself → walk to the booth, the DJ booth (song
  requests) opens.
- **Dance floor:** a tile → walk there and dance (the club's own Dance, so the party meter and the dance-off count).
- **Bouncer** → Entry & VIP.
- **Wall ad** → its card.
- **Sofas** → sit (Phase 0). **People** → as before.
There is no separate mic stand: the Mic is on the dock (owner's choice).

**Phase 4 · VIP service.** Take your VIP seat and a waiter walks over with a tray, puts the drink down and you sip it
(first one on the house with a VIP pass, then order from your seat). Bottle service with sparklers for the VIP table.
✅ Done 30 Oct 2026 (no switch; 007 / one-city Club, the `night` venue):
- **The waiter.** Taking a VIP seat (world.js signals `chinalife:vip-seated`) brings a waiter in a black suit from the
  bar, carrying a silver tray and a glass. He walks round the stage into the lounge (a new crowd mode, `serve`, with
  waypoints), stops beside you and faces you.
- **First drink.** On his first visit, economy.php `club-drink` with `vip:1` gives a free Pappi Fizz. It is checked on the
  server: a vip-night pass for the club in the last 14 hours, or a vip-member pass in the last 30 days; once per 14 hours.
  A second free ask is refused with a 409 and is **never charged**.
- **After that.** He opens the bar menu and you order at bar prices. Ordering from your seat doesn't stand you up. If you
  don't order within 15 s he leaves.
- **The drink.** It goes on a little side table by your seat and is cleared when you get up. He walks back to the bar and
  leaves.
- While you're seated in VIP, the dock's **Bar** button calls the waiter instead.
- Not built: bottle service with sparklers. It stays a later idea; the VIP table perk is unchanged.

**Phase 5 · The walls.** The big screen above the DJ shows only the song playing and who requested it. Paid ads get
their own frames on the side walls and rotate. No "Advertise here" pop-up.

Each phase: tests, a local play-through on a phone-sized screen, its own commit; live when the owner says. The city
map's look does not change (club interior and character code only; edits to protected files kept minimal and reported).
