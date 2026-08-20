# Frozen Contracts - Menu Overhaul

These interfaces are written once, in task T1.1, and then treated as immutable. Every other task
imports from these files and codes against exactly these shapes.

Rule for delegated agents: if a contract below does not give you a field you think you need, you do
NOT add it. Stop and report the gap. Changing a contract silently breaks every parallel agent.

All code in this document is the intended final content of the named files. Copy it verbatim.

---

## 1. src/ui/panel/types.ts

Every control in the developer editor is one of these objects. There are no element ids and no
markup. The label, the read path and the write path live in the same literal, so the compiler
checks the wiring that string ids never could.

```ts
/**
 * Declarative control schema for the developer editor.
 *
 * Rules that make this work:
 * - A control never reads the DOM. It reads `get()` and writes through `set()`.
 * - `get()` must be cheap. It runs on every refresh, for every visible control.
 * - `set()` is the only place a world system is touched. Never mutate config directly
 *   in a schema; call the system setter so the render side effects happen.
 * - `visible()` and `disabled()` are re-evaluated on every refresh.
 */

/** Shared by every control. */
export interface ControlBase {
    /** Plain text. No icons, no emoji, no unicode symbols. */
    label?: string;
    /** Optional one line explanation shown under the label. */
    hint?: string;
    /** Re-evaluated on every refresh. Absent means always visible. */
    visible?: () => boolean;
    /** Re-evaluated on every refresh. Absent means always enabled. */
    disabled?: () => boolean;
    /** Stable key for refresh-in-place. Auto-derived from label when omitted. */
    key?: string;
}

/** A titled card that groups controls. Sections do not nest. */
export interface SectionDef extends ControlBase {
    kind: 'section';
    /** Uppercase plain text, e.g. 'GLOW AND BLOOM'. */
    title: string;
    /** Small right-aligned tag, e.g. '9 ISLANDS'. Re-read on refresh. */
    tag?: () => string;
    children: ControlDef[];
}

/** Range slider with a live value readout and an optional numeric entry box. */
export interface SliderDef extends ControlBase {
    kind: 'slider';
    min: number;
    max: number;
    step: number;
    /** Appended to the readout, e.g. 'x', 'm', '%', ' deg'. Plain ASCII only. */
    unit?: string;
    /** Decimal places in the readout. Default 2, or 0 when step is an integer. */
    precision?: number;
    /** Show a number input beside the readout for exact entry. Default false. */
    numeric?: boolean;
    get: () => number;
    /** Fires on every input event. Must tolerate being called at 60 Hz. */
    set: (value: number) => void;
    /** Fires once on change (pointer release). Use for expensive rebuilds. */
    commit?: (value: number) => void;
}

/** Colour picker with a hex readout. */
export interface ColorDef extends ControlBase {
    kind: 'color';
    /** Always '#rrggbb' lowercase. */
    get: () => string;
    set: (hex: string) => void;
}

/** Two state button. Label reflects state through `onLabel` / `offLabel`. */
export interface ToggleDef extends ControlBase {
    kind: 'toggle';
    onLabel: string;
    offLabel: string;
    get: () => boolean;
    set: (value: boolean) => void;
}

/** Single action button. */
export interface ButtonDef extends ControlBase {
    kind: 'button';
    text: string;
    /** 'default' | 'primary' | 'danger' | 'success'. Styling only. */
    tone?: 'default' | 'primary' | 'danger' | 'success';
    /** May be async. The button disables itself until the promise settles. */
    onClick: () => void | Promise<void>;
}

/** Buttons laid out on one row, equal width. */
export interface ButtonRowDef extends ControlBase {
    kind: 'buttonRow';
    buttons: ButtonDef[];
}

/** Mutually exclusive options rendered as a pill row. */
export interface SegmentedDef<T extends string = string> extends ControlBase {
    kind: 'segmented';
    options: Array<{ value: T; text: string }>;
    get: () => T;
    set: (value: T) => void;
}

/** Dropdown. Options are re-read on refresh, so dynamic lists are fine. */
export interface SelectDef extends ControlBase {
    kind: 'select';
    options: () => Array<{ value: string; text: string }>;
    get: () => string;
    set: (value: string) => void;
}

/** Editable list of colours, e.g. the canopy palette. Click a swatch to edit it. */
export interface SwatchListDef extends ControlBase {
    kind: 'swatchList';
    get: () => string[];
    set: (colors: string[]) => void;
    /** Allow adding and removing entries. Default false. */
    editableLength?: boolean;
}

/** Free text filter box. */
export interface SearchDef extends ControlBase {
    kind: 'search';
    placeholder: string;
    get: () => string;
    set: (query: string) => void;
}

/** One entry in a CardGridDef. */
export interface CardItem {
    id: string;
    name: string;
    /** Small line under the name, e.g. category. */
    meta?: string;
    /** Resolved lazily. Use ThumbnailGenerator.getModelThumbnail. */
    thumbnail?: () => Promise<string>;
    /** Renders a state pill on the card, e.g. 'ON' / 'OFF'. */
    state?: () => string;
    /** True when this card is the current selection. */
    selected?: () => boolean;
    /** True when the card is active in the world (drives the ON/OFF pill styling). */
    active?: () => boolean;
    draggable?: boolean;
}

/** Thumbnail grid. Used for the vegetation catalog, prop catalog and castle models. */
export interface CardGridDef extends ControlBase {
    kind: 'cardGrid';
    /** Re-read on refresh. Return the already filtered list. */
    items: () => CardItem[];
    columns?: number;
    onSelect?: (id: string) => void;
    /** Clicking the state pill. Absent means the pill is not clickable. */
    onToggle?: (id: string) => void;
    onDragStart?: (id: string) => void;
    onDragEnd?: (id: string) => void;
    /** Shown in place of the grid when items() is empty. */
    emptyText?: string;
}

/** Read-only line of text, e.g. a coordinate readout. */
export interface ReadoutDef extends ControlBase {
    kind: 'readout';
    get: () => string;
}

/**
 * Escape hatch for the two things a schema cannot express: the file upload input
 * and the placed-props list with its per row delete. Build the element once in
 * `mount`, update it in `refresh`. Use sparingly; four uses exist in this plan.
 */
export interface CustomDef extends ControlBase {
    kind: 'custom';
    mount: (host: HTMLElement) => void;
    refresh?: (host: HTMLElement) => void;
    destroy?: (host: HTMLElement) => void;
}

export type ControlDef =
    | SectionDef
    | SliderDef
    | ColorDef
    | ToggleDef
    | ButtonDef
    | ButtonRowDef
    | SegmentedDef
    | SelectDef
    | SwatchListDef
    | SearchDef
    | CardGridDef
    | ReadoutDef
    | CustomDef;

/** Returned by renderPanel. */
export interface PanelHandle {
    root: HTMLElement;
    /**
     * Re-read every get(), visible() and disabled() and update the existing DOM in place.
     * Must not rebuild slider elements, or dragging one would stutter. CardGrid contents
     * may be rebuilt because their items() list can change length.
     */
    refresh(): void;
    /** Remove listeners, run every CustomDef.destroy, and empty the host. */
    destroy(): void;
}

/** One tab in the editor shell. */
export interface TabDef {
    /** Stable identifier used by switchTab, e.g. 'vegetation'. */
    id: string;
    /** Uppercase plain text shown on the button. Keep to two words. */
    label: string;
    /**
     * Called when the tab is first shown, and again whenever the active biome changes.
     * Return a fresh schema. Do not cache world state inside the returned closures
     * beyond what get() re-reads.
     */
    build: () => ControlDef[];
}
```

