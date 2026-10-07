# ChinaLife: Season 0 — Student Life

Product principle: **You don’t play ChinaLife. You live it.** ChinaLife belongs to the Hafrik ecosystem. The release focus is a convincing persistent multiplayer student world in Shenyang. The user’s long-term specification is the product direction, not a request to implement every system in one pass.

## Current milestone: origin, student profile and arrival introduction

The implementation extends existing systems:

| Existing system | Extension |
| --- | --- |
| Hafrik token/native-session authentication | Guest character adoption into an empty account; existing account characters load automatically |
| Revision-checked PHP game saves | Student origin, city/university, study level, major and campaign progress remain in the existing per-account game JSON |
| Guest device saves | Play before login; optional Save your ChinaLife / Continue with Hafrik |
| City/university venues | Shenyang is the first student-story city; unsupported city/university details remain in the profile and use an explicit temporary campus |
| Phone and profile | Student Story entry and optional introduction for existing student characters |
| Venue movement and activities | Arrival chapters reuse travel and activity animation; no separate multiplayer world is created |
| Presence API | Outside-China campaign characters join shared presence after arrival; both origins use the same city/place/player routing |

`public/student-story.js` owns the version-1 student campaign content and university choices. `public/game.js` renders setup and executes campaign transitions using existing movement, needs, XP and save functions. `public/cloud.js` handles Hafrik identity, account restoration and upload. PHP owns account authentication, database isolation and optimistic save revisions. Campaign version 1 keeps its step ordering stable; future campaign restructuring needs a saved-progress migration.

Fresh characters select their origin first. Study is playable; the other life paths are visible as Coming Soon. Already-in-China students start at their campus welcome desk. Overseas students complete the simplified simulated preparation campaign, arrive at the airport and enter the same Shenyang world. Real admission, immigration, visa decisions and bookings are outside the simulation. No real service CTA is added until an actual Hafrik destination is verified.

Existing student characters may explicitly add their university profile and start the introduction without resetting money, skills, purchases or friendships. Other existing backgrounds remain playable. Existing prototype cities remain available; their full student campaigns have not been built.

The introduction is not the complete **WELCOME TO CHINA** first-day mission. It introduces arrival, campus registration, dormitory check-in, starter necessities, a meal, a class and the student centre. It does not yet verify roommate interactions, another-player interaction or orientation attendance. Its starter necessities and meal are complimentary, so this milestone adds no new monetary pricing or cash reward logic.

## Next milestones, one at a time

1. Finish the reusable university/first-day mission framework: campus sublocations, registration, dorm assignment, roommate, necessities, food, campus exploration, real-player interaction and orientation. Completion rewards must be granted once.
2. Strengthen authoritative server-side economy and configurable pricing. Existing earnings/purchases still execute on the client; PHP transfers are atomic but do not make the whole economy authoritative.
3. Extend existing NPC, housing, food/shop, academic and activity systems rather than replacing them.
4. Add the reusable Life Event Engine for location, university, time, needs, relationships, academic standing, reputation and previous-choice triggers. The origin campaign remains a short guided introduction; it must not become the entire life storyline.
5. Improve Shenyang’s phone/Hafrik services, events, social activities and multiplayer reliability; then day/night, winter/weather and consequences.
6. Add further universities and distinctive cities only after the Shenyang loop is stable. Guangzhou trade/Canton Fair is a later path, not Season 0’s priority.

Long-term systems include jobs, businesses, relationships, inventory, economy, transportation, weather, reputation/law and persistent housing. Multiplayer romance must be non-explicit and mutually consensual. Real services remain separate from game progression. Avoid duplicating maps or introducing one-off venue logic.

## Validation and release discipline

Inspect existing implementations before each milestone. Preserve working features, separate server/client responsibilities and avoid unrelated redesign. Test two authenticated clients in the same venue, both-origin convergence, guest adoption, logout/reconnect and process restart. Report remaining gaps. Complete one milestone, push it for server deployment, and stop until the user chooses the next step.
