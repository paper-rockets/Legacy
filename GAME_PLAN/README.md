# Wanderlust LEGACY - Gamification Master Plan

Target platform: LEGACY (E:\GAME FINAL RUN\LEGACY), Three.js 0.185.1, Vite, TypeScript.
Target player: an 8 year old girl (primary), playable and appealing to boys of the same age.
Design pillars: fun, simple, lightweight, WebGPU based, future biome friendly, castles as the top reward.

This folder is the complete delegation package. Three documents:

1. README.md       - what we are building and why (this file)
2. CONTRACTS.md    - frozen interfaces. Written first, then never changed without an owner sign off.
3. PERFORMANCE.md  - measured findings and the ranked fix list. Read before starting Phase 0.
4. TASKS.md        - one brief per delegated agent, with acceptance criteria.

Note on biome count: `BIOME_LOCATIONS` contained 8 entries when this plan was written, the most
recent being `prism_sanctum`. Nothing in this plan hard codes that number. Wherever a count
appears it is illustrative; always read the current list from `src/world/noise.ts`.

---

## 1. Review of the current build

### 1.1 What exists today

Entry point is `src/main.ts` (117 lines), a plain TypeScript bootstrap. React is a dependency but
`src/main.tsx` and `src/App.tsx` are 10 and 8 lines and are not part of the flight experience.

Systems constructed in `bootstrap()` and ticked in one `requestAnimationFrame` loop:

| System | File | Role |
| --- | --- | --- |
| RenderPipeline | src/core/renderer.ts | WebGLRenderer, EffectComposer, UnrealBloomPass |
| LightingSystem | src/world/lighting.ts | Day / Dusk / Twilight phases, sun mesh, star Points |
| TerrainSystem | src/world/terrain.ts | Sliding 128 res grid re centred on the player |
| WaterSystem | src/world/water.ts | Toon and physical water planes |
| PropsSystem | src/world/props.ts | 50 instanced clouds |
| SkyCastleSystem | src/world/skyCastles.ts | 9 sky islands, LOD, collisions, updraft, layer fog deck |
| TreeSystem | src/world/trees.ts | Instanced tree and bush catalog, per biome selection |
| WorldPropsSystem | src/world/worldProps.ts | Hand placed structures from the dev editor |
| PlayerSystem | src/player/player.ts | Flight model, camera rig, aerodynamics |
| ControlsManager | src/player/controls.ts | Keyboard, virtual joystick, boost button |
| AmbientAudioEngine | src/audio/audio.ts | Procedural Web Audio music, 5 tracks |
| UIManager | src/ui/ui.ts | Top bar, settings, photo mode, debug |
| DevEditor | src/ui/devEditor.ts | 2234 line biome authoring studio |

Total main game source is roughly 8,000 lines. `src/world/volumetricClouds.ts`,
`src/world/rainbowGodRays.ts` and `src/world/vortexPortal.ts` are NOT imported by `main.ts`.
They only serve the standalone demo entries declared in `vite.config.ts`. They are out of scope
for everything below.

### 1.2 What the player can do now

Fly. Change avatar. Change biome by teleport. Change time of day. Take a photo. Pause.
There is no goal, no score, no progression, no persistence, no reason to return.
Every asset needed for a good game is already present; only the game layer is missing.

### 1.3 Systems that are already load bearing for gameplay

These exist and must be reused rather than reinvented. This is where most of the leverage is.

- `PlayerSystem.isSkimmingWater` gives a speed bonus when low over Estuary water.
- `PlayerSystem.isUpdraftLift` gives lift over Archipelago and Geothermal high ground.
- `SkyCastleSystem.getUpdraftLift(x, y, z)` already lifts the player near a sky island.
- `SkyCastleSystem.resolveCollisions(pos, radius, velocity)` returns a boolean and already
  pushes the player out of castle geometry. This becomes our soft bounce feedback signal.
- `SkyCastleSystem.layerFogAltitude` (default 260) is a dense fog deck between ground and sky.
  This becomes the gate between the ground game and the castle game.
