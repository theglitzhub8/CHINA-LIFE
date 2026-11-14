# Today plan: one place for everything to do today (14 Nov 2026)

The owner asked to plan a "Today hub" after looking at Vatarverse (Lagos Life), whose screens always show one obvious
next step. What we learned there, and what it means for ChinaLife:

- **One pull-down panel** from a small ⌄ at the top: notifications, messages, today's tasks, streak and level, what's
  next, mood and needs, wallet, players online, and switches for music, dark mode and a clean screen.
- **Three daily tasks** ("Hustles"): one for money, one for life, one for people. Each shows the time it takes, the
  reward and one **Go** that takes you there. All three pay a Daily Bonus; one free swap a day; a countdown to new ones.
- **A pinned "next task" chip** under the top bar with **Go**.
- **Event screens with one button**: countdown, Top 3 in your city, "You: not on the board yet", the reward, one Go.
- **"What's new"** dated cards, and a "How it works · Got it" card the first time you open a feature.

**Our problem today:** the rewards from the Energy plan are spread over many screens (streak card, ¥20 first visits,
three gossip tasks, the football challenge, vote rewards, jobs). Nobody sees them all in one place, so most players
never find most of them.

## Phases (each ships on its own, each has a switch in Hafrik integrations, default on)

**Phase 1: Today's Three.** Every Beijing midnight each player gets three tasks, one from each group, picked from
things the server can already check:
- 💴 **Hustle** (money): work one shift (economy.php job), finish an HQ shift, a hospital shift for staff.
- 🏙 **Life**: play a football match (football-day.php), visit 3 places (daily-visit.php), a hospital check-up.
- 💬 **Link-up** (people): drop a gossip tip, vote a Hot Seat round, react to 5 tips (gossip-today.php), vote in an
  open election (politics.php).

Each row: icon, group tag, one line, "about N min", the reward chips it already pays, and **Go** (opens the place or
screen; uses the existing place docks). One free swap a day (↻). All three done: a **Daily Bonus** of ¥300 + 50 XP,
paid once by a new chinalife-api/today.php that counts from the ledger (no new tables: the picks are the same for
everyone each day, seeded from the date, so the server knows them without storing them; the swap is a ledger row).
"New tasks in 9h 12m" at the top. The streak (daily.php) sits at the top of the same screen as one row.
Opens from the existing ⏱ Today chip and the phone's Tasks app, which today show a plain list.

✅ Built 14 Nov 2026 (public/today.js, chinalife-api/today.php, switch `todays_three`, default on). As built: Hustle =
work one shift or one night mission; Life = play a football match or visit 3 places; Link-up = drop a tip, vote a Hot
Seat round or react to 5 tips (the hospital check-up is weekly, so it is not in the pool, and elections are not always
open). The picks come from the date; the swap and the bonus are ledger rows (today-swap, today-bonus). Opens from the
⏱ Today chip and the phone's Tasks app (game.js tasksScreen); signed-out players are asked to log in. Admin → Energy
has a "Today's Three done" column.

**Phase 2: The Today panel.** A small ⌄ on the clock chip in the top bar opens one sheet:
Today's Three (0/3) · 🔥 Streak and rank · 🔔 Notifications · 💬 Messages · 😊 Mood and needs · ¥ Wallet ·
🟢 Players online · 🎵 Music on/off · 🌙 Clean screen on/off. Each row opens the screen we already have.
**This touches the approved top bar (CLAUDE.md):** only the ⌄ is added, nothing is restyled or moved, and the owner
sees it before it goes live.

✅ Built 14 Nov 2026 (public/today-panel.js, switch `today_panel`, default on). As built: instead of a second ⌄ (the
city line already has one), a small "🎯 1/3" pill sits in the empty space of the clock chip and turns gold with a pulse
when something waits (the streak reward or the bonus); tapping it or the clock drops one card: the time and day,
Today's Three, streak and rank, Notifications, Messages, Link Up (players and friends online), mood, wallet, and
switches for Music and Clean screen. Map change, for the owner: only the pill is added to the top bar; on narrow phones
it moves to the city line, and where there is no room at all it hides and the clock shows a small gold dot instead.

**Added 14 Nov 2026 at the owner's request: the Gym.** The Community Gym (already in the China map data, hidden in
shared-city mode) is now the 8th shared-city place (one-city.js PLACES/ORDER, common.php CL_ONE_CITY_PLACES; a saved
layout from before gets it once when read, and an admin save after that is kept as chosen). Today's Three gets a Life
task "Work out at the gym" from 15 Nov: the phone reports arriving at the gym and a finished workout there
(today.php gym-arrive / workout); it counts after 60 s at the gym, or straight away when the shared city shows you at
the gym, never from another place. First visits stay the seven places. Link Up shows the Gym card in orange.

**Phase 3: The next-step chip.** One chip under the top bar: "🎯 Drop a gossip tip · +¥100 · Go", always the next
unfinished task of Today's Three; ✓ and the bonus when all three are done. It replaces the "Find your feet" goal chip
when the switch is on, and hides with Clean screen. Also in the approved layout: owner sees it first.

✅ Built 14 Nov 2026 (today.js next(), one line in r3.js nextStep, switch `today_next`, default on). As built: the
existing "Next step" chip (no new chip, so the map screen gains nothing) now shows, after "Daily reward ready" and an
urgent low need, the next unfinished task of Today's Three with its icon and money ("Drop a tip on the Gossip wall ·
+¥100", "Visit 3 places (1/3) · +¥20"); tapping it does the task's Go. When all three are done it shows "Daily Bonus
ready · +¥300", and once collected it goes back to its usual hints.

**Phase 4: Event screens.** One shared screen for Match Day (cups), elections and Hot Seat Hour: a coloured card with a
countdown, **Top 3 in your city** (football goals today, votes, gossip rep), your own line ("Not on the board yet"),
the reward, one big Go. Server data exists for all three.

**Phase 5: What's new and How it works.** A "What's new" sheet once after an update (dated cards, each with a grey
"where to find it" box), and a one-time "How it works · Got it" card on Today's Three, Football, Voting and the
Gossip Centre.

## Numbers to watch (Admin → Energy)

Add a "Today's Three" column (players who finished all three) and a "Bonus" column. Success: more players claiming
the streak, and a higher "came back next day".

## Not copied

Vatarverse's look, names, characters and art. We take the patterns (one list, three tasks, one Go), in ChinaLife's own
style. The approved city map does not change.
