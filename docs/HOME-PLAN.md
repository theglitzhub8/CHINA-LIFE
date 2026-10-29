# Home experience plan (30 Oct 2026)

The owner's brief: give the home the same treatment as the club. One row of options right in your face (like the club
dock), nothing crowded, and every action shows what it means so the player feels it.

## What a home has today

Place bar (collapsed) with five items, and a "🏠 At home" sheet with the rest:

| Action | Today |
|---|---|
| 🛏 Proper sleep | restores energy fully |
| 😴 Take a nap | 3 h, restores energy |
| 🚿 Take a shower | 30 min, restores hygiene |
| 🚽 Use the toilet | 15 min, restores bladder |
| 🍜 Cook instant noodles | 45 min, ¥18, +30 hunger (kitchen.js cooking with your fridge when University food is on) |
| 🛵 Order food | every restaurant delivers |
| 📺 Watch Netflix | 2 h, restores fun |
| 👋 Invite friends over | accepted friends you invite can come in (home-visits.js) |
| 🛋️ Furniture & property shop | preview, finish, buy; arrange furniture |
| Upgrades | comfortable bed, kitchen kit, study desk |

The home interiors already have a bed, shower, toilet, sofa, TV, desk, fridge, wardrobe and a kitchen spot. Most actions
run the generic activity (walk somewhere, freeze, time skip, a toast).

## The home dock (proposal)

One button per need, so the dock is also your wellbeing at a glance (a thin bar under each icon shows how full that need
is, red when low):

🛏 Sleep (energy) · 🚿 Shower (hygiene) · 🚽 Toilet (bladder) · 🍜 Eat (hunger) · 📺 Chill (fun) · 👋 Friends (social) · ••• More

More: nap, wardrobe (change outfit at the wardrobe/mirror), study at the desk (if you have one), furnish and arrange,
furniture shop, the home routine sheet.

## Moments (what each action shows)

- **Sleep:** walk to the bed, lie down, the lights dim to night, "Zzz" bubbles, the clock runs fast; wake up with a
  stretch, "Good morning ☀️", energy full. Nap: the same, shorter.
- **Shower:** walk into the bathroom; the shower runs (water drops and steam, frosted, never the body), a hum bubble
  🎶; out with a fresh ✨ sparkle and the hygiene bar filling.
- **Toilet:** walk to the toilet, the door closes and the screen fades ("🚽 15 minutes later…"), a flush, back out.
- **Eat:** choose Cook or Order. Cook: at the kitchen, a pot on the stove with steam and sizzle, then a bowl on the
  table, sit and eat. Order: phone in hand, a rider walks to your door ("Delivery! 🛵"), you take the bag and eat at the
  table.
- **Chill:** sit on the sofa, the TV glows and changes, a bowl of popcorn, laughing bubbles 😂.
- **Friends:** invite friends (as today); when one arrives the doorbell rings and they walk in.
- **Wardrobe:** walk to the wardrobe/mirror and open the outfit screen; the new look shows on the spot.

Costs, times and rewards stay as they are; only what you see and feel changes. Same rules as the club: the approved city
map does not change; home interiors can.

## Owner's decisions (30 Oct 2026)

1. **Dock:** one button per need: 🛏 Sleep · 🚿 Shower · 🚽 Toilet · 🍜 Eat · 📺 Chill · 👋 Friends · ••• More, each
   with a thin bar for that need (red when low).
2. **Sleep:** night falls. Lie down, the room goes dark with Zzz, the clock runs fast, then wake up with a stretch and
   "Good morning ☀️".
3. **Extras, all four:**
   - **Change outfit** at the wardrobe or mirror.
   - **Study at the desk** (if you own one).
   - **Video call family** from the bed (social up, eases homesickness).
   - **Cook from my fridge** at the stove (University food system), not only instant noodles.
4. **Order of work:** the dock first, then the moments one by one.

## Phases

