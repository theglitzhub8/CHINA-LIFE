# University Years, Wardrobe and Room Realism: plan

Status: decisions taken with the owner (28 Oct 2026). Nothing is built yet.
Branch: `feature/university-years`, cut from `r8-buildings`. Nothing reaches `main` or the server until the owner approves.
Every phase sits behind an admin switch (default OFF) so the live game is unchanged until it is switched on.

## What already exists (we build on it, not beside it)

| Area | Today | File |
|---|---|---|
| Student start | Onboarding, 15 Shenyang campuses, `state.student` (major field exists, always empty) | `game.js` onboarding / studentProfile |
| Arrival story | 7 steps: airport, campus card, dorm key, kit, meal, first lecture, student centre | `student-story.js`, `game.js` studentStory |
| Chinese | 30 HSK 1-2 units, spaced repetition, one class quiz per day, HSK certificates by skill level | `chinese-course.js`, `game.js` classroomScreen |
| Attendance | Server-checked "I'm here" once per Beijing day at a campus, ¥30 + 15 XP, warning / risk (XP held) | `attendance.php`, `school.js` |
| Clock | Real Beijing time, 1 real day = 1 game day (must stay: daily limits, server forces day/hour) | `game.js` chinaClock, `save.php` |
| Homes | 6 home tiers with colliders and spots (bed, desk, cook, toilet), furniture slots, rotate/move | `home-interiors.js`, `world.js` |
| Food | Instant noodles at home, delivery app (off in one-city), Cooking skill; no ingredients or sickness | `game.js` |
| Look | Rocketbox avatar picker (hair, colours, skin, beard, top), store clothes priced only | `game.js` appearanceScreen / storeScreen, `realism.js` |
| Sitting | Sit emote snaps onto the nearest chair; action sit walks to a point, not tied to a chair | `world.js` setEmote / perform |
| Collision | 0.4 m walking grid, box colliders, crowd push; player can brush through furniture edges | `movement.js`, `world.js` |

## Design decisions (adjusted from the brief)

1. **Time scale.** The real clock stays Beijing time (daily limits, server checks). On top of it an **academic calendar**:
   1 real week = 1 academic year, Monday to Sunday. A 4-year degree takes 4 real weeks from enrolment.
   - Mon-Fri: class days. Sat: library / catch-up day. Sun: exam day and year-end results.
   - The year counter is computed on the server from the enrolment date, never trusted from the device.
2. **Catch-up, not failure.** Missing days never fails you out. Missed classes become **Truancy Risk**: it lowers your
   exam buff (exams get harder). Library study sessions win the buff back. A failed year-end exam can be resat the next
   week while the new year starts ("carry-over"), so nobody is stuck.
3. **Attendance score 100.** Each year starts at 100. A missed class costs points, attending gives them back up to 100.
   The score feeds the exam buff. It replaces nothing: the existing visa warning / risk stays as it is.
4. **Class buzz.** 2 minutes before a class the in-game phone buzzes (banner + vibration). Push to the real phone is
   optional and only for players who already allowed notifications.
5. **Majors stay language-first.** Year 3 picks Computer Science or Physics, but the lab work is Chinese puzzles
   (vocabulary matching, logic ordering, reading instructions), so the major is flavour plus a new word set.
6. **Wardrobe locks are milestones, not paywalls.** Starter clothes stay neat (campus sportswear, plain tee).
   Locked items show in the store with their requirement (Year 2, Graduation, first city apartment, rank).

## Build order (owner's choice: university years first)
1. Phase 0 switches → 2. Phase 2 dorm → 3. Phase 3 calendar and years → 4. Phase 4 timetable and attendance
5. Phase 5 food → 6. Phase 6 library → 7. Phase 7 lab and major → 8. Phase 8 graduation
9. Phase 1 room realism → 10. Phase 9 wardrobe locks → 11. Phase 10 micro-customization

## Phases (each one: build, tests, try it locally, commit; then the next)

### Phase 0. Branch and switches
- [x] Branch `feature/university-years` from `r8-buildings`.
- [x] Admin switches (appadmin Features, default OFF): `uni_years`, `uni_food`, `wardrobe_locks`, `micro_style`,
      `real_sitting`. Client reads them through `flags.js`, server through `cl_hafrik_features()`.

### Phase 1. Room realism (Ideas 2 and 3), switch `real_sitting`
- [x] The player's body keeps 16 cm clear of furniture: paths keep that gap (`walkingPath` clearance) and every
      step is checked with it; someone who starts inside furniture can still walk out. Measured over 25 random walks
      in each home tier: the body overlapped furniture in 7% of frames before, 0 with the switch on (tested).
      Every venue action still completes with the switch on.
