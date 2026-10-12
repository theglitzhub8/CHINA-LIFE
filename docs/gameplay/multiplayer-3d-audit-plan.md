# ChinaLife multiplayer 3D audit and implementation plan

Date: 12 October 2026. Audited baseline: `3d79aef`.
Status: proposal for review; no renderer, map, authentication or gameplay changes made in this audit.

## Recommendation

Keep Three.js, the approved isometric city, existing save data, Hafrik authentication, PHP APIs, chat, voice, social features and game economy. Add a reusable gameplay layer to existing venues, starting with one classroom. There is no code evidence that replacing the engine or rewriting the game is warranted.

The references guide colourful environments, readable silhouettes, responsive movement and shared activities. They do not authorize importing the reference game's models, characters, textures, interface, sounds or branding. Create original ChinaLife interiors and use assets with documented redistribution rights.

The main architectural addition proposed is a room-scoped real-time transport. It supplements the current presence system rather than replacing account, city discovery, chat or voice services. Hosting feasibility and a measured prototype are required before selecting or installing the server component.

## What the code actually does today

| Area | Evidence in repository | Consequence for the upgrade |
|---|---|---|
| Renderer and camera | `public/world.js` imports local Three.js and creates an OrthographicCamera; `updateCamera()` sets the isometric view | Keep this camera for the city. Add a separate optional perspective camera for gameplay rooms; never apply perspective settings to the city camera. |
| Movement | `public/movement.js` provides grid paths, entry recovery and activity targets; the world frame loop moves on X/Z at 3.8 units/sec with box obstacle checks | Reuse entry/path logic; introduce continuous input, player-radius clearance, vertical motion, grounded state and swept collision for gameplay. Current bounds checks are not server movement validation. |
| Characters | `public/characters.js` builds procedural low-poly people with clothing compatibility and limb pivot groups | Preserve wardrobe IDs and appearance mapping. Existing avatars can be the first controller test rig and fallback; imported skeletal rigs are a later adapter, not a save migration. |
| Animation | Walking, action poses, NPC sitting/dancing and local emotes live in `public/world.js`; remote walking is inferred from position changes | A pose is not currently a synchronized animation state. Add explicit state, facing, timestamps and interaction IDs. Do not mistake seated NPCs for multiplayer seating. |
| Interiors | Existing builders in `public/world.js`, `public/models.js` and `public/home-interiors.js` cover venue families, furniture and room interactions | Improve selected interiors through a room registry, retaining venue IDs and existing activity routes. A camera behind a character will need interior wall/ceiling occlusion and camera collision. |
| Presence | `public/cloud.js` heartbeats every 2.5 seconds. `chinalife-api/presence.php` stores X/Z, appearance and an activity enum, with finite-coordinate bounds, room access and block filtering | Useful for discovery and legacy clients, but too sparse for responsive synchronized jumping or racing. No vertical position, seat ownership or authoritative jump trajectory is carried today. |
| Remote display | `syncPlayers()` in the world builds peers; the frame loop lerps positions and guesses walking | Add timestamped snapshots and buffered interpolation. Keep these legacy paths available when the gameplay feature is disabled. |
| Shared activities | `public/shared-activities.js` and `chinalife-api/activities.php` already support invitations, readiness, presence checks, choices and timed participation | Reuse consent and reward principles. These are activity sessions, not an existing shared quiz round or checkpoint-race authority. |
| Persistence and security | PHP APIs authenticate Hafrik users, protect save revisions, scopes and rewards; private-home invitations and blocks already exist | Reuse these rules for room access. Browser-supplied score, elapsed time or position must not become trusted reward evidence. |
| Mobile groundwork | Adaptive pixel ratio capped at 1.7, shared geometry/materials, static city merging/caches, native pause hooks and world performance readouts | Preserve these optimizations. Measure actual mobile devices before promising a frame rate or scene capacity. |
| Test coverage | Node/linkedom tests, Three.js world tests, PHP/MySQL integration tests and multi-client harnesses | Extend them with controller, protocol and minigame checks; they do not substitute for two physical-device demonstrations. |

This is a static code audit and automated regression check. Live production load, WebSocket hosting support, device GPU behaviour, latency and the deployed PHP runtime were not measured in this turn.

## Boundaries that must remain intact

- Approved map tag `map-approved-2026-10-10`: existing geometry, building positions, city camera, labels, sky, HUD and map controls remain unchanged. `world.js` receives only narrow gameplay integration hooks when implementation is approved.
- Existing cities, active-city settings, venue IDs, player progress, owned homes, furniture, wardrobe, money, XP and save revisions survive. New room/session tables are additive and migrations repeat safely.
- Politics, voting, Police/Court, services, marketplace, events, city guide, phone, notifications, HQ appointments, chat and voice retain their entry points.
- Private rooms retain owner/guest access and block restrictions. Native app presence is not evidence that a user is inside a gameplay room.
- Legacy clients keep their current presence response. New gameplay capability/version fields are additive; old clients cannot join incompatible competitive sessions.
- No game rewards are granted from a WebView timer or animation callback.

