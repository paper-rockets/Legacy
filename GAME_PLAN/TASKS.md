# Delegation Packet

One brief per agent. Each brief is self contained. Give an agent the preamble in section A plus
exactly one brief from section B onwards. Do not give an agent two briefs at once.

---

## A. Preamble - paste at the top of every agent prompt

```
You are working in the repository at E:\GAME FINAL RUN\LEGACY.
This is a Three.js 0.185.1 + Vite + TypeScript flight game. Read GAME_PLAN/README.md and
GAME_PLAN/CONTRACTS.md before writing any code.

PROJECT RULES, inherited from RULES.md. These override any instinct you have:

1. Pinpoint edits only. Modify only the lines the task names. Never regenerate or reformat a
   whole file, a whole function, or a whole section that you were not asked to change.
2. Visual invariant lock. Lighting values, sun horizon offsets, track arrays, colour constants
   and material settings are protected. Do not tune, improve, or "fix" them.
3. Never add icons, emojis, unicode symbols, or decorative glyphs. Not in code, not in UI text,
   not in comments, not in your report. Plain text only.
4. Do not refactor, rename, reorganise, or optimise anything outside your task scope.
5. Do not add npm dependencies. Do not change package.json, vite.config.ts, or tsconfig.json
   unless your task explicitly says so.
6. Do not touch src/ui/devEditor.ts. It is 2234 lines of authoring tooling and is out of scope
   for every task in this plan unless named explicitly.
7. The player is an 8 year old child. No fail states, no death, no timers, no penalties, no
   scary or aggressive language in any user facing string.

WORKFLOW FOR EVERY TASK:
- Read the files listed under "Read first" before editing.
- Make the change.
- Run: npm run lint    (this is tsc --noEmit and must be clean)
- Run the verification listed in the task.
- Report: what you changed, the verification output, and anything you could not do.
- If the task conflicts with a frozen contract in GAME_PLAN/CONTRACTS.md, STOP and report.
  Do not change a contract to make your task easier.

NEVER edit any file under a "Forbidden" list in your task.
```

---

## B. Phase 0 - WebGPU foundation

Phase 0 changes how the existing game renders. Nothing new is added. The success condition for
the whole phase is that the game looks the same and still runs.

---

### T0.0 - Capture the visual baseline

Depends on: nothing. Must run before any other Phase 0 task.

Read first: `package.json`, `src/world/noise.ts` (BIOME_LOCATIONS), `src/ui/ui.ts` (time phase
buttons).

Create: `GAME_PLAN/tools/capture_baseline.mjs`, output PNGs in `GAME_PLAN/baseline/`.

Modify: nothing.

Forbidden: everything under `src/`.

Do:
Write a Node script using the already installed `puppeteer-core` that starts nothing itself but
attaches to `http://localhost:8080` (the developer runs `npm run dev` first). For each of the 7
entries in `BIOME_LOCATIONS`, teleport via `window.__game.player.teleportTo(x, z, 50, y)`, then
for each of the 3 time phases set through `window.__game.lighting`, wait 1500 ms for material
and terrain settling, and screenshot at 1280x720 into
`GAME_PLAN/baseline/<biomeId>_<phase>.png`. 21 files total.

Accept when: 21 PNGs exist, each is a rendered frame and not a blank canvas, and the script
prints the list of files it wrote.

Verify: `node GAME_PLAN/tools/capture_baseline.mjs` with the dev server running.

---

### T0.1 - Swap RenderPipeline to WebGPURenderer

Depends on: T0.0.

Read first: `src/core/renderer.ts`, `src/main.ts`, `E:\GAME FINAL RUN\WEBGPU\src\core\Engine.js`
(working reference for the same Three version).

Modify: `src/core/renderer.ts` only.

Forbidden: `src/main.ts`, `src/ui/ui.ts`, `src/ui/devEditor.ts`, everything under `src/world/`.

Do:
Replace `THREE.WebGLRenderer` with `WebGPURenderer` imported from `three/webgpu`. Keep the same
constructor options where they still apply (`antialias`, `powerPreference`). Move renderer
creation so that `await this.renderer.init()` happens inside the existing `public async init()`
method, which `main.ts` already awaits. Leave `EffectComposer` and `UnrealBloomPass` in place for
this task only if they still function; if they do not, temporarily render without bloom and note
it in your report, because T0.2 replaces them immediately after.

The public API of `RenderPipeline` must not change by one character:
`applyBiomeBloom`, `setBloomStrength`, `setBloomRadius`, `setBloomThreshold`, `setPixelRatioCap`,
`handleResize`, `render`, and the public fields `renderer`, `camera`, `scene`, `container`,
`basePixelRatio`. `src/ui/ui.ts` and `src/ui/devEditor.ts` call into these and must keep compiling
untouched.

Keep `toneMapping = THREE.ACESFilmicToneMapping` and `toneMappingExposure = 1.1`.
Keep `shadowMap.enabled = true` and the PCF soft shadow setting.

Accept when: the game loads with no console errors, the terrain and trees render, and
`window.__game.pipeline.renderer.isWebGPURenderer` is true. On a machine without WebGPU the
automatic WebGL2 backend fallback must also load without errors.

Verify: load `http://localhost:8080`, then in the console:
`window.__game.pipeline.renderer.isWebGPURenderer`
`window.__game.pipeline.renderer.backend.isWebGPUBackend`

---

### T0.2 - Replace UnrealBloomPass with the TSL bloom node

Depends on: T0.1.

Read first: `src/core/renderer.ts`, `node_modules/three/examples/jsm/tsl/display/BloomNode.js`,
`E:\GAME FINAL RUN\WEBGPU\src\core\PostProcessing.js`.

