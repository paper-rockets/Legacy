# LEGACY Menu Rebuild - Delegation Packet

Target: `E:\GAME FINAL RUN\LEGACY`. Three.js 0.185.1, Vite 6, TypeScript 5.8.

Approach: **delete the entire UI layer and write a new one against the existing world API.**
No migration, no parallel run, no cut over. The world systems already work and are not touched.

This folder is a complete, self contained work package:

1. `README.md`      - why a rebuild is the cheaper option, and what the new UI is (this file)
2. `CONTRACTS.md`   - frozen interfaces. Copy verbatim. Never edited by a task agent.
3. `TASKS.md`       - one brief per agent, with dependencies and acceptance criteria
4. `tools/audit_dom_ids.mjs`   - every id bound from TypeScript must have markup. 59 before the
   rebuild, must be 0 from T2.1 onward.
5. `tools/audit_index_ids.mjs` - index.html may contain only the 10 ids in the frozen markup
   contract, and must stay under 200 lines. Exits 1 before T2.1, must exit 0 after. This is what
   stops markup creeping back in and recreating the original defect.
6. `_ARCHIVE/`  - byte-identical copies of the 9 files the rebuild deletes or rewrites. The only
   restore point. More faithful than git history, which lacks the uncommitted edits several of these files carried.
7. `BEHAVIOUR_INVENTORY.md` - 173 line checklist of everything the old UI did, with broken and
   duplicated controls marked. Phase 7 checks against it.
8. `baseline/` - numeric world-state fingerprint plus the script that reproduces it, and
   `PRE_EXISTING_DEFECTS.md`, which records faults that already existed so the acceptance sweep
   does not attribute them to the rebuild.

Baseline: `npm run lint` (tsc --noEmit) exits 0. Keep it that way.

---

## 0. READ THIS BEFORE DELETING ANYTHING

**There are two nested git repositories, and only one of them tracks the source.**

    E:\GAME FINAL RUN\           outer repo - does NOT track LEGACY/src/
    E:\GAME FINAL RUN\LEGACY\    LEGACY's own repo - DOES track src/

Run every git command from inside `LEGACY/`. From the outer repo, `git ls-files LEGACY/src/ui/`
returns nothing, which falsely suggests the source was never committed. It was. All four UI files
this package deletes exist in LEGACY's history and are recoverable with `git checkout <commit> --`.

Task T0.1 still archives the UI layer before anything else happens, and it is still worth doing:
several of those files were dirty relative to HEAD, so the archive preserves uncommitted edits that
git history does not have. The archive is the more faithful restore point; git is the backstop.

One real hazard remains. The OUTER repo has roughly 1300 untracked files including several hundred
MB of `.glb` binaries. Never run `git add -A` there. Git retains large blobs permanently and
removing them later requires rewriting history.

---

## 1. Why rebuilding is cheaper than repairing

The instinct that this should be built fresh is correct, and the evidence supports it.

### 1.1 The world layer is clean and does not need to change

Every system outside `src/ui/` is already DOM free, except one file:

| Layer | DOM dependencies |
| --- | --- |
| `src/world/` (10 files, 6800 lines) | none, apart from an offscreen canvas in trees.ts:188 |
| `src/core/` (config, renderer) | none |
| `src/audio/`, `src/player/player.ts` | none |
| `src/player/controls.ts` | 4 element ids, listed in section 4 |

So the game, the terrain, the vegetation, the castles, the persistence and the flight model are
all independent of the menu. The menu can be replaced without touching any of them. That is the
fact that makes a rebuild safe.

### 1.2 The UI layer is where all the damage is