- **Phase 1 · The home dock** with need bars. More holds nap, wardrobe, study, video call, furnish/arrange, the shop
  and the home routine.
  ✅ Done 30 Oct 2026 (switch `home_dock`, default ON). The dock module is club-dock.js, which now serves the club and
  the home.
  - **Buttons:** 🛏 Sleep · 🚿 Shower · 🚽 Toilet · 🍜 Eat · 📺 Chill · 👋 Friends · ••• More.
  - **Need bars:** each need button has a bar (energy, hygiene, bladder, hunger, fun, social). It is green, and red with
    a gentle pulse under 30%.
  - **How they run:** through game.js `homeAct(id)`, the home sheet's own actions without opening the sheet. Sleep,
    shower, toilet, Netflix, study and the pantry no longer pop the sheet back up after they finish.
  - **Eat:** Cook a meal (from your fridge when University food is on), Instant noodles, Order food, and the emergency
    pantry when you can't afford food.
  - **More:** nap, wardrobe (the store), study at the desk (or the shop if you don't have one), the furniture shop, the
    full home routine, and My homes. The video call comes in Phase 6.
  - **Where it shows:** only in your own home. Not when visiting someone (a guest has no dock), not on the map. The
    place bar is hidden, the joystick sits above the dock, and sheets open at half height, as in the club.
- **Phase 2 · Sleep and nap:** night falls.
  ✅ Done 30 Oct 2026 (no switch; public/home-moments.js). Sleep or a nap in your own home:
  - You lie in bed and say "💤 Goodnight…". The room goes dark blue with a moon, twinkling stars and Zzz drifting up.
  - A big counter runs through the hours slept (8h for sleep, 3h for a nap). The game clock stays on Beijing time.
  - The moment lasts 8 s (nap 5.5 s). Then the light turns warm, "☀️ Good morning!" (nap: "😌 That nap hit
    different") and you stretch with both arms up.
  - Energy, time and rent are unchanged (game.js). Skipped when motion is reduced.
  - **Changes to the protected world.js** (no map change): a per-frame hook list (`ChinaLifeWorld.onFrame`) and
    `ChinaLifeWorld.body`, the player's body, so moments can pose the arms.
- **Phase 3 · Shower and toilet** (steam / door and fade, never the body).
  ✅ Done 30 Oct 2026 (no switch; public/home-moments.js, no world.js change). At home, from the dock:
  - **Shower (7 s):** you go out of sight behind frosted glass with running water and rising steam, and the sound of the
    shower. "🎶 La la la…" and "🎶 Hmm hmm hmmm~" float up from behind the glass. At the end: sparkles, "🧼 Hygiene 100%"
    and "✨ So fresh!".
  - **Toilet (5 s):** the screen goes dark with a closed door and "🚽 15 minutes later…", then "🌀 Flush!" with a flush
    sound. Out with "🚽 Bladder 100%" and "😮‍💨 Much better".
  - The body is never shown (world.js shows it again when the activity ends). Sounds follow the music volume and are
    silent at 0. Times and needs are unchanged (game.js). Skipped when motion is reduced.
- **Phase 4 · Eat:** cook from your fridge at the stove, or order with the rider at your door.
  ✅ Done 30 Oct 2026 (no switch; public/home-moments.js). At home:
  - **Cooking** (instant noodles, or a dish from your fridge when University food is on): you step up to the stove and
    face it. A pot with a lid sits on the hob over a flickering flame, steam rises and it sizzles. "🔥 Cooking…", then
    "😋 Smells so good…", then "🍜 Ready!" (9 s).
  - **Eating:** you then sit down a step back from the stove at a little round table with a stool and a steaming bowl
    (6 s), "😋 Mmm…" and "😌 That hit the spot". The pantry meal sits at the table too.
  - **Delivery:** collecting an order at home brings a rider in a yellow jacket in from the door with an orange bag,
    tagged "🛵 Delivery!". He stops beside you ("🛵 Your <dish>! Enjoy 🙏"), hands it over ("🙏 Thank you!"), walks
    back out, and you sit down to eat it. Only an order seen on its way in this session sends him, so an old order from
    a save never does.
  - Food, money and time are unchanged (game.js, kitchen.js). Props are temporary and never block walking. Sounds
    follow the music volume. Skipped when motion is reduced.
  - **Change to the protected world.js** (no map change): `ChinaLifeWorld.fx()` (the room's props and people kit,
    inside a room only) and `ChinaLifeWorld.homeSpot(name)` (the home's door, stove, bed…).
- **Phase 5 · Chill and friends:** TV on the sofa with popcorn; the doorbell when a friend arrives.
  ✅ Done 30 Oct 2026 (no switch; home-moments.js, plus small changes in game.js and home-visits.js; no world.js change).
  - **📺 Chill (10 s), homes with a sofa and TV** (apartment and up): you walk to the sofa and sit on the cushion facing
    the TV. The screen lights up with a made-up show ("Campus Hearts", "The Last Dumpling"…) and cuts between scenes,
    with a coloured glow. A bowl of popcorn sits beside you. "📺 <show> time!", "😂😂😂", "😮 No way!",
    "🍿 *crunch crunch*", "🤣 I can't…", then "😌 Needed that".
  - **A sofa but no TV** (the townhouse): you sit on the sofa watching the show on a glowing tablet, with the popcorn
    and laughs (31 Oct 2026, the owner's own home).
  - **No sofa** (dorm, rental): the same at the desk with the laptop and popcorn.
  - Before this, Netflix had no scene at all. Fun, energy and time are unchanged (game.js). If there's no free spot, it
    runs straight away as before.
  - The TV picture is placed with a ray, because the renderer draws the TV screen as a deeper black box than the model.
  - **👋 Friends:** when a friend you invited accepts and comes over, the host hears a two-tone doorbell, sees
    "🔔 Ding-dong! <name> is here" and says "👋 Come in, <name>!". It rings once per visit. Visits already on when the
    page loads stay quiet. It's checked every 30 s, the same as invitations.
- **Phase 6 · Wardrobe, study at the desk, video call family.**
  ✅ Done 30 Oct 2026 (no switch; home-moments.js, plus small changes in game.js, club-dock.js and home-interiors.js; no
  world.js change).
  - **📱 Video call family** (new, in More and the home sheet): you go to your bedside with your phone, and a phone
    screen shows your family back home ("Family · Lagos", your departure city) with a running call timer. Their lines
    ("🍲 Have you eaten?", "🙏 We are so proud of you"…) alternate with yours in blue on the call, then hearts and
    "🥹 Home feels closer" (12 s). The game: 30 minutes, social +30 and fun +8 the first call of the day; calling again
    the same day is a quick catch-up (+10 / +2). Saved as `familyCallDay`.
  - **📚 Study at the desk:** now walks to the home's real desk (it used a fixed spot before). You face the desk, a warm
    desk lamp comes on, books and a notebook lie beside the laptop, and "📚 Focus mode", "✍️ Taking notes…",
    "🤔 Hmm…", "💡 Oh, I get it now!", then "🎓 Brain: upgraded" (8 s). Skills, energy and time are unchanged.
  - **👔 Wardrobe:** you walk to the wardrobe and face it ("👔 What to wear…"), and the outfit screen opens. If your look
    changes within 5 minutes while you're home, you turn around once in it with sparkles: "✨ New look!". Homes without
    a wardrobe (the dorm) open the outfit screen straight away as before.
  - home-interiors.js marks the built-in wardrobe (`userData.homeWardrobe`). It is not registered as the shop's
    "Tall wardrobe", so a bought wardrobe still gets its own copy.
