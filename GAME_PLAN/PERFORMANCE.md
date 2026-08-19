# Performance Workstream

Written after measuring the current build. This runs alongside the gamification phases, not after
them, because the tree catalog is about to grow and two of the findings below get worse linearly
with that growth.

Read this before starting Phase 0. Tasks TP.1 to TP.9 are in TASKS.md section J.

---

## 1. Headline finding

The terrain rebuild is the dominant cost in the build, by a wide margin, and it is a CPU cost on
the main thread that produces a periodic hitch rather than a steady low frame rate.

The maths, all confirmed by reading the code:

- `src/world/terrain.ts` line 394 builds `new THREE.PlaneGeometry(1600, 1600, 128, 128)`.
- Line 396 passes it through `setupFacetedBarycentricGeometry`, which calls `toNonIndexed()`
  to get flat faceted shading.
- Non indexed means 128 x 128 x 2 triangles x 3 vertices = **98,304 vertices**, not the 16,641
  the grid resolution suggests.
- `TerrainSystem.update()` loops over every one of those vertices and calls `terrainHeightJS`
  (multi octave simplex), `getBiomeWeights` (now 8 biomes), a `snoise` call for macro variation,
  and a five way colour blend.
- That loop runs every time the player crosses a 12.5 metre grid line (`gridStride = 12.5`).
  At the 18 m/s cruise speed that is roughly every 0.7 seconds. Under boost at 75 m/s it is
  every 0.17 seconds.

Two compounding problems:

1. The work is enormous: on the order of one to three million noise evaluations per rebuild.
2. Roughly **83 percent of it is redundant**. Because the geometry is non indexed, each interior
   lattice point is duplicated across the six triangles that share it, and the identical world
   position is recomputed six times.

This is very likely the cause of the 18 FPS observation, and it will present as a stutter every
time the player crosses a grid line rather than as uniformly slow rendering.

---

## 2. Second finding: trees do not scale with the catalog

`src/world/trees.ts` today:

- `TREE_CATALOG` has 42 entries. `init()` creates one `InstancedMesh` per entry at
  `MAX_CAPACITY = 800`, so 42 meshes and 33,600 instance slots are allocated up front regardless
  of how many are used. Each mesh carries instanceMatrix, instanceColor, aTrunkColor, aLeafColor,
  aColorMode and aGlowFactor buffers, roughly 76 KB each, so about 3.2 MB of mostly idle buffers.
- `rebuild()` covers `SPAWN_RADIUS = 700` at `treeGridSpacing = 16`, which is about **7,921 cells
  per rebuild**, each calling `getDominantBiome` plus per model RNG and `terrainHeightJS`.
- It runs whenever the player moves `REBUILD_THRESHOLD = 20` metres, and it recomputes **every
  cell in the 1400 metre box** even though moving 20 metres only changes about 3 percent of them.
- On commit it sets `instanceMatrix.needsUpdate = true`, which uploads the **entire 800 slot
  buffer** for every visible mesh, not just the used range.

The parts that grow linearly as the catalog grows: memory, upload volume, and the number of
visible draw calls when several models are active. This is the direct answer to the concern about
adding many more trees.

Mitigating fact already in the code, worth keeping: `entry.treeInst.visible = count > 0`, so
catalog entries with no instances cost nothing to draw.

---

## 3. Third finding: the shadow pass redraws trees that can never cast a visible shadow

- `src/world/lighting.ts` sets the shadow camera to plus or minus 120 metres (lines 120 to 123),
  tightened to 60 to 90 when `shadowTuned` is on.
- Trees spawn out to `SPAWN_RADIUS = 700` metres, and `setupInstMesh` defaults `castShadow` to
  true for every tree mesh.
- An `InstancedMesh` is frustum culled as a single object by its bounding sphere. Because its
  instances span 1400 metres, that sphere always intersects the shadow frustum, so the mesh is
  never culled and **every instance is transformed in the shadow pass**, including the roughly
  95 percent that lie outside the shadow camera entirely.

Splitting near and far tree casters removes almost all of that wasted vertex work.

---

## 4. Fourth finding: pixel count

`src/core/renderer.ts` sets `basePixelRatio = 2.0` and then
`setPixelRatio(Math.min(window.devicePixelRatio, 2.0))`.

