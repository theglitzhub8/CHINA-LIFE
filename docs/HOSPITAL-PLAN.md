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
✅ Done 29 Oct 2026 (switch `hospital_staff`, off; needs `hospital_care` on and **migrate.php run first**:
migration-hospital.sql adds chinalife_hospital_staff and chinalife_hospital_patients). Qualified (owner's decision):
**doctors** are players with a University major (Year 3); **nurses** pass the Health worker test at the hospital
(8 questions: 4 hospital Chinese, 4 "what do you give?"; 7 right; one try a day). In Your health at the hospital:
"🧑‍⚕️ Ask the doctor on shift" (patients) and "🩺 Work at the hospital" (staff). A shift is 60 minutes at the hospital;
the queue refreshes every 5 s and shows each patient's chart (needs, drunk, food sickness) with four treatments. The
right one is for the most urgent problem (food sickness, then drunk 60%+, then the lowest need): doctor ¥120 / nurse ¥80
+ 20 XP (5 XP when wrong), paid for 20 patients a day and once a day per patient; the patient gets 10 XP. The patient is
treated either way (the ward staff step in after a wrong pick). Patients wait up to 10 minutes, one visit at a time,
20 minutes between visits; staff can't be patients. Code: chinalife-api/hospital-staff.php, hospital-lib.php, hospital.js.

**Phase 4 · Visiting the ward.** See which friends are recovering on the ward, visit them, bring flowers or fruit
(their fun and social go up), and a "Get well" message.
✅ Done 29 Oct 2026 (switch `hospital_visits`, off; needs `hospital_care` on and **migrate.php run first**:
migration-hospital.sql adds chinalife_hospital_visits). "💐 Visit the ward" in Your health at the City Hospital lists
friends who woke up at the hospital or were treated by a player doctor/nurse in the last 3 hours. Visit each once a day
from the hospital: just a card (free, +10 social), flowers 鲜花 ¥50 (+15 fun, +20 social) or fruit 水果 ¥30 (+15 hunger,
+15 social), with a set card (早日康复！, 多喝水，多休息！, 我们想你！, 加油！; no free text to moderate). The visitor gets
+10 XP and +10 social. The patient's game collects visits (on load, every 3 minutes, and when opening Your health),
applies the gift once and shows a banner. Blocked players can't visit. Code: chinalife-api/hospital-visits.php.

**Phase 5 · Student health insurance.** Students can join the campus insurance plan (a small monthly fee from their
allowance), which cuts hospital bills, as it works for international students in China.
✅ Done 29 Oct 2026 (switch `hospital_insurance`, off; needs `hospital_care` on; no migration): "🛡️ Student insurance"
in Your health (anywhere, students who haven't graduated only). ¥200 for 30 days, paid from your money when you join
and never renewed by itself; renew in the last 7 days (30 more days from the end of the current cover). While covered:
waking up at the hospital costs ¥40 instead of ¥200 (the wake-up screen says what it saved) and the pharmacy is 25%
off. Cover lives in the economy log (economy.php action `insurance`); numbers in hospital-lib.php `CL_INS_*`. Paid
from the player's money rather than taken out of the daily student allowance, so nothing is charged without a tap.

**Phase 6 · Admin.** A Hospital tab in appadmin: prices and bills, the check-up questions, pharmacy prices, job pay
and shifts, insurance fee and cover.
✅ Done 29 Oct 2026: appadmin **🏥 Hospital** tab (admin.php `hospital_settings` / `set_hospital_settings`,
chinalife-api/hospital-settings.php, saved in chinalife_settings 'hospital' as changes over the defaults and logged).
30 numbers in five groups: wake-up bill and "no second bill within" minutes; check-up length and XP; the four medicine
prices, how many you keep and how long vitamins work; doctor/nurse pay, XP, paid patients a day, shift length, waiting
time, minutes between visits and the test's pass mark; ward hours, flower/fruit prices and visitor XP; insurance fee,
days, both discounts and the renewal window. Check-up questions: untick built-in ones, add up to 50 of your own (they
are used by the check-up and the Health worker test). Today's numbers at the top (wake-ups, check-ups, treated by
players, on shift, nurses, ward visits, students insured). Changes apply at once, even with switches off.

## Owner's decisions (29 Oct 2026)

1. **Hospital bill (Phase 0):** ¥200 when you wake up at the hospital; your first time is free. Admin can change it.
2. **Doctors (Phase 3):** only qualified players: a University major or a health certificate first.
3. **Insurance (Phase 5):** yes, for students: a small monthly fee that cuts hospital bills.

## Order

Phase 0 first (it makes the hospital part of the game), then 1 and 2, then 3 and 4 (with other players), then 5 and 6.
Each phase: tests, local play-through, its own commit, pushed to the feature branch; live only when the owner says so,
switches off.
