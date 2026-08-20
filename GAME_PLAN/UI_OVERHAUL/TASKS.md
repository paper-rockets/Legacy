# Delegation Packet - Menu Rebuild

One brief per agent. Each brief is self contained. Give an agent the preamble in section A plus
exactly one brief. Do not give an agent two briefs at once. Only Phase 4 runs in parallel.

---

## A. Preamble - paste at the top of every agent prompt

```
You are working in the repository at E:\GAME FINAL RUN\LEGACY.
This is a Three.js 0.185.1 + Vite + TypeScript flight game. The menu layer is being rebuilt from
scratch against the existing world API. Read GAME_PLAN/UI_OVERHAUL/README.md and
GAME_PLAN/UI_OVERHAUL/CONTRACTS.md before writing code.

PROJECT RULES. These override any instinct you have:

1. Never add icons, emojis, unicode symbols, or decorative glyphs. Not in code, not in UI text,
   not in comments, not in your report. Plain ASCII text only.
2. Visual invariant lock. Lighting values, sun horizon offsets, track arrays, colour constants and
   material settings are protected. This package builds a menu; it does not tune values. Every
   default a control displays must be read from globalConfigManager at runtime. Never hard code a
   value into a schema.
3. Do not add npm dependencies. Do not change package.json, vite.config.ts, or tsconfig.json.
4. Nothing under src/world/, src/core/, src/player/ or src/audio/ may be modified. If your brief
   names an exception, that exception is the only one you get.
5. Do not change any interface in GAME_PLAN/UI_OVERHAUL/CONTRACTS.md. If your task appears to need
   a field or a method that does not exist, STOP and report the gap. Do not invent a setter and do
   not write to config directly to work around a missing one.
6. Only edit the files named under "Modify", "Create" and "Delete" in your brief.
7. The world must render identically when the editor is closed.

WORKFLOW FOR EVERY TASK:
- Read every file listed under "Read first" before editing anything.
- Make the change.
- Run: npm run lint                                          (must exit 0)
- Run: node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs    (see your brief for the expected number)
- Run the verification steps in your task, in a browser, with npm run dev running.
- Report: what you changed, the lint result, the audit number, the verification observations, and
  anything you could not do.

DO NOT report a task complete because the code compiles. Every control you touch must be OBSERVED
working in the browser. The defect that caused this rebuild was 59 controls that compiled, ran, and
did nothing. A described observation per control is the deliverable, not a green build.
```

---

## B. Phase 0 - Archive and baseline

### T0.1 - Archive the old UI before anything is deleted

Depends on: nothing. **No other task may start until this one is accepted.**

Read first: `GAME_PLAN/UI_OVERHAUL/README.md` section 0.

Create: `GAME_PLAN/UI_OVERHAUL/_ARCHIVE/`, `GAME_PLAN/UI_OVERHAUL/BEHAVIOUR_INVENTORY.md`,
`GAME_PLAN/UI_OVERHAUL/baseline/`.

Modify: nothing.

Forbidden: everything under `src/`, `index.html`.

Do:
`src/` has never been committed to git. It is not ignored, it was simply never added, so a deleted
file is gone permanently with no recovery. Before any other task runs, preserve the current UI:

1. Copy these files, byte for byte, into `GAME_PLAN/UI_OVERHAUL/_ARCHIVE/`:
   `index.html`, `src/ui/devEditor.ts`, `src/ui/topViewController.ts`, `src/ui/ui.ts`,
   `src/ui/deviceSimulator.ts`, `src/main.ts`, `src/core/saved_biome_config.json`.
   Do not reformat them. They are reference material for later tasks.
2. Recommend to the owner, in your report, that they run `git add -A && git commit` on the
   repository. Do not run it yourself.

Then write `BEHAVIOUR_INVENTORY.md`: every behaviour the current UI provides, one line each, as a
checklist. Walk the running game and the four archived files. This is the list Phase 7 checks
against, and it is the only protection against silently dropping a feature during the rebuild.
Cover at minimum: the top bar (pause, three time phases, ten avatar models, seven biome
destinations, FPS readout), fullscreen, the settings dropdown contents, the six editor tabs, the
blueprint view toolbar and drawer, photo mode, the debug panel toggles, the placement HUD, and the
touch controls.