- `SkyCastleSystem.setIslandColors(id, colors)` plus `CASTLE_COLOR_PRESETS` already recolour a
  castle at runtime. This becomes the castle dress up reward with almost no new code.
- `getDominantBiome(x, z, y)` returns `sky_citadel` for any y at or above 250.
- `FLIGHT_MODELS` in `src/player/FlightModels.ts` is a list of avatars, all currently free.
  Gating these behind castle crowns turns an existing menu into a reward ladder.
- `terrainHeightJS(x, z)` and `getBiomeWeights(x, z)` in `src/world/noise.ts` are pure functions.
  All procedural gameplay placement uses them, so a new biome gets content for free.

### 1.4 Known problems to respect

- Frame rate was observed at 18 FPS with the developer editor open on the reference machine.
  The game layer therefore gets a hard budget, see section 5. Separately, a measured review of the
  existing hot paths found that the terrain rebuild loop runs over 98,304 vertices with roughly 83
  percent of that work duplicated, and that it fires every 12.5 metres of movement. That is a
  pre existing cost, not something the game layer introduces, and it is very likely the main cause
  of the observed frame rate. It is addressed by the performance workstream in PERFORMANCE.md,
  which runs alongside these phases rather than after them.
- `RULES.md` and `.agents/rules.md` mandate pinpoint edits, a visual invariant lock, and a
  strict no icon and no emoji rule. Every delegated task inherits these. See the TASKS.md preamble.
- Assets are served from `public/Assets`, base path is `./`, deployment is GitHub Pages.
  No server exists in production, so all progression is client side.

---

## 2. Game design

### 2.1 One sentence

The cloud castles have fallen asleep; collect star dust, follow the rainbow rings, wake the
castles, and make each one yours.

### 2.2 Non negotiable child safety rules for this design

- No death, no damage, no game over, no lives, no countdown timers.
- Nothing that has been earned can ever be lost.
- Bumping into anything is a soft bounce plus sparkles, never a penalty.
- All progress saves automatically and silently.
- Objective text is one short line, present tense, words an 8 year old reads at a glance.
- A visible guide always points at the next thing to do, so the player is never lost.
- No violence, no enemies, no chasing, no scary audio.
- Every session is a win: even a two minute flight collects dust and grows the meter.

### 2.3 The three loops

Loop 1 - Star Dust. Seconds.
Floating sparkles sit above the terrain everywhere in the world. Fly through one to collect it.
Collect another within three seconds and a combo multiplier steps up, to a maximum of five.
Dust fills the Rainbow Meter. There is always visible dust within sight of the player.

Loop 2 - Rainbow Rings. One to two minutes.
Each biome owns a chain of eight large glowing rings that follows the shape of that biome
terrain. Fly through ring one to start the chain; the next ring lights up and the guide points
at it. There is no timer. Completing the chain awards a Rainbow Feather for that biome and a
large dust bonus. The chain can be replayed for dust, but the feather is awarded once.

Loop 3 - Cloud Castles. Five to fifteen minutes. This is the top of the ladder.
Above 260 metres sits the cloud deck, a dense fog layer that already exists in the build.
Without charge it is a soft ceiling: pushing into it slows the player and eases them back down.
With a full Rainbow Meter and at least one Rainbow Feather, a Rainbow Bridge opens at the biome
centre: a wide column of light that lifts the player through the deck into the Cloud Citadel.

Up there sit the nine sky castles that the build already renders. Each sleeping castle has three
Crown Rings orbiting its spire at descending heights. Fly all three in order to wake the castle.
Bumping the castle does not fail the trial; it just resets the ring sequence with a friendly
chime, and the player can try again immediately.

Waking a castle claims it. Claiming a castle gives, permanently:

- A new flying friend, one avatar unlocked from `FLIGHT_MODELS`.
- Castle dress up for that castle: choose its roof, wall and crystal colours from the existing
  presets. The choice is saved and applied every session.