## Proposed modules and contracts

Names below are proposed boundaries, not files already implemented.

| Module | Responsibility |
|---|---|
| `gameplay/controller.js` | Fixed-step movement, run speed, jump/gravity, capsule/box collision, grounded state and intent/state transitions. No DOM, rewards or account management. |
| `gameplay/input.js` | Keyboard and mobile stick/button input; pointer cancellation, modal focus and app-background pause. |
| `gameplay/camera.js` | Isometric/perspective gameplay selection, spring follow, wall collision and occlusion. Uses the existing renderer. |
| `gameplay/avatar.js` | Map controller state to the current procedural rig or a licensed GLB rig; blend walk/run/jump/sit/dance/emotes. |
| `gameplay/rooms.js` | Venue adapters: room ID, version, spawn points, colliders, seats, triggers and existing activity callbacks. |
| `gameplay/transport.js` | Versioned room connection, authenticated membership, sequencing, interpolation, reconnect and legacy fallback. |
| `gameplay/minigames.js` | Common lobby → countdown → active → results → exit flow; quiz and obstacle-course adapters. |
| PHP room/session APIs | Hafrik access checks, short-lived room tickets, durable sessions/results and idempotent reward transactions. |
| Optional real-time server | Room state, leases, simulation, snapshots and trusted result production; no replacement of Hafrik login or PHP save APIs. |

A normalized controller state includes position X/Y/Z, velocity, facing, grounded state, animation state, input sequence and current interaction. Rendering consumes state rather than independently moving the same avatar. Existing timed activity choreography temporarily owns control through a clear adapter, then releases it. Walking, running, airborne, seated and dancing states cannot be active simultaneously; emotes have explicit interruption rules.

Use a lightweight kinematic controller first: static boxes/planes, swept collision, sliding, radius clearance, fixed-step gravity and defined platform tops. Share room collision data between client and authoritative simulation. Defer a full physics dependency until slopes, moving platforms or profiling demonstrate a need. Avoid introducing an engine-wide rigid-body simulation just to support one classroom.

## Camera and mobile controls

- City stays isometric. Gameplay rooms start in isometric mode and offer a persistent optional third-person choice.
- Third-person uses a PerspectiveCamera following the same player, with bounded pitch/distance, obstruction checks and near-wall fade/hide rules. Switching views does not rebuild the room or reset player state.
- Mobile: left stick for movement, contextual interact/sit, jump and an optional run control; right-side drag for camera only in third-person. Respect safe areas and avoid radio/mic, dock, phone and chat controls.
- Keyboard: held movement keys, run modifier, jump and interact. Inputs are ignored while typing, a modal is open or the native game is paused.
- On app backgrounding, neutralize inputs, release timed interactions as appropriate and reconnect from server state. Do not allow a stale jump or movement input to replay after resume.

## Network and authority proposal

First perform a transport spike using two existing Hafrik accounts. Confirm the production server can provide a secure WebSocket reverse proxy, supervised process, connection limits, logs and rollback. Do not silently install a daemon or change production networking as part of frontend work.

Preferred path: a small room service, reusing Hafrik identity through PHP-issued short-lived tickets. Send the ticket in an initial authenticated message, not a token-bearing URL; enforce origin, expiry, room scope, revocation/revalidation and account/session ownership. PHP remains the durable source of truth for saves, access and rewards. Existing PHP presence continues its discovery heartbeat; detailed movement is sent only to authorized room members.

Initial tuning targets, to be measured: local simulation 60 Hz, authoritative simulation 30 Hz, client input up to 20 Hz, server snapshots about 10 Hz, remote interpolation buffer around 100–150 ms. Send changed inputs, bound queues and payload sizes, and cap a pilot classroom at eight real players. These are starting values, not measured capacity or guarantees.

Messages carry protocol/room version, input sequence, server tick, animation state and interaction IDs. The server determines participant identity. It owns seat leases, session clock, quiz answers/scores, checkpoints and results. Clients predict their own movement and reconcile authoritative snapshots; other players interpolate. Reject stale, impossible, wrong-room and repeated commands. Slow receivers receive current bounded snapshots, not an unbounded backlog.

Fallback: retain the existing PHP discovery and gameplay outside pilot rooms. A bounded, dedicated HTTP room-state prototype may prove seating/quiz correctness if WebSockets are unavailable, but the existing 2.5-second city poll is not an acceptable smooth-racing transport. Do not increase city-wide SQL polling to render-frame frequency. Obstacle-course rollout waits for adequate authoritative transport.

