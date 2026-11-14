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

**Phase 3: The next-step chip.** One chip under the top bar: "🎯 Drop a gossip tip · +¥100 · Go", always the next
unfinished task of Today's Three; ✓ and the bonus when all three are done. It replaces the "Find your feet" goal chip
when the switch is on, and hides with Clean screen. Also in the approved layout: owner sees it first.

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
