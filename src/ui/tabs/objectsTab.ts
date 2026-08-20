import { ControlDef } from '../panel/types';
import { WorldPropsSystem, WORLD_PROP_CATALOG, WorldPropCatalogItem } from '../../world/worldProps';
import { PlayerSystem } from '../../player/player';
import { RenderPipeline } from '../../core/renderer';
import { ThumbnailGenerator } from '../thumbnailGenerator';
import { PlacedWorldProp } from '../../core/config';

export interface ObjectsTabContext {
    worldProps: WorldPropsSystem;
    player: PlayerSystem;
    pipeline: RenderPipeline;
    status: (message: string, isError?: boolean) => void;
    rebuild: () => void;
}

interface ObjectsTabState {
    search: string;
    category: 'all' | 'castles' | 'ships';
}

export function buildObjectsTab(ctx: ObjectsTabContext): ControlDef[] {
    const state: ObjectsTabState = {
        search: '',
        category: 'all'
    };

    function getFilteredCatalog(): WorldPropCatalogItem[] {
        const fullCatalog = WORLD_PROP_CATALOG;
        const q = state.search.trim().toLowerCase();

        return fullCatalog.filter((item) => {
            if (state.category === 'castles' && item.category !== 'Castles & Towers') return false;
            if (state.category === 'ships' && item.category !== 'Ships & Vessels') return false;

            if (q) {
                const matchName = item.name.toLowerCase().includes(q);
                const matchCat = item.category?.toLowerCase().includes(q);
                const matchDesc = item.description?.toLowerCase().includes(q);
                if (!matchName && !matchCat && !matchDesc) return false;
            }

            return true;
        });
    }

    const selectedProp = () => ctx.worldProps.getSelectedProp();

    // ── Global Viewport Placement Listener ────────────────────────────────────
    let placementHudEl: HTMLElement | null = null;

    const onPointerMove = (e: PointerEvent) => {
        if (ctx.worldProps.isPlacing) {
            ctx.worldProps.updatePlacementFromMouse(e.clientX, e.clientY, ctx.pipeline.camera);
        }
    };

    const onPointerDown = (e: MouseEvent) => {
        if (ctx.worldProps.isPlacing) {
            // Check if clicking inside panel
            const panel = document.getElementById('dev-editor-panel');
            if (panel && panel.contains(e.target as Node)) return;

            const placed = ctx.worldProps.confirmPlacement();
            if (placed) {
                ctx.status(`Placed "${placed.name}"`);
                ctx.rebuild();
            }
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (ctx.worldProps.isPlacing) {
            if (e.key === 'Escape') {
                ctx.worldProps.cancelPlacement();
                ctx.status('Cancelled placement');
                ctx.rebuild();
            } else if (e.key === 'ArrowLeft') {
                ctx.worldProps.nudgeGhostPosition(-2, 0);
            } else if (e.key === 'ArrowRight') {
                ctx.worldProps.nudgeGhostPosition(2, 0);
            } else if (e.key === 'ArrowUp') {
                ctx.worldProps.nudgeGhostPosition(0, -2);
            } else if (e.key === 'ArrowDown') {
                ctx.worldProps.nudgeGhostPosition(0, 2);
            } else if (e.key === 'PageUp') {
                ctx.worldProps.nudgeGhostElevation(1);
            } else if (e.key === 'PageDown') {
                ctx.worldProps.nudgeGhostElevation(-1);
            } else if (e.key === '[') {
                ctx.worldProps.nudgeGhostScale(-0.1);
            } else if (e.key === ']') {
                ctx.worldProps.nudgeGhostScale(0.1);
            }
        } else if (ctx.worldProps.selectedPropId) {
            const id = ctx.worldProps.selectedPropId;
            if (e.key === 'ArrowLeft') {
                ctx.worldProps.nudgePropPosition(id, -2, 0);
            } else if (e.key === 'ArrowRight') {
                ctx.worldProps.nudgePropPosition(id, 2, 0);
            } else if (e.key === 'ArrowUp') {
                ctx.worldProps.nudgePropPosition(id, 0, -2);
            } else if (e.key === 'ArrowDown') {
                ctx.worldProps.nudgePropPosition(id, 0, 2);
            } else if (e.key === 'PageUp') {
                ctx.worldProps.nudgePropElevation(id, 1);
            } else if (e.key === 'PageDown') {
                ctx.worldProps.nudgePropElevation(id, -1);
            } else if (e.key === '[') {
                ctx.worldProps.nudgePropScale(id, -0.1);
            } else if (e.key === ']') {
                ctx.worldProps.nudgePropScale(id, 0.1);
            }
        }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('click', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return [
        // ── 1. PLACE IN WORLD ──────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'PLACE IN WORLD',
            children: [
                {
                    kind: 'search',
                    placeholder: 'Filter structures & vessels...',
                    get: () => state.search,
                    set: (q: string) => {
                        state.search = q;
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Category',
                    options: [
                        { value: 'all', text: 'All' },
                        { value: 'castles', text: 'Castles' },
                        { value: 'ships', text: 'Ships' }
                    ],
                    get: () => state.category,
                    set: (cat) => {
                        state.category = cat as 'all' | 'castles' | 'ships';
                    }
                },
                {
                    kind: 'cardGrid',
                    items: () => {
                        return getFilteredCatalog().map((item) => ({
                            id: item.id,
                            name: item.name,
                            meta: item.category,
                            thumbnail: () => ThumbnailGenerator.getModelThumbnail(item.path),
                            selected: () => ctx.worldProps.placingModelId === item.id
                        }));
                    },
                    onSelect: (id: string) => {
                        ctx.worldProps.startPlacement(id);
                        ctx.status(`Placement active: Click in 3D viewport to place`);
                        ctx.rebuild();
                    },
                    emptyText: 'No matching props found'
                },
                {
                    kind: 'custom',
                    mount: (host: HTMLElement) => {
                        // Placement HUD floating element
                        if (!placementHudEl) {
                            placementHudEl = document.createElement('div');
                            placementHudEl.style.position = 'fixed';
                            placementHudEl.style.top = '70px';
                            placementHudEl.style.left = '50%';
                            placementHudEl.style.transform = 'translateX(-50%)';
                            placementHudEl.style.background = 'rgba(15, 23, 42, 0.92)';
                            placementHudEl.style.border = '1px solid #38bdf8';
                            placementHudEl.style.borderRadius = '8px';
                            placementHudEl.style.padding = '8px 16px';
                            placementHudEl.style.color = '#ffffff';
                            placementHudEl.style.fontSize = '11px';
                            placementHudEl.style.fontWeight = '800';
                            placementHudEl.style.textTransform = 'uppercase';
                            placementHudEl.style.zIndex = '150';
                            placementHudEl.style.display = 'none';
                            placementHudEl.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
                            document.body.appendChild(placementHudEl);
                        }
                    },
                    refresh: () => {
                        if (placementHudEl) {
                            if (ctx.worldProps.isPlacing) {
                                const modelItem = WORLD_PROP_CATALOG.find(i => i.id === ctx.worldProps.placingModelId);
                                placementHudEl.textContent = `PLACING: ${modelItem?.name || 'OBJECT'} - CLICK VIEWPORT TO CONFIRM (ESC TO CANCEL)`;
                                placementHudEl.style.display = 'block';
                            } else {
                                placementHudEl.style.display = 'none';
                            }
                        }
                    },
                    destroy: () => {
                        if (placementHudEl) {
                            placementHudEl.remove();
                            placementHudEl = null;
                        }
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('click', onPointerDown);
                        window.removeEventListener('keydown', onKeyDown);
                    }
                }
            ]
        },

        // ── 2. PLACED OBJECTS ──────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'PLACED OBJECTS',
            tag: () => `${ctx.worldProps.getPlacedProps().length} OBJECTS`,
            children: [
                {
                    kind: 'custom',
                    mount: (host: HTMLElement) => {
                        host.innerHTML = '';

                        const listWrap = document.createElement('div');
                        listWrap.style.display = 'flex';
                        listWrap.style.flexDirection = 'column';
                        listWrap.style.gap = '4px';
                        listWrap.style.maxHeight = '160px';
                        listWrap.style.overflowY = 'auto';

                        const props = ctx.worldProps.getPlacedProps();

                        if (props.length === 0) {
                            const empty = document.createElement('div');
                            empty.className = 'dev-card-empty';
                            empty.textContent = 'No placed objects in the world';
                            listWrap.appendChild(empty);
                        } else {
                            props.forEach((p: PlacedWorldProp) => {
                                const row = document.createElement('div');
                                row.className = 'dev-readout-row';
                                row.style.cursor = 'pointer';
                                if (ctx.worldProps.selectedPropId === p.id) {
                                    row.style.borderColor = '#38bdf8';
                                    row.style.background = 'rgba(56, 189, 248, 0.15)';
                                }

                                const label = document.createElement('span');
                                label.className = 'dev-readout-text';
                                label.textContent = `${p.name} (${Math.round(p.position[0])}, ${Math.round(p.position[2])})`;

                                const delBtn = document.createElement('button');
                                delBtn.className = 'dev-btn tone-danger';
                                delBtn.textContent = 'DEL';
                                delBtn.style.padding = '2px 6px';
                                delBtn.style.fontSize = '9px';

                                delBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    ctx.worldProps.deleteProp(p.id);
                                    ctx.status(`Deleted "${p.name}"`);
                                    ctx.rebuild();
                                });

                                row.addEventListener('click', () => {
                                    ctx.worldProps.selectProp(p.id);
                                    ctx.rebuild();
                                });

                                row.appendChild(label);
                                row.appendChild(delBtn);
                                listWrap.appendChild(row);
                            });
                        }

                        host.appendChild(listWrap);

                        if (props.length > 0) {
                            const clearBtn = document.createElement('button');
                            clearBtn.className = 'dev-btn tone-danger';
                            clearBtn.textContent = 'Clear All Placed Objects';
                            clearBtn.style.marginTop = '6px';
                            clearBtn.addEventListener('click', () => {
                                if (window.confirm('Delete all placed objects across the entire world?')) {
                                    ctx.worldProps.clearAllProps();
                                    ctx.status('Cleared all placed objects');
                                    ctx.rebuild();
                                }
                            });
                            host.appendChild(clearBtn);
                        }
                    }
                }
            ]
        },

        // ── 3. SELECTED OBJECT ─────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'SELECTED OBJECT',
            visible: () => selectedProp() !== null,
            tag: () => (selectedProp()?.name || '').toUpperCase(),
            children: [
                {
                    kind: 'button',
                    text: 'Move with Mouse',
                    tone: 'primary',
                    onClick: () => {
                        const cur = selectedProp();
                        if (cur) {
                            ctx.worldProps.startMoving(cur.id);
                            ctx.status(`Repositioning "${cur.name}" - Click in viewport to set new position`);
                            ctx.rebuild();
                        }
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: '+Z (North)',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropPosition(selectedProp()!.id, 0, 5);
                            }
                        },
                        {
                            kind: 'button',
                            text: '-Z (South)',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropPosition(selectedProp()!.id, 0, -5);
                            }
                        },
                        {
                            kind: 'button',
                            text: '-X (West)',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropPosition(selectedProp()!.id, -5, 0);
                            }
                        },
                        {
                            kind: 'button',
                            text: '+X (East)',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropPosition(selectedProp()!.id, 5, 0);
                            }
                        }
                    ]
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Elev +1m',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropElevation(selectedProp()!.id, 1.0);
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Elev -1m',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropElevation(selectedProp()!.id, -1.0);
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Scale -0.2x',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropScale(selectedProp()!.id, -0.2);
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Scale +0.2x',
                            onClick: () => {
                                if (selectedProp()) ctx.worldProps.nudgePropScale(selectedProp()!.id, 0.2);
                            }
                        }
                    ]
                },
                {
                    kind: 'slider',
                    label: 'Object Scale',
                    min: 0.1,
                    max: 50.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    get: () => selectedProp()?.scale ?? 1.0,
                    set: (v: number) => {
                        if (selectedProp()) ctx.worldProps.setPropScale(selectedProp()!.id, v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Ground Elevation Offset',
                    min: -50.0,
                    max: 200.0,
                    step: 0.5,
                    unit: 'm',
                    numeric: true,
                    get: () => selectedProp()?.groundOffset ?? 0.0,
                    set: (v: number) => {
                        if (selectedProp()) ctx.worldProps.setPropGroundOffset(selectedProp()!.id, v);
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Snap to Ground',
                            onClick: () => {
                                if (selectedProp()) {
                                    ctx.worldProps.snapToGround(selectedProp()!.id);
                                    ctx.status('Snapped to ground');
                                }
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Snap to Water Level',
                            onClick: () => {
                                if (selectedProp()) {
                                    ctx.worldProps.snapToWater(selectedProp()!.id);
                                    ctx.status('Snapped to water level (y = 0)');
                                }
                            }
                        }
                    ]
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
                        const cur = selectedProp();
                        return cur ? Math.round((cur.rotation[1] * (180 / Math.PI)) % 360) : 0;
                    },
                    set: (deg: number) => {
                        if (selectedProp()) ctx.worldProps.setPropRotation(selectedProp()!.id, deg);
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Focus',
                            tone: 'primary',
                            onClick: () => {
                                const cur = selectedProp();
                                if (cur) {
                                    ctx.player.teleportTo(cur.position[0], cur.position[2], 50, cur.position[1] + 30);
                                    ctx.status(`Focused on "${cur.name}"`);
                                }
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Duplicate',
                            tone: 'default',
                            onClick: () => {
                                const cur = selectedProp();
                                if (cur) {
                                    const dup = ctx.worldProps.duplicateProp(cur.id);
                                    if (dup) {
                                        ctx.status(`Duplicated "${dup.name}"`);
                                        ctx.rebuild();
                                    }
                                }
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Delete',
                            tone: 'danger',
                            onClick: () => {
                                const cur = selectedProp();
                                if (cur) {
                                    ctx.worldProps.deleteProp(cur.id);
                                    ctx.status(`Deleted "${cur.name}"`);
                                    ctx.rebuild();
                                }
                            }
                        }
                    ]
                }
            ]
        }
    ];
}