Reward bridge: only the trusted server can submit a completed result to PHP using server-only credentials. PHP checks session membership, game/room version, final state and a unique result/reward key within a transaction, then updates existing balances/revisions. Repeated delivery grants no extra reward. Never accept a client-side “finished in 12 seconds” claim as authoritative.

## First milestone: classroom vertical slice

Implement one classroom behind an admin-controlled pilot switch, entered through an existing active university venue. Use a subroom identifier so entering/exiting preserves the city and venue identity. No new city-map building is necessary.

Delivery order:

1. Capture current room/spawn/presence behaviour and add regression fixtures. Establish transport and hosting feasibility before the service choice is finalized.
2. Add the controller and adapter around the current procedural avatar. Implement walking, running, jump/landing, collision, sitting and standing; share a minimal dance/wave state as a synchronization check.
3. Create an original classroom with eight seats, desks, teacher board, clear aisles, colliders, defined spawn/exit points and interaction markers. Occupied seats cannot be claimed by another player. Seat release covers stand-up, leave, disconnect and lease timeout.
4. Add the optional third-person room camera and touch controls without altering the approved city camera.
5. Run a short shared university quiz: lobby/readiness, three server-selected questions, server deadlines, one answer per player/question, shared progress, server scoring and a results panel. Use the existing Chinese learning curriculum where appropriate while keeping existing daily class rewards separate.
6. Reconnect into the current session safely. Rejoining cannot repeat a question reward or restart the shared timer.

Acceptance demonstration:

- Two independently authenticated Hafrik accounts on separate clients enter the same classroom and see the correct real peer; demonstrate an empty room before the second account joins so NPCs cannot masquerade as the second player.
- Both can walk around desks, run, jump/land, sit in separate seats, stand up and see the other player's state. A seat race awards the seat to only one account.
- Both switch isometric/third-person independently, without moving the other player's camera or changing city layout.
- Both complete the three-question activity; the same server session and authoritative result appear on both devices. Any configured reward is credited once, including after reconnect and duplicate submission.
- Leaving the room removes the peer and releases the seat. Test blocked accounts, another city/room, session expiry, native app background/resume and an interrupted network.
- Existing university class, chat, voice, phone and travel still work after exit. No form is periodically rebuilt while a player is typing.

Evidence required: automated two-client tests plus a recorded two-device walkthrough with account/room IDs obscured as needed, real-device frame/latency measurements and reward/reconnect checks. No simulated “online” counter is evidence of multiplayer correctness.

## Second milestone: obstacle-course vertical slice

Build an original, isolated university recreation course reached from an existing venue interaction. Keep the map untouched. Reuse the controller, room transport, camera, lobby and reward bridge from the classroom.

Start with static colourful platforms, safe starting area, jump gaps, three sequential checkpoint regions, a fall/reset zone and finish trigger. Reuse geometry/materials; introduce moving obstacles only after the static course passes physics and mobile performance checks.

Server owns countdown/start/end ticks, player simulation, ordered checkpoint occupancy, respawn position and finish eligibility. Crossing the finish line counts only after all checkpoints and an active authorized run. Collision and checkpoint geometry have an explicit version shared with the client. On lag, authoritative state prevails; queued obsolete input is discarded. A reconnect resumes an active run using server elapsed time, or marks it abandoned according to the documented timeout policy; restarting cannot improve an existing run by resetting its timer.

Acceptance demonstration:

- Two real players join one countdown, see each other running and jumping, activate checkpoints, fall/respawn and reach the finish line.
- Timing uses server ticks; results match on both clients and persist across reload. Rewards and leaderboard insertion occur once.
- Tests reject direct finish calls, skipped/out-of-order checkpoints, teleport/speed changes, forged elapsed time, replayed packets/results, wrong-room submissions and obsolete course versions.
- Show a legitimate complete run, a failed cheating attempt and a disconnect/reconnect. Verify fall recovery and camera obstruction on mobile.

Validation limit: checkpoint ordering and a minimum duration alone do not prove a fair run. Competitive results require authoritative movement/trajectory validation. Client-only collision can remain a responsiveness aid, not the reward authority.

## Avatar and environment art progression

Improve the current rig's proportions, faces, silhouettes and animation timing first. Then trial one original or explicitly licensed low-poly GLB avatar with idle/walk/run/jump/land/sit/dance/emote clips. Preserve skin, outfit colours, clothing ownership and fallback rendering. Bundle GLTFLoader/decoders matching the locally vendored Three.js revision; do not pull mismatched latest loaders at runtime. If skeletal-rig swapping improves results, adopt it gradually behind the avatar adapter.