---

## 2. src/ui/panel/render.ts - public surface only

The implementation is task T3.1. This is the signature every other task codes against.

```ts
import { ControlDef, PanelHandle } from './types';

/**
 * Build DOM for `schema` inside `host` and return a handle.
 * Clears `host` first. Safe to call repeatedly; call destroy() on the old handle.
 */
export function renderPanel(host: HTMLElement, schema: ControlDef[]): PanelHandle;

/**
 * getElementById that fails loudly instead of returning null.
 * Throws in development so a missing mount point is visible immediately,
 * which is the failure mode that produced the 59 dangling ids this overhaul fixes.
 */
export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T;
```

---

## 3. src/ui/panel/shell.ts - the editor frame

```ts
import { ControlDef, TabDef, PanelHandle } from './types';

export interface EditorShellOptions {
    /** Existing empty element in index.html, e.g. '#dev-editor-panel'. */
    mount: HTMLElement;
    title: string;
    /** Re-read on refresh. Rendered as the header badge, e.g. 'CANDYLAND'. */
    subtitle: () => string;
    /** Rendered as a row of buttons above the tabs. */
    biomeStrip: {
        options: () => Array<{ value: string; text: string }>;
        get: () => string;
        set: (value: string) => void;
    };
    tabs: TabDef[];
    /** Always visible at the bottom of the panel, on every tab. */
    footer: () => ControlDef[];
    /** Header actions on the right, e.g. Teleport and Close. */
    headerActions: ControlDef[];
}

export interface EditorShell {
    open(): void;
    close(): void;
    toggle(): void;
    readonly isOpen: boolean;
    /** Switch tab by TabDef.id. Rebuilds that tab's schema. */
    switchTab(tabId: string): void;
    readonly activeTabId: string;
    /** Refresh the active tab, the footer and the header. Cheap; safe to call often. */
    refresh(): void;
    /** Rebuild the active tab from scratch. Use after the biome changes. */
    rebuild(): void;
    /** Transient message in the header, auto-hides after 3.5 s. */
    status(message: string, isError?: boolean): void;
    destroy(): void;
}

export function createEditorShell(options: EditorShellOptions): EditorShell;
```

