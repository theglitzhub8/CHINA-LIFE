# Hospital upgrade plan (29 Oct 2026)

The third of the seven one-city places to get a major upgrade, after University and the Gossip Room. Goal: the City
Hospital is where your character's health actually lives. When something goes wrong (you faint, black out, get food
sickness) you end up here; you can come in to get better, learn the Chinese you'd need at a real Chinese hospital, and
other players can work here and look after you.

Same rules as before: each phase behind its own appadmin switch (default OFF), shipped to live switched off, tunable
from an admin Hospital tab. The approved map look does not change; the hospital's interior can. Game interpretation,
never medical advice.

## Today

| Feature | What it does | Code |
|---|---|---|
| See a doctor | ¥150, 1 hour, +40 energy | game.js `cityhospital` actions |
| Rest on the ward | free, 2 hours, +30 energy | same |
| Food sickness | walking into the hospital cures it | kitchen.js |
| Street accident | ambulance ride and a bill (¥300 + treatment) on the server | street-social.js, economy.php |
| Fainting | at 0 energy or 0 hunger you faint where you are and lose 90 minutes | game.js `faint` |
| Drinking blackout | at 100 drunk you black out | game.js `blackout` |
| Room | reception, two beds, a heart monitor, waiting chairs | rooms.js |

Problems: two thin actions; the hospital is never part of what happens to you (fainting and blackouts don't involve
it, and street accidents can't happen in one-city mode); nothing to learn or do with other players.

## Phases

**Phase 0 · You wake up at the hospital (switch `hospital_care`).** Fainting, a blackout or a bad case of food sickness
take you to the City Hospital by ambulance: you wake up on the ward, a nurse explains what happened, and the bill is
charged on the server (it can be waived the first time). A "🩺 Your health" screen in the hospital shows what is wrong
right now (low needs, sickness, drunk) and the treatments that fix it.
✅ Done 29 Oct 2026: fainting (hunger or energy) and a drinking blackout take you to the hospital by ambulance;
economy.php action `hospital` charges ¥200 (`CL_HOSPITAL_BILL`), the first visit free, no second bill within 10
minutes, never more than you have. "🩺 Your health" is on the hospital's place bar (one line in world.js) and on the
wake-up screen. Not built: an automatic ambulance for food sickness (it is listed in Your health and cured on arrival,
as before). Code: public/hospital.js, game.js `faint`/`blackout`; tests: tests/hospital.mjs, tests/php-api.mjs.

**Phase 1 · Check-ups and hospital Chinese.** A free weekly check-up: the doctor asks questions in simple Chinese
(发烧 fever, 头疼 headache, 肚子疼 stomach ache, 过敏 allergy…) and you answer from choices; doing well gives XP and
Chinese progress, like University's words. Useful for real life in China.
✅ Done 29 Oct 2026 (switch `hospital_checkup`, off; it needs `hospital_care` on too): "👩‍⚕️ Free weekly check-up" in
Your health at the City Hospital. 5 of 18 questions (chinalife-api/hospital-lib.php): what the doctor says (你哪儿不舒服？,
你发烧吗？, 张开嘴…, 一天吃三次，饭后吃, 挂号, 急诊…) and how you'd say it (我发烧了, 我对青霉素过敏, 药房在哪儿？…).
economy.php action `checkup` hands out the questions without answers and marks them; once per Beijing week (Monday);
+8 XP per right answer and +20 for 5/5 on the server ledger, +5 Chinese per right answer; the result screen shows
every right answer with pinyin and meaning. No sign-in, no check-up.

**Phase 2 · Pharmacy.** Buy medicine to keep: painkillers (energy), oral rehydration salts (after drinking), vitamins
(slower needs drop for a day), stomach medicine (cures food sickness anywhere). Used from the phone; priced so that
coming to the hospital is still worth it.
✅ Done 29 Oct 2026 (switch `hospital_pharmacy`, off; needs `hospital_care` on too): "💊 Pharmacy" in Your health at the
City Hospital (buy) and "💊 Your medicine" anywhere else (take). The phone's 💊 Wellbeing app opens Your health while
`hospital_care` is on (one line in game.js). Painkillers 止痛药 ¥60 (+20 energy), rehydration salts 口服补液盐 ¥40 (−40
drunk, +5 energy), vitamins 维生素 ¥80 (needs drop 30% slower for 24 hours, one course at a time), stomach medicine
肠胃药 ¥90 (cures food sickness). Up to 5 of each. Stock lives on the server (economy.php action `pharmacy`, bought minus
used in the economy log: no migration); prices in hospital-lib.php `cl_pharmacy_items`.

**Phase 3 · Real doctors and nurses.** A Hospital job with shifts. Players on shift see patients who come in (a queue,
like the Hot Seat): pick the right treatment from what the "Your health" screen shows, and both are rewarded. When no
player is on shift, the hospital's staff treat you as today.

**Phase 4 · Visiting the ward.** See which friends are recovering on the ward, visit them, bring flowers or fruit
(their fun and social go up), and a "Get well" message.

**Phase 5 · Student health insurance.** Students can join the campus insurance plan (a small monthly fee from their
allowance), which cuts hospital bills, as it works for international students in China.

**Phase 6 · Admin.** A Hospital tab in appadmin: prices and bills, the check-up questions, pharmacy prices, job pay
and shifts, insurance fee and cover.

## Owner's decisions (29 Oct 2026)

1. **Hospital bill (Phase 0):** ¥200 when you wake up at the hospital; your first time is free. Admin can change it.
2. **Doctors (Phase 3):** only qualified players: a University major or a health certificate first.
3. **Insurance (Phase 5):** yes, for students: a small monthly fee that cuts hospital bills.

## Order

Phase 0 first (it makes the hospital part of the game), then 1 and 2, then 3 and 4 (with other players), then 5 and 6.
Each phase: tests, local play-through, its own commit, pushed to the feature branch; live only when the owner says so,
switches off.