Modify: `src/core/renderer.ts` only.

Forbidden: `src/ui/ui.ts`, `src/ui/devEditor.ts`, everything under `src/world/`.

Do:
Remove `EffectComposer`, `RenderPass` and `UnrealBloomPass`. Use `PostProcessing` from
`three/webgpu` with `pass(scene, camera)` and `bloom(...)` from
`three/addons/tsl/display/BloomNode.js`.

The four bloom setters must keep working by writing into the bloom node uniform values rather
than plain numbers. Preserve the existing clamps exactly: strength 0 to 3.0, radius 0 to 2.0,
threshold 0 to 1.0. Preserve the existing behaviour in `render()` where a strength at or below
0.001 skips the bloom composite and renders the scene directly, because this is a real
performance path on low end machines.

`applyBiomeBloom` must keep its lerp branch and its exact lerp factor semantics.

Accept when: bloom is visible on glowing trees at twilight, the developer editor bloom sliders
still move it, and the biome to biome bloom transition still interpolates.

Verify: compare `GAME_PLAN/baseline/*_2.png` (twilight frames) against fresh captures. Bloom
extent and brightness must match to the eye. Then in the console:
`window.__game.pipeline.setBloomStrength(2.0)` and confirm the change is visible.

---

### T0.3 - Port the tree material hook to TSL

Depends on: T0.1.

Read first: `src/world/trees.ts` lines 780 to 910, `GAME_PLAN/CONTRACTS.md` section 6.

Modify: `src/world/trees.ts`, only the `this.treeMat` construction and its `onBeforeCompile`.

Forbidden: everything else in `src/world/trees.ts` below the material setup, all other files.

Do:
Replace the `MeshToonMaterial` plus `onBeforeCompile` block with a `MeshToonNodeMaterial` from
`three/webgpu`. The hook currently does two things and both must be preserved exactly:

1. Reads five custom vertex attributes: `aPartType`, `aOriginalColor`, `aTrunkColor`,
   `aLeafColor`, `aColorMode`, and uses them to choose between original, trunk and leaf colours
   per vertex. Port with `attribute('aPartType', 'float')` and friends from `three/tsl`.
2. Adds emissive radiance driven by the `uBioluminescence` and `uTimePhaseGlow` uniforms.
   Port to `material.emissiveNode`, keeping the same multipliers.

Keep the existing uniform objects `this.bioluminescenceUniform`, `this.timePhaseGlowUniform` and
`this.leafColorUniform` as the source of truth so that every existing setter in this file and in
`devEditor.ts` keeps working. Wrap them with TSL `uniform()` nodes that read from the same
`.value`, or update both. Do not rename them.

Keep `gradientMap`, `alphaTest: 0.25`, `side: THREE.DoubleSide`, `shadowSide: THREE.DoubleSide`,
`dithering: true`, `depthWrite: true`, `transparent: false`.

Accept when: trees render with correct per part colours, the bioluminescence slider in the
settings menu still changes glow, and glow still rises from day to twilight.

Verify: capture `meadow_0`, `meadow_2`, `candyland_0` and compare with the baseline. Then:
`window.__game.trees.setBioluminescence(0)` and `window.__game.trees.setBioluminescence(100)`.

---

### T0.4 - Port the bush material hook to TSL

Depends on: T0.1. Can run in parallel with T0.3 only if the two agents do not both edit
`src/world/trees.ts` at the same time. Prefer running it directly after T0.3.

Read first: `src/world/trees.ts` around line 909.

Modify: `src/world/trees.ts`, only the `this.bushMat` construction and its `onBeforeCompile`.

Forbidden: the `treeMat` block, all other files.

Do:
Same treatment as T0.3 but simpler. The hook adds emissive radiance from instance colour,
normalised by its own maximum channel, times `uBioluminescence * uTimePhaseGlow * 1.8`, with a
fallback to diffuse colour when instance colour is absent. Port to `emissiveNode` using
`instanceColor` from `three/tsl`. Keep the 1.8 multiplier exactly.

Accept when: bushes glow at twilight at the same intensity as the baseline.

Verify: compare `meadow_2` and `estuary_2` against the baseline.

---

### T0.5 - Port the cloud material hook in PropsSystem

Depends on: T0.1.

Read first: `src/world/props.ts` lines 30 to 70.

Modify: `src/world/props.ts`, only the `matCloud` construction and its `onBeforeCompile`.

Forbidden: everything else.

Do:
Replace with `MeshToonNodeMaterial`. The hook adds `emiCol * (uCloudBloom * 2.0)` where `emiCol`
is the instance colour when instancing colour is present and the `uCloudEmissive` uniform
otherwise. Port to `emissiveNode`. Keep the 2.0 multiplier. Keep `this.cloudBloomUniform` and
`this.cloudEmissiveUniform` as the same objects so `applyBiomeCloud`, `setCloudBloom`,
`setCloudColor` and `setCloudEmissive` keep working unchanged.

Accept when: clouds look identical across all three time phases and the developer editor cloud
bloom slider still works.

Verify: compare `archipelago_0` and `archipelago_2` against the baseline.

---

### T0.6 - Port the cloud and layer fog materials in SkyCastleSystem

Depends on: T0.1.

Read first: `src/world/skyCastles.ts` material setup and `initDenseLayerFog`.

Modify: `src/world/skyCastles.ts`, only `matCloud`, `matLayerFog` and the `onBeforeCompile` block.

Forbidden: `resolveCollisions`, `getUpdraftLift`, `update`, the island definitions, everything
else in the file, all other files.

