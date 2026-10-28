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

**Phase 1 · Check-ups and hospital Chinese.** A free weekly check-up: the doctor asks questions in simple Chinese
(发烧 fever, 头疼 headache, 肚子疼 stomach ache, 过敏 allergy…) and you answer from choices; doing well gives XP and
Chinese progress, like University's words. Useful for real life in China.

**Phase 2 · Pharmacy.** Buy medicine to keep: painkillers (energy), oral rehydration salts (after drinking), vitamins
(slower needs drop for a day), stomach medicine (cures food sickness anywhere). Used from the phone; priced so that
coming to the hospital is still worth it.

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
