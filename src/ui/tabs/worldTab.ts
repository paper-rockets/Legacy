import { ControlDef } from '../panel/types';
import { TerrainSystem, TERRAIN_PALETTES } from '../../world/terrain';
import { WaterSystem } from '../../world/water';
import { LightingSystem, numberToHexString, hexStringToNumber } from '../../world/lighting';
import { RenderPipeline } from '../../core/renderer';
import { AmbientAudioEngine } from '../../audio/audio';
import { globalConfigManager } from '../../core/config';
import { BiomeId } from '../../world/noise';

export interface WorldTabContext {
    terrain: TerrainSystem;
    water: WaterSystem;
    lighting: LightingSystem;
    pipeline: RenderPipeline;
    audio: AmbientAudioEngine;
    photoMode: { enter: () => void };
    biomeId: () => BiomeId;
    onTimePhaseChanged?: (phase: number) => void;
    status: (message: string, isError?: boolean) => void;
    rebuild: () => void;
}

export function buildWorldTab(ctx: WorldTabContext): ControlDef[] {
    const biomeId = () => ctx.biomeId();
    const terrainCfg = () => globalConfigManager.getBiomeConfig(biomeId()).terrain;
    const waterCfg = () => globalConfigManager.getBiomeConfig(biomeId()).water;
    const phaseIndex = () => ctx.lighting.timePhase || 0;
    const phaseCfg = () => globalConfigManager.getBiomeConfig(biomeId()).phases[phaseIndex()] || globalConfigManager.getBiomeConfig(biomeId()).phases[0];

    return [
        // ── 1. TERRAIN ─────────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'TERRAIN',
            tag: () => terrainCfg().presetName?.toUpperCase() || 'CUSTOM',
            children: [
                {
                    kind: 'buttonRow',
                    buttons: Object.keys(TERRAIN_PALETTES).slice(0, 4).map((name) => ({
                        kind: 'button',
                        text: name.split(' ')[0],
                        onClick: () => {
                            ctx.terrain.applyBiomePalette(biomeId(), name);
                            ctx.status(`Applied "${name}" palette`);
                            ctx.rebuild();
                        }
                    }))
                },
                {
                    kind: 'buttonRow',
                    buttons: Object.keys(TERRAIN_PALETTES).slice(4).map((name) => ({
                        kind: 'button',
                        text: name.split(' ')[0],
                        onClick: () => {
                            ctx.terrain.applyBiomePalette(biomeId(), name);
                            ctx.status(`Applied "${name}" palette`);
                            ctx.rebuild();
                        }
                    }))
                },
                {
                    kind: 'color',
                    label: 'Low Elevation Color',
                    get: () => terrainCfg().colorLow || '#76d149',
                    set: (hex: string) => {
                        ctx.terrain.setBiomeTerrainColors(biomeId(), { colorLow: hex });
                    }
                },
                {
                    kind: 'color',
                    label: 'High Elevation Color',
                    get: () => terrainCfg().colorHigh || '#89e05e',
                    set: (hex: string) => {
                        ctx.terrain.setBiomeTerrainColors(biomeId(), { colorHigh: hex });
                    }
                },
                {
                    kind: 'color',
                    label: 'Dirt / Rock Color',
                    get: () => terrainCfg().colorDirt || '#dcb58a',
                    set: (hex: string) => {
                        ctx.terrain.setBiomeTerrainColors(biomeId(), { colorDirt: hex });
                    }
                },
                {
                    kind: 'color',
                    label: 'Path / Trail Color',
                    get: () => terrainCfg().colorPath || '#bd9973',
                    set: (hex: string) => {
                        ctx.terrain.setBiomeTerrainColors(biomeId(), { colorPath: hex });
                    }
                },
                {
                    kind: 'color',
                    label: 'Sand / Shore Color',
                    get: () => terrainCfg().colorSand || '#f2e1b8',
                    set: (hex: string) => {
                        ctx.terrain.setBiomeTerrainColors(biomeId(), { colorSand: hex });
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Terrain Shading Style',
                    options: [
                        { value: 'toon', text: 'Painterly Toon' },
                        { value: 'standard', text: 'Modern PBR' },
                        { value: 'crystal', text: 'Crystal Glass' }
                    ],
                    get: () => ctx.terrain.terrainStyle,
                    set: (val: string) => {
                        ctx.terrain.setTerrainStyle(val as any, biomeId());
                        ctx.rebuild();
                    }
                },
                {
                    kind: 'slider',
                    label: 'Glass Transmission',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => ctx.terrain.crystalParams.glassTransmission,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ glassTransmission: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Iridescence',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 3.0,
                    step: 0.1,
                    get: () => ctx.terrain.crystalParams.iridescence,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ iridescence: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Specular Glint',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    get: () => ctx.terrain.crystalParams.specularGlint,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ specularGlint: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bevel Gleam',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 3.0,
                    step: 0.1,
                    get: () => ctx.terrain.crystalParams.bevelGleam,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ bevelGleam: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Vein Glow',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 3.0,
                    step: 0.1,
                    get: () => ctx.terrain.crystalParams.veinGlow,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ veinGlow: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Glass Refraction (IOR)',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 1.0,
                    max: 2.5,
                    step: 0.02,
                    get: () => ctx.terrain.crystalParams.glassRefraction,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ glassRefraction: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Glass Tint',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.0,
                    max: 2.0,
                    step: 0.05,
                    get: () => ctx.terrain.crystalParams.glassTint,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ glassTint: v }, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Vein Scale',
                    visible: () => ctx.terrain.terrainStyle === 'crystal',
                    min: 0.1,
                    max: 5.0,
                    step: 0.1,
                    get: () => ctx.terrain.crystalParams.veinScale,
                    set: (v: number) => {
                        ctx.terrain.setCrystalParams({ veinScale: v }, biomeId());
                    }
                }
            ]
        },

        // ── 2. WATER ───────────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'WATER',
            children: [
                {
                    kind: 'color',
                    label: 'Water Color',
                    get: () => waterCfg().color || '#00d2ff',
                    set: (hex: string) => {
                        ctx.water.setColor(hex, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Water Opacity',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().opacity ?? 0.85,
                    set: (v: number) => {
                        ctx.water.setOpacity(v, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Reflectivity',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().reflectivity ?? 0.8,
                    set: (v: number) => {
                        ctx.water.setReflectivity(v, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Roughness',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().roughness ?? 0.1,
                    set: (v: number) => {
                        ctx.water.setRoughness(v, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Metalness',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().metalness ?? 0.1,
                    set: (v: number) => {
                        ctx.water.setMetalness(v, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Clearcoat',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().clearcoat ?? 0.9,
                    set: (v: number) => {
                        ctx.water.setClearcoat(v, biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Clearcoat Roughness',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => waterCfg().clearcoatRoughness ?? 0.1,
                    set: (v: number) => {
                        ctx.water.setClearcoatRoughness(v, biomeId());
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Water Shading',
                    options: [
                        { value: 'physical', text: 'Physical Shading' },
                        { value: 'toon', text: 'Painterly Toon' }
                    ],
                    get: () => (waterCfg().isToonMode ? 'toon' : 'physical'),
                    set: (val: string) => {
                        ctx.water.setBiomeWater(biomeId(), { isToonMode: val === 'toon' });
                    }
                }
            ]
        },

        // ── 3. SKY AND LIGHT ───────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'SKY AND LIGHT',
            tag: () => ['DAY', 'DUSK', 'TWILIGHT'][phaseIndex()],
            children: [
                {
                    kind: 'segmented',
                    label: 'Time Phase',
                    options: [
                        { value: '0', text: 'Day' },
                        { value: '1', text: 'Dusk' },
                        { value: '2', text: 'Twilight' }
                    ],
                    get: () => String(phaseIndex()),
                    set: (val: string) => {
                        const p = parseInt(val, 10);
                        ctx.lighting.setTimePhase(p, ctx.pipeline.scene);
                        ctx.onTimePhaseChanged?.(p);
                        ctx.rebuild();
                    }
                },
                {
                    kind: 'color',
                    label: 'Sky Background Color',
                    get: () => phaseCfg().bg,
                    set: (hex: string) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { bg: hex }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'color',
                    label: 'Atmospheric Fog Color',
                    get: () => phaseCfg().fog,
                    set: (hex: string) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { fog: hex }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Fog Near Distance',
                    min: 10,
                    max: 1000,
                    step: 10,
                    unit: 'm',
                    precision: 0,
                    get: () => phaseCfg().fogNear,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { fogNear: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Fog Far Distance',
                    min: 100,
                    max: 5000,
                    step: 50,
                    unit: 'm',
                    precision: 0,
                    get: () => phaseCfg().fogFar,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { fogFar: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'color',
                    label: 'Sun / Celestial Body Color',
                    get: () => phaseCfg().sunC,
                    set: (hex: string) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { sunC: hex }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Sun Visual Intensity',
                    min: 0.0,
                    max: 5.0,
                    step: 0.1,
                    get: () => phaseCfg().sunI,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { sunI: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'color',
                    label: 'Ambient Light Color',
                    get: () => phaseCfg().amb,
                    set: (hex: string) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { amb: hex }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Ambient Light Intensity',
                    min: 0.0,
                    max: 3.0,
                    step: 0.05,
                    get: () => phaseCfg().ambI,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { ambI: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'color',
                    label: 'Directional Sunlight Color',
                    get: () => phaseCfg().dir,
                    set: (hex: string) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { dir: hex }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Directional Sunlight Intensity',
                    min: 0.0,
                    max: 4.0,
                    step: 0.1,
                    get: () => phaseCfg().dirI,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { dirI: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Hemisphere Ambient Light',
                    min: 0.0,
                    max: 3.0,
                    step: 0.05,
                    get: () => phaseCfg().hemi,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { hemi: v }, ctx.pipeline.scene);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Starfield Opacity',
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                    get: () => phaseCfg().starOp,
                    set: (v: number) => {
                        ctx.lighting.updateBiomePhaseConfig(biomeId(), phaseIndex(), { starOp: v }, ctx.pipeline.scene);
                    }
                }
            ]
        },

        // ── 4. PERFORMANCE ─────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'PERFORMANCE',
            children: [
                {
                    kind: 'segmented',
                    label: 'Terrain Resolution',
                    options: [
                        { value: '64', text: '64 (Fast)' },
                        { value: '128', text: '128 (Normal)' },
                        { value: '256', text: '256 (Ultra)' }
                    ],
                    get: () => String(ctx.terrain.currentRes),
                    set: (val: string) => {
                        const res = parseInt(val, 10);
                        ctx.terrain.setResolution(res, 1600 / res);
                        ctx.status(`Terrain resolution set to ${res}`);
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Pixel Ratio (DPI Cap)',
                    options: [
                        { value: '1', text: '1.0x (Performance)' },
                        { value: '1.5', text: '1.5x (Balanced)' },
                        { value: '2', text: '2.0x (Retina/High)' }
                    ],
                    get: () => String(ctx.pipeline.basePixelRatio),
                    set: (val: string) => {
                        const ratio = parseFloat(val);
                        ctx.pipeline.setPixelRatioCap(ratio);
                        ctx.status(`Pixel ratio cap set to ${ratio}x`);
                    }
                },
                {
                    kind: 'toggle',
                    onLabel: 'Post-Processing Bloom: Active',
                    offLabel: 'Post-Processing Bloom: Bypassed',
                    get: () => ctx.pipeline.bloomPass.strength > 0.01,
                    set: (on: boolean) => {
                        ctx.pipeline.setBloomStrength(on ? 0.45 : 0.0, biomeId());
                        ctx.status(on ? 'Bloom composer enabled' : 'Bloom composer bypassed for performance');
                    }
                },
                {
                    kind: 'toggle',
                    onLabel: 'Dynamic Shadows: Enabled',
                    offLabel: 'Dynamic Shadows: Disabled',
                    get: () => ctx.pipeline.renderer.shadowMap.enabled,
                    set: (on: boolean) => {
                        ctx.pipeline.renderer.shadowMap.enabled = on;
                        ctx.pipeline.renderer.shadowMap.needsUpdate = true;
                        ctx.status(on ? 'Shadow map enabled' : 'Shadow map disabled for performance');
                    }
                }
            ]
        },

        // ── 5. SESSION TOOLS ───────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'SESSION TOOLS',
            children: [
                {
                    kind: 'toggle',
                    onLabel: 'Background Music: Playing',
                    offLabel: 'Background Music: Paused',
                    get: () => ctx.audio.isMusicPlaying,
                    set: () => {
                        ctx.audio.toggleMusic();
                    }
                },
                {
                    kind: 'button',
                    text: 'Next Music Track',
                    onClick: () => {
                        const name = ctx.audio.nextTrack();
                        ctx.status(`Playing: ${name}`);
                    }
                },
                {
                    kind: 'button',
                    text: 'Enter Photo Mode',
                    tone: 'primary',
                    onClick: () => {
                        ctx.photoMode.enter();
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Export JSON',
                            onClick: () => {
                                const jsonStr = JSON.stringify(globalConfigManager.config, null, 2);
                                const blob = new Blob([jsonStr], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'wanderlust_biome_config.json';
                                a.click();
                                URL.revokeObjectURL(url);
                                ctx.status('Exported config JSON file');
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Import JSON',
                            onClick: () => {
                                const fileInput = document.createElement('input');
                                fileInput.type = 'file';
                                fileInput.accept = '.json';
                                fileInput.addEventListener('change', async () => {
                                    const file = fileInput.files?.[0];
                                    if (file) {
                                        try {
                                            const text = await file.text();
                                            const parsed = JSON.parse(text);
                                            Object.assign(globalConfigManager.config, parsed);
                                            await globalConfigManager.saveConfigToDisk();
                                            ctx.status('Imported and saved config JSON');
                                            ctx.rebuild();
                                        } catch (err: any) {
                                            ctx.status(`Import error: ${err.message}`, true);
                                        }
                                    }
                                });
                                fileInput.click();
                            }
                        }
                    ]
                }
            ]
        }
    ];
}