| File | Lines | Verdict |
| --- | --- | --- |
| index.html | 2353 | 1338 lines inline CSS, 265 ids. Replace with about 120 lines. |
| src/ui/devEditor.ts | 2240 | Delete. Binds 44 ids that have no markup. |
| src/ui/topViewController.ts | 981 | Delete. Duplicates the castle editor; the useful camera code is about 200 lines and is faster to rewrite than to untangle. |
| src/ui/ui.ts | 706 | Delete. Its settings menu is a second, desynchronised editor. |
| src/ui/deviceSimulator.ts | 377 | Delete. Binds 11 ids, none exist, has never functioned. |
| src/ui/thumbnailGenerator.ts | 135 | **Keep unchanged.** Works, self contained, no defects. |

Deleted: about 4300 lines of TypeScript and 2200 lines of HTML and CSS.
Written new: about 1100 lines. Net removal of roughly 5400 lines.

### 1.3 Why repair was going to cost more

`node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs` reports **59 dangling ids**: controls that
TypeScript binds where no markup exists. Every lookup in the codebase is written as

    const el = document.getElementById('dev-castle-x') as HTMLInputElement | null;
    if (el) { ... }

so a missing element throws nothing, logs nothing, and shows nothing. The control is simply absent
and the code driving it never runs. The whole castle transform block (21 elements), the four castle
colour pickers plus crystal bloom (9 elements), and the entire cloud sea fog deck (10 elements) are
in this state. That is the reported "parts of menu cut off": real headings, missing controls,
silent failure.

It is also why previous attempts did not land. The work was never hard, it was *unverifiable*.
An agent edits one side, the build compiles, the game runs, the control does nothing.

A repair would have to keep both editors alive at once, migrate tab by tab, then cut over and
delete. Every one of those steps is a seam where old and new state can disagree. A rebuild has no
seams: the world API is the contract, it already exists, and it is stable.

### 1.4 What is lost by starting over, and why it does not matter

Three behaviours exist only in the old UI files:

- **Blueprint camera** (topViewController lines 170-360): camera pose save and restore, altitude
  lerp, grid helper, far plane expansion. About 200 lines, rewritten in T5.1. The hard part is not
  here: `raycastCastles` and `raycastHorizontalPlane` live in `skyCastles.ts:833-872`, in the world
  layer, and are kept.
- **Photo mode** (ui.ts:402-470): OrbitControls plus a clean frame capture. About 70 lines,
  rewritten in T2.1.
- **Prop placement HUD**: a one line status bar. Trivial.

Everything else in the old UI is either duplicated, broken, or a control that can be re-declared in
five lines of schema. The full inventory of behaviours to re-provide is in T0.1.

---

## 2. What gets built

### 2.1 Settings is a decoy

The cogwheel opens a small window titled `Settings` with five inert rows: Graphics, Sound,
Controls, Language, Version. None of them do anything. It exists so the game looks like a game.

One live control sits inside it: `Developer Options`, which opens the editor. Rationale: F2 opens
the editor too, but F2 does not exist on a tablet, and without this entry the editor is unreachable
on touch. It is behind `SETTINGS_DECOY.showDeveloperEntry` so it can be switched off for a build
handed to a player.

Nothing else. No sliders, no palettes, no vegetation controls, no debug toggles.

### 2.2 The developer editor is four tabs and a fixed save bar

| Tab | Contents |
| --- | --- |
| VEGETATION | model catalog, per model scale / density / colours, biome glow and bloom, ground cover |
| OBJECTS | manual structure and vessel placement |
| CASTLES | island transform, model, colours, fog deck, layout - shared with the blueprint view |
| WORLD | terrain, water, sky and light, performance, session tools |

Four buttons fit the panel width, so no tab is ever clipped. The old editor had six and hid the
overflow scrollbar in CSS, which is why the sixth tab looked cut off.

The save controls are a permanent footer, visible on every tab:

    [ Save this biome ]  [ Save all biomes ]  [ SAVE PERMANENTLY TO DISK ]  [ Reset ]

"Set permanent" was named as a core requirement, so it is never more than one click away and never
behind a tab.

