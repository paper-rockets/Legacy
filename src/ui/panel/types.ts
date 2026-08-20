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