Do:
Same emissive port as T0.5. Preserve `this.cloudBloomUniform` and `this.cloudEmissiveUniform`
identity so that `applyBiomeCloud`, `setCloudBloom`, `setCloudColor`, `setCloudEmissive`,
`setLayerFogColor`, `setLayerFogEmissive` and `setLayerFogBloom` all keep working.
`matSilhouette` is a `MeshBasicMaterial` used for the far LOD proxy; swap it to
`MeshBasicNodeMaterial` with the same colour and settings.

Note for the agent: `registerClonedMaterial` clones castle GLB materials at runtime. Under
WebGPU those clones must also be node materials. If loaded GLB materials do not render, convert
them in `registerClonedMaterial` and report exactly what you changed.

Accept when: the sky castles, their cloud skirts and the fog deck render identically, and the
castle colour presets still apply.

Verify: teleport to the citadel and compare against `sky_citadel_0` and `sky_citadel_2`:
`window.__game.player.teleportTo(0, -100, 50, 510)`

---

### T0.7 - Port the terrain toon material and the shoreline hook

Depends on: T0.1. This is the highest risk task in Phase 0. Assign to your strongest agent.

Read first: `src/world/terrain.ts` lines 100 to 200, and the vertex colour writing loop in
`update()` starting near line 535.

Modify: `src/world/terrain.ts`, only the `toonMat` and `standardMat` construction and the
`onBeforeCompile` block attached to them.

Forbidden: the `update()` method, the height and colour maths, `reloadColorsFromConfig`,
`setBiomeTerrainColors`, and every colour constant in the file. All other files.

Do:
Swap `MeshToonMaterial` to `MeshToonNodeMaterial` and `MeshStandardMaterial` to
`MeshStandardNodeMaterial`. The hook computes a world space Y varying and uses it with
`uShoreBloom`, `uShoreColor`, `uShoreWaterY` and `uShoreWidth` to add a glowing band near the
waterline. Port using `positionWorld.y` from `three/tsl` in `emissiveNode`. Keep all four
uniform objects by identity so `setShoreBloom` keeps working.

Vertex colours are written per frame into a `color` buffer attribute. Under node materials
confirm `vertexColors: true` still feeds `colorNode`; if it does not, wire
`attribute('color', 'vec3')` explicitly.

Accept when: terrain colour banding, the shoreline glow band, and the day to twilight response
all match the baseline in every biome.

Verify: compare all 7 biomes at phase 0 and phase 2 against the baseline. Then:
`window.__game.terrain.setShoreBloom(0)` and `window.__game.terrain.setShoreBloom(2)`.

---

### T0.8 - Port or gate the crystal terrain style

Depends on: T0.7.

Read first: `src/world/terrain.ts` `crystalMat`, `crystalParams`, `crystalUniforms`,
`syncCrystalUniforms`, `setTerrainStyle`, `setCrystalParams`.

Modify: `src/world/terrain.ts` crystal material only.

Forbidden: everything else.

Do:
The crystal style is a raw `ShaderMaterial` with a custom GLSL pair. Port it to a node material
if you can do so with confidence. If you cannot, take the fallback path instead: keep
`setTerrainStyle('crystal')` callable but make it fall back to the toon material, log one
console warning, and leave every `crystalParams` and `crystalUniforms` field in place so the
developer editor keeps compiling and keeps its controls. Do not delete anything.

State clearly in your report which path you took.

Accept when: `setTerrainStyle` accepts all three values without throwing, the toon and standard
styles are unaffected, and the developer editor crystal controls still exist.

Verify: `window.__game.terrain.setTerrainStyle('crystal')` then `('toon')` then `('standard')`.

---

### T0.9 - Phase 0 parity gate

Depends on: T0.1 through T0.8.

Read first: `GAME_PLAN/tools/capture_baseline.mjs`.

Create: `GAME_PLAN/tools/compare_parity.mjs`, output in `GAME_PLAN/parity/`.

Modify: nothing under `src/`.

Forbidden: all of `src/`. If you find a regression, report it. Do not fix it yourself.

Do:
Re run the capture against the migrated build into `GAME_PLAN/parity/`, then compare each pair
of PNGs pixel by pixel and print, per frame, the percentage of pixels differing by more than 8
in any channel. Write a plain text table to `GAME_PLAN/parity/REPORT.txt`.

Accept when: every frame is under 2 percent differing pixels, or every frame above that
threshold is listed in the report with a one line description of what differs.

Verify: `node GAME_PLAN/tools/compare_parity.mjs`

---

## C. Phase 1 - Game core scaffolding

---

### T1.1 - Write the frozen contracts

Depends on: nothing, but do not merge before Phase 0 completes.

Read first: `GAME_PLAN/CONTRACTS.md` in full, `src/world/noise.ts` for `BiomeId`.

Create: `src/game/types.ts`.

Modify: nothing.

Forbidden: everything else.

Do:
Create `src/game/types.ts` with exactly the content given in CONTRACTS.md section 1. Do not add
fields. Do not remove fields. Do not reorder. Do not add helper functions.

Accept when: `npm run lint` is clean and the file matches the contract exactly.

Verify: `npm run lint`

---

### T1.2 - GameState and the save store

Depends on: T1.1.

Read first: `GAME_PLAN/CONTRACTS.md` sections 1 and 2.

Create: `src/game/GameState.ts`, `src/game/save/SaveStore.ts`.

Modify: nothing.

Forbidden: everything else.

Do:
Implement the public surface in CONTRACTS.md section 2 exactly. `SaveStore` owns localStorage
under the key `wanderlust.save.v1` and implements the four non negotiable save behaviours listed
in that section. The combo window is 3.0 seconds and the multiplier steps 1, 2, 3, 4, 5.
`meterMax` is `100 * meterTier`, and `meterTier` starts at 1 and increases by 1 per claimed
castle.