Persistence is unchanged and already works: `POST /api/save-config-to-disk` is served by
`localConfigPersistencePlugin` in `vite.config.ts:7-32` and writes
`src/core/saved_biome_config.json`; `main.ts:23` calls `globalConfigManager.syncFromDisk()` before
any system is constructed. The endpoint is registered in `configureServer`, so disk save works
under `npm run dev` only. The footer must say so when the fetch fails, which `config.ts:838`
already handles.

### 2.3 The VEGETATION tab, in order

This is the tab the request is actually about: place trees and vegetation, scale it, edit colours
and bloom, set permanent.

    CATALOG
      search        select all       unselect all
      filter: all | trees | flowers
      grid of model cards, each with thumbnail, name, ON/OFF state
      upload custom .glb

    SELECTED MODEL              (only when a card is selected)
      scale            slider + number box
      density          slider + number box
      colour mode      original | custom
      canopy swatches  leaf swatches  trunk swatches

    GROUND COVER
      bush scale       bush density

    GLOW AND BLOOM              (biome wide - new, no equivalent exists today)
      foliage glow          trees.setBioluminescence
      bloom strength        pipeline.setBloomStrength
      bloom radius          pipeline.setBloomRadius
      bloom threshold       pipeline.setBloomThreshold
      cloud bloom           props.setBiomeCloud
      shoreline bloom       terrain.setShoreBloom

Two corrections to how the old UI presented this:

**Bloom had no UI at all.** `RenderPipeline` exposes `setBloomStrength`, `setBloomRadius` and
`setBloomThreshold` (renderer.ts:95-124) and nothing in index.html referenced them. Bloom editing
was requested and did not exist.

**Foliage glow is biome wide, not per model.** The old inspector drew a `BIOLUMINESCENCE` slider
inside the selected model card, but `devEditor.ts:1292` called
`trees.setBioluminescence(v/100, biomeId)`, which writes one uniform for the whole biome. It now
appears once, in GLOW AND BLOOM, labelled accordingly.

Related trap: `setTreeBloomIntensity`, `setCanopyGlowMultiplier`, `setTrunkGlowMultiplier`,
`setBushBloomIntensity` and `setBushGlowMultiplier` (trees.ts:1470-1489) are five aliases that all
write that same single uniform. `BloomSettings` stores them as five separate fields, so exposing
them would produce five sliders that overwrite each other. Only the one honest control is exposed,
and the five dead aliases are deleted in T4.1.

### 2.4 The CASTLES tab and the blueprint view share one editor

`src/ui/castleEditorState.ts` owns the selected island id and notifies subscribers. One function,
`buildCastleControls(ctx)`, returns the control schema. It is rendered into two places: the CASTLES
tab, and the blueprint drawer. Same code, one implementation, no possibility of divergence.

The old build had this implemented twice, in two files, against two DOM trees, with two separate
selection variables kept in sync by callbacks. Duplicated operations were addIsland, removeIsland,
setIslandModel, setIslandColors, applyLayoutPreset, resetToDefaults and saveConfigToDisk.

The controls that existed in code with no markup come back as schema entries: X, Y, Z, rotation,
island scale, cloud radius, cloud puff count, roof / wall / trim / crystal colours, crystal bloom,
and the fog deck.

---

## 3. The architecture that keeps this from rotting again

One idea, and it is the reason the rebuild is worth doing rather than just patching markup.

**Controls are declared once, as data, in TypeScript. The DOM is generated from that data.**

    { kind: 'slider', label: 'Tree scale', min: 0.5, max: 30, step: 0.1, unit: 'x',
      get: () => veg().treeScale,
      set: v => trees.setBiomeTreeScale(biomeId(), v) }

There is no id and no markup. A control cannot be half wired, because the label, the getter and
the setter are one literal that the compiler checks. Adding a control is adding one object literal.
An agent cannot silently break the link between markup and behaviour, because there is no link.

Supporting guarantees:

- `requireEl(id)` replaces `getElementById` for the handful of static mount points and throws in
  development instead of returning null. Silent no-ops become loud failures.
- `window.__panelAudit()` calls every accessor in every live panel and returns the ones that throw.
  This is how a task proves a control is wired, rather than proving it compiles.
- `audit_dom_ids.mjs` must report 0 dangling ids from T2.1 onward. It is a cheap regression guard.
- Panel CSS lives in `src/ui/panel/panel.css`, imported by the module that owns it, so a deleted
  panel takes its styles with it.

---

## 4. The only markup the world layer requires

`src/player/controls.ts` is the one non-UI file that touches the DOM. The new `index.html` must
provide exactly these, with these ids, or the touch controls break:

    #touch-controls      container, also the touch capture surface
    #joystick-zone       CSS only hit area, no TypeScript lookup
    #joystick-base       gets .resting and .active toggled by controls.ts
    #joystick-knob       moved by transform
    #boost-btn           gets .active toggled by controls.ts

Plus `document.body.classList` receives `is-touch-device`.

The CSS for these five elements is behavioural, not decorative: `controls.ts` toggles `.resting`
and `.active` and expects the stylesheet to make that visible. **Copy the existing rules for
`#touch-controls`, `#joystick-zone`, `#joystick-base`, `#joystick-knob`, `#boost-btn` and
`body.is-touch-device` out of index.html verbatim.** Do not rewrite them. They are the one part of
the old stylesheet that is load bearing.

`#app` is also required: `main.ts:19` mounts the renderer into it.

---

## 5. Phase order

| Phase | Tasks | Outcome |
| --- | --- | --- |
| 0 | T0.1 | Old UI archived, baseline captured. Blocks everything. |
| 1 | T1.1 | Frozen contracts written. |
| 2 | T2.1 | The clean break: new index.html, old UI deleted, game boots and flies with a working top bar. |
| 3 | T3.1 | Panel runtime, editor shell, save footer. F2 opens an empty four tab editor. |
| 4 | T4.1, T4.2, T4.3 | Vegetation, Objects and World tabs. Parallel. |
| 5 | T5.1 | Castles tab and the rewritten blueprint view. |
| 6 | T6.1 | Layout, responsive and touch pass. |
| 7 | T7.1 | Acceptance sweep. |

T2.1 is the scary one and it is deliberately a single task rather than a migration. After it the
game runs with no editor at all. That is a clean, verifiable state, and everything after it is
additive.

---

## 6. Invariants

From `RULES.md` and from what the game looks like today. A task that violates one is rejected
regardless of how well the rest works.

1. No icons, emojis, unicode symbols or decorative glyphs. Anywhere. Plain ASCII only.
2. Lighting values, sun horizon offsets, track arrays, colour constants and material settings are
   protected. This package builds a menu; it does not tune values. Every default a control shows is
   read from `globalConfigManager` at runtime, never hard coded into a schema.
3. Do not change `package.json`, `vite.config.ts` or `tsconfig.json`. No new dependencies. The
   panel runtime is plain DOM, roughly 350 lines, no framework.
4. `npm run lint` must exit 0 after every task.
5. Config shape (`AppConfig`, `BiomeConfig`, `VegetationBiomeSettings`, `BloomSettings`,
   `SkyCastleIslandDef`) is frozen. A `saved_biome_config.json` written before this work must still
   load after it. If a task appears to need a config field that does not exist, stop and report.
6. Nothing under `src/world/`, `src/core/`, `src/player/` or `src/audio/` is modified, with exactly
   one exception: the five dead glow aliases deleted in T4.1.
7. The world must render identically when the editor is closed. Compare against the T0.1 baseline.

`RULES.md` rule 1 restricts changes to 2-5 lines. It is suspended for `index.html`, `src/main.ts`
and everything under `src/ui/`, and only those. It remains in force everywhere else.