Finally capture, with `npm run dev` running, at 1280x800 into `baseline/`:
`world_day.png` (Candyland, day, no UI open), `world_twilight.png`, `dev_castles.png`,
`top_view.png`. Also save the output of `npm run lint` and of the id audit.

Accept when: the archive contains all seven files and they are byte identical to the originals;
`BEHAVIOUR_INVENTORY.md` has at least 40 checklist lines; the four PNGs are rendered frames; and
the report states the starting audit number (expected 59) and lint result (expected exit 0).

Verify: `node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs`

---

## C. Phase 1 - Contracts

### T1.1 - Write the frozen contracts

Depends on: T0.1.

Read first: `GAME_PLAN/UI_OVERHAUL/CONTRACTS.md`, `src/core/config.ts`, `src/world/noise.ts`.

Create: `src/ui/panel/types.ts`, `src/ui/castleEditorState.ts`.

Modify: nothing.

Forbidden: everything else.

Do:
Copy CONTRACTS.md section 1 into `src/ui/panel/types.ts` verbatim, including the comments. Do not
add fields. Do not improve the types.

Implement `src/ui/castleEditorState.ts` against CONTRACTS.md section 4. Plain module level state
plus a listener array, about 45 lines. Requirements:

- `select(id)` returns without notifying when the id is unchanged.
- `notify()` iterates a copy of the listener array, so a listener that unsubscribes during
  notification cannot corrupt the iteration.
- `subscribe()` returns an unsubscribe function.
- No imports from any UI file and none from Three.js. This module knows nothing about rendering.

Nothing imports these files yet. That is expected.

Accept when: both files exist, `npm run lint` exits 0, `types.ts` matches CONTRACTS.md section 1
exactly.

Verify: `npm run lint`

---

## D. Phase 2 - The clean break

### T2.1 - New index.html, old UI deleted, game boots

This is the largest single task in the package. It is deliberately one task rather than a
migration, because a partial state where two editors coexist is what made the old build
unmaintainable. After this task the game runs and flies with a working top bar and no editor.

Depends on: T1.1.

Read first: `index.html` in full, `src/main.ts`, `src/ui/ui.ts` lines 60-245 (top bar) and 402-470
(photo mode), `src/player/controls.ts` lines 50-135, `GAME_PLAN/UI_OVERHAUL/README.md` section 4,
`GAME_PLAN/UI_OVERHAUL/BEHAVIOUR_INVENTORY.md`.

Create: `src/ui/hud.ts`, `src/ui/photoMode.ts`, `src/ui/settingsWindow.ts`, `src/ui/hud.css`.

Delete: `src/ui/devEditor.ts`, `src/ui/topViewController.ts`, `src/ui/ui.ts`,
`src/ui/deviceSimulator.ts`.

Modify: `index.html` (replaced wholesale), `src/main.ts`.

Forbidden: everything under `src/world/`, `src/core/`, `src/player/`, `src/audio/`, and
`src/ui/thumbnailGenerator.ts`.

Do:

**Step 1 - new index.html.** Replace it with roughly 120 lines. It contains only:

    <div id="app"></div>                  renderer mount, required by main.ts:19
    <div id="hud-root"></div>             top bar, built by hud.ts
    <div id="settings-root"></div>        decoy window, built by settingsWindow.ts
    <div id="editor-root"></div>          developer editor, filled in T3.1
    <div id="blueprint-root"></div>       blueprint HUD, filled in T5.1
    <div id="touch-controls"> ... </div>  copied verbatim, see below
    <script type="module" src="/src/main.ts"></script>

The touch controls block and its CSS are **copied verbatim from the archived index.html**. Do not
rewrite them. `controls.ts` toggles `.resting` and `.active` on `#joystick-base` and `.active` on
`#boost-btn`, and adds `is-touch-device` to `document.body`; the stylesheet is what makes those
states visible, so it is behavioural, not decorative. The required ids are `#touch-controls`,
`#joystick-zone`, `#joystick-base`, `#joystick-knob`, `#boost-btn`.