The event emitter is a plain `Map<string, Set<Function>>`. No dependency, no class hierarchy.

Accept when: state round trips through a page reload, and a deliberately corrupted save loads a
fresh default without throwing.

Verify: in the console after wiring, or in a scratch page:
```
localStorage.setItem('wanderlust.save.v1', 'not json'); location.reload();
```
The game must load normally and `localStorage.getItem('wanderlust.save.v1.broken')` must exist.

---

### T1.3 - GameDirector and the main.ts hook

Depends on: T1.2.

Read first: `src/main.ts` in full, `GAME_PLAN/CONTRACTS.md` sections 3 and 5.

Create: `src/game/GameDirector.ts`.

Modify: `src/main.ts`, exactly three inserted lines as written in README.md section 3.3.

Forbidden: any other change to `src/main.ts`. Every other file.

Do:
Implement the surface in CONTRACTS.md section 3. For this task the subsystem list is empty; the
director builds the `GameContext`, ticks the combo, holds `objective`, and implements
`applyLift` and `applyDrag`. Later tasks add subsystems to the fixed construction order.

`applyLift` adds to `player.playerGrp.position.y`, mirroring the existing updraft code in
`main.ts`. `applyDrag` scales `player.velocity`. Neither may be called more than once per frame
per subsystem; the director accumulates and applies once at the end of `update()`.

Expose the director on the existing debug object by adding it to the object literal already
assigned to `window.__game` in `main.ts`. That counts as part of your three lines only if you can
do it without reformatting; otherwise assign it on the next line and report the extra line.

Accept when: the game runs unchanged, `window.__game.director` exists, and setting
`window.__game.director.enabled = false` makes `update()` return immediately.

Verify: `window.__game.director.state.data.schema` returns 1.

---

### T1.4 - Game audio layer

Depends on: T1.1.

Read first: `src/audio/audio.ts` in full.

Create: `src/game/audio/GameAudio.ts`.

Modify: `src/audio/audio.ts`, adding exactly one public getter that returns the existing private
`audioCtx`. Add nothing else to that file.

Forbidden: the `tracks` array and every frequency value in it. The music scheduler. All other
files.

Do:
Implement short procedural sound effects on the existing `AudioContext`. No audio files.
Required sounds, all soft and warm, nothing harsh:

- `dust(combo)` - a short bell, pitch rising one step per combo level
- `comboBreak()` - a gentle downward two note figure, never harsh
- `ringPassed(index, total)` - an ascending arpeggio note, one step per ring
- `chainComplete()` - a bright four note flourish
- `bridgeOpen()` - a slow rising pad swell
- `castleWoken()` - the largest sound in the game, a warm major chord with a long tail
- `softBounce()` - a muted low thud, clearly not a failure sound

Every sound must respect the existing music gain and must not play if the AudioContext has not
been unlocked by user interaction yet. Cap concurrent effect voices at 8.

Accept when: each method can be called from the console and produces sound after the first
click, and calling `dust` 60 times in one second does not distort or crash.

Verify: `window.__game.director.audio.dust(1)` after clicking the page.

---

### T1.5 - HUD shell

Depends on: T1.2.

Read first: `index.html` around `#top-bar` and `#touch-controls` for the existing visual
language, `src/ui/ui.ts` photo mode section.

Create: `src/game/ui/GameHUD.ts`.

Modify: `index.html`, appending exactly the markup block in CONTRACTS.md section 7 plus one CSS
block. Do not modify any existing element or rule.

Forbidden: `src/ui/ui.ts`, `src/ui/devEditor.ts`, every other file.

Do:
Implement the HUD. It subscribes to `dust`, `combo`, `objective`, `featherEarned`,
`castleWoken` and `sovereign`, and updates DOM text and one meter fill width. Update at most
once per frame and only when a value actually changed; never write to the DOM every frame with
the same value.

Styling for the target player: numerals at 18 px or larger, high contrast, translucent dark pill
matching `#top-bar`. No icons, no emoji, no decorative glyphs. Crown tally is plain text such as
`Castles 3 of 9`.

The HUD hides when `#photo-mode-ui` is visible and when the developer editor panel is open.

Accept when: the HUD appears on load, shows zero dust, and hides in photo mode.

Verify: load the page, open photo mode from the settings menu, confirm the HUD disappears and
reappears on exit.

---

### T1.6 - Biome gameplay registry

Depends on: T1.1.

Read first: `GAME_PLAN/CONTRACTS.md` section 4, `src/world/noise.ts` `BIOME_LOCATIONS`.

Create: `src/game/BiomeGameplay.ts`.

Modify: nothing.

Forbidden: `src/world/noise.ts`, everything else.

Do:
Create the file with exactly the content in CONTRACTS.md section 4. Then add one exported
function `assertBiomeCoverage(): string[]` that returns the ids in `BIOME_LOCATIONS` with no
entry in `BIOME_GAMEPLAY`. It returns a list, it does not throw, because a missing entry is
legal and only means the default tuning applies.

Accept when: `npm run lint` is clean and `assertBiomeCoverage()` returns an empty array today.

Verify: `npm run lint`

---

## D. Phase 2 - Star dust

---

### T2.1 - Deterministic dust placement

Depends on: T1.3, T1.6.

Read first: `src/world/noise.ts` (`snoise`, `terrainHeightJS`), `src/world/terrain.ts` `update()`
for the sliding grid pattern to imitate.

Create: `src/game/dust/DustField.ts` (placement half only).

Modify: nothing.

Forbidden: `src/world/noise.ts`, `src/world/terrain.ts`, everything else.

