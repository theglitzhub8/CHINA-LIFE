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
- Only City Centre is upgraded. The other Shenyang districts and Guangzhou still use the generic blocks.
- City Centre shows no day/night lighting or weather yet. Shop signs are fixed text in one shared texture.
- Map places, labels and positions still live in code (`city-layout.js`, `catalog.js`, `game.js`). Phase 2 moves them into map data files.
- The camera glide and momentum run in the game's frame loop, so they pause while the page is in the background.