---

## 4. src/ui/castleEditorState.ts

The single owner of castle editor selection. Both the dev editor tab and the top down blueprint
drawer read and write through this and subscribe to it. Neither keeps its own copy.

```ts
export type CastleEditorListener = () => void;

export interface CastleEditorState {
    /** Island id, or null when the archipelago is empty. */
    readonly selectedIslandId: string | null;
    /** Sets selection and notifies every listener exactly once. No-op if unchanged. */
    select(id: string | null): void;
    /** Castle model path staged for click-to-place on the blueprint grid. */
    readonly pendingModelPath: string;
    setPendingModel(path: string): void;
    /** True while the blueprint grid is in click-to-place mode. */
    readonly placementMode: boolean;
    setPlacementMode(active: boolean): void;
    /** Notify listeners without changing anything. Call after any island mutation. */
    notify(): void;
    subscribe(listener: CastleEditorListener): () => void;
}

export const castleEditorState: CastleEditorState;
```

Note for T5.1: the old build kept two independent selection variables,
`DevEditor.selectedCastleIslandId` and `TopViewController.selectedIslandId`, synchronised by
callbacks. Both files are deleted in T2.1. Do not recreate that pattern. The CASTLES tab and the
blueprint drawer both read `castleEditorState.selectedIslandId` and both subscribe to it. Neither
holds a copy, and there are no `setOnIslandMoved` style callbacks.

---

## 5. src/ui/settingsWindow.ts

```ts
/**
 * The player-facing Settings window. It is deliberately inert: nothing in it
 * changes the world. Every real control lives in the developer editor.
 */
export interface SettingsDecoyConfig {
    /**
     * When true, the window shows a 'Developer Options' entry that opens the
     * developer editor. Set false for a build handed to a player. F2 still works.
     */
    showDeveloperEntry: boolean;
    /** Inert rows, rendered as label plus a fixed value. Purely cosmetic. */
    rows: Array<{ label: string; value: string }>;
}

export const SETTINGS_DECOY: SettingsDecoyConfig;

export function createSettingsWindow(onOpenDeveloper: () => void): {
    open(): void;
    close(): void;
    toggle(): void;
};
```