All other CSS moves out of index.html into `src/ui/hud.css`, imported from `hud.ts`. The only
inline `<style>` that survives is the touch control block plus a minimal reset and the canvas
sizing.

**Step 2 - hud.ts.** Build the top bar in TypeScript, no markup in index.html. It provides, from
the behaviour inventory: pause and resume, the three time phase buttons, the avatar dropdown over
`FLIGHT_MODELS`, the biome dropdown over `BIOME_LOCATIONS` (read the list at runtime, never hard
code seven), the FPS readout, the fullscreen toggle, and the cogwheel that opens the decoy window.
Port the behaviour from the archived `ui.ts:60-245`; do not port its structure.

**Step 3 - photoMode.ts.** Port `ui.ts:402-470` as a standalone module: enable OrbitControls, hide
the HUD, capture a clean frame to `Wanderlust_Screenshot.png`, restore camera FOV and position on
exit. Behaviour identical, no changes.

**Step 4 - settingsWindow.ts.** Implement CONTRACTS.md section 5. A small centred window titled
`Settings`, a Close button, the five inert rows from `SETTINGS_DECOY.rows` rendered as label plus
fixed value with no inputs, and, when `showDeveloperEntry` is true, a single `Developer Options`
button at the bottom that calls the callback. Nothing else may be interactive. No sliders, no
toggles, no palettes. If a row looks like it should do something, it still must not. That is the
point.

**Step 5 - main.ts.** Remove the `DeviceSimulator` import (line 14), its construction (line 57),
and its key in `window.__game` (line 58). Replace the `UIManager` construction with the new `hud`,
`photoMode` and `settingsWindow`. The animation loop reads `ui.devEditor?.topViewController` at
lines **97, 101, 112 and 115**; all four now resolve to a blueprint controller that does not exist
yet, so stub them behind a single nullable module level reference that T5.1 fills in. Missing one
of the four is the likeliest way to break the camera later.

`Developer Options` and F2 both open the editor. Until T3.1 lands, wire both to a `console.info`
placeholder rather than leaving them dead, and say so in your report.

Accept when: the game boots with no console errors; flight, boost and the touch joystick all work;
all three time phases work; every avatar and every biome in the dropdowns works; FPS updates;
fullscreen works; photo mode captures a PNG and exits cleanly; the cogwheel opens a window whose
only working control is `Developer Options`; `index.html` is under 150 lines; and the four deleted
files are gone from `src/ui/`.

Verify: `npm run lint` exits 0. `npm run build` succeeds.
`node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs` must now report **0 dangling references**.
Compare a fresh Candyland day screenshot against `baseline/world_day.png`; the world must be
identical.

---

## E. Phase 3 - Panel runtime

### T3.1 - Schema renderer, editor shell, save footer

Depends on: T2.1.

Read first: `src/ui/panel/types.ts`, `GAME_PLAN/UI_OVERHAUL/CONTRACTS.md` sections 2, 3 and 8,
`_ARCHIVE/index.html` lines 520-760 (the old `.dev-*` CSS, which is the visual reference),
`src/core/config.ts` lines 715-880, `src/ui/thumbnailGenerator.ts`, `vite.config.ts`.

Create: `src/ui/panel/render.ts`, `src/ui/panel/panel.css`, `src/ui/panel/shell.ts`,
`src/ui/editorFooter.ts`.

Modify: `src/main.ts` (mount the shell, wire F2 and `Developer Options`).

Forbidden: everything under `src/world/`, `src/core/`, `src/player/`, `src/audio/`, `index.html`.

Do:

**renderPanel and requireEl**, per CONTRACTS.md section 2. About 350 lines. Plain DOM, no
framework. Use `textContent`, never `innerHTML`, for anything carrying model names or user uploaded
filenames.

Behaviour the rest of the package depends on:

- `refresh()` updates existing elements in place. It must not recreate a `slider` input, because
  recreating one mid drag drops pointer capture and the slider stops following the cursor. This is
  the most common way a hand written panel feels broken. Test it explicitly.
