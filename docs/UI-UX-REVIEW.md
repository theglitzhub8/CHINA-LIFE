# ChinaLife UI/UX review (29 Oct 2026)

Goal from the owner: the game should feel light, not crowded or "choky", and make sense to a brand-new player.
Method: a full new-player play-through on the local stack (phone size 375×812 and a narrow desktop pane) as a new
Student, plus a code map of every on-screen element. The approved city map itself is not part of this review
(CLAUDE.md); everything here is UI drawn over it, the phone, sheets and the sign-up flow.

## The short version

1. **Too many things on screen at once.** On a phone, a new student sees up to 11 overlays at the same time: the HUD
   pill, the needs bar, a toast over the HUD, two school cards, two round map buttons, mic, jump, joystick, the place
   bar (open, with a chat box and two suggestion chips) and the dock. About half the screen is UI before the city.
2. **The first five minutes contradict themselves.** The welcome toast says "open your phone", the tour says "tap Map"
   (there is no button called Map), the first Where-to card says "The dance floor is full" next to "Quiet now".
3. **Sign-up has a real bug and padding.** Tapping Male/Female on the character step ends sign-up immediately, so skin,
   hair, outfit and university are never chosen. Gender is asked twice. The city step offers one choice.
4. **The same thing has several doors.** School: "Class today" card, University card, "Continue your student story",
   "Chinese class" chip, and Learning → Chinese / Classes / Learning Hub in the phone.
5. **Words a new player can't decode:** "NPC", "attendance 100", "2026-11-02", "Coins" vs "¥", "cities opened by
   admin", seven icon-only need meters.

## Findings

### A. Sign-up (first 60 seconds)