Do:
Divide the world into 200 metre cells. For the 5 by 5 cell block around the player, hash the
integer cell coordinates to a deterministic pseudo random value and place
`getBiomeGameplay(biome).dustPerCell` motes per cell at hashed offsets inside the cell.
Mote Y is `terrainHeightJS(x, z) + dustAltitude`, except when `followsWater` is true, in which
case it is a fixed low altitude above water level.

Recompute only when the player crosses a cell boundary, exactly like `TerrainSystem.update`
does with its grid stride. Never recompute every frame.

Collected motes are remembered in a `Set<string>` of `cellX:cellZ:slot` keys. A cell is forgotten
and its motes become available again only when the player is more than 1200 metres away, so the
player never watches a mote respawn in front of them.

Cap live motes at 128. If the maths would exceed the cap, drop the furthest.

Accept when: standing still produces a stable set of positions, flying a loop and returning
produces the identical set, and the recompute does not run on frames where the cell did not
change.

Verify: `window.__game.director.dust.debugCount()` returns a stable number while hovering.

---

### T2.2 - Dust rendering

Depends on: T2.1, T0.2.

Read first: `GAME_PLAN/CONTRACTS.md` section 6.

Create: rendering half of `src/game/dust/DustField.ts`.

Modify: nothing.

Forbidden: everything outside `src/game/`.

Do:
One `InstancedMesh` of capacity 128 using an `IcosahedronGeometry(1.6, 0)` and a
`MeshBasicNodeMaterial` following the reference pattern in CONTRACTS.md section 6. Colour comes
from the biome accent colour and cross fades over 0.5 seconds when the biome changes.

Motes bob gently and pulse. Unused instances get a zero scale matrix, not a visibility toggle.
`frustumCulled = false`. No shadows. `depthWrite = false`.

Emissive value must sit above 1.0 so the existing bloom picks it up. Do not add a second bloom.

Accept when: exactly one extra draw call appears, motes are visible from 400 metres, and they
read clearly against bright terrain in day phase and against dark terrain in twilight.

Verify: `window.__game.pipeline.renderer.info.render.drawCalls` before and after enabling the
subsystem differs by 1.

---

### T2.3 - Collection, combo and meter

Depends on: T2.2, T1.2, T1.4.

Read first: `src/game/GameState.ts`, `src/game/types.ts`.

Create: collection half of `src/game/dust/DustField.ts`.

Modify: nothing.

Forbidden: `src/player/player.ts`, everything outside `src/game/`.

Do:
Each frame, test the player against live motes with a swept segment test from
`ctx.prevPlayerPos` to `ctx.playerPos` against a sphere of radius 10 metres. A plain distance
test is not enough, because boost speed is 75 metres per second and at 60 frames per second the
player moves 1.25 metres per frame, but at low frame rates on a tablet the step is much larger
and the player would fly through motes without collecting them. This matters for the target
player, so the swept test is required, not optional.

On collection: call `state.addDust(1, pos)`, play `audio.dust(combo)`, fire a sparkle burst,
shrink the instance to zero over 0.25 seconds.

Combo: collecting within 3.0 seconds of the previous collection steps the multiplier up to 5.
Expiry is silent and gentle; play `comboBreak` only above a multiplier of 2, and never show
failure language.

Accept when: flying through a mote at full boost always collects it, the meter fills, and the
combo reaches 5 on a dense line of motes.

Verify: `window.__game.director.state.data.dust` increases; set
`window.__game.player.velocity = 75` and confirm no mote is missed.

---

### T2.4 - Sparkle burst pool

Depends on: T0.2. Can run in parallel with T2.1.

Read first: `GAME_PLAN/CONTRACTS.md` sections 5 and 6.

Create: `src/game/fx/SparkleBurst.ts`.

Modify: nothing.

Forbidden: everything outside `src/game/`.

Do:
One `InstancedMesh` of 48 small particles shared by every effect in the game. `burst(pos, color,
count)` claims the oldest free instances, gives them outward velocities and a 0.6 second life,
and returns immediately. No allocation per burst; reuse preallocated vectors.

Accept when: 20 bursts in one second do not allocate and do not drop frames, and the pool
recycles rather than growing.

Verify: call `burst` 20 times in a loop from the console and watch the frame time.

---

### T2.5 - Guide trail and objective wiring

Depends on: T2.3, T1.5.

Read first: `src/game/types.ts` `Objective`.

Create: `src/game/fx/GuideTrail.ts`.

Modify: `src/game/GameDirector.ts`, only the objective selection method.

Forbidden: everything else.

Do:
The guide trail is one `InstancedMesh` of 24 small motes spaced along the line from the player to
the current objective target, fading with distance. It points at the nearest uncollected mote
when the objective is `collect_dust`.

The director picks the objective each frame with this precedence, and no other logic:
castle trial in progress, then bridge ride in progress, then bridge available, then ring chain in
progress, then ring chain available, then collect dust.

Objective text for the target player, exact strings, no icons:
```
collect_dust  "Fly through the sparkles"
start_rings   "Fly through the big ring"
next_ring     "Follow the rainbow rings"
open_bridge   "Your rainbow bridge is ready"
ride_bridge   "Fly up the rainbow"
wake_castle   "Wake the castle"
free_flight   "Fly anywhere you like"
```

Accept when: the trail always points somewhere sensible, and the objective line changes as the
player progresses.

Verify: watch the HUD line change when flying into a ring chain.

---

## E. Phase 3 - Rainbow rings

---

### T3.1 - Ring chain generation

Depends on: T1.6, T2.1.

Read first: `src/world/noise.ts` `BIOME_LOCATIONS`, `src/game/BiomeGameplay.ts`.

Create: `src/game/rings/RingCourse.ts` (generation half).

Modify: nothing.

Forbidden: `src/world/noise.ts`, everything outside `src/game/`.