- A `slider` fires `set` on `input` and `commit` on `change`.
- `cardGrid` may rebuild its children on refresh because `items()` can change length. Render a
  placeholder rectangle first and swap the src when the thumbnail promise resolves.
- `visible()` false hides with `display: none`; it does not unmount.
- `disabled()` true sets `disabled` on inputs and adds `.is-disabled` to the row.
- `section` renders a card with an uppercase title and an optional right aligned tag.

**Development self check.** When `import.meta.env.DEV`, wrap the first call of every `get()`,
`visible()` and `disabled()` in try/catch and `console.error` the control label plus the error.
Expose `window.__panelAudit()` returning `{ label, error }[]` for every accessor that throws across
every live panel. This is how later tasks prove a control is wired.

**panel.css** for the classes the renderer emits. Match the archived editor look: `#0b0f19` body,
`rgba(30,41,59,0.55)` section cards, `#6366f1` active accent, 10px to 11px type. This is a port of
the appearance, not a redesign.

**shell.ts**, per CONTRACTS.md section 3. Header, biome strip, tab bar, scrolling body, fixed
footer. Only the body scrolls. Register four tabs whose `build()` returns a single placeholder
readout: `vegetation`, `objects`, `castles`, `world`.

**editorFooter.ts**, visible on every tab:

- `Save this biome` - `globalConfigManager.saveBiomeDefault(activeBiomeId)`
- `Save all biomes` - `globalConfigManager.saveGlobalDefaults()`
- `SAVE PERMANENTLY TO DISK` - `await globalConfigManager.saveConfigToDisk()`, tone `success`
- `Reset` - `globalConfigManager.resetBiomeDefaults(activeBiomeId)`, tone `danger`, confirm guarded

Disk save returns `{ success, message }`. Show it through `shell.status()`, as an error when
`success` is false. That path fires when the game runs from a built bundle instead of the dev
server, because the endpoint only exists in `configureServer`. The message must read as an
explanation, not a crash.

Finally, point F2 and `Developer Options` at `shell.toggle()` and `shell.open()`.

Accept when: F2 opens a panel with a header, a biome strip built from `BIOME_LOCATIONS`, four tab
buttons that fit on one row at 1280 wide with no horizontal scrolling, a scrolling body, and a
footer that stays visible while the body scrolls. `SAVE PERMANENTLY TO DISK` updates the mtime of
`src/core/saved_biome_config.json` and shows the success message. A scratch schema exercising all
13 control kinds renders correctly; include it in your report, do not commit it.

Verify: `npm run lint`; audit still 0; drag a slider while `refresh()` runs on a 16 ms interval and
confirm the drag is not interrupted.

---

## F. Phase 4 - The three straightforward tabs

T4.1, T4.2 and T4.3 may run in parallel. They touch different files.

### T4.1 - VEGETATION tab

This is the tab the whole rebuild exists for. Read README section 2.3 first.

Depends on: T3.1.

Read first: `src/world/trees.ts` (public API from line 1293, `TREE_CATALOG` at 634,
`BIOME_VEG_PRESETS` at 27), `src/core/config.ts` (`VegetationBiomeSettings`,
`ModelVegetationConfig`, `BloomSettings`), `src/core/renderer.ts` lines 79-124,
`src/world/props.ts` lines 103-140, `src/world/terrain.ts` lines 554-560,
`_ARCHIVE/devEditor.ts` lines 329-560 and 1180-1330 (reference for behaviour only),
`GAME_PLAN/UI_OVERHAUL/CONTRACTS.md` sections 7 and 8.

Create: `src/ui/tabs/vegetationTab.ts`.

Modify: `src/ui/panel/shell.ts` (register the tab only), `src/world/trees.ts` (delete five dead
methods - this is the one permitted world layer exception in the whole package).

Forbidden: every other file under `src/world/`, and all of `src/core/`, `src/player/`,
`src/audio/`, `index.html`.

Do:
Build the schema in the exact order in README section 2.3. Use only the read and write pairs in
CONTRACTS.md section 7. Follow the worked example in CONTRACTS.md section 8 for file shape.