- The castle glows at dusk and twilight instead of standing dark.
- One extra Rainbow Meter tier, which means a longer boost.

Claiming all nine castles unlocks Sky Sovereign: an aurora over the whole world, every flying
friend unlocked, and free play with everything on.

### 2.4 Why this is the right shape for the player

- Collecting and decorating is the core appeal, not skill under pressure.
- The reward ladder is visible from the ground: the castles are literally above the player and
  visibly asleep, which creates the pull without a single line of tutorial text.
- Every mechanic reuses a system that already exists, so the build stays lightweight.
- Nothing in the loop depends on reading speed, reaction time, or precision flying.

### 2.5 Reward ladder summary

| Tier | Action | Reward | Persistence |
| --- | --- | --- | --- |
| 1 | Collect star dust | Meter growth, combo chime | Session and save |
| 1 | Combo of five | Sparkle burst, meter bonus | Session |
| 2 | Complete a ring chain | Rainbow Feather for that biome, dust bonus | Permanent |
| 3 | Open a Rainbow Bridge | Access to the Cloud Citadel | Permanent per biome |
| 3 | Wake a castle | Flying friend, castle dress up, castle night glow, meter tier | Permanent |
| 3 | Wake all nine | Sky Sovereign aurora, everything unlocked | Permanent |

---

## 3. Technical architecture

### 3.1 Guiding rule

The game layer is additive and isolated. It lives entirely under `src/game/`. It reads the world
through a narrow context object and writes back only through two declared calls. Existing world
files are touched only where the plan explicitly says so, and only in the exact lines named.

### 3.2 New directory layout

```
src/game/
  types.ts                 Frozen shared types, see CONTRACTS.md
  GameState.ts             Save data, unlocks, counters, event emitter
  GameDirector.ts          Owns all game systems, single update entry
  BiomeGameplay.ts         Per biome tuning registry plus default fallback
  save/SaveStore.ts        localStorage read and write, schema versioning
  dust/DustField.ts        Deterministic star dust spawning and collection
  rings/RingCourse.ts      Per biome rainbow ring chain
  castles/CloudDeck.ts     Soft ceiling gate at the fog deck altitude
  castles/RainbowBridge.ts Ascension column at a biome centre
  castles/CrownTrials.ts   Per castle three ring trial and claim
  fx/SparkleBurst.ts       Pooled instanced particle burst
  fx/GuideTrail.ts         Sparkle line pointing at the current objective
  audio/GameAudio.ts       Chimes and stingers over the existing AudioContext
  ui/GameHUD.ts            Meter, dust count, objective line, crown tally
  ui/CastleDressUp.ts      Colour picker for a claimed castle
```

### 3.3 Integration surface with the existing build

Exactly four existing files are modified by the game layer, and each modification is small and
named up front:

1. `src/main.ts` - one import, one construction, one update call. Three inserted lines total.
2. `src/audio/audio.ts` - one public getter that exposes the existing `AudioContext` so the SFX
   layer does not create a second one.
3. `index.html` - one HUD container div and its CSS block. No changes to existing markup.
4. `src/player/FlightModels.ts` - one optional field `unlockedByCrown` per entry.

Everything else the game needs is already public on the existing systems.

The exact `main.ts` diff, which must not grow:

```ts
import { GameDirector } from './game/GameDirector';
// after ui and deviceSimulator are constructed:
const game = new GameDirector(pipeline.scene, pipeline.camera, player, skyCastles, audio, lighting);
// inside animate(), after the existing world updates and before ui.updateFPS():
game.update(flightDt, realDt);
```

### 3.4 Data flow

`GameDirector.update()` builds one `GameContext` per frame, a plain object holding player
position, quaternion, speed, current biome id, lighting time phase, and delta time. Every game
subsystem receives that same context. Subsystems never reach into `PlayerSystem` or
`SkyCastleSystem` directly except through the two declared write calls:

- `GameDirector.applyLift(amount)` adds to player Y, mirroring the existing updraft pattern.
- `GameDirector.applyDrag(factor)` scales player velocity, used by the cloud deck ceiling.