Do:
For the current biome, generate `ringCount` rings evenly spaced around a circle of radius
`ringSpread` centred on the biome centre from `BIOME_LOCATIONS`, with a deterministic wobble so
the chain is not a perfect circle. Each ring sits at `terrainHeightJS(x, z) + ringAltitude`,
or just above water level when `followsWater` is true. Each ring faces along the path direction
so the player flies through it, not past it.

A `ringCount` of 0 means the biome has no chain. Handle that without branching elsewhere.

Regenerate only on biome change, never per frame.

Accept when: every biome in `BIOME_LOCATIONS` produces a flyable chain whose rings clear the
terrain, verified by sampling terrain height under each ring.

Verify: `window.__game.director.rings.debugValidate()` returns an empty list of problems for
every biome.

---

### T3.2 - Ring rendering

Depends on: T3.1, T0.2.

Read first: `GAME_PLAN/CONTRACTS.md` section 6.

Create: rendering half of `src/game/rings/RingCourse.ts`.

Modify: nothing.

Forbidden: everything outside `src/game/`.

Do:
One `InstancedMesh` with a `TorusGeometry` of the configured radius and a thin tube. The next
ring in the sequence is bright and pulsing; already passed rings are dim; not yet reached rings
are mid. Colour is the biome accent shifted through a rainbow across the chain index, because
the mechanic is named for it and the target player will look for it.

Accept when: exactly one extra draw call, the next ring is obvious from 300 metres, and the
chain is readable in all three time phases.

Verify: draw call delta of 1.

---

### T3.3 - Pass through detection and the feather award

Depends on: T3.2, T1.2, T1.4.

Read first: `src/game/GameState.ts`.

Create: detection half of `src/game/rings/RingCourse.ts`.

Modify: nothing.

Forbidden: `src/player/player.ts`, everything outside `src/game/`.

Do:
Test only the next ring and the one after it, never the whole chain. A pass is the segment from
`prevPlayerPos` to `playerPos` crossing the ring plane inside the ring radius. Use a generous
radius, the full `ringRadius`, because precision flying is not the point.

Passing out of order is not a failure. If the player passes ring 5 while ring 3 is next, accept
it and advance to 6. Never reset the chain, never show an error, never make the child feel they
did it wrong.

Completing the chain grants the feather via `state.grantFeather(biomeId)`, awards a dust bonus of
25, plays `chainComplete`, and emits `featherEarned`. The chain then resets so it can be replayed
for dust, but the feather is granted once.

Accept when: a full chain grants a feather that survives a reload, and out of order passes
advance rather than block.

Verify: `window.__game.director.state.hasFeather('meadow')` is true after completing the chain,
and still true after `location.reload()`.

---

### T3.4 - Ring chain onboarding

Depends on: T3.3, T2.5. Can run in parallel with T3.1.

Read first: `src/game/fx/GuideTrail.ts`, `src/game/ui/GameHUD.ts`.

Create: nothing.

Modify: `src/game/GameDirector.ts` objective selection, `src/game/ui/GameHUD.ts` text only.

Forbidden: everything else.

Do:
The first ring of an unstarted chain becomes the guide target once the player has collected 10
dust in the current biome, so a new player meets dust first and rings second. Before that
threshold the chain renders but is not pointed at.

Accept when: a fresh save points at dust, and after 10 dust it points at ring one.

Verify: `window.__game.director.state.reset(); location.reload();` then fly.

---

## F. Phase 4 - Cloud castles

---

### T4.1 - Cloud deck soft ceiling

Depends on: T1.3.

Read first: `src/world/skyCastles.ts` `layerFogAltitude`, `layerFogEnabled`, `setLayerFogAltitude`.

Create: `src/game/castles/CloudDeck.ts`.

Modify: nothing outside `src/game/`.

Forbidden: `src/world/skyCastles.ts`, `src/player/player.ts`, everything else.

Do:
Read the deck altitude from `skyCastles.layerFogAltitude`. When the player climbs into the band
from 20 metres below the deck to the deck itself, and the player has not opened a bridge for the
current biome, call `director.applyDrag` with a factor that eases the climb to a stop and let
the existing flight model carry them back down. Never teleport the player. Never take control
away. The feeling is thick cloud, not a wall.

When the player has opened the bridge for the current biome, the deck does nothing.

Accept when: a new player cannot accidentally reach 300 metres by holding climb, and a player
with a bridge open passes through with no resistance.

Verify: hold climb from ground level on a fresh save and confirm the altitude plateaus near the
deck; then `window.__game.director.state.openBridge('meadow')` and climb again.

---

### T4.2 - Rainbow bridge

Depends on: T4.1, T2.3, T3.3.

Read first: `src/world/skyCastles.ts` `getUpdraftLift` for the lift pattern to imitate.

Create: `src/game/castles/RainbowBridge.ts`.

Modify: nothing outside `src/game/`.

Forbidden: `src/world/skyCastles.ts`, `src/player/player.ts`, everything else.

Do:
When the meter is full and the player holds a feather for the current biome, the bridge opens at
the biome centre. It is one wide cylinder with a scrolling rainbow gradient, tall enough to reach
from ground level to 320 metres. Inside its radius the bridge calls `director.applyLift` strongly
enough to carry the player up through the deck without any input, because holding a climb for 30
seconds is not fun for the target player.

Opening the bridge calls `state.openBridge(biomeId)`, plays `bridgeOpen`, and emits
`bridgeOpened`. The bridge stays open for that biome forever after.

Accept when: flying into the column lifts the player above 320 metres, and the biome reported by
`getDominantBiome` becomes `sky_citadel` on arrival.

Verify: `window.__game.player.currentBiome` becomes `sky_citadel`.

---

### T4.3 - Crown trials