Record creator/source, license, redistribution rights, attribution, file size, geometry/material counts, texture sizes and rig/clip names for every asset. Benchmark a wardrobe-equipped avatar, not just the naked base model. Reuse geometry and materials where safe; shared objects must not be disposed when one remote avatar leaves. Check current disposal ownership before enabling model sharing across new adapters.

Initial per-avatar targets: roughly 5,000–10,000 triangles, 1–3 materials for the base avatar, small shared texture atlases and simpler distant avatars. Treat these as profiling budgets, not an existing asset specification. Start room textures at 512–1024 pixels and limit live shadow casters. Retain procedural avatars for failures and low-end settings.

Expand interiors after both milestones prove the framework:

| Venue | Functional progression |
|---|---|
| Universities | Classroom/quiz first, then campus social/study areas; retain existing learning and student-story entry points. |
| Nightclubs | Dance floor, synchronized dance/emotes, lounge seats, DJ/music and existing VIP/club activities. |
| Restaurants | Tables with seat ownership, menu/ordering and existing delivery/shared dinner flows. |
| Homes | Existing decor and invitations, private-room controller and guest-safe furniture interactions. |
| Offices/HQ | Workstations, appointment/service interactions and existing careers/studio callbacks. |
| Government | Existing politics and Police/Court routes with meeting/seating spaces; no changes to vote or case authority. |

Each interior uses original ChinaLife visual design with bright, controlled colour, soft lighting, readable props and generous paths. Reference UI, grades, currencies and character designs are not copied. Existing buildings and map composition remain unchanged.

## Performance and compatibility gates

Target at least stable 30 FPS on representative supported mid-range phones, with 60 FPS where measured hardware permits. Before acceptance, measure P95 frame time, draw calls/triangles, texture memory estimate, load size/time, server tick time, RTT, correction frequency, request/message volume and 15-minute thermal behaviour. Set final room population caps from these results rather than from desktop FPS.

Test iOS WKWebView inside Hafrik, Android WebView inside Hafrik, Safari, Chrome Android and desktop. Include portrait/landscape resizing, pinch/camera controls, keyboard focus, reduced-motion settings, low-end quality mode, interrupted connectivity and WebGL context loss/restoration. Pause rendering/input/network work appropriately when the game is hidden or native navigation takes over.

Lazy-load gameplay rooms and avatar assets; retain a usable loading/error exit. Cap particles, skeletal animation updates and shadows. Avoid heavy post-processing for the pilot. Inspect `ChinaLifeWorld.stats()`/`benchmark()` on real devices; synthetic render-loop estimates do not measure interactive thermal performance.

## Rollout and rollback

1. Review this plan; settle the transport/hosting spike and pilot room before architectural implementation.
2. Add separate feature switches for classroom, controller, third-person, upgraded avatars and obstacle course. Restrict first access to admin/test accounts.
3. Add backward-compatible schema/protocol support and migration tests before exposing client features. Deploy database/API support before new assets.
4. Complete milestone-one acceptance and phone/WebView checks, then allow a small pilot cohort.
5. Complete milestone-two authority and mobile gates, then expand venue families individually.
6. Disable the new gameplay flags to restore existing venue behaviour. Preserve new session records and existing player saves; do not restore old map files over unrelated work. Realtime failure must never prevent Hafrik login, phone access or legacy city gameplay.

Production server installation/reverse-proxy configuration needs a separate concrete deployment procedure after hosting capability is established. The current `deploy-php.sh` publishes PHP/static assets and migrates MySQL; it does not install or supervise a real-time room server. A future release must state exactly which server steps are required.

## Implementation size and outstanding decisions

This spans several releases. It is not a visual reskin or a single server pull. Work packages are: transport feasibility; controller/room contracts; classroom interaction and synchronized quiz; mobile acceptance; obstacle-course authority; avatar asset trial; venue-by-venue expansion. Calendar estimates follow the transport/device spike; assigning a reliable completion date now would hide unresolved infrastructure and asset work.

Working defaults: one existing university classroom, eight pilot participants, isometric default, optional third-person, static course first, and no new rewards until existing economy limits are reviewed. Outstanding environment facts: compatible supervised server runtime/WSS proxy, target iOS/Android devices, load/concurrency expectations and available original/licensed avatar art. These do not prevent reviewing the plan; they must be resolved before a production implementation is finalized.

## Documentation consulted

Three.js already provides perspective cameras and an animation system; GLTFLoader is the proposed import path, subject to installed-version compatibility. References: [Three.js documentation](https://threejs.org/docs/), [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

The browser WebSocket API provides duplex communication but requires application-level queue limits/backpressure handling; it does not provide authoritative gameplay validation. Reference: [MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).