Default `SETTINGS_DECOY`, to be used verbatim unless the owner says otherwise:

```ts
export const SETTINGS_DECOY: SettingsDecoyConfig = {
    showDeveloperEntry: true,
    rows: [
        { label: 'Graphics', value: 'Automatic' },
        { label: 'Sound', value: 'On' },
        { label: 'Controls', value: 'Standard' },
        { label: 'Language', value: 'English' },
        { label: 'Version', value: '1.0' }
    ]
};
```

---

## 6. Unchanged contracts

These are frozen for the duration of this work package. Do not add, rename or reorder fields.

- `src/core/config.ts`: `AppConfig`, `BiomeConfig`, `VegetationBiomeSettings`,
  `ModelVegetationConfig`, `BloomSettings`, `WaterSettings`, `TerrainColorsSettings`,
  `EnvPhaseConfig`, `SkyCastleIslandDef`, `CastleColorSettings`, `PlacedWorldProp`
- `src/world/noise.ts`: `BiomeId`, `BIOME_LOCATIONS`
- Every public method on `TreeSystem`, `WorldPropsSystem`, `SkyCastleSystem`, `TerrainSystem`,
  `WaterSystem`, `LightingSystem`, `RenderPipeline`, `PropsSystem`

The one permitted exception in the entire work package is the deletion of the five dead glow
aliases on `TreeSystem` (trees.ts:1470-1489), which happens in T4.1 after their last caller is
gone. No other file under `src/world/`, `src/core/`, `src/player/` or `src/audio/` is modified by
any task.

---

## 7. The mapping every schema must use

A control that does not appear in this table does not exist yet. If a task needs one, stop and
report.

| Control | Read | Write |
| --- | --- | --- |
| Tree scale (biome) | `veg.treeScale` | `trees.setBiomeTreeScale(biomeId, v)` |
| Tree density (biome) | `veg.treeDensity` | `trees.setBiomeTreeDensity(biomeId, v)` |
| Bush scale | `veg.bushScale` | `trees.setBiomeBushScale(biomeId, v)` |
| Bush density | `veg.bushDensity` | `trees.setBiomeBushDensity(biomeId, v)` |
| Model enabled | `veg.selectedTreeModelIds.includes(id)` | `trees.setBiomeTreeModelSelected(biomeId, id, on)` |
| Model scale | `trees.getModelConfig(biomeId, id).scale` | `trees.setModelScale(biomeId, id, v)` |
| Model density | `trees.getModelConfig(biomeId, id).density` | `trees.setModelDensity(biomeId, id, v)` |
| Model colour mode | `...useOriginalColors` | `trees.setModelColorMode(biomeId, id, b)` |
| Model canopy colours | `...canopyColors` | `trees.setModelCanopyColors(biomeId, id, arr)` |
| Model leaf colours | `...leafColors` | `trees.setModelLeafColors(biomeId, id, arr)` |
| Model trunk colours | `...trunkColors` | `trees.setModelTrunkColors(biomeId, id, arr)` |
| Foliage glow (biome) | `veg.bioluminescence` | `trees.setBioluminescence(v, biomeId)` |
| Bloom strength | `bloom.globalStrength` | `pipeline.setBloomStrength(v, biomeId)` |
| Bloom radius | `bloom.globalRadius` | `pipeline.setBloomRadius(v, biomeId)` |
| Bloom threshold | `bloom.globalThreshold` | `pipeline.setBloomThreshold(v, biomeId)` |
| Cloud bloom | `bloom.cloudBloom` | `props.setBiomeCloud(biomeId, { cloudBloom: v })` |
| Shoreline bloom | `bloom.shoreBloom` | `terrain.setShoreBloom(v, undefined, undefined, biomeId)` |
| Island position / rotation / scale | `skyCastles.getIsland(id)` | `skyCastles.updateIsland(id, { ... })` |
| Island colours | `island.colors` | `skyCastles.setIslandColors(id, colors)` |
| Island model | `island.modelPath` | `await skyCastles.setIslandModel(id, path)` |
| Fog deck enabled | `skyCastles.layerFogEnabled` | `skyCastles.setLayerFogEnabled(b)` |
| Fog deck altitude | `skyCastles.layerFogAltitude` | `skyCastles.setLayerFogAltitude(v)` |
| Fog deck density | `skyCastles.layerFogDensity` | `skyCastles.setLayerFogDensity(v)` |
| Fog deck colour | config `skyCitadel.layerFogColor` | `skyCastles.setLayerFogColor(hex)` |
| Fog deck emissive | config `skyCitadel.layerFogEmissive` | `skyCastles.setLayerFogEmissive(hex)` |
| Save this biome | - | `globalConfigManager.saveBiomeDefault(biomeId)` |
| Save all biomes | - | `globalConfigManager.saveGlobalDefaults()` |
| Save permanently to disk | - | `await globalConfigManager.saveConfigToDisk()` |
| Reset | - | `globalConfigManager.resetBiomeDefaults(biomeId)` |

