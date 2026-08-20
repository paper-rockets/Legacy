import { ControlDef } from '../panel/types';
import { SkyCastleSystem, CASTLE_MODEL_CATALOG, CASTLE_COLOR_PRESETS } from '../../world/skyCastles';
import { castleEditorState } from '../castleEditorState';
import { ThumbnailGenerator } from '../thumbnailGenerator';
import { globalConfigManager } from '../../core/config';

export interface CastleTabContext {
    skyCastles: SkyCastleSystem;
    /** 'panel' renders every section. 'drawer' renders the compact subset. */
    variant: 'panel' | 'drawer';
    onEnterBlueprint?: () => void; // panel only
    onExitBlueprint?: () => void; // drawer only
    status: (message: string, isError?: boolean) => void;
}

export function buildCastleControls(ctx: CastleTabContext): ControlDef[] {
    const selectedId = () => castleEditorState.selectedIslandId;
    const currentIsland = () => (selectedId() ? ctx.skyCastles.getIsland(selectedId()!) : undefined);

    const sections: ControlDef[] = [
        // ── 1. ARCHIPELAGO ─────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'ARCHIPELAGO',
            tag: () => `${ctx.skyCastles.getIslands().length} ISLANDS`,
            children: [
                ...(ctx.variant === 'panel' && ctx.onEnterBlueprint
                    ? [
                          {
                              kind: 'button' as const,
                              text: 'Top-Down Blueprint View',
                              tone: 'primary' as const,
                              onClick: () => {
                                  ctx.onEnterBlueprint?.();
                              }
                          }
                      ]
                    : []),
                ...(ctx.variant === 'drawer' && ctx.onExitBlueprint
                    ? [
                          {
                              kind: 'button' as const,
                              text: 'Exit Blueprint View',
                              tone: 'primary' as const,
                              onClick: () => {
                                  ctx.onExitBlueprint?.();
                              }
                          }
                      ]
                    : []),
                {
                    kind: 'select',
                    label: 'Select Island',
                    options: () => {
                        const list = ctx.skyCastles.getIslands();
                        if (list.length === 0) return [{ value: '', text: 'No islands in archipelago' }];
                        return list.map((i) => ({
                            value: i.id,
                            text: `${i.name}${i.locked ? ' [LOCKED]' : ''}`
                        }));
                    },
                    get: () => selectedId() || '',
                    set: (id: string) => {
                        castleEditorState.select(id || null);
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Focus Island',
                            tone: 'default',
                            onClick: () => {
                                const isl = currentIsland();
                                if (isl) {
                                    ctx.status(`Focused on "${isl.name}"`);
                                    castleEditorState.notify();
                                }
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Lock Island',
                            tone: 'default',
                            onClick: () => {
                                const id = selectedId();
                                if (id) {
                                    const locked = ctx.skyCastles.isIslandLocked(id);
                                    ctx.skyCastles.setIslandLocked(id, !locked);
                                    castleEditorState.notify();
                                    ctx.status(locked ? 'Island unlocked' : 'Island locked');
                                }
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Lock All',
                            tone: 'default',
                            onClick: () => {
                                const allLocked = ctx.skyCastles.areAllIslandsLocked();
                                ctx.skyCastles.lockAllIslands(!allLocked);
                                castleEditorState.notify();
                                ctx.status(allLocked ? 'All islands unlocked' : 'All islands locked');
                            }
                        }
                    ]
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: '+ New Island',
                            tone: 'default',
                            onClick: () => {
                                const isl = ctx.skyCastles.addIsland();
                                castleEditorState.select(isl.id);
                                ctx.status(`Added "${isl.name}"`);
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Delete Island',
                            tone: 'danger',
                            disabled: () => selectedId() === null,
                            onClick: () => {
                                const id = selectedId();
                                if (id) {
                                    const isl = currentIsland();
                                    const name = isl?.name || id;
                                    ctx.skyCastles.removeIsland(id);
                                    const remaining = ctx.skyCastles.getIslands();
                                    castleEditorState.select(remaining.length > 0 ? remaining[0].id : null);
                                    castleEditorState.notify();
                                    ctx.status(`Deleted castle "${name}"`);
                                }
                            }
                        }
                    ]
                }
            ]
        },

        // ── 2. CASTLE MODEL ────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'CASTLE MODEL',
            visible: () => selectedId() !== null,
            children: [
                {
                    kind: 'cardGrid',
                    columns: 3,
                    items: () => {
                        const cur = currentIsland();
                        return CASTLE_MODEL_CATALOG.map((c) => ({
                            id: c.path,
                            name: c.name,
                            meta: `Default ${c.defaultScale}x`,
                            thumbnail: () => ThumbnailGenerator.getModelThumbnail(c.path),
                            selected: () => cur?.modelPath === c.path,
                            draggable: true
                        }));
                    },
                    onSelect: async (path: string) => {
                        const id = selectedId();
                        if (id) {
                            await ctx.skyCastles.setIslandModel(id, path);
                            castleEditorState.notify();
                            ctx.status('Updated castle structure model');
                        }
                    },
                    onDragStart: (path: string) => {
                        castleEditorState.setPendingModel(path);
                    }
                }
            ]
        }
    ];

    // ── 3. TRANSFORM ──────────────────────────────────────────────────────────
    sections.push({
        kind: 'section',
        title: 'TRANSFORM',
            visible: () => currentIsland() !== undefined,
            disabled: () => currentIsland()?.locked === true,
            tag: () => (currentIsland()?.locked ? 'LOCKED' : ''),
            children: [
                {
                    kind: 'slider',
                    label: 'Position X',
                    min: -3500,
                    max: 3500,
                    step: 10,
                    unit: 'm',
                    precision: 0,
                    numeric: true,
                    get: () => Math.round(currentIsland()?.x ?? 0),
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { x: v });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Altitude (Y)',
                    min: 100,
                    max: 1500,
                    step: 10,
                    unit: 'm',
                    precision: 0,
                    numeric: true,
                    get: () => Math.round(currentIsland()?.y ?? 500),
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { y: v });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Position Z',
                    min: -3500,
                    max: 3500,
                    step: 10,
                    unit: 'm',
                    precision: 0,
                    numeric: true,
                    get: () => Math.round(currentIsland()?.z ?? 0),
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { z: v });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Heading / Rotation',
                    min: 0,
                    max: 360,
                    step: 5,
                    unit: ' deg',
                    precision: 0,
                    get: () => {
                        const rot = currentIsland()?.rotationY ?? 0;
                        let deg = Math.round((rot * (180 / Math.PI)) % 360);
                        if (deg < 0) deg += 360;
                        return deg;
                    },
                    set: (deg: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { rotationY: deg * (Math.PI / 180) });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Island Scale',
                    min: 0.2,
                    max: 10.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    get: () => currentIsland()?.scale ?? 2.0,
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { scale: v });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Cloud Skirt Radius',
                    min: 10,
                    max: 200,
                    step: 5,
                    unit: 'm',
                    precision: 0,
                    get: () => currentIsland()?.cloudRadius ?? 30,
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { cloudRadius: v });
                            castleEditorState.notify();
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Cloud Puff Count',
                    min: 4,
                    max: 40,
                    step: 1,
                    precision: 0,
                    get: () => currentIsland()?.cloudPuffCount ?? 12,
                    set: (v: number) => {
                        const id = selectedId();
                        if (id) {
                            ctx.skyCastles.updateIsland(id, { cloudPuffCount: v });
                            castleEditorState.notify();
                        }
                    }
                }
            ]
        });

    // ── 4. COLOURS ─────────────────────────────────────────────────────────────
    sections.push({
        kind: 'section',
        title: 'COLOURS',
        visible: () => currentIsland() !== undefined,
        children: [
            {
                kind: 'buttonRow',
                buttons: [
                    {
                        kind: 'button',
                        text: 'Ruby',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.ruby);
                                castleEditorState.notify();
                            }
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Sapphire',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.sapphire);
                                castleEditorState.notify();
                            }
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Amethyst',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.amethyst);
                                castleEditorState.notify();
                            }
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Golden',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.golden);
                                castleEditorState.notify();
                            }
                        }
                    }
                ]
            },
            {
                kind: 'buttonRow',
                buttons: [
                    {
                        kind: 'button',
                        text: 'Emerald',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.emerald);
                                castleEditorState.notify();
                            }
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Pastel',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.pastel);
                                castleEditorState.notify();
                            }
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Original',
                        onClick: () => {
                            if (selectedId()) {
                                ctx.skyCastles.setIslandColors(selectedId()!, CASTLE_COLOR_PRESETS.original);
                                castleEditorState.notify();
                            }
                        }
                    }
                ]
            },
            {
                kind: 'button',
                text: 'Apply Theme to ALL Islands',
                onClick: () => {
                    const preset = currentIsland()?.colors?.preset || 'ruby';
                    ctx.skyCastles.applyGlobalPresetToAll(preset);
                    castleEditorState.notify();
                    ctx.status(`Applied "${preset}" theme to all islands`);
                }
            },
            {
                kind: 'color',
                label: 'Roof Color',
                get: () => currentIsland()?.colors?.roofColor || '#e11d48',
                set: (hex: string) => {
                    if (selectedId()) {
                        ctx.skyCastles.setIslandColors(selectedId()!, { roofColor: hex });
                        castleEditorState.notify();
                    }
                }
            },
            {
                kind: 'color',
                label: 'Wall Color',
                get: () => currentIsland()?.colors?.wallColor || '#fdf2f8',
                set: (hex: string) => {
                    if (selectedId()) {
                        ctx.skyCastles.setIslandColors(selectedId()!, { wallColor: hex });
                        castleEditorState.notify();
                    }
                }
            },
            {
                kind: 'color',
                label: 'Trim Color',
                get: () => currentIsland()?.colors?.trimColor || '#f59e0b',
                set: (hex: string) => {
                    if (selectedId()) {
                        ctx.skyCastles.setIslandColors(selectedId()!, { trimColor: hex });
                        castleEditorState.notify();
                    }
                }
            },
            {
                kind: 'color',
                label: 'Crystal Core Color',
                get: () => currentIsland()?.colors?.crystalColor || '#ec4899',
                set: (hex: string) => {
                    if (selectedId()) {
                        ctx.skyCastles.setIslandColors(selectedId()!, { crystalColor: hex });
                        castleEditorState.notify();
                    }
                }
            },
            {
                kind: 'slider',
                label: 'Crystal Bloom Intensity',
                min: 0.0,
                max: 3.0,
                step: 0.05,
                get: () => currentIsland()?.colors?.crystalBloom ?? 0.7,
                set: (v: number) => {
                    if (selectedId()) {
                        ctx.skyCastles.setIslandColors(selectedId()!, { crystalBloom: v });
                        castleEditorState.notify();
                    }
                }
            }
        ]
    });

    // ── 5. CLOUD SEA DECK (Omitted in blueprint drawer) ────────────────────────
    if (ctx.variant === 'panel') {
        sections.push({
            kind: 'section',
            title: 'CLOUD SEA FOG DECK',
            children: [
                {
                    kind: 'toggle',
                    onLabel: 'Cloud Sea Fog Deck: Active',
                    offLabel: 'Cloud Sea Fog Deck: Disabled',
                    get: () => ctx.skyCastles.layerFogEnabled,
                    set: (on: boolean) => {
                        ctx.skyCastles.setLayerFogEnabled(on);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Deck Altitude',
                    min: 50,
                    max: 1000,
                    step: 10,
                    unit: 'm',
                    precision: 0,
                    get: () => ctx.skyCastles.layerFogAltitude,
                    set: (v: number) => {
                        ctx.skyCastles.setLayerFogAltitude(v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Fog Density',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => ctx.skyCastles.layerFogDensity,
                    set: (v: number) => {
                        ctx.skyCastles.setLayerFogDensity(v);
                    }
                },
                {
                    kind: 'color',
                    label: 'Fog Color',
                    get: () => globalConfigManager.config.skyCitadel?.layerFogColor || '#e0e7ff',
                    set: (hex: string) => {
                        ctx.skyCastles.setLayerFogColor(hex);
                        if (globalConfigManager.config.skyCitadel) {
                            globalConfigManager.config.skyCitadel.layerFogColor = hex;
                        }
                    }
                },
                {
                    kind: 'color',
                    label: 'Fog Emissive Radiance',
                    get: () => globalConfigManager.config.skyCitadel?.layerFogEmissive || '#c7d2fe',
                    set: (hex: string) => {
                        ctx.skyCastles.setLayerFogEmissive(hex);
                        if (globalConfigManager.config.skyCitadel) {
                            globalConfigManager.config.skyCitadel.layerFogEmissive = hex;
                        }
                    }
                },
                {
                    kind: 'slider',
                    label: 'Fog Bloom Glow',
                    min: 0.0,
                    max: 3.0,
                    step: 0.05,
                    get: () => globalConfigManager.config.skyCitadel?.layerFogBloom ?? 0.8,
                    set: (v: number) => {
                        ctx.skyCastles.setLayerFogBloom(v);
                        if (globalConfigManager.config.skyCitadel) {
                            globalConfigManager.config.skyCitadel.layerFogBloom = v;
                        }
                    }
                }
            ]
        });
    }

    // ── 6. LAYOUT ──────────────────────────────────────────────────────────────
    sections.push({
        kind: 'section',
        title: 'LAYOUT PRESETS',
        children: [
            {
                kind: 'buttonRow',
                buttons: [
                    {
                        kind: 'button',
                        text: 'Spatial Spread',
                        onClick: () => {
                            ctx.skyCastles.applyLayoutPreset('spacious');
                            castleEditorState.notify();
                            ctx.status('Applied Spatial Spread layout');
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Wide Ring',
                        onClick: () => {
                            ctx.skyCastles.applyLayoutPreset('ring');
                            castleEditorState.notify();
                            ctx.status('Applied Wide Ring layout');
                        }
                    },
                    {
                        kind: 'button',
                        text: 'Compact',
                        onClick: () => {
                            ctx.skyCastles.applyLayoutPreset('compact');
                            castleEditorState.notify();
                            ctx.status('Applied Compact Cluster layout');
                        }
                    }
                ]
            },
            {
                kind: 'button',
                text: 'Reset Island Positions',
                tone: 'danger',
                onClick: () => {
                    if (window.confirm('Reset all floating islands to factory layout?')) {
                        ctx.skyCastles.resetToDefaults();
                        castleEditorState.notify();
                        ctx.status('Reset island layout to factory defaults');
                    }
                }
            }
        ]
    });

    return sections;
}