This keeps the flight model authoritative and prevents fights between systems.

### 3.5 WebGPU

Today the pipeline is `THREE.WebGLRenderer` plus `EffectComposer` plus `UnrealBloomPass`.
Phase 0 moves it to `WebGPURenderer` from `three/webgpu` plus `PostProcessing` with the TSL
`bloom` node from `three/addons/tsl/display/BloomNode.js`. Three 0.185.1 ships all of this, and
the sibling project at `E:\GAME FINAL RUN\WEBGPU\src` already runs this exact stack, so it is a
working reference rather than an experiment.

Why Phase 0 comes first: node materials from `three/webgpu` do not render under the classic
`WebGLRenderer`. If the game layer were authored against classic materials it would have to be
rewritten later. Doing the renderer swap first means every line of game code is written once.

Fallback safety: `WebGPURenderer` automatically falls back to its WebGL2 backend when
`navigator.gpu` is unavailable, so older tablets and school Chromebooks keep working. There is
no separate code path to maintain.

Migration scope in the main game path is small and fully enumerated:

| File | What must move | Notes |
| --- | --- | --- |
| src/core/renderer.ts | Renderer and bloom | Public API of RenderPipeline stays identical |
| src/world/trees.ts | 2 onBeforeCompile hooks | Bioluminescence emissive plus per part colour attributes |
| src/world/props.ts | 1 onBeforeCompile hook | Cloud emissive boost |
| src/world/skyCastles.ts | 1 onBeforeCompile hook | Cloud and layer fog emissive boost |
| src/world/terrain.ts | 1 onBeforeCompile hook, 1 ShaderMaterial | Shoreline glow, crystal terrain style |
| src/world/water.ts, lighting.ts, worldProps.ts, player.ts | Material class swap only | No custom GLSL |

`RenderPipeline` public methods `applyBiomeBloom`, `setBloomStrength`, `setBloomRadius`,
`setBloomThreshold`, `setPixelRatioCap`, `handleResize` and `render` keep their exact signatures,
so `ui.ts` and the 2234 line `devEditor.ts` need zero changes.

### 3.6 Future biome compatibility

This is a hard requirement, so it is enforced structurally rather than by convention.

A new biome today means adding an entry to `BIOME_LOCATIONS` in `src/world/noise.ts`, a case in
`getBiomeWeights` and `getDominantBiomeName`, and a `BiomeConfig` in `src/core/config.ts`.

After this plan lands, that is still all that is required. The game layer adapts automatically:

- Star dust placement is a pure function of `terrainHeightJS` and cell hashing. A new biome gets
  dust the moment its terrain exists. No authoring.
- Ring chains are generated from the biome centre in `BIOME_LOCATIONS` plus terrain sampling.
  A new biome gets a ring chain automatically.
- `BiomeGameplay.ts` exports `BIOME_GAMEPLAY` as a partial record and `DEFAULT_BIOME_GAMEPLAY`.
  Lookups go through `getBiomeGameplay(id)` which falls back to the default. A missing entry is
  never an error, only a missing flavour tuning.
- Castles are looked up from `SkyCastleSystem.getIslands()` at runtime, not hard coded. Adding a
  tenth castle in the dev editor creates a tenth crown trial with no code change.
- `GameState` keys progression by biome id and castle id strings, and the save schema tolerates
  unknown ids on load. Removing a biome does not corrupt a save.

Task T6.1 delivers `ADDING_A_BIOME.md` and a check that runs the registry against every id in
`BIOME_LOCATIONS`.

---

## 4. Phase plan

Phases are ordered by dependency. Tasks inside a phase marked parallel can be given to
different agents at the same time.

