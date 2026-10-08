# Shenyang City Centre prototype (map upgrade, Phase 1 + prototype)

Screenshots: phone width (390 px) on the left and tablet/desktop width (960 px) on the right.

| | Before | After |
|---|---|---|
| City map | `before-overview.jpg` | `after-overview.jpg` |
| City Centre close-up | `before-city-centre.jpg` | `after-city-centre.jpg`, `after-city-centre-mid-zoom.jpg` |

## Performance

Measured with `ChinaLifeWorld.benchmark()`, which renders 60 frames, including a full shadow pass each frame (worst case), and waits for the GPU.

| Scene | Frame cost | Draw calls | Triangles | Meshes |
|---|---|---|---|---|
| City Centre, phone viewport (663×1326 px) | 3.3 ms | 286 | 58k | 595 |
| Whole-city overview | 2.6 ms | 512 | 67k | 595 |
| 007 Club interior | 1.8 ms | 314 | 69k | 330 |

These figures are from a MacBook GPU, not a phone. Mid-range phone GPUs are roughly 5–10× slower, so the worst case would be about 17–33 ms (30–60 FPS). On the map, shadows are now redrawn only when the camera moves, so normal frames cost less than the benchmark. Before the merge work, the map had about 3,660 meshes and about 7,200 draw calls per frame.

To measure on a real phone, open ChinaLife and connect Safari or Chrome remote debugging, then run:

```js
ChinaLifeWorld.benchmark()   // frame cost, draw calls, triangles, pixel ratio
ChinaLifeWorld.stats()       // live FPS, meshes, shadow casters
```

## Remaining limitations

- No measurements from a real phone yet; see above for how to take them.
- Shop sign text is fixed in the shared atlas. It is not editable from the admin panel yet.
- Venue landmark models outside City Centre (universities, clubs, malls) still use the earlier designs. They now stand in the upgraded streets.
- The camera glide and momentum run in the game's frame loop, so they pause while the page is in the background.

## Rollout: every neighbourhood, day/night and weather

The prototype style now covers every block in every city.

- Map data lives in `public/map-data.js`: the grid, the twelve neighbourhoods and their styles, base positions, and per-city overrides such as Guangzhou's district names and Shenyang's hotel position.
- `public/city-kit.js` holds the shared building pieces: facades with night windows, roofs, the 48-sign bilingual atlas, street furniture and intersections.
- `public/districts.js` builds each block in its neighbourhood's style. Each city is built once, merged and cached, and reused on every later map visit.
- Outdoors, lighting follows the game clock. Each city has stable daily weather: clear, cloudy, rain, or snow in the northern cities. At night, facade windows light up.

Screenshots: `rollout-shenyang-overview.jpg`, `rollout-shenyang-districts.jpg`, `rollout-guangzhou.jpg` and `night-and-snow.jpg`.

### Performance after the rollout

These figures use the same MacBook as above, but the GPU was running slower during this session. The unchanged 007 Club scene measured 7.2 ms per frame here, against 1.8 ms earlier, so compare each scene to the club rather than to the earlier table.

| Scene (phone viewport) | Frame cost | Compared with the club | Draw calls |
|---|---|---|---|
| Shenyang street view | 11.4 ms | 1.6× | 303 |
| Shenyang whole city | 18.3 ms | 2.5× | 545 |
| Guangzhou street view | 10.4 ms | 1.4× | 315 |
| 007 Club | 7.2 ms | 1.0× | 314 |

Building a city for the first time takes 100–250 ms on desktop, about 0.5–1 s on a phone. After that the city comes from the cache. City Centre's frame cost relative to the club is about the same as before the rollout (1.6× now, 1.8× earlier).
