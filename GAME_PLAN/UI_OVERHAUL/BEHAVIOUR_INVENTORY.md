# Behaviour Inventory - Current Menu Layer (pre-rebuild snapshot)

Source: `GAME_PLAN/UI_OVERHAUL/_ARCHIVE/` copies of index.html, ui.ts, devEditor.ts,
topViewController.ts, controls.ts, deviceSimulator.ts, main.ts, thumbnailGenerator.ts.
Cross-referenced against `node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs` (59 dangling ids).

How to read this document:
- Each line names the control, what it visibly does, and the method/state it drives.
- `(BROKEN: reason)` means the TypeScript binds an id that has no markup in index.html, so the
  control currently does nothing. These are NOT to be faithfully reproduced as "does nothing" -
  they are to be rebuilt as INTENDED (the setter they call is real and works if wired to a real
  element).
- `(DUPLICATE)` means the same behaviour is reachable through two different controls today.

---

## 1. Top Bar (#top-bar)

- [ ] Pause/resume flight (#pause-flight-btn) -> toggles `controls.isFlightPaused`; swaps the
      pause/play SVG icons (#pause-icon/#play-icon), updates aria-label/title, toggles `.paused`
      class on the button (ui.ts setupButtons)
- [ ] Day time-of-day button (#time-day-btn) -> `lighting.setTimePhase(0)`; marks itself `.active`
      in the segmented control; if the dev editor is open, syncs `devEditor.activeEnvPhase` and
      calls `devEditor.refreshUI()`
- [ ] Dusk time-of-day button (#time-dusk-btn) -> `lighting.setTimePhase(1)`, same sync behaviour
- [ ] Twilight time-of-day button (#time-twilight-btn) -> `lighting.setTimePhase(2)`, same sync
      behaviour
- [ ] Avatar/model selector (#model-select-btn + #model-dropdown) -> lists all 10 flight models
      (Scarlet Macaw, American Robin, Eastern Wood-Pewee, Blue Morpho Butterfly, Flock of Birds,
      Tropical Parrot, Mitsubishi B2M2, Porco Rosso Seaplane, Princess, Kiki (Low Poly) - from
      `FLIGHT_MODELS` in src/player/FlightModels.ts); clicking an option calls
      `player.setModel(idx)`; closes the biome dropdown and settings menu when it opens; closes
      itself on outside click
- [ ] Biome/destination selector (#biome-select-btn + #biome-dropdown) -> lists all 7
      `BIOME_LOCATIONS` destinations with description subtitles: Candyland (0, 0), Lush Meadow
      (0, 2560), Floating Archipelago (3200, 3200), Geothermal Ridge (3200, -3200), Bioluminescent
      Estuary (-3200, 3200), Colossal Redwood (-3200, -3200), Floating Cloud Citadel (0, -160,
      y=510); clicking an option calls `UIManager.travelToBiome(x, z, y)`, which teleports the
      player, force-updates terrain/trees/props/water/skyCastles at the new position, re-applies
      that biome's bloom and cloud config, and switches lighting; closes on outside click
- [ ] FPS counter (#fps-counter) -> read-only text, refreshed every 200ms in
      `UIManager.updateFPS()` with the rounded current FPS
- [ ] Flight-status readout (reuses #biome-select-btn's own text) -> shows
      `player.currentBiomeName` with " (Skimming)" appended when `player.isSkimmingWater`, or
      " (Updraft)" when `player.isUpdraftLift`; also re-highlights the matching option in the
      biome dropdown every frame

## 2. Top-Right Quick Actions (#top-right-bar)

- [ ] Fullscreen toggle (#fullscreen-toggle) -> `document.documentElement.requestFullscreen()` /
      `document.exitFullscreen()`
- [ ] Cogwheel / settings button (#settings-btn) -> opens/closes #settings-menu; closes the model
      and biome dropdowns first; closes itself on outside click

## 3. Settings Dropdown (#settings-menu, opened from the cogwheel)

- [ ] Developer Editor entry (#dev-menu-toggle) -> closes the settings menu, calls
      `devEditor.open()`
- [ ] Music toggle (#music-toggle) -> `audio.toggleMusic()`; label flips "Music" / "Pause Music";
      reveals the Track button when playing
- [ ] Track button (#track-toggle) -> `audio.nextTrack()`, updates its own label to the new track
      name; stays hidden until music is playing
- [ ] Debug toggle (#debug-toggle) -> toggles `UIManager.isDebugOpen`, shows/hides #debug-panel,
      label flips "Debug: ON" / "Debug: OFF"
- [ ] Photo Mode entry (#photo-toggle) -> see section 13, Photo Mode
- [ ] Terrain Shading Style toggle (#terrain-shading-toggle) -> 2-way toggle,
      `terrain.setToonMode(!terrain.isToonMode)`; label "Style: Painterly Ghibli" / "Style: Modern
      Soft PBR" (NOTE: this reads/writes `terrain.isToonMode` directly, while the Terrain & Water
      tab's own toggle - see section 9 - cycles a 3-way `terrainStyle` field (toon/standard/
      crystal) via a different setter. The two controls can disagree; this is the "second,
      desynchronised editor" problem the README calls out for ui.ts)
- [ ] Color Palette preset pills (#preset-candy/-cotton/-lollipop/-mints/-berry) ->
      `trees.setPreset(presetKey)`, applying one of the `BIOME_VEG_PRESETS`; marks the clicked
      pill `.active`
- [ ] Bioluminescence / Foliage Glow slider (#bioluminescence-slider) ->
      `trees.setBioluminescence(v/100)` for the whole active biome; kept in sync live with the
      dev editor's own biolum slider (#dev-model-biolum) and the debug panel's biolum slider
      (#tree-biolum-debug-slider) - a three-way mirrored value (DUPLICATE)
- [ ] Tree Scale slider (#tree-scale-slider) -> `trees.setScale(val)`
- [ ] Tree Density slider (#tree-density-slider) -> `trees.setDensity(val)`
- [ ] Bush Scale slider (#bush-scale-slider) -> `trees.setBushScale(val)`
- [ ] Bush Density slider (#bush-density-slider) -> `trees.setBushDensity(val)`

## 4. Developer Editor - Shell (#dev-editor-panel)

- [ ] F2 keyboard shortcut -> `DevEditor.toggle()`, opens/closes the whole editor panel from
      anywhere (devEditor.ts bindKeyboardShortcut)
- [ ] Toggle button (#dev-editor-toggle) (BROKEN: bound in three places - devEditor.ts:84, 105,
      1010 - to add/remove an `.active` class and call `toggle()`, but no element with this id
      exists anywhere in index.html. The only ways to actually open the editor today are F2 and
      the Settings > Developer Editor menu item)
- [ ] Close button (#dev-editor-close) -> `devEditor.close()`
- [ ] Teleport button (#dev-biome-tp-btn) -> `devEditor.teleportToActiveBiome()`, teleports the
      player to the active biome's `BIOME_LOCATIONS` coordinates
- [ ] Biome selector strip (.dev-biome-btn x7: Candyland, Meadow, Archipelago, Geothermal,
      Estuary, Redwood, Sky Citadel) -> `devEditor.selectBiome(id)`; switches the editor's active
      biome context, teleports the player there, and re-applies bloom/cloud/lighting/water for
      that biome
- [ ] Six top tab buttons (.dev-tab-btn: Models & Flora, World Props, Sky Castles, Sky & Light,
      Terrain & Water, Profile & Export) -> `devEditor.switchTab(tabId)` toggles the matching
      `.dev-tab-pane` visible

## 5. Developer Editor - Tab 1: Models & Flora (#tab-models)

- [ ] Model search box (#dev-tree-search) -> filters the catalog grid by name / category /
      description substring
- [ ] Select All button (#dev-select-all-trees-btn) -> adds every model in the current category
      filter to the biome's `selectedTreeModelIds`
- [ ] Unselect All button (#dev-clear-trees-btn) -> `trees.setBiomeTreeModels(biome, [])`
- [ ] Category filter pills (All / Trees / Flowers, .dev-tree-cat-btn) -> filters
      #dev-tree-models-grid (NOTE: the "(23)"/"(16)"/"(7)" counts printed on the pills are
      hand-authored static text in index.html, not computed live from `TREE_CATALOG.length`, so
      they can go stale if the catalog changes size)
- [ ] Model catalog grid (#dev-tree-models-grid) -> renders one card per `TREE_CATALOG` entry with
      thumbnail/name/category/[ON]/[OFF]; clicking the card body selects it for inspection;
      clicking [ON]/[OFF] calls `trees.toggleBiomeTreeModel(biome, id)`
- [ ] Upload Custom .GLB button (#dev-upload-tree-btn + hidden #dev-tree-file-input) ->
      `trees.loadCustomTreeModel(filename, buffer, 1.0)`, then auto-selects the new model for
      inspection
- [ ] Model inspector active toggle (#dev-inspector-toggle-btn) ->
      `trees.toggleBiomeTreeModel(biome, inspectedModelId)`
- [ ] Model Scale slider + number box (#dev-model-scale / #dev-model-scale-num) ->
      `trees.setModelScale(biome, modelId, v)`
- [ ] Model Density slider + number box (#dev-model-density / #dev-model-density-num) ->
      `trees.setModelDensity(biome, modelId, v)`
- [ ] Model Bioluminescence slider + number box (#dev-model-biolum / #dev-model-biolum-num) ->
      `trees.setBioluminescence(v/100, biome)` (NOTE: this control is drawn inside the
      per-model inspector card, implying it is per-model, but it actually writes one uniform for
      the whole active biome - see README 2.3 "Related trap". Any model's slider changes every
      other model's glow too)
- [ ] Color Mode buttons (#dev-model-orig-btn / #dev-model-custom-btn) ->
      `trees.setModelColorMode(biome, modelId, useOriginalColors: boolean)`
- [ ] Canopy / Leaf / Trunk color swatches (#dev-model-canopy-swatches, #dev-model-leaf-swatches,
      #dev-model-trunk-swatches) -> each swatch is a hidden `<input type=color>`; on input calls
      `trees.setModelCanopyColors` / `setModelLeafColors` / `setModelTrunkColors`; the three
      section labels relabel themselves for flower ("Blossom/Leaf/Stem"), castle
      ("Roof/Trim/Wall"), and ship ("Sails/Cabin/Hull") items
- [ ] Global Bush Scale slider (#dev-veg-bush-scale) -> `trees.setBiomeBushScale(biome, v)`
- [ ] Global Bush Density slider (#dev-veg-bush-density) -> `trees.setBiomeBushDensity(biome, v)`

## 6. Developer Editor - Tab 2: World Props (#tab-props)

- [ ] Prop search box (#dev-prop-search) -> filters `WORLD_PROP_CATALOG` grid by name/category
- [ ] Category filter pills (All / Castles & Towers / Ships & Vessels, .dev-prop-cat-btn) ->
      filters #dev-prop-catalog-grid
- [ ] Prop catalog grid + "[ PLACE IN WORLD ]" per-card button -> `worldProps.startPlacement(id)`,
      shows the Placement HUD (section 15), then a click in the 3D viewport confirms placement
      (global pointerdown handler in devEditor.ts)
- [ ] Upload Custom .GLB Structure (#dev-upload-prop-btn + hidden #dev-prop-file-input) ->
      `worldProps.loadCustomPropModel(filename, buffer)`, immediately starts placement mode for it
- [ ] Placed objects list (#dev-placed-props-list) -> lists every placed prop with rounded X/Y/Z;
      clicking a row calls `worldProps.selectProp(id)`; its "[ DEL ]" button calls
      `worldProps.deleteProp(id)`
- [ ] Clear All Placed Objects button (#dev-clear-props-btn) -> `confirm()` then
      `worldProps.clearAllProps()`
- [ ] Move with Mouse button (#dev-prop-move-btn) -> `worldProps.startMoving(selected.id)`, next
      click in the viewport relocates it
- [ ] On-screen nudge D-pad: +Z/-Z/-X/+X, Elev+/Elev-, Scale-/Scale+ (#dev-prop-nudge-n/-s/-w/-e,
      #dev-prop-nudge-up/-dn, #dev-prop-scale-dn/-up) -> `devEditor.nudgeSelectedProp` /
      `nudgeSelectedPropElevation` / `nudgeSelectedPropScale` (same functions the Arrow/PageUp/
      PageDown/[/] keyboard shortcuts drive - see section 17)
- [ ] Object Scale slider + number box (#dev-prop-scale / #dev-prop-scale-num) ->
      `worldProps.setPropScale(id, v)`
- [ ] Ground Elevation Offset slider + number box (#dev-prop-offset / #dev-prop-offset-num) ->
      `worldProps.setPropGroundOffset(id, v)`
- [ ] Snap to Ground / Snap to Water Level buttons (#dev-prop-snap-ground-btn /
      #dev-prop-snap-water-btn) -> `worldProps.snapToGround(id)` / `snapToWater(id)`
- [ ] Heading/Rotation slider (#dev-prop-yaw) -> `worldProps.setPropRotation(id, degrees)`
- [ ] Focus / Duplicate / Delete Object buttons (#dev-prop-tp-btn / #dev-prop-dup-btn /
      #dev-prop-del-btn) -> teleport player camera to the prop / `worldProps.duplicateProp(id)` /
      `worldProps.deleteProp(id)`

## 7. Developer Editor - Tab 3: Sky Castles (#tab-castles) - shared state with the Blueprint view

- [ ] Top-Down Blueprint button (#dev-castle-top-view-btn) ->
      `topViewController.toggleTopView()` (DUPLICATE of #top-view-exit-btn in the blueprint HUD,
      which does the reverse)
- [ ] Lock All / Unlock All button (#dev-castle-lock-all-btn) ->
      `skyCastles.lockAllIslands(!allLocked)`
- [ ] Island visual chips strip (#dev-castle-island-chips) -> one chip per island; click selects
      it; shows a "[LOCK]" tag when that island is locked
- [ ] Island select dropdown (#dev-castle-island-select) -> selects the island under edit
      (DUPLICATE of #top-insp-island-select in the blueprint HUD)
- [ ] Focus button (#dev-castle-tp-btn) -> teleports the player (or, if blueprint view is active,
      the blueprint camera via `topViewController.focusOnCoordinates`) to the selected island
- [ ] "Lock: Off"/"Locked: On" button (#dev-castle-lock-item-btn) ->
      `skyCastles.setIslandLocked(id, !locked)` for just the selected island (DUPLICATE of
      #top-insp-lock-btn)
- [ ] top-view-lock-toggle-btn (BROKEN: bound in devEditor.ts:2010 to the same
      `setIslandLocked` toggle as the item above, but no markup with this id exists anywhere -
      it is dead code shadowing the two working lock buttons)
- [ ] + New Island button (#dev-castle-add-btn) -> `skyCastles.addIsland()` (DUPLICATE of
      #top-insp-add-btn)
- [ ] Delete button (#dev-castle-del-btn) -> `confirm()` then `skyCastles.removeIsland(id)`
      (DUPLICATE of #top-insp-del-btn)
- [ ] Spatial Spread / Wide Ring / Reset Positions buttons (#dev-castle-preset-spacious /
      #dev-castle-preset-ring / #dev-castle-reset-layout) -> `skyCastles.applyLayoutPreset
      ('spacious'|'ring')` / `resetToDefaults()` (DUPLICATE of #top-view-preset-spacious /
      -ring / -reset in the blueprint drawer)
- [ ] Castle model grid (#dev-castle-model-grid) -> click, or drag-and-drop, a
      `CASTLE_MODEL_CATALOG` thumbnail to call `skyCastles.setIslandModel(id, path)`; dropping
      onto the 3D world (outside the panel) instead creates a brand-new island there (DUPLICATE
      of #top-insp-model-grid in the blueprint drawer)
- [ ] Color theme preset pills: Original/Ruby/Sapphire/Amethyst/Golden/Emerald/Pastel
      (.dev-castle-color-preset-btn) -> `skyCastles.setIslandColors(id,
      CASTLE_COLOR_PRESETS[key])` (DUPLICATE of .top-insp-color-btn in the blueprint drawer,
      which is missing the "Amethyst" option)
- [ ] Apply to All button (#dev-castle-apply-all-colors-btn) -> copies the selected island's
      current colour object onto every island in the biome
- [ ] Save Permanently to Disk button (#dev-save-castles-disk-btn) -> `skyCastles.saveToConfig()`
      then `globalConfigManager.saveConfigToDisk()` (POST /api/save-config-to-disk, dev-server
      only) (DUPLICATE of #top-view-save-disk-btn)
- [ ] Save Browser Cache button (#dev-save-castles-btn) -> `skyCastles.saveToConfig()` only, no
      disk write
- [ ] Copy Config JSON button (#dev-copy-castles-json-btn) ->
      `navigator.clipboard.writeText(globalConfigManager.exportJSON())`
- [ ] Position X slider + number box (#dev-castle-x / #dev-castle-x-num) (BROKEN: bound in
      devEditor.ts:903-905 and 1881, no markup exists. Partially reachable today only as a side
      effect of dragging the island on the blueprint grid or using the D-pad / Arrow keys, never
      as an exact numeric entry)
- [ ] Position Z slider + number box (#dev-castle-z / #dev-castle-z-num) (BROKEN: same as X,
      devEditor.ts:911-913 and 1881; partially reachable via drag/D-pad/Arrow keys only)
- [ ] Position Y / altitude slider + number box (#dev-castle-y / #dev-castle-y-num) (BROKEN:
      devEditor.ts:907-909 and 1882; no markup, and unlike X/Z there is NO other control anywhere
      in the UI that changes island altitude - it is completely unreachable today)
- [ ] Rotation slider + number box (#dev-castle-rot / #dev-castle-rot-num) (BROKEN:
      devEditor.ts:915-918 and 1884; no markup. Approximated only by the blueprint's Rot -15/+15
      buttons or Q/E hotkeys, which nudge in fixed 15 degree steps rather than setting an exact
      value)
- [ ] Island Scale slider + number box (#dev-castle-scale / #dev-castle-scale-num) (BROKEN:
      devEditor.ts:920-922 and 1885; no markup and no equivalent control exists anywhere else -
      island scale is completely unreachable today)
- [ ] Cloud Radius slider + number box (#dev-castle-cldrad / #dev-castle-cldrad-num) (BROKEN:
      devEditor.ts:924-926 and 1886; no markup, unreachable)
- [ ] Cloud Puff Count slider + number box (#dev-castle-puffs / #dev-castle-puffs-num) (BROKEN:
      devEditor.ts:928-930 and 1887; no markup, unreachable)
- [ ] Lock status badge (#dev-castle-lock-badge) (BROKEN: devEditor.ts:934-939; no markup.
      DUPLICATE-of-intent is #top-insp-lock-badge in the blueprint HUD, which does work and shows
      the same LOCKED/UNLOCKED state)
- [ ] Roof / Wall / Trim / Crystal color pickers + hex labels (#dev-castle-roof, -wall, -trim,
      -crystal, each with a matching -hex label) (BROKEN: devEditor.ts:985-988 and 1911-1914; none
      of the 8 ids have markup. Manual per-colour editing of a castle is unreachable today - only
      the whole-theme presets above work)
- [ ] Crystal Bloom slider (#dev-castle-crystal-bloom / #dev-castle-crystal-bloom-val) (BROKEN:
      devEditor.ts:989 and 1916-1931; no markup, unreachable)
- [ ] Cloud Sea Deck enable/disable toggle (#dev-layer-fog-toggle) (BROKEN:
      devEditor.ts:992-995 and 2108-2118; no markup; `skyCastles.setLayerFogEnabled` is unreachable)
- [ ] Cloud Sea Deck altitude slider + number box (#dev-layer-fog-alt / #dev-layer-fog-alt-num)
      (BROKEN: devEditor.ts:997-999 and 2120-2133; no markup; `setLayerFogAltitude` unreachable)
- [ ] Cloud Sea Deck density slider (#dev-layer-fog-density) (BROKEN: devEditor.ts:1001 and
      2135-2143; no markup; `setLayerFogDensity` unreachable)
- [ ] Cloud Sea Deck base color picker (#dev-layer-fog-color / #dev-layer-fog-color-hex) (BROKEN:
      devEditor.ts:2145-2152; no markup; `setLayerFogColor` unreachable)
- [ ] Cloud Sea Deck emissive color picker (#dev-layer-fog-emissive /
      #dev-layer-fog-emissive-hex) (BROKEN: devEditor.ts:2154-2161; no markup;
      `setLayerFogEmissive` unreachable). Together these five fog-deck controls mean the entire
      "cloud sea beneath the floating islands" feature has no working UI anywhere today.

## 8. Developer Editor - Tab 4: Sky & Light (#tab-sky)

- [ ] Day / Dusk / Twilight phase buttons (.dev-phase-btn) -> `lighting.setTimePhase(phase,
      scene)` then `devEditor.refreshUI()` (DUPLICATE of the top bar's #time-day/-dusk/-twilight
      buttons; kept in sync through `activeEnvPhase`)
- [ ] Sky Background color (#dev-env-bg) -> `lighting.updateBiomePhaseConfig(biome, phase, {bg})`
- [ ] Fog Color (#dev-env-fog) -> `updateBiomePhaseConfig({fog})`
- [ ] Fog Near / Fog Far sliders (#dev-env-fognear / #dev-env-fogfar) ->
      `updateBiomePhaseConfig({fogNear} / {fogFar})`
- [ ] Ambient Light color + Intensity (#dev-env-amb-color, #dev-env-amb-intensity) ->
      `updateBiomePhaseConfig({amb} / {ambI})`
- [ ] Directional Light color + Intensity (#dev-env-dir-color, #dev-env-dir-intensity) ->
      `updateBiomePhaseConfig({dir} / {dirI})`
- [ ] Hemisphere Intensity slider (#dev-env-hemi-intensity) -> `updateBiomePhaseConfig({hemi})`
- [ ] Sun Color, Intensity, Scale (#dev-env-sun-color, #dev-env-sun-intensity,
      #dev-env-sun-scale) -> `updateBiomePhaseConfig({sunC} / {sunI} / {sunScale})`
- [ ] Starfield Opacity slider (#dev-env-star-opacity) -> `updateBiomePhaseConfig({starOp})`

## 9. Developer Editor - Tab 5: Terrain & Water (#tab-terrain)

- [ ] Terrain palette buttons: Marshmallow Pastel, Lush Green, Autumn Warmth, Ghibli Pastel,
      Alpine Highlands, Candy Meadow (.dev-palette-btn) -> `terrain.applyBiomePalette(biome, name,
      playerX, playerZ)`
- [ ] Lowland / Highland / Dirt / Path / Sand color pickers (#dev-terrain-low/-high/-dirt/-path/
      -sand) -> `terrain.setBiomeTerrainColors(biome, {key: hex}, x, z)`
- [ ] Terrain Style toggle button (#dev-terrain-toon-toggle) -> 3-way cycle
      toon -> standard -> crystal via `terrain.setTerrainStyle(next, biome)` (NOTE: see section 3
      - this is desynchronised from the settings-menu's simpler 2-way toggle on the same terrain)
- [ ] Crystal Glass Terrain controls, shown only when style = crystal: Glass Transmission,
      Prismatic Iridescence, Diamond Specular, Facet Bevel Gleam, Crystal Vein Glow, Optical
      Refraction IOR, Gemstone Tint Strength, Vein Strata Frequency (8 sliders, #dev-crystal-*) ->
      each calls `terrain.setCrystalParams({field: v}, biome)`
- [ ] Water Color picker (#dev-water-color) -> `water.setColor(hex, biome)`
- [ ] Water Opacity / Reflectivity / Roughness / Metalness / Clearcoat / Clearcoat Roughness
      sliders (#dev-water-opacity/-reflectivity/-roughness/-metalness/-clearcoat/
      -clearcoat-roughness) -> `water.setOpacity/setReflectivity/setRoughness/setMetalness/
      setClearcoat/setClearcoatRoughness(v, biome)`
- [ ] Shader Mode toggle (#dev-water-toon-toggle) -> `water.setToonMode(!isToonMode, biome)`,
      label "MeshToon (Fast)" / "MeshPhysical (Realistic)" (this is a persistent, per-biome
      setting - distinct from the Debug Panel's #toggle-water, which is a session-only perf
      toggle affecting the same underlying flag without saving it)

## 10. Developer Editor - Tab 6: Profile & Export (#tab-profile)

- [ ] Set As Default for Active Biome button (#dev-save-biome-btn) ->
      `globalConfigManager.saveBiomeDefault(biome)`
- [ ] Set All Biomes As Default button (#dev-save-all-btn) ->
      `globalConfigManager.saveGlobalDefaults()`
- [ ] Reset All Settings to Factory Default button (#dev-reset-all-btn) -> `confirm()` then
      `globalConfigManager.resetFactoryDefaults()`, then re-applies bloom/lighting/water/terrain
      colours/tree rebuild for the active biome
- [ ] Export Biome JSON Config button (#dev-export-btn) -> downloads
      `globalConfigManager.exportJSON()` as `biome_config_<id>.json`
- [ ] Import JSON Config button (#dev-import-btn + hidden #dev-import-input) ->
      `globalConfigManager.importJSON(text)`, re-applies everything on success, shows an error
      status message on failure

## 11. Blueprint / Top-Down View - Toolbar Row (#top-view-hud .top-view-main-row)

- [ ] Island select dropdown (#top-insp-island-select) -> selects and focuses the camera on an
      island (DUPLICATE of #dev-castle-island-select)
- [ ] Lock badge (#top-insp-lock-badge) -> read-only LOCKED/UNLOCKED indicator for the selected
      island
- [ ] Lock/Unlock button (#top-insp-lock-btn) -> `skyCastles.setIslandLocked` toggle (DUPLICATE
      of #dev-castle-lock-item-btn)
- [ ] Delete button (#top-insp-del-btn) -> `confirm()` then `skyCastles.removeIsland` (DUPLICATE
      of #dev-castle-del-btn)
- [ ] + New Island button (#top-insp-add-btn) -> `topViewController.setPlacementMode(true)`
      (click-to-place, not an instant add)
- [ ] top-insp-place-btn (BROKEN: bound in topViewController.ts:138-142 to the same
      `setPlacementMode` toggle as #top-view-place-mode-btn below, but no markup with this id
      exists - it is unreachable dead code)
- [ ] Live coordinates readout (#top-view-cursor-coords) -> shows the selected island's X/Z/ALT,
      or the raw cursor world coordinates when nothing is selected; updated on every pointermove
- [ ] D-Pad Up/Down/Left/Right (#top-view-nudge-up/-down/-left/-right) ->
      `topViewController.moveSelectedCastle(dx, dz)` by the current step size
- [ ] Step size buttons: 10m / 25m / 50m / 100m (.top-view-step-btn) -> sets
      `topViewController.currentMoveStep`
- [ ] + Place on Grid button (#top-view-place-mode-btn) ->
      `topViewController.setPlacementMode(!placementMode)`; next click on the grid spawns a new
      island using `pendingPlacementModel`
- [ ] Models & Themes drawer toggle (#top-view-toggle-drawer-btn) -> shows/hides
      #top-view-drawer
- [ ] Zoom In / Zoom Out buttons (#top-view-zoom-in / #top-view-zoom-out) ->
      `topViewController.zoomByFactor(0.70 / 1.40)`
- [ ] Zoom presets: 500m / 1500m / 3500m / 7500m (#top-view-zoom-500/-1500/-3500/-7500) ->
      `topViewController.setAltitude(fixedValue)`
- [ ] Save to Disk button (#top-view-save-disk-btn) -> `skyCastles.saveToConfig()` then
      `globalConfigManager.saveConfigToDisk()` (DUPLICATE of #dev-save-castles-disk-btn)
- [ ] 3D Exploration View / Exit button (#top-view-exit-btn) -> `topViewController.exitTopView()`
- [ ] Min View / Max View toggle (#top-view-min-btn) -> collapses the drawer and enters a
      minimal-chrome "zen" map view

## 12. Blueprint / Top-Down View - Drawer (#top-view-drawer)

- [ ] 3D Castle Models strip (#top-insp-model-grid) -> click, or drag-and-drop, to assign a model
      to the selected island or place a brand-new one (DUPLICATE of #dev-castle-model-grid)
- [ ] Nearest neighbor readout (#top-insp-nearest-val) -> read-only, shows the nearest island's
      name and distance via `skyCastles.getDistanceToNearestCastle`
- [ ] Color Theme buttons: Original/Ruby/Sapphire/Golden/Emerald/Pastel (.top-insp-color-btn) ->
      `skyCastles.setIslandColors` (DUPLICATE of .dev-castle-color-preset-btn, missing the
      "Amethyst" option that the tab version has)
- [ ] Rot -15 deg / Rot +15 deg buttons (#top-view-rot-ccw / #top-view-rot-cw) ->
      `topViewController.rotateSelectedCastle(+-PI/12)` (same action as the Q/E hotkeys, section
      17)
- [ ] Layout Presets: Spatial Spread / Wide Ring / Reset Defaults (#top-view-preset-spacious /
      -ring / -reset) -> `skyCastles.applyLayoutPreset(...)` / `resetToDefaults()` (DUPLICATE of
      the Sky Castles tab's equivalents)
- [ ] top-view-toggle-panel-btn (BROKEN: bound in topViewController.ts:733-743 to show/hide
      #dev-editor-panel and relabel itself "Hide Sidebar"/"Sidebar", but no element with this id
      exists in index.html anywhere - unreachable. The only ways to hide/show the sidebar while
      in blueprint view are F2 or the editor's own Close button)

## 13. Blueprint View - non-button interactions

- [ ] Drag-to-place: dragging a castle card from either model grid onto the 3D scene, or a plain
      click while in placement mode, raycasts the grid plane and calls `skyCastles.addIsland` at
      the hit point
- [ ] Drag-to-reposition: left-click-dragging an unlocked island on the grid live-updates
      `skyCastles.updateIsland` with the new X/Z as the mouse moves
- [ ] Right-click or middle-click drag pans the blueprint camera (`targetCenter` follows the drag)
- [ ] Mouse wheel zooms the blueprint camera by adjusting `cameraAltitude`
- [ ] Selection ring visual feedback: a pulsing, slowly rotating ring mesh follows the selected
      island in world space (no DOM control, purely a Three.js overlay)
- [ ] HUD toast messages (#top-view-toast) -> transient instructional text shown on entering the
      view, entering placement mode, moving/rotating an island, and applying layout presets

## 14. Photo Mode

- [ ] Photo Mode entry (#photo-toggle, inside the settings dropdown) -> hides #top-bar,
      #top-right-bar, #debug-panel, #dev-editor-panel, #touch-controls; shows #photo-mode-ui;
      creates (once) and enables an `OrbitControls` instance targeted at the player's position
- [ ] Capture button (#photo-capture) -> hides the photo UI for two animation frames, calls
      `pipeline.render()`, downloads `renderer.domElement.toDataURL('image/png')` as
      `Wanderlust_Screenshot.png`, restores the photo UI
- [ ] Exit button (#photo-exit) -> restores top bar / top-right bar / debug panel (if it was open)
      / dev editor panel (if it was open) / touch controls; resets camera FOV to 60 and
      position/rotation to the default chase-cam pose; disables OrbitControls

## 15. Debug Panel (#debug-panel)

- [ ] Close button (#debug-close-btn) -> hides the panel, resets #debug-toggle's label to
      "Debug: OFF"
- [ ] Terrain Mesh toggle (#toggle-terrain) -> `terrain.setResolution(128 or 256, ...)`, labelled
      "128x128 (Fast)" / "256x256 (Slow)"
- [ ] Props & Culling toggle (#toggle-props) -> `props.setOptimizedMode(bool)`, "Culled 1.1k
      (Fast)" / "Full Density"
- [ ] DPI Resolution toggle (#toggle-dpi) -> `pipeline.setPixelRatioCap(1.25 or 2.0)`
- [ ] Shadow Map toggle (#toggle-shadows) -> `lighting.setShadowResolution(1024 or 2048)` and
      sets `lighting.shadowTuned`
- [ ] Water Shader toggle (#toggle-water) -> `water.setToonMode(bool)` (session-only; does not
      persist, unlike the Terrain & Water tab's equivalent in section 9)
- [ ] Bioluminescence debug slider (#tree-biolum-debug-slider) -> `trees.setBioluminescence(v/100)`;
      mirrors live, in both directions, with the settings-menu bioluminescence slider (section 3)
- [ ] Biome Fast-Travel grid (.dev-biome-tp-btn x6 inside the debug panel: Meadow, Archipelago,
      Geothermal, Estuary, Redwood, Sky Citadel - Candyland is omitted here) ->
      `UIManager.travelToBiome(x, z, y)` using hardcoded `data-x`/`data-z`/`data-y` attributes
      (NOTE: these coordinates are hand-duplicated in the HTML rather than read from
      `BIOME_LOCATIONS`, and could silently drift out of sync with the top bar's biome dropdown)
- [ ] "Open 4-Way Terrain Comparison Viewer" link -> navigates to `./terrain_comparison.html`
- [ ] "Open Magical Rainbow God Rays Studio" link -> navigates to `./rainbow_god_rays.html`
- [ ] Enable All (60 FPS Mode) / Reset All master toggle (#toggle-all) -> flips all five
      performance toggles above together in one click

## 16. Placement HUD (#dev-placement-hud)

- [ ] Placement banner text (#dev-placement-hud-text) -> shown while a prop or castle is being
      placed; text is overwritten per item by `devEditor.showPlacementHUD(msg)`, e.g. "PLACEMENT
      MODE: CLICK TERRAIN TO PLACE | ESC TO CANCEL"
- [ ] Cancel button (#dev-placement-cancel-btn) -> `worldProps.cancelPlacement()`, hides the HUD

## 17. Touch Controls (#touch-controls)

- [ ] Joystick zone / base / knob (#joystick-zone, #joystick-base, #joystick-knob) ->
      touch-or-mouse drag on the left ~65% of the screen drives `controls.touchState.x/y`, which
      feeds `InputState.up/down/left/right`; CSS classes toggled by controls.ts: #joystick-base
      gets `.resting` when idle but touch mode is on, `.active` while a touch/drag is down;
      `document.body` gets `.is-touch-device` once any touch is detected (or `forceTouchControls`
      is called)
- [ ] Boost button (#boost-btn) -> touchstart/mousedown/pointerdown sets
      `controls.touchState.boost = true` and adds `.active`; touchend/touchcancel/mouseup/
      mouseleave/pointerup/pointercancel clear it back to false and remove `.active`

## 18. Keyboard Shortcuts (every `addEventListener('keydown'/'keyup')` in the archived files)

- [ ] W / A / S / D (controls.ts, global, always listening) -> set `controls.keys.w/a/s/d` true on
      keydown, false on keyup; drive forward steering input
- [ ] Shift (controls.ts, global) -> `controls.keys.shift = true/false`, used as the boost input
- [ ] Space (controls.ts, global) -> `controls.keys.space = true/false`, used as the brake input
- [ ] Any key, once (main.ts:68) -> `unlockAudio()`, initializes the Web Audio context on first
      user interaction (not a feature shortcut, but it is a real global keydown listener)
- [ ] F2 (devEditor.ts:121-126, global) -> `DevEditor.toggle()`, opens/closes the developer editor
- [ ] Escape (devEditor.ts:1579, only while a world prop is being placed) -> cancels prop
      placement and hides the Placement HUD
- [ ] Arrow Up/Down/Left/Right (devEditor.ts:1603-1614, only when the editor is open, the Props
      tab is active, and a prop is selected or being placed) -> nudge prop position 2m per press,
      10m with Shift held
- [ ] Page Up / Page Down (devEditor.ts:1615-1620, same conditions) -> nudge prop elevation 1m,
      5m with Shift
- [ ] [ or - / ] or = or + (devEditor.ts:1621-1626, same conditions) -> nudge prop scale down/up
      by 0.2, 0.5 with Shift
- [ ] R (devEditor.ts:1627-1629, same conditions) -> rotate the selected prop +15 degrees, -15
      with Shift
- [ ] Delete / Backspace (devEditor.ts:1630-1638, same conditions) -> delete the selected prop
- [ ] D (devEditor.ts:1639-1649, same conditions, not while Ctrl is held) -> duplicate the
      selected prop
- [ ] F (devEditor.ts:1650-1657, same conditions) -> teleport the player camera to focus on the
      selected prop
- [ ] Arrow Up/Down/Left/Right (topViewController.ts:577-604, only while blueprint view is
      active) -> move the selected island by the current step size (25m default, x5 with Shift,
      rounded down to 20% with Alt or Ctrl for precision); if nothing is selected, pans the
      camera instead
- [ ] W / A / S / D (topViewController.ts:605-613, only while blueprint view is active) -> pans
      the blueprint camera regardless of selection (distinct from the flight-control W/A/S/D,
      which is suppressed while in blueprint view since `main.ts` skips `player.update` there)
- [ ] Q / E (topViewController.ts:614-621, only while blueprint view is active) -> rotate the
      selected island -15 / +15 degrees (same action as the Rot -15/+15 buttons, section 12)
- [ ] Escape (topViewController.ts:622-629, only while blueprint view is active) -> cancels
      placement mode if active, otherwise calls `exitTopView()`
- [ ] M (deviceSimulator.ts:187-196, global, always listening) -> `cycleDevice()` (BROKEN
      downstream: it does toggle real `document.body` classes such as `is-device-simulated` and
      does call `controls.forceTouchControls(true)`, silently turning on touch-control mode, but
      the visual device-frame UI it is meant to control never appears - see section 19)
- [ ] O (deviceSimulator.ts:187-196, global, not while device mode is 'fullscreen') -> toggles
      `setOrientation('portrait'/'landscape')`, same caveat as M

## 19. Non-functional subsystem: Device Simulator

- [ ] Device Simulator toolbar (#simulator-root, #device-stage, #device-frame, #device-screen,
      #simulator-info-text, #simulator-toolbar, #sim-btn-s25, #sim-btn-tabs6,
      #sim-btn-fullscreen, #sim-btn-orientation, #sim-btn-scale, #sim-btn-toggle-bar,
      #settings-device-toggle) (BROKEN: `DeviceSimulator` is instantiated unconditionally in
      main.ts:57, but all 13 of its ids are dangling - none exist in index.html. Per README 1.2,
      this class "has never functioned." The M/O hotkeys above are the only observable
      side-effect it still has)

---

## Deliberate removals proposed by the plan

These are NOT regressions if missing from the rebuild. README.md section 2 states they are
intentionally not being carried forward:

- The settings-menu (cogwheel) world-editing controls documented in section 3 above - the color
  palette presets and the bioluminescence/tree-scale/tree-density/bush-scale/bush-density sliders
  currently living in #settings-menu - are removed from the new Settings window. Per README 2.1,
  the new Settings is a decoy with five inert rows (Graphics, Sound, Controls, Language, Version)
  plus one live "Developer Options" entry; all real vegetation editing moves exclusively into the
  Developer Editor's Vegetation tab.
- The entire Device Simulator (`deviceSimulator.ts`, ~377 lines, section 19 above) is deleted. It
  binds 13 ids that have never had matching markup and has never worked.
- The Island Visual Chips Strip (#dev-castle-island-chips, section 7) is dropped; the rebuilt
  Castles tab and blueprint view share one island selector instead of a chip strip plus a
  dropdown.
- The five dead glow aliases in `trees.ts` (`setTreeBloomIntensity`, `setCanopyGlowMultiplier`,
  `setTrunkGlowMultiplier`, `setBushBloomIntensity`, `setBushGlowMultiplier`, trees.ts:1470-1489)
  are deleted in T4.1. All five currently write the exact same single bioluminescence uniform, so
  exposing them as separate sliders would only let them overwrite each other; only one honest
  "Foliage Glow" control is kept.