`veg` is `globalConfigManager.getBiomeConfig(biomeId).vegetation`.
`bloom` is `globalConfigManager.getBiomeConfig(biomeId).bloom`.

Every method in this table was verified to exist at the time of writing. Exact signatures worth
noting:

- `terrain.setShoreBloom(intensity, colorHex?, width?, biomeId?)` - terrain.ts:554
- `props.setBiomeCloud(biomeId, { cloudBloom, cloudColor, cloudEmissive })` - props.ts:120
- `skyCastles.setLayerFogEnabled|Altitude|Density|Color|Emissive|Bloom` - skyCastles.ts:906-935
- `skyCastles.setIslandModel` is async. Await it, then call `castleEditorState.notify()`.
- `pipeline.setBloomStrength|Radius|Threshold(value, biomeId?)` - renderer.ts:95-124

If any of these does not match what you find in the source, stop and report rather than inventing a
setter or writing to config directly.

---

## 8. Worked example - the shape every tab module must have

This is not pseudocode. It is the intended skeleton of `src/ui/tabs/vegetationTab.ts` from T4.1,
trimmed to four controls. Follow this shape exactly; the details of the remaining controls come
from the table in section 7.

```ts
import { ControlDef } from '../panel/types';
import { TreeSystem, TREE_CATALOG } from '../../world/trees';
import { RenderPipeline } from '../../core/renderer';
import { globalConfigManager } from '../../core/config';
import { BiomeId } from '../../world/noise';

export interface VegetationTabContext {
    trees: TreeSystem;
    pipeline: RenderPipeline;
    /** Read fresh on every call. The user can change biome without rebuilding the tab. */
    biomeId: () => BiomeId;
    status: (message: string, isError?: boolean) => void;
}

/** Tab-local UI state. Not world state, so it does not belong in config. */
interface TabState {
    search: string;
    category: 'all' | 'trees' | 'flowers';
    inspectedId: string | null;
}

export function buildVegetationTab(ctx: VegetationTabContext): ControlDef[] {
    const state: TabState = { search: '', category: 'all', inspectedId: null };

    // Helpers. Note these are functions, not values captured once. Every control
    // re-reads through them, so switching biome needs no rebuild.
    const veg = () => globalConfigManager.getBiomeConfig(ctx.biomeId()).vegetation;
    const bloom = () => globalConfigManager.getBiomeConfig(ctx.biomeId()).bloom;
    const model = () => ctx.trees.getModelConfig(ctx.biomeId(), state.inspectedId!);

    return [
        {
            kind: 'section',
            title: 'SELECTED MODEL',
            visible: () => state.inspectedId !== null,
            children: [
                {
                    kind: 'slider',
                    label: 'Model scale',
                    min: 0.1, max: 30, step: 0.1, unit: 'x', numeric: true,
                    get: () => model().scale,
                    // setModelScale already calls forceRebuild, and forceRebuild is
                    // debounced onto one requestAnimationFrame (trees.ts:1506-1518).
                    // Do NOT add a commit hook here; it would rebuild twice.
                    set: v => ctx.trees.setModelScale(ctx.biomeId(), state.inspectedId!, v)
                }
            ]
        },
        {
            kind: 'section',
            title: 'GROUND COVER',
            children: [
                {
                    kind: 'slider',
                    label: 'Bush density',
                    min: 0, max: 800, step: 10, precision: 0,
                    get: () => veg().bushDensity,
                    set: v => ctx.trees.setBiomeBushDensity(ctx.biomeId(), v)
                }
            ]
        },
        {
            kind: 'section',
            title: 'GLOW AND BLOOM',
            children: [
                {
                    kind: 'slider',
                    label: 'Foliage glow (whole biome)',
                    hint: 'One value for every plant in this biome.',
                    min: 0, max: 100, step: 5, unit: '%', precision: 0,
                    get: () => Math.round((veg().bioluminescence ?? 0.8) * 100),
                    set: v => ctx.trees.setBioluminescence(v / 100, ctx.biomeId())
                },
                {
                    kind: 'slider',
                    label: 'Bloom strength',
                    min: 0, max: 3, step: 0.05,
                    get: () => bloom().globalStrength,
                    set: v => ctx.pipeline.setBloomStrength(v, ctx.biomeId())
                }
            ]
        }
    ];
}
```