CATALOG: `search` filtering by name, case insensitive; `segmented` category filter (all, trees,
flowers) derived from the existing `TreeCatalogItem.category`, do not add a field; `buttonRow` of
Select all and Unselect all operating on the **currently filtered** list, respecting both the
category filter and the search box - the old build respected the category but ignored the search
(`_ARCHIVE/devEditor.ts:1096-1108`), so typing a filter and pressing Select all enabled models the
user could not see; a `cardGrid` whose `onToggle` calls `trees.setBiomeTreeModelSelected` and whose
`state()` returns `ON` or `OFF`; and a `custom` control hosting the .glb upload input calling
`trees.loadCustomTreeModel`.

SELECTED MODEL, `visible: () => inspectedId !== null`: scale, density, colour mode segmented, and
the three swatch lists. Scale and density use `numeric: true` and must **not** declare a `commit`
hook: `setModelScale` and `setModelDensity` already call `forceRebuild()` (trees.ts:1302-1312) and
`forceRebuild` is debounced onto one animation frame (trees.ts:1506-1518). A commit rebuild would
rebuild the instanced meshes twice per drag.

GROUND COVER: bush scale, bush density.

GLOW AND BLOOM: the six controls in README section 2.3. Nothing is being ported here; this section
has no equivalent in the old build. Ranges, all clamped by the existing setters: foliage glow 0 to
1 shown as a percentage; bloom strength 0 to 3; bloom radius 0 to 1; bloom threshold 0 to 1; cloud
bloom 0 to 3; shoreline bloom 0 to 3.

The per model bioluminescence slider does not appear in SELECTED MODEL. It appears once here,
labelled `Foliage glow (whole biome)`, because it writes a biome wide uniform.

Finally delete from `src/world/trees.ts` lines 1470-1489: `setTreeBloomIntensity`,
`setCanopyGlowMultiplier`, `setTrunkGlowMultiplier`, `setBushBloomIntensity`,
`setBushGlowMultiplier`. Grep the whole repository for each name first. If a caller remains, do not
delete it, report instead. Do not touch `setBioluminescence` or `setBiomeBloomAndGlow`.

Accept when, observed in the browser across at least two biomes:
- Toggling a card ON makes that model appear in the world and OFF removes it
- Scale and density visibly change the model; the number box accepts typed values
- Switching to custom colours and editing a canopy swatch recolours the trees
- All six GLOW AND BLOOM sliders produce a visible change on screen
- `Save this biome`, reload the page, and every value above is still set
- `window.__panelAudit()` returns an empty array with this tab open

Verify: `npm run lint`; audit still 0; the observations above, one line each, in your report.

### T4.2 - OBJECTS tab

Depends on: T3.1.

Read first: `src/world/worldProps.ts` (full public API), `_ARCHIVE/devEditor.ts` lines 590-790 and
1340-1520, `_ARCHIVE/index.html` lines 1675-1792.

Create: `src/ui/tabs/objectsTab.ts`.

Modify: `src/ui/panel/shell.ts` (register the tab only).

Forbidden: everything under `src/world/`, `src/core/`, `src/player/`, `src/audio/`, `index.html`.

Do:
Rebuild the world props editor. No feature changes from the archived behaviour. Sections:

PLACE: search, category segmented (all, castles, ships), a `cardGrid` whose `onSelect` calls
`worldProps.startPlacement(id)`, a `custom` upload input calling `loadCustomPropModel`.

PLACED OBJECTS: a `custom` control rendering the list with a per row delete, plus Clear all behind
a confirm guard.

SELECTED OBJECT, `visible: () => worldProps.getSelectedProp() !== null`: Move with mouse; the eight
nudge buttons; scale and ground offset sliders with `numeric: true`; snap to ground; snap to water;
yaw slider; Focus, Duplicate, Delete.

The placement status bar (`#dev-placement-hud` in the archive) no longer exists in index.html.
Build it from this module as a `custom` control appended to `document.body`, shown only while
`worldProps.isPlacing` is true, and remove it in the tab's destroy path.

Keyboard nudging (arrow keys, PgUp, PgDn, bracket keys) lived in the archived devEditor. Port it
here, scoped so it only listens while the OBJECTS tab is active and a prop is selected.

