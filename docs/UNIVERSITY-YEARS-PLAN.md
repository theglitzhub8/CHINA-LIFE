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
- [ ] Player collision padding so the body never enters furniture edges (also NPC walkers); every desk, chair,
      bed and board gets a collider; a test that walks every venue and home and asserts no overlap.
- [ ] Real sit: tap a chair, walk to the spot in front of it, turn to face the chair's direction (about 0.4 s),
      play a short sit-down, then the seated loop. Standing up reverses it. Works for the sit emote, sit actions
      and furniture with `userData.seat`.
- [ ] Furniture placement keeps a walkable gap so a chair is always reachable.
- Touches `world.js` (protected file): venue movement only, no map look change. Owner approved (28 Oct).

### Phase 2. The 2-person dorm
- [ ] New home tier `dorm`: two beds, two desks, private toilet, compact kitchen unit, at the right scale.
- [ ] Students live in the dorm of their campus until graduation (the story's "dorm key" step uses it).
- [ ] One roommate: an NPC with a name, a routine (studies, sleeps, cooks) and small events (borrows food,
      asks for quiet before exams). Later: a real player can be the roommate.

### Phase 3. Academic calendar and years, switch `uni_years`
- [ ] Server: enrolment date, current year 1-4, week number, results per year (new table + migration,
      `university.php` GET status / POST actions). Client card "Year 1 · Week day 3 · Attendance 92".
- [ ] Year-by-year unlocks on the university map: Year 1 classrooms + dorm + campus store, Year 2 library,
      Year 3 laboratory, Year 4 graduation hall. Locked rooms show "Opens in Year 2".
- [ ] Sunday exam: built from the existing Chinese course (HSK 1 in Years 1-2, HSK 2 in Years 3-4), harder or
      easier by the exam buff. Pass = next year; fail = resit next week (carry-over).

### Phase 4. Timetable, attendance 100 and the phone buzz
- [ ] Daily timetable (Beijing time), for example 09:00 and 14:00 classes of 45 minutes each, shown on the phone.
- [ ] Attendance 100 per year, server-checked by being in the classroom during the class (presence, like today).
- [ ] Phone buzz 2 minutes before class; optional web push reminder (needs a push payload change in `sw.js`).
- [ ] Truancy Risk lowers the exam buff; library sessions restore it.

### Phase 5. Year 1 food economy, switch `uni_food`
- [ ] Student allowance ¥100 per real (Beijing) day, about ¥3,000 a month (owner's decision).
- [ ] Campus store with ingredients (rice, noodles, egg, tomato, vegetables, meat, spices...), a small fridge
      inventory. Prices make ordering food eat most of the allowance (about ¥80 a day) while cooking costs
      about ¥25-35 a day, so cooking leaves money for everything else.
- [ ] Cooking: known recipes, or free combination of 2-4 ingredients. Good combos feed more and train Cooking;
      bad combos cause food sickness: hunger drops, urgent toilet trips (bladder), lower energy for a few hours.
- [ ] Server ledger for allowance and purchases (same rules as other money).

### Phase 6. Year 2 library
- [ ] Library room: sit at a desk (uses real sit), read major books: knowledge points, restores exam buff,
      quiet-room rules (no music, whisper chat).

### Phase 7. Year 3 laboratory and major
- [ ] Choose Computer Science or Physics (sets `student.major`).
- [ ] Lab sessions: Chinese mini-games per major (match terms to meanings, order the steps of an experiment,
      read a Chinese instruction and pick the right action). New HSK 2 word sets for each major.

### Phase 8. Year 4 graduation
- [ ] Final task: write a self-introduction in Chinese characters (typed with the phone's Chinese keyboard),
      checked for required parts (name, country, university, major, a plan), then read it on stage.
- [ ] Graduation ceremony, certificate, formal blazer unlocked, the player moves on to the city life
      (first apartment, jobs).

### Phase 9. Progression-locked wardrobe, switch `wardrobe_locks`
- [ ] `requires` on store items: year, graduation, first apartment, rank. Locked items visible with a lock and
      the reason; the server refuses buying or wearing locked items.
- [ ] Starter set reviewed so it looks neat, not humiliating.

### Phase 10. Micro-customization, switch `micro_style`
- [ ] Per-item details: button colour, stitching colour, collar type, bag colourway and graphic, trouser length
      and fit (standard, shorts, joggers, cropped).
- [ ] Saved per owned item, validated on the server, shared through presence so other players see them.
- [ ] Rare colourways tied to milestones for status signalling.
- [ ] Tint the Rocketbox clothing (top, trousers, shoes) per player on every graphics level (owner's decision),
      then add details where the model allows; Low / classic bodies get the full set.

## Rules for every phase
- Tests for every phase, `npm test` green before each commit, try it locally with `scripts/local-stack.mjs`.
- Protected map files: smallest possible edits, never a change to the map's look; tell the owner what changed.
- Server migrations go in a new `.sql` file and follow `docs/DEPLOY.md`.
- No deploy without the owner's go-ahead; each phase can ship on its own when its switch is turned on.