Four things in that file are the whole point, and a task is wrong if it drops any of them:

1. There is no element id anywhere, and no markup. The label, the read and the write are one
   literal that the compiler checks.
2. `biomeId` is a function, not a value. Nothing is captured at build time, so a biome switch needs
   only `shell.refresh()`.
3. `get()` reads `globalConfigManager` rather than a cached number, so a value changed by any other
   code path shows up on the next refresh.
4. Rebuild cost is understood before a hook is added. Most `TreeSystem` setters already call
   `forceRebuild()`, which is debounced onto one animation frame, so `set` is safe to fire at
   60 Hz and `commit` must be left off. Use `commit` only for a setter that does expensive work
   synchronously with no debounce of its own. Check the setter's body before deciding; adding a
   redundant `commit` is the easiest way to make this editor feel slow.

---

## 9. The markup contract - the only ids index.html must provide

The rebuild deletes essentially all markup. These elements are the exception. They are frozen
because code outside `src/ui/` depends on them by exact id.

| Element | Required by | Why |
| --- | --- | --- |
| `#app` | `src/main.ts:19` | renderer mount |
| `#touch-controls` | `src/player/controls.ts:134` | touch capture surface |
| `#joystick-zone` | CSS only | hit area, no TypeScript lookup |
| `#joystick-base` | `controls.ts:115,131` | receives `.resting` and `.active` |
| `#joystick-knob` | `controls.ts:116,132` | moved by transform |
| `#boost-btn` | `controls.ts:101,133` | receives `.active` |

`controls.ts` also adds and removes `is-touch-device` on `document.body` (lines 55 and 61).

**The CSS for these six elements is behavioural, not decorative.** `controls.ts` toggles `.resting`
and `.active` and relies on the stylesheet to make those states visible; it never sets an inline
style for them. Copy the existing rules for all six selectors plus `body.is-touch-device` out of
the archived index.html **verbatim**. Do not rewrite, reformat, or tidy them. They are the one part
of the old stylesheet that is load bearing, and a rewrite that looks equivalent can still break the
joystick feedback in a way that only shows up on a real touch device.

The new UI adds four mount points of its own. These are created empty in `index.html` and filled
entirely from TypeScript:

    #hud-root         top bar            src/ui/hud.ts
    #settings-root    decoy window       src/ui/settingsWindow.ts
    #editor-root      developer editor   src/ui/panel/shell.ts
    #blueprint-root   blueprint HUD      src/ui/blueprintView.ts

No other id may appear in `index.html`. If a task needs one, it is building markup that should be
a schema instead.