Accept when, observed in the browser: placing a structure puts it on the terrain under the cursor;
every nudge button moves the selected object; keyboard nudging works and does not fire while
another tab is active; snap to ground and snap to water land correctly; delete removes it; and
after `SAVE PERMANENTLY TO DISK` plus a reload the placed object is still there.

Verify: `npm run lint`; audit still 0.

### T4.3 - WORLD tab

Depends on: T3.1.

Read first: `src/world/terrain.ts` (`TERRAIN_PALETTES` and public setters), `src/world/water.ts`,
`src/world/lighting.ts`, `src/core/config.ts` (`EnvPhaseConfig`, `TerrainColorsSettings`,
`WaterSettings`), `_ARCHIVE/devEditor.ts` lines 1330-1800, `_ARCHIVE/ui.ts` lines 471-706 (the
debug panel), `src/ui/photoMode.ts`, `src/audio/audio.ts`.

Create: `src/ui/tabs/worldTab.ts`.

Modify: `src/ui/panel/shell.ts` (register the tab only).

Forbidden: everything under `src/world/`, `src/core/`, `src/player/`, `src/audio/`, `index.html`.

Do:
One tab, five sections, merging what the old build split across two tabs and a floating debug
panel:

- TERRAIN: palette preset buttons, five colour pickers, terrain style segmented (toon, standard,
  crystal), then the eight crystal sliders with `visible: () => style === 'crystal'`. The old build
  showed those eight in every style, which is why the tab looked cluttered where they did nothing.
- WATER: colour, opacity, reflectivity, roughness, metalness, clearcoat, clearcoat roughness,
  shader mode toggle.
- SKY AND LIGHT: phase segmented (day, dusk, twilight), then every `EnvPhaseConfig` field for the
  selected phase. Changing the phase must also call `lighting.setTimePhase` so the editor and the
  world agree, and must update the top bar time selector. That coupling existed at `_ARCHIVE/ui.ts:104`
  and must be preserved; expose it as a callback rather than importing hud.ts, to avoid a cycle.
- PERFORMANCE: terrain resolution, prop culling, DPI cap, shadow map size, water shader, and the
  master "Enable all" button. Ported from the archived debug panel.
- SESSION TOOLS: music toggle, next track, photo mode, export JSON, import JSON.

Accept when, observed in the browser: every colour picker changes the world immediately; the
crystal sliders appear only in crystal style; changing the light phase changes the world, the
fields below it, and the top bar selector; each performance toggle changes the FPS readout or the
visible resolution; export downloads a JSON file that import accepts back.

Verify: `npm run lint`; audit still 0.

---

## G. Phase 5 - Castles and the blueprint view

### T5.1 - Castles tab and the rewritten blueprint controller

Depends on: T4.1, T4.2 and T4.3 all accepted.

Read first: `src/ui/castleEditorState.ts`, `src/world/skyCastles.ts` (public API from line 685,
`raycastCastles` at 833, `raycastHorizontalPlane` at 852, plus `CASTLE_MODEL_CATALOG` and
`CASTLE_COLOR_PRESETS`), `_ARCHIVE/topViewController.ts` lines 170-360 (the camera logic being
rewritten), `_ARCHIVE/devEditor.ts` lines 785-1005, `src/core/config.ts` (`SkyCastleIslandDef`,
`CastleColorSettings`), README sections 2.4 and 1.4.

Create: `src/ui/tabs/castlesTab.ts`, `src/ui/blueprintView.ts`, `src/ui/blueprint.css`.

Modify: `src/ui/panel/shell.ts` (register the tab), `src/main.ts` (fill in the blueprint controller
reference stubbed in T2.1).

Forbidden: everything under `src/world/`, `src/core/`, `src/player/`, `src/audio/`, `index.html`.

Do:

**Part 1 - the shared schema.** One exported function:

```ts
export function buildCastleControls(ctx: CastleTabContext): ControlDef[];
```

It is called from two places, the CASTLES tab and the blueprint drawer, and must not assume which:

```ts
export interface CastleTabContext {
    skyCastles: SkyCastleSystem;
    /** 'panel' renders every section. 'drawer' renders the compact subset. */
    variant: 'panel' | 'drawer';
    onEnterBlueprint?: () => void;   // panel only
    onExitBlueprint?: () => void;    // drawer only
    status: (message: string, isError?: boolean) => void;
}
```

Selection is `castleEditorState.selectedIslandId`. Never keep a local copy. Every mutation is
followed by `castleEditorState.notify()`.

Sections, in order:

1. ARCHIPELAGO - island `select`, Focus, Lock this island, Lock all, New island, Delete island
   (confirm guarded), and a `readout` of the count. The old build also drew a chips strip; it is
   dropped, because the dropdown and the model grid already carry that information and the chips
   were a third rendering of the same list.
2. CASTLE MODEL - `cardGrid` over `CASTLE_MODEL_CATALOG`, `draggable: true`, `onSelect` awaiting
   `setIslandModel` then notifying.
3. TRANSFORM - X, Y, Z, rotation, island scale, cloud radius, cloud puff count. All
   `numeric: true`, all `disabled: () => island.locked === true`. These are the 21 controls that
   existed in the old code with no markup at all.
4. COLOURS - seven theme preset buttons, Apply to all, then roof, wall, trim and crystal colour
   pickers plus crystal bloom. Nine more that had no markup.
5. CLOUD SEA DECK - enable, altitude, density, colour, emissive. Ten more that had no markup.
   Omitted in the `drawer` variant.
6. LAYOUT - Spatial spread, Wide ring, Reset positions.

Read the bounds for each slider from actual data, not from intuition: check
`src/core/saved_biome_config.json` for the widest values any existing island uses and make sure
every one of them is representable. A range that clamps a saved island is a data loss bug.

In the `drawer` variant render sections 1, 2, 4 and 6 only, with a horizontal layout hint. The
drawer is a strip along the bottom of the blueprint view, not a column.

**Part 2 - blueprintView.ts.** Rewrite the overhead view from scratch, roughly 250 lines. Keep only
what genuinely belongs to it: camera pose save and restore, far plane expansion to 35000, altitude
clamp 50 to 10000, altitude lerp, the grid helper, the selection indicator, cursor to world
raycasting via the existing `skyCastles.raycastHorizontalPlane` and `raycastCastles`, drag to move,
drag and drop to place, keyboard nudge with the 10 / 25 / 50 / 100 step selector, zoom presets 500
/ 1500 / 3500 / 7500, the coordinate readout, and enter and exit.

It must contain **no** island mutation UI. Every island operation comes from the shared schema
rendered into its drawer. Concretely: no second model grid, no second colour theme row, no second
layout preset row, no second save button.

Mount it into `#blueprint-root`. On enter it hides the editor panel and shows the blueprint HUD; on
exit it restores the camera, the fog state and the panel. Subscribe to `castleEditorState` and
refresh the drawer handle; do not add `setOnIslandMoved` style callbacks.

Wire the four `main.ts` call sites stubbed in T2.1 (lines 97, 101, 112, 115 of the original) to
this controller, keeping the null safe access.

Accept when, observed in the browser: every one of the seven TRANSFORM controls moves, rotates or
resizes the selected island; the four colour pickers and crystal bloom recolour it; the fog deck
controls change the cloud sea; locking an island greys out TRANSFORM; selecting an island in the
blueprint drawer changes the selection in the CASTLES tab and the reverse is also true, with no
flicker; dragging a castle across the grid updates the TRANSFORM numbers live; and there is exactly
one castle model grid, one colour theme row and one layout preset row in the entire product.
`window.__panelAudit()` returns an empty array on both surfaces.

Verify: `npm run lint`; audit still 0;
`grep -c "addIsland\|setIslandColors\|applyLayoutPreset" src/ui/blueprintView.ts` returns 0.

---

## H. Phase 6 - Layout

### T6.1 - Fit, scroll and touch

Depends on: T5.1.

Read first: `src/ui/panel/panel.css`, `src/ui/panel/shell.ts`, `src/ui/hud.css`,
README section 1.3.