| Phase | Name | Tasks | Parallel | Blocking for |
| --- | --- | --- | --- | --- |
| 0 | WebGPU foundation | T0.0 - T0.9 | T0.3 - T0.8 after T0.1 | Everything |
| 1 | Game core scaffolding | T1.1 - T1.6 | T1.4 - T1.6 after T1.1 | Phases 2 - 5 |
| 2 | Star dust loop | T2.1 - T2.5 | T2.4 alongside T2.1 | Phase 3 gating |
| 3 | Rainbow rings | T3.1 - T3.4 | T3.4 alongside T3.1 | Phase 4 gating |
| 4 | Cloud castles | T4.1 - T4.5 | T4.5 alongside T4.3 | Phase 5 |
| 5 | Rewards and polish | T5.1 - T5.5 | T5.1 - T5.3 | none |
| 6 | Extensibility and perf | T6.1 - T6.3 | all three | none |
| P | Performance workstream | TP.1 - TP.9 | see PERFORMANCE.md | runs alongside |

Suggested ordering for a small agent pool: run Phase 0 to completion and verify parity before
opening Phase 1, because a broken renderer makes every later verification ambiguous.

---

## 5. Budgets and constraints

Hard limits. A task that breaches one of these is rejected and reworked.

- Draw calls added by the entire game layer: 6 or fewer.
  One instanced mesh each for dust, rings, crown rings, sparkle bursts, guide trail, bridge.
- CPU time added per frame: 1.0 ms or less on the reference machine, measured with the game
  layer toggled off and on via `window.__game.director.enabled`.
- New npm dependencies: zero.
- New binary assets required for the minimum viable game: zero. All game shapes are procedural
  geometry. The optional companion pet in T5.2 may reuse an existing GLB from `public/Assets`.
- Bundle growth: under 60 KB of source before minification.
- Live game objects at any time: 128 dust motes, 8 rings, 3 crown rings, 48 burst particles.
- Save payload: under 8 KB of JSON in localStorage under the single key `wanderlust.save.v1`.
- No blocking work in the animate loop. All loading is async and the game degrades gracefully
  while assets are still arriving.

---

## 6. Verification strategy

Phase 0 uses screenshot parity. T0.0 captures a baseline of every biome at every time phase
using the existing puppeteer-core dependency, writing PNGs to `GAME_PLAN/baseline/`. Every
Phase 0 task must reproduce those frames within tolerance. The sibling WEBGPU project used this
same method and its `gl_*.png` and `gpu_*.png` pairs show the expected workflow.

Phases 1 to 6 use behavioural checks driven from the console, because there is no test runner in
this project and adding one is out of scope. Each task in TASKS.md names the exact expression to
evaluate and the expected result, for example:

```
window.__game.director.state.dust
```

Every task must also pass `npm run lint`, which is `tsc --noEmit`.

---

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| WebGPU migration shifts colours or bloom | Breaks the visual invariant lock | T0.0 baseline capture before any change, per task parity check |
| Node material port loses the tree wind or glow | Visible regression | Each hook gets its own task with a named before and after screenshot |
| Frame rate falls further | Game becomes unplayable for the target player | Hard draw call and CPU budget, T6.2 audit gate before sign off |
| Agents refactor beyond scope | Violates RULES.md | Explicit forbidden file list on every task brief |
| A future biome breaks the game layer | Contradicts a core requirement | Default fallback in the registry, T6.1 check across all ids |
| Save corruption loses a child castles | Emotionally serious for the target player | Schema version, defensive load, never throw on bad save, keep last good copy |
| Crystal terrain style has no TSL equivalent yet | One visual style unavailable | T0.8 may feature gate the style off rather than block the phase |

---

## 8. Definition of done

- The game runs on `WebGPURenderer` with automatic WebGL2 fallback and no visual regression
  against the Phase 0 baseline.
- A first time player with no instructions collects dust within 30 seconds of loading.
- A ring chain is completable in every biome that exists in `BIOME_LOCATIONS`.
- All nine castles can be woken, claimed, recoloured, and stay claimed after a reload.
- Adding a new biome requires no edits inside `src/game/` other than an optional tuning entry.
- `npm run lint` is clean and the draw call and CPU budgets in section 5 are met.