- [x] Real sit (sit emote, any chair or `userData.seat` furniture within reach): walk to a free spot beside the
      chair (front, sides or back), turn to the chair's direction (0.4 s), slide onto the seat (0.3 s), then the
      seated pose. Standing up puts you back on that spot instead of inside the chair. Walking away cancels it.
- [ ] Later: NPC walkers with the same body gap, a sit-down animation clip, and colliders for wall boards and
      thin props; furniture placement that always leaves a walkable gap to every chair.
- Touches `world.js` (protected file): venue movement only, no map look change. Owner approved (28 Oct).

### Phase 2. The 2-person dorm
- [x] New home tier `dorm`: two beds, two desks, private toilet and shower, compact kitchen unit, at the right scale.
- [x] Students without a bought home in the city live in the dorm (the story's "dorm key" step uses it); the place
      card says "Your student dorm". Moving out at graduation comes with Phase 8.
- [x] One roommate (`public/dorm.js`): same gender, picked per player, routine on Beijing time (asleep, breakfast,
      at class, studying, cooking), one small moment a day (share food, quiet before an exam, rubbish, cooked too
      much, study together) that moves a saved bond (`state.dorm`).
- [ ] Later: a real player can be the roommate.

### Phase 3. Academic calendar and years, switch `uni_years`
- [x] Server `university.php`: enrolment (Mon-Wed starts Year 1 this week, Thu-Sun is orientation until Monday),
      year 1-4 from the enrolment date, day type, results per year. Kept in `game_state.university` like attendance
      (no new table); `save.php` keeps it and `attendance` from being wiped by device saves (that was an existing bug).
- [x] Client `university.js`: campus chip ("Year 1 · Class day", or "Exam day" with Take exam) and a University
      screen with the calendar, each year's result and the campus rooms. Locked rooms show "opens in Year N".
- [x] Sunday exam made and graded on the server from the Chinese course words (`university-words.php`, generated by
      `scripts/university-words.mjs`): 10 questions, pass 6, +60 XP and ¥120. HSK 1 in Years 1-2, HSK 2 in Years 3-4.
      One attempt per year per Sunday; a missed or failed year becomes a resit on any later Sunday.
- [x] Fixed: rewards paid by the server (exam pass, and attendance's ¥30 + 15 XP) were taken back by the next device
      save; `cloud.js` now adds them on the device at once.
- [ ] Exam buff (harder or easier by attendance) comes with Phase 4.

### Phase 4. Timetable, attendance 100 and the phone buzz
- [x] Timetable on class days (Beijing time): 09:00 Chinese class and 14:00 Lecture, 45 minutes each, on the
      University screen with each class's status (attended, on now, missed, later).
- [x] Check-in from 2 minutes before a class until it ends, only from a campus (live presence): +10 XP, ¥10.
- [x] Attendance score per year: starts at 100, a missed class costs 10, an attended class gives 5 back (max 100).
      It sets that year's exam pass mark: 90+ is 5/10, 60+ is 6/10, below 60 is Truancy Risk and 7/10.
- [x] Phone buzz in the game 2 minutes before each class (banner + vibration), once per class, anywhere in the game.
- [ ] Web push reminder to the real phone (needs a push payload change in `sw.js` and a cron): later.
- [ ] Library sessions win back attendance points: Phase 6.

### Phase 5. Year 1 food economy, switch `uni_food`
- [x] Student allowance ¥100 per Beijing day (about ¥3,000 a month), paid by `allowance.php` on the server ledger and
      collected automatically when the game opens; kept in `game_state.allowance` (save.php keeps it).
- [x] Campus store (`kitchen.js`): 17 ingredients at ¥1-12, bought only at a campus, a fridge of 30 items. Ordering a
      meal costs ¥40 (two a day = ¥80 of the ¥100); the ten recipes cost ¥4-17 each.
- [x] Cooking at home with the walk-to-the-kitchen animation: ten known recipes (Chinese and West African), or 2-4
      ingredients of your own. Good mixes feed and train Cooking; bad ones (two meats, meat with nothing to cook it
      with, seasoning only, clashing pairs) give 3 hours of food sickness: no real meal, less energy and fun, and an
      urgent toilet cramp every 25 minutes, until it passes or a doctor at the City Hospital treats it.
- [x] Purchases are spent on the device like every other purchase (the save rules record the spending).
- [x] Fixed on the way: the sleeping roommate lay inside the mattress (the world's idle bob reset his height).

### Phase 6. Year 2 library
- [x] Library (opens in Year 2, on campus): up to 2 reading sessions a day from the University screen. The radio
      pauses ("quiet please"), the character studies at a desk, reads 3 words of the year's units, then answers 3
      questions marked by `university.php`. 2 right wins back 5 attendance points for the current year (10 on Saturday,
      library day) and 5 knowledge per right answer (saved for the lab and graduation).
- [ ] Later: a library room of its own on the campus map, whisper-only chat, and sitting on a real chair (Phase 1).

### Phase 7. Year 3 laboratory and major
- [x] Choose Computer Science or Physics once, from Year 3 (saved in `university.major` and `student.major`).
- [x] One lab session a day on campus (`university-lab.php` holds the content: 15 terms, 2 experiments and 4
      instructions per major): 2 terms to match, an experiment's steps to tap in order (Chinese, optional English
      hint, undo), and a Chinese instruction to act on. Marked by `university.php`; 3 of 4 earns a lab credit and
      20 XP, and every point is 5 knowledge. Lab credits and knowledge are kept for graduation.
- [ ] Later: more experiments and instructions per major.

### Phase 8. Year 4 graduation
- [x] Graduation hall (Year 4) once all four year exams are passed and a major is chosen (it lists what is missing).
- [x] Self-introduction typed in Chinese characters, checked by `university.php`: at least 20 characters and five
      parts (name 我叫, where from 我是…人/我来自, university 大学, the student's own major 物理 or 计算机, a plan
      我想/以后). A miss comes back as a checklist and keeps the draft.
- [x] A pass: read on stage (speech bubble), degree certificate, ¥500 and 200 XP, the award-only Graduation blazer
      (`grad-blazer`, never sold, shown under My stuff), and moving out of the dorm (`student.graduated`).
- [ ] Later: a graduation hall room with an audience, and switching to a working background after graduating.

### Phase 9. Progression-locked wardrobe, switch `wardrobe_locks`
- [x] 12 locked items (`public/wardrobe-locks.js`, same list in `chinalife-api/wardrobe-locks.php`, kept equal by a
      test). Students with university years: Varsity jacket at Year 2, Tailored suit and Suit trousers at graduation.
      Everyone else by rank (Explorer 200 XP ... Legend 12,000 XP). Leather jacket and White leather sneakers: your
      first apartment. Gown, designer sneakers, gold chain, handbag, luxury watch: higher ranks.
- [x] The store shows a lock and the milestone instead of the price, and no Buy button; the item can still be
      previewed. Items already owned are never locked.
- [x] `save.php` refuses a new locked item before its milestone and wearing one that is not owned; items in the stored
      wardrobe stay (bought before the locks or unlocked earlier).
- [x] Starter set reviewed: Everyday tee, Slim jeans and Canvas sneakers stay neat and are never locked.

### Phase 10. Micro-customization, switch `micro_style`
- [x] Per-item details (`public/micro-style.js`): button colour, collar (classic, mandarin, spread, V) and hem stitching
      on shirts, suits and jackets (stitching on every top); length (full, cropped), fit (slim, regular, wide) and seam
      stitching on jeans, chinos and joggers; colourway and graphic (star, stripe, heart, panda) on backpack and handbag.
      Customised from the store under an owned item; choosing an option again clears it.
- [x] Saved in `state.wardrobe.details`, cleaned on load and on every save (`chinalife-api/micro-style.php`, same lists,
      kept equal by a test), and returned by `presence.php` for the items a player wears, so others see them.
- [x] Rare options tied to milestones: jade buttons (graduation / Regular rank), bright gold stitching (Insider), gold bag
      (Shenyang Star), panda graphic (Year 2 / Local). Locked in the store and refused by `save.php`.
- [x] Classic bodies (`characters.js`) draw every detail. Rocketbox avatars on High / Medium get the player's top,
      trouser and shoe colours painted over their clothes (`realism.js` rbTint, as the Hypeman), for the player and
      other real players, never the crowd.
- [ ] Later: buttons, collars and bags drawn on the Rocketbox avatars too (needs a per-avatar texture mask).

## Rules for every phase
- Tests for every phase, `npm test` green before each commit, try it locally with `scripts/local-stack.mjs`.
- Protected map files: smallest possible edits, never a change to the map's look; tell the owner what changed.
- Server migrations go in a new `.sql` file and follow `docs/DEPLOY.md`.
- No deploy without the owner's go-ahead; each phase can ship on its own when its switch is turned on.