Depends on: T4.2, T3.2.

Read first: `src/world/skyCastles.ts` `getIslands`, `resolveCollisions`, the island definitions.

Create: `src/game/castles/CrownTrials.ts`.

Modify: nothing outside `src/game/`.

Forbidden: `src/world/skyCastles.ts`, everything else.

Do:
Enumerate castles at runtime from `skyCastles.getIslands()`. Never hard code the nine ids, so a
tenth castle added in the developer editor gets a trial for free.

For the nearest unclaimed castle within 400 metres, place 3 crown rings orbiting the spire at
descending radii and ascending heights derived from the island `y` and `scale`, matching the
collider geometry already described in `resolveCollisions`. Reuse the ring geometry and pass
through test from Phase 3; one extra `InstancedMesh` of capacity 3.

Fly all 3 in order to wake the castle. Order matters here, unlike the ring chain, because this is
the one place a small challenge is welcome, but there is still no failure: bumping the castle
resets the sequence with `softBounce` and a friendly HUD line, and the player retries at once.
Detect the bump from the boolean already returned by `skyCastles.resolveCollisions`, which
`main.ts` calls through `player.update`. Read it, do not call it again.

Waking calls `state.claimCastle(id)`, plays `castleWoken`, fires a large sparkle burst, and emits
`castleWoken`.

Accept when: a castle can be woken, the claim survives a reload, and bumping resets without any
punishment.

Verify: `window.__game.director.state.isCastleClaimed('sky_castle_high_0')` after the trial and
again after `location.reload()`.

---

### T4.4 - Claim effects on the castle itself

Depends on: T4.3.

Read first: `src/world/skyCastles.ts` `setIslandColors`, `applyCustomColorsToIsland`,
`CASTLE_COLOR_PRESETS`, and `src/world/lighting.ts` `timePhase`.

Create: nothing.

Modify: `src/game/castles/CrownTrials.ts` only.

Forbidden: `src/world/skyCastles.ts`, `src/world/lighting.ts`, everything else.

Do:
On claim, and on every load for already claimed castles, apply the saved dress up preset through
the existing `skyCastles.setIslandColors`. A claimed castle also raises its crystal bloom at dusk
and twilight, using the existing `crystalBloom` field in its colour settings, so claimed castles
visibly light up at night and unclaimed ones stay dark. This is the single strongest visual
reward in the game and must be obvious from the ground.

Accept when: claimed castles are visibly brighter at twilight than unclaimed ones, and the state
is correct immediately on load without waiting for the player to fly up.

Verify: claim one castle, reload, switch to twilight, and compare it against a neighbour.

---

### T4.5 - Castle dress up panel

Depends on: T4.3. Can run in parallel with T4.4 if the two agents split the files as written.

Read first: `src/world/skyCastles.ts` `CASTLE_COLOR_PRESETS`, `index.html` settings menu markup
for the visual language to match.

Create: `src/game/ui/CastleDressUp.ts`.

Modify: `index.html`, appending one panel block. No existing element is modified.

Forbidden: `src/ui/ui.ts`, `src/ui/devEditor.ts`, `src/world/skyCastles.ts`, everything else.

Do:
When the player is near a claimed castle, a single button appears offering to decorate it.
The panel shows the existing colour presets as large plain colour swatches with plain text names,
at least 44 by 44 pixels for touch. Choosing one calls `state.setDressUp(castleId, preset)` and
applies it immediately.

No icons, no emoji. Text is one word per swatch. The panel is dismissible by tapping anywhere
outside it, because an 8 year old will not hunt for a close control.

Accept when: a castle can be recoloured, the choice persists across reloads, and the panel is
usable with a finger on a tablet.

Verify: choose a preset, reload, confirm the colour persists.

---

## G. Phase 5 - Rewards and polish

---

### T5.1 - Flying friends as unlocks

Depends on: T4.3.

Read first: `src/player/FlightModels.ts`, `src/ui/ui.ts` model dropdown construction near line 134.

Create: nothing.

Modify: `src/player/FlightModels.ts` adding one optional field per entry;
`src/ui/ui.ts` model dropdown rendering only.

Forbidden: everything else in `src/ui/ui.ts`, `src/ui/devEditor.ts`, all other files.

Do:
Add `unlockedByCrown` to the model definitions, mapping most models to a castle id and leaving
two or three unlocked from the start so a new player has a choice immediately. In the dropdown,
locked entries render greyed with the plain text `Locked` and are not selectable. Unlocking on a
castle claim emits `friendUnlocked` and the HUD announces it in one short line.

Never remove a model the player already selected, even if the save is later reset.

Accept when: a fresh save shows locked entries, and claiming a castle unlocks exactly one.

Verify: `window.__game.director.state.isFriendUnlocked('...')`.

---

### T5.2 - Companion pet, optional

Depends on: T5.1. Cut this task first if the schedule is tight.

Read first: `src/player/player.ts` model loading, `public/Assets/Animals`.

Create: `src/game/fx/Companion.ts`.

Modify: nothing outside `src/game/`.

Forbidden: `src/player/player.ts`, everything else.

Do:
After the first castle is claimed, a small animal from the existing `public/Assets/Animals`
library follows the player at a soft offset with smoothed lag. One GLB, one draw call, no
animation mixer if the model has no clips. It never blocks the camera and never collides.

Accept when: the pet follows smoothly, adds under 0.2 ms per frame, and is absent on a fresh save.

Verify: frame time before and after.

---

### T5.3 - Night glow and Sky Sovereign

Depends on: T4.4.

Read first: `src/world/lighting.ts` phase handling, `src/core/renderer.ts` bloom API.

Create: nothing.