| # | What happens | Why it hurts | Fix |
|---|---|---|---|
| A1 | Tapping **Male** or **Female** on "Build your character" submits the form and starts the game ([game.js:709](../public/game.js:709): the buttons come from the profile Look screen's `action()` helper and have no `type="button"`). | Skin, hair, outfit and university are skipped; the player never sees what they chose. | Drop the two cards; keep one gender choice as a pill row like skin/hair. |
| A2 | Gender is asked twice (cards at the top, dropdown at the bottom), with the odd hint "For relationship requests". | Looks unfinished. | One choice, no hint. |
| A3 | Step 1 shows a city dropdown with a single option ("China") and "Only cities opened by admin are available". | An extra tap and admin wording. | In one-city mode skip the city picker; never say "admin" to players. |
| A4 | Each step opens at the previous step's scroll position (step 3 opened half-way down). | The player misses the top of the form. | Scroll to top on each step. |
| A5 | No preview of the character while choosing skin/hair/outfit (the city is blurred behind). | Choices feel blind. | Small live avatar preview at the top of step 3. |
| A6 | Signed-in players still see "Sign in with Hafrik or load your character" and "New to Hafrik? Create an account" on every step. | Confusing: "am I signed in?" | Hide these once signed in. |

### B. The first screen in the city

| # | What happens | Fix |
|---|---|---|
| B1 | Up to 11 overlays at once on a phone (listed above). | A "calm HUD" rule: at most one card on the map at a time (a queue, highest priority first), the place bar starts collapsed, mic/jump only when relevant (voice joined / on a street). |
| B2 | Toasts sit on top of the HUD pill, hiding the clock and money. | Toasts below the HUD (or above the dock), one at a time. |
| B3 | Two school cards stacked ("Class today · I'm here" from school.js and "Year 1 · Orientation" from university.js) covering the player and the mic button. | When University Years is on, the University card replaces the old attendance card (one card, one "I'm here"). |
| B4 | The place bar opens expanded on arrival: title, "⋯", a chat box, two suggestion chips, Venue chat and Voice. | Start collapsed to one line (venue name + chat count); expand on tap. CLAUDE.md already describes it this way. |
| B5 | Needs bar: seven tiny meters with icons only. | Show the one or two needs that are low, with a word ("Hungry"); full list on tap. |
| B6 | Labels like "Mei · NPC". | "Mei" (or "Mei · host"). |
| B7 | University card text: "Orientation week · Year 1 starts 2026-11-02 · attendance 100". | "Orientation week. Classes start Monday." Dates as "Mon 2 Nov"; attendance only once classes start. |

### C. The tour and first goals

| # | What happens | Fix |
|---|---|---|
| C1 | Welcome toast "Open your phone to see your goals" and tour step 1 "Tap Map to see your city" at the same time. | One voice: the tour. No welcome toast while the tour runs. |
| C2 | Tour says "Map" but the dock button is "Where to?"; the map button is an unlabelled round icon. | Use the real button names; point at the button. |
| C3 | Where to?: "Suggested · Club · The dance floor is full" while the same card says "Quiet now"; most venues show "Closed" for a new player at night. | Suggest only open places; never claim activity that isn't there; for a new student, suggest the campus/dorm first. |
| C4 | **The one-city tour gets stuck** on "Pick a place": the step only completes at the café ([r3.js:51](../public/r3.js:51)), which is not one of the one-city destinations. | Complete the step on arrival at any place. |
| C5 | Within ~2.5 s of arriving: welcome toast, daily-reward banner and the tour card. The daily reward is signalled in 5 places (banner, 🎁 badge, Next-step pill, phone widget, Rank badge). | Tour first; reward once, after the tour. |
| C6 | The first goal is "visit 5 venues", but the tour is 5 more taps, and there are four overlapping to-do systems (Goals, Daily tasks, Weekly activities, Rank) plus night missions, milestones and events. | One "Today" list for new players; the rest unlock later. |

### D. The phone

| # | What happens | Fix |
|---|---|---|
| D1 | The home screen is clean (13 apps), but the three widgets cut their text ("Thursday …", "Clear nig…", "University welcome…"). | Shorter widget text or two lines. |
| D2 | "Coins" in the widget, "¥" everywhere else. | One name for money: ¥ / yuan. |
| D3 | Learning holds Chinese, Classes (whose screen is titled "Learn") and Learning Hub; University is elsewhere. Classes lists greyed certificates with "Shenyang" while the player is in "China". | One "Study" app: University (students), Chinese, Certificates. Same title on the icon and the screen. |

### E. Consistency (why it feels heavy)

| # | What the code shows | Fix |
|---|---|---|
| E1 | Three top banners share one spot over the HUD: `#toast`, `#gameNotification`, `#messageNotification`; ~265 `toast()` calls. | One notification lane (see task 2); fewer toasts for routine things. |
| E2 | 18 CSS files + 4 JS-injected styles, ~580 `!important`; 44 font sizes (10 of them under 12 px, 11 px used 105 times); at least 13 different "primary" teals; ~5 font families. | A small token set (2 fonts, 1 primary, 6 text sizes, ≥12 px) applied screen by screen, never on the map. |
| E3 | Five close-button styles (30–38 px), tap targets under 40 px (close, account icon, tour buttons and ~30 more). Back appears from the phone but not from the map. | One close button (44 px), one back rule, swipe-down on every sheet. |
| E4 | Native `confirm()` for players in game.js:202 and hot-seat.js:212/232 although `ChinaLifeSheet.confirm` exists. | Use the in-game sheet. |
| E5 | The help dialog is out of date ("single-player", "Look → personality → dream → background → home"). | Rewrite as a 4-line "How to play" with pictures (the new how-to-play page can feed it). |
| E6 | Sign-in opens on top of the onboarding sheet; registration asks gender too (three times in all). | Sign-in first, then onboarding; gender once. |

### F. Words and systems

- Money has four names: ¥, "Coins", "game coins", "virtual yuan". → ¥ (yuan) everywhere.
- Unexplained: XP, Rank, streak, reputation, six needs (incl. "Bladder") as icons, visa status, "XP held", attendance points. → each gets a one-line explanation the first time it appears.
- "gist", "Hot seat", "Gossip TV" and the "Gossip Room" are three separate gossip features. → group under one name.
- Scripted hosts show "● Online · Hafrik host" like real players; NPCs show "NPC". → one honest, friendly label ("host").
- Several doors to the same thing: Where to? (dock, room card, phone, search), chat (Say something, Venue chat, Link Up), voice (mic button and card button), wallet (HUD and phone). → keep the dock as the main door; the others become shortcuts, not copies.

## Plan (tasks, in order)

Each task is small, keeps the approved map look, and can ship behind no switch (they are fixes), unless marked.

1. **Sign-up fixes (A1–A6, E6).** Biggest win for new players; mostly game.js onboarding and cloud.js.
   ✅ Done 29 Oct: one gender row that no longer submits the form (signed-in players start with their Hafrik gender),
   no one-option city picker or "admin" wording, each step opens at the top, no sign-in links once signed in, the
   Student card no longer says "Shenyang". Still open: A5 (a live character preview) and E6 (registration's gender).
2. **Tour that works (C1–C5).** Fix the stuck step, real button names, honest suggestions, students start at campus,
   reward after the tour.
   ✅ Done 29 Oct: the one-city tour is 4 steps (no "Tap Map"); "Pick a place" completes on arrival anywhere; it no
   longer promises a free first ride (walking is free); the welcome toast, daily-reward and first-day banners wait
   for the tour to end; Where to? suggests only open places, never the place you are in, says "full" only with people
   there, and points a new student to campus.
3. **One card at a time (B1–B3, E1).** A tiny queue for chips, cards and banners: tour > class now > reward >
   everything else; one notification lane that never covers the HUD.
   ✅ Done 29 Oct (r3.js `lane()`): one card under the HUD (tour > class check-in > daily attendance > kitchen >
   University > tips > street chip), the rest wait their turn; toasts and notification banners use the same spot
   (never over the clock and money), cards wait while one shows, and the newest banner wins. A University class
   check-in also marks the day's attendance, so "Class today" doesn't ask twice.
4. **Calm place bar and controls (B4, mic/jump).** Collapsed by default; mic only after joining voice; jump on streets.
   (These live partly in world.js/world.css: the edits stay minimal and the owner sees before/after.)
   ✅ Done 29 Oct: every room opens with the place bar collapsed (world.js `buildRoom`: one call changed from opening
   it to closing it; the approved map tag did not open it either); the tour opens it once for its two steps inside it;
   the mic shows when someone else is in the room's voice or you talk (listening alone keeps it hidden; the bar's
   Voice button still joins); jump shows while walking the streets.
5. **Plain words pass (A3, B5–B7, D2, F).** ¥ only, no "NPC"/"admin", readable dates, needs with words, first-time
   explanations.
   ✅ Done 29 Oct: the phone widget says "Money"; club gifts are "virtual yuan"; players read "the ChinaLife team"
   instead of "admin"; no " · NPC" suffix (players still show " · Player"); hosts no longer claim "● Online"; the
   University card reads "classes start Mon 2 Nov" and shows attendance only once classes start; a low need shows a
   word ("Hungry", "Tired", "Bored", "Lonely", "Shower", "Toilet") on the needs strip (world.js `hudNeeds`, small
   edit); one-time tips explain needs and XP; the card spot and banners now sit below the needs strip, and one-time
   tips go ahead of the always-on University and kitchen cards. Gossip feature names (F) are left for task 7.
6. **One look for sheets (E2–E5).** Close/back buttons, tap sizes, fonts and colours, in-game confirm, new help.
7. **Study app and one "Today" list (C6, D3).** One place for school; one to-do list for new players.
8. **Phone widgets (D1).**

Then the next location work, using the same rules for any new screens.