Create: nothing.

Modify: `src/ui/panel/panel.css`, `src/ui/panel/shell.ts`, `src/ui/hud.css`.

Forbidden: every tab module, `src/ui/blueprintView.ts`, everything outside `src/ui/`.

Do:
The tab bar must not scroll horizontally at any supported width. With four tabs it fits at 1280,
and below 900 the labels shorten rather than overflow. Never hide a scrollbar on a container that
can overflow; that was the bug that made the old sixth tab invisible rather than reachable.

Requirements:
- Panel width `min(560px, calc(100vw - 24px))`. Below 720px wide it becomes a full width bottom
  sheet; the tablet form factor is a first class target for this project.
- Only the body scrolls. Header, biome strip, tabs and footer stay fixed. Verify by scrolling the
  vegetation catalog to the bottom and confirming the save footer is still on screen.
- The biome strip wraps cleanly with the 7 biomes in BIOME_LOCATIONS and stays correct if one is added or removed; do not hard
  code a column count that leaves a ragged row.
- Touch targets in the footer and tab bar are at least 32px tall.
- The editor panel and the blueprint HUD must not overlap; check both z-indexes.

Accept when: at 1280x800, 1024x768, 820x1180 and 375x812 the panel is usable, no tab is clipped, no
horizontal scrollbar appears on the body, and the save footer is reachable in every case. Include a
screenshot at each size.

Verify: browser at the four sizes above.

---

## I. Phase 7 - Acceptance

### T7.1 - Full sweep

Depends on: T6.1.

Read first: `GAME_PLAN/UI_OVERHAUL/BEHAVIOUR_INVENTORY.md`,
`GAME_PLAN/UI_OVERHAUL/baseline/`, README.

Create: `GAME_PLAN/UI_OVERHAUL/ACCEPTANCE.md`.

Modify: nothing. If you find a defect, report it; do not fix it in this task.

Forbidden: everything.

Do:
Walk the checklist below across at least three biomes including `candyland` and `sky_citadel`.
Record pass or fail with one line of evidence each.

Primary requirements, from the original request:
1. Settings opens a window and changes nothing in the world.
2. Every real control is inside the developer editor.
3. Vegetation models can be turned on and off per biome and appear in the world.
4. Vegetation scale and density work, per model and per biome.
5. Vegetation colours can be edited and the change is visible.
6. Bloom and glow can be edited and the change is visible.
7. Settings survive a page reload after `SAVE PERMANENTLY TO DISK`.
8. The castle editor has no duplicated section and no empty section.

Regression checks:
9. Every line of `BEHAVIOUR_INVENTORY.md` is either provided or listed as a deliberate removal with
   a reason. This is the check that catches a feature silently dropped by the rebuild.
10. `node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs` exits 0.
11. `npm run lint` exits 0 and `npm run build` succeeds.
12. `window.__panelAudit()` returns an empty array on all four tabs and the blueprint drawer.
13. With the editor closed the world matches `baseline/world_day.png` and
    `baseline/world_twilight.png`. Flag any visible difference.
14. The archived `saved_biome_config.json` from T0.1 still loads.
15. Flight, boost, the touch joystick, photo mode and the three time phases all work.

Accept when: `ACCEPTANCE.md` exists with all 15 items marked, and every failure carries a file and
line reference so it can become a follow up brief.

Verify: the commands in items 10 and 11.

---

## J. Notes for whoever runs this

- T0.1 is not optional and not a formality. `src/` is untracked; a deletion in T2.1 without the
  archive is unrecoverable.
- Give one brief at a time. The failure mode of this codebase is an agent that changes two things
  and verifies neither.
- The audit number is the honesty check. It reads 59 before T2.1 and must read 0 from T2.1 onward.
  If it is anything other than 0 after the rebuild starts, a task is not complete.
- `window.__panelAudit()` is the second honesty check, and it is the one that catches a control
  that renders but is wired to nothing.
- `BEHAVIOUR_INVENTORY.md` is the third. It is what stops a rebuild from quietly losing features.
- If an agent asks to change a contract, the answer is no. Bring it back to the owner.