Modify: `src/game/castles/CrownTrials.ts` and `src/game/GameDirector.ts` only.

Forbidden: `src/world/lighting.ts`, `src/core/renderer.ts`, everything else.

Do:
When every castle in `getIslands()` is claimed, set `skySovereign`, emit `sovereign`, unlock all
flying friends, and raise the global bloom slightly at dusk and twilight through the existing
`pipeline.applyBiomeBloom` lerp path. The reward is a warmer, brighter sky, achieved with the
existing bloom controls and nothing new.

Do not add a new render pass. Do not change any lighting constant.

Accept when: claiming the last castle produces a visible change and the flag persists.

Verify: set all castles claimed from the console and observe.

---

### T5.4 - First run onboarding

Depends on: T2.5, T3.4.

Read first: `src/game/ui/GameHUD.ts`.

Create: nothing.

Modify: `src/game/ui/GameHUD.ts` and `src/game/GameDirector.ts` only.

Forbidden: everything else.

Do:
On a fresh save, place the first three dust motes within 300 metres of the spawn point regardless
of the normal cell hashing, so the first thing a new player sees is something to fly through.
Show one line of text for the first 15 seconds only: `Fly through the sparkles`. No modal, no
tutorial sequence, no button to dismiss, no second screen.

Accept when: a fresh save reliably puts a mote in the initial camera view.

Verify: `window.__game.director.state.reset(); location.reload();`

---

### T5.5 - Child safety and forgiveness pass

Depends on: every gameplay task.

Read first: everything under `src/game/`.

Create: `GAME_PLAN/SAFETY_REVIEW.md`.

Modify: only what the review finds, and only inside `src/game/`.

Forbidden: everything outside `src/game/`.

Do:
Audit the whole game layer against the rules in README.md section 2.2 and write the findings.
Specifically confirm and fix: no timer anywhere; no user facing string containing failure,
loss, wrong, lost, or dead; every collection radius is generous enough at 75 metres per second;
nothing earned can be removed; the save never throws; `prefers-reduced-motion` reduces pulsing
and burst counts; every touch target is at least 44 by 44 pixels.

Accept when: the review file lists every check with a pass or a fix, and every fix is applied.

Verify: read `GAME_PLAN/SAFETY_REVIEW.md`.

---

## H. Phase 6 - Extensibility and performance

---

### T6.1 - Adding a biome guide and coverage check

Depends on: T3.1, T4.2.

Read first: `src/world/noise.ts`, `src/core/config.ts`, `src/game/BiomeGameplay.ts`.

Create: `GAME_PLAN/ADDING_A_BIOME.md`.

Modify: nothing.

Forbidden: all of `src/`.

Do:
Write the complete checklist for adding a new biome after this plan has landed: the entry in
`BIOME_LOCATIONS`, the height function, the `getBiomeWeights` case, the `getDominantBiomeName`
case, the `BiomeConfig` in `config.ts`, and the optional `BIOME_GAMEPLAY` tuning entry. State
plainly which of those are required and which are optional, and state that no file under
`src/game/` needs to change.

Then prove it: document the exact steps to add a throwaway test biome, confirm dust and rings
appear in it with no game layer edits, and record the result in the document.

Accept when: the guide is accurate enough that following it produces a playable new biome.

Verify: follow your own guide end to end on a scratch branch, then revert.

---

### T6.2 - Performance audit

Depends on: every gameplay task.

Read first: `GAME_PLAN/README.md` section 5.

Create: `GAME_PLAN/PERF_REPORT.md`.

Modify: only what is needed to meet the budget, and only inside `src/game/`.

Forbidden: everything outside `src/game/`.

Do:
Measure draw calls and CPU frame time with `window.__game.director.enabled` toggled false and
true, in each of the 7 biomes at each of the 3 time phases, on the reference machine. Record the
numbers. If the layer exceeds 6 added draw calls or 1.0 ms added CPU time, fix it inside
`src/game/` and record what you changed.

Note the pre existing 18 FPS observation with the developer editor open. That is not your
regression and you must not attempt to fix it; measure with the editor closed and say so.

Accept when: the report shows the budget met in every biome and phase, or names precisely where
it is not and why.

Verify: read `GAME_PLAN/PERF_REPORT.md`.

---

### T6.3 - Touch and low end pass

Depends on: T6.2.

Read first: `src/player/controls.ts`, `src/ui/deviceSimulator.ts`.

Create: nothing.

Modify: only inside `src/game/`, plus the HUD CSS block in `index.html` that T1.5 added.

Forbidden: `src/player/controls.ts`, `src/ui/`, everything else.

Do:
Verify the whole game is playable with the existing virtual joystick and boost button alone.
The HUD must not overlap the joystick zone, which the code reserves as the left 65 percent of the
screen for touch pointers. Reduce dust capacity and burst particle count when
`window.devicePixelRatio` is low or the measured frame time is above 25 ms, using the existing
`setOptimizedMode` pattern in `src/world/props.ts` as the precedent.

Test through the existing device simulator rather than adding new tooling.

Accept when: the game is completable on a simulated tablet profile at a stable frame rate.

Verify: open the device simulator and play through one ring chain.

---

## I. Assignment guidance

- Give Phase 0 to your most capable agents. T0.7 is the single riskiest task in the plan.
- T0.3 and T0.4 both edit `src/world/trees.ts`. Run them sequentially, never together.
- T4.4 and T4.5 can run together only because they touch different files. Confirm before
  dispatching both.
- Every task that says "Create: half of file X" means a second agent will add the other half
  later. Write clean seams: exported class, private methods, no cross half assumptions beyond
  the contract.
- If an agent reports that it needed to change a frozen contract, do not accept the work. Rework
  the contract yourself, then re dispatch every affected task.