On a 2x display that renders four times as many pixels as at ratio 1.0, and the bloom composite
pays that cost again. A cap of 1.5 is visually near indistinguishable at this art style and is
one of the cheapest wins available. The setter `setPixelRatioCap` already exists, so this is a
default value change plus an adaptive rule, not new machinery.

---

## 5. Ranked fix list

Ordered by benefit divided by risk. Do them in this order.

| Rank | Fix | Expected win | Risk | Task |
| --- | --- | --- | --- | --- |
| 1 | Terrain: compute on the 129x129 lattice, scatter to the 98,304 vertices | About 6x less terrain CPU, no visual change | Low | TP.1 |
| 2 | Terrain: amortise the rebuild across frames | Converts one long hitch into several short frames | Low | TP.2 |
| 3 | Pixel ratio cap 1.5 plus an adaptive rule | Up to 40 percent fragment cost on high DPI | Low | TP.3 |
| 4 | Trees: per cell chunk cache | About 30x less tree CPU per rebuild | Medium | TP.4 |
| 5 | Trees: near field shadow casters only | Large cut to shadow pass vertex work | Medium | TP.5 |
| 6 | Instance buffers: partial upload via addUpdateRange | Cuts upload volume, scales with catalog | Low | TP.6 |
| 7 | Bloom at half resolution | Meaningful fragment saving | Low | TP.7 |
| 8 | Trees: BatchedMesh to flatten draw calls | Keeps draw calls flat as the catalog grows | High | TP.8 |
| 9 | Terrain height and colour on the GPU in TSL | Removes the JS loop entirely | High | TP.9 |

TP.1 through TP.7 are safe, mechanical, and together should resolve the current stutter.
TP.8 and TP.9 are the scaling answers and should only be attempted once the game layer is stable.

---

## 6. How this interacts with the WebGPU migration

Two of these fixes belong naturally inside Phase 0 rather than after it:

- **TP.9** is the natural end state once the renderer is node based. Under `WebGPURenderer` the
  terrain height can be evaluated in a vertex node and the biome colour blend in a fragment node,
  which deletes the 98,304 iteration JS loop rather than optimising it. The faceted look is
  preserved with flat normals derived from screen space derivatives instead of `toNonIndexed`,
  which also lets the geometry go back to indexed and cuts vertex count by six times as a side
  effect. This is the single largest available win, and it is also the highest risk item in the
  whole plan because it must reproduce the existing colour blend exactly under the visual
  invariant lock.
- **TP.7** replaces `UnrealBloomPass` resolution tuning with the TSL bloom node resolution
  parameter, so it is cheapest to do while T0.2 is already open in that file.

Everything else in this document is renderer independent and can proceed in parallel with Phase 0
as long as the file ownership rules in TASKS.md are respected.

Sequencing rule: **do not run TP.1 and TP.9 at the same time.** TP.9 supersedes TP.1. If TP.9 is
attempted and succeeds, TP.1 and TP.2 become dead code and must be removed as part of TP.9.

---

## 7. Budget for the tree catalog growth

When the catalog grows, hold these limits:

- Visible tree `InstancedMesh` count at any moment: 12 or fewer without TP.8, unlimited with it.
- Per model instance capacity: right sized to that model maximum density, not a flat 800.
- Total tree instance slots allocated: under 12,000.
- Tree rebuild CPU: under 4 ms, measured at the moment of a rebuild, not averaged.
- Terrain rebuild CPU: under 6 ms before TP.9, under 1 ms after.
- Shadow casting tree instances: 400 or fewer.

A new catalog entry must not require any code change to stay inside these numbers. If it does,
the fix is wrong.

---

## 8. Measurement method

There is no profiler in this project and adding one is out of scope. Use these:

- Rebuild cost: wrap the call site in `performance.now()` and log only when the elapsed time
  exceeds 2 ms, so the log itself does not become the cost.
- Draw calls and triangles: `window.__game.pipeline.renderer.info.render`.
- Frame pacing: record 600 frame deltas into a preallocated array and report the 99th percentile,
  not the mean. The problem here is a periodic hitch, and a mean frame time hides it completely.
- Always measure with the developer editor closed. The 18 FPS observation was taken with it open,
  and that panel is authoring tooling, not the shipping game.

Record every measurement before and after in `GAME_PLAN/PERF_REPORT.md`, which task T6.2 owns.
