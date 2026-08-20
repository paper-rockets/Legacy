import { BiomeId } from '../world/noise';

export interface EnvPhaseConfig {
    bg: string;
    fog: string;
    fogNear: number;
    fogFar: number;
    amb: string;
    ambI: number;
    dir: string;
    dirI: number;
    dirPos: { x: number; y: number; z: number };
    hemi: number;
    sunI: number;
    sunC: string;
    sunPos: { x: number; y: number; z: number };
    sunScale: number;
    starOp: number;
}

export interface BloomSettings {
    globalStrength: number;
    globalRadius: number;
    globalThreshold: number;
    cloudBloom: number;
    cloudColor: string;
    cloudEmissive: string;
    treeBloom: number;
    treeCanopyGlow: number;
    treeTrunkGlow: number;
    bushBloom: number;
    bushGlow: number;
    shoreBloom: number;
    shoreColor: string;
    shoreWidth: number;
}

export interface WaterSettings {
    color: string;
    opacity: number;
    reflectivity: number;
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    isToonMode: boolean;
}

export interface TerrainColorsSettings {
    colorLow: string;
    colorHigh: string;
    colorDirt: string;
    colorPath: string;
    colorSand: string;
    presetName?: string;
    isToonMode?: boolean;
    terrainStyle?: 'toon' | 'standard' | 'crystal';
    isCrystalMode?: boolean;
    glassTransmission?: number;
    iridescence?: number;
    specularGlint?: number;
    bevelGleam?: number;
    veinGlow?: number;
    glassRefraction?: number;
    glassTint?: number;
    veinScale?: number;
    spireScale?: number;
    shardSpeed?: number;
    showGroundCrystals?: boolean;
}

export interface ModelVegetationConfig {
    modelId: string;
    enabled: boolean;
    scale: number;
    density: number;
    bioluminescence?: number;
    useOriginalColors: boolean;
    canopyColors: string[];
    leafColors: string[];
    trunkColors: string[];
    activePreset?: string;
}

export function getDefaultModelConfig(modelId: string): ModelVegetationConfig {
    const isFlower = modelId.includes('flower') || modelId.includes('clover') || modelId.includes('bush');
    const isCastle = modelId.includes('castle');
    const isShip = modelId.includes('ship') || modelId.includes('boat') || modelId.includes('galleon');

    let scale = 6.0;
    let density = 250;
    if (isFlower) {
        scale = 3.5;
        density = 350;
    } else if (isCastle) {
        scale = 12.0;
        density = 25;
    } else if (isShip) {
        scale = 8.0;
        density = 40;
    }

    return {
        modelId,
        enabled: false,
        scale,
        density,
        bioluminescence: 0.8,
        useOriginalColors: false,
        canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600'],
        leafColors: ['#22c55e', '#16a34a', '#15803d', '#4ade80', '#10b981'],
        trunkColors: ['#5c3a21', '#451a03', '#78350f', '#3f3f46'],
        activePreset: 'candy'
    };
}

export interface VegetationBiomeSettings {
    treeScale: number;
    treeDensity: number;
    bushScale: number;
    bushDensity: number;
    bioluminescence?: number;
    glowStickEnabled?: boolean;
    glowStickRatio?: number;
    glowStickIntensity?: number;
    candyGloss?: number;
    sugarSparkle?: number;
    candyTranslucency?: number;
    textureStyle?: 'original' | 'candy' | 'cotton_candy' | 'flutter';
    floatingPlanetsEnabled?: boolean;
    floatingPlanetAltitude?: number;
    floatingPlanetCount?: number;
    canopyColors: string[];
    trunkColors: string[];
    activePreset: string;
    selectedTreeModelIds: string[];
    models?: Record<string, ModelVegetationConfig>;
}

export interface CastleColorSettings {
    preset?: string;
    roofColor?: string;
    wallColor?: string;
    trimColor?: string;
    crystalColor?: string;
    crystalBloom?: number;
}

export interface SkyCastleIslandDef {
    id: string;
    name: string;
    modelPath: string;
    x: number;
    y: number;
    z: number;
    rotationY: number;
    scale: number;
    cloudRadius: number;
    cloudPuffCount: number;
    colors?: CastleColorSettings;
    locked?: boolean;
}

export interface SkyCitadelSettings {
    layerFogEnabled: boolean;
    layerFogAltitude: number;
    layerFogDensity: number;
    layerFogColor: string;
    layerFogEmissive: string;
    layerFogBloom: number;
}

export interface BiomeConfig {
    id: BiomeId;
    name: string;
    terrain: TerrainColorsSettings;
    water: WaterSettings;
    bloom: BloomSettings;
    vegetation: VegetationBiomeSettings;
    phases: [EnvPhaseConfig, EnvPhaseConfig, EnvPhaseConfig]; // Day, Dusk, Twilight
}

export interface PlacedWorldProp {
    id: string;
    modelId: string;
    name: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
    groundOffset: number;
    biomeId?: BiomeId;
    locked?: boolean;
}

export interface AppConfig {
    version: number;
    activeBiomeId: BiomeId;
    globalBloom: {
        strength: number;
        radius: number;
        threshold: number;
    };
    cloud: {
        bloom: number;
        color: string;
        emissive: string;
    };
    skyCastles?: SkyCastleIslandDef[];
    skyCitadel?: SkyCitadelSettings;
    biomes: Record<BiomeId, BiomeConfig>;
    placedProps?: PlacedWorldProp[];
}

function createDefaultPhases(
    dayBg: string, dayFog: string, dayAmb: string, dayDir: string,
    duskBg: string, duskFog: string, duskAmb: string, duskDir: string,
    twiBg: string, twiFog: string, twiAmb: string, twiDir: string
): [EnvPhaseConfig, EnvPhaseConfig, EnvPhaseConfig] {
    return [
        {
            // Day
            bg: dayBg, fog: dayFog, fogNear: 60, fogFar: 420,
            amb: dayAmb, ambI: 0.6,
            dir: dayDir, dirI: 0.9,
            dirPos: { x: 250, y: 350, z: -200 },
            hemi: 0.45,
            sunI: 0.9, sunC: '#fffae0',
            sunPos: { x: 350, y: 400, z: -850 },
            sunScale: 1.0,
            starOp: 0.0
        },
        {
            // Dusk
            bg: duskBg, fog: duskFog, fogNear: 50, fogFar: 380,
            amb: duskAmb, ambI: 0.5,
            dir: duskDir, dirI: 0.85,
            dirPos: { x: 0, y: 45, z: -600 },
            hemi: 0.35,
            sunI: 1.0, sunC: '#ff5511',
            sunPos: { x: 0, y: 15, z: -700 },
            sunScale: 1.6,
            starOp: 0.1
        },
        {
            // Twilight
            bg: twiBg, fog: twiFog, fogNear: 40, fogFar: 360,
            amb: twiAmb, ambI: 0.7,
            dir: twiDir, dirI: 0.6,
            dirPos: { x: 100, y: 250, z: -100 },
            hemi: 0.4,
            sunI: 0.0, sunC: '#000000',
            sunPos: { x: 0, y: -300, z: -800 },
            sunScale: 0.1,
            starOp: 0.95
        }
    ];
}

export const FACTORY_CONFIG: AppConfig = {
    version: 18,
    activeBiomeId: 'candyland',
    placedProps: [],
    globalBloom: {
        strength: 0.0,
        radius: 0.0,
        threshold: 0.70
    },
    cloud: {
        bloom: 0.0,
        color: '#ffffff',
        emissive: '#fff6ea'
    },
    biomes: {
        candyland: {
            id: 'candyland',
            name: 'Candyland',
            terrain: {
                colorLow: '#fffbf5',
                colorHigh: '#fce7f3',
                colorDirt: '#e9d5ff',
                colorPath: '#fed7aa',
                colorSand: '#ffffff',
                presetName: 'Marshmallow Pastel',
                isToonMode: true
            },
            water: {
                color: '#f472b6',
                opacity: 0.76,
                reflectivity: 0.88,
                roughness: 0.12,
                metalness: 0.05,
                clearcoat: 0.9,
                clearcoatRoughness: 0.12,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#fbcfe8',
                cloudEmissive: '#fdf2f8',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#fbcfe8',
                shoreWidth: 1.1
            },
            vegetation: {
                treeScale: 8.25,
                treeDensity: 280,
                bushScale: 1.1,
                bushDensity: 180,
                bioluminescence: 0.8,
                glowStickEnabled: true,
                glowStickRatio: 0.20,
                glowStickIntensity: 3.0,
                candyGloss: 1.35,
                sugarSparkle: 0.85,
                candyTranslucency: 0.7,
                floatingPlanetsEnabled: true,
                floatingPlanetAltitude: 14.0,
                floatingPlanetCount: 3,
                canopyColors: ['#f472b6', '#93c5fd', '#fde047', '#c084fc', '#ffffff', '#ffb6c1', '#a7f3d0'],
                trunkColors: ['#ffffff', '#fffbf0', '#ffe4e6', '#f0f9ff'],
                activePreset: 'candyland_pastel',
                selectedTreeModelIds: ['candy_cotton_cloud', 'candy_lollipop_spiral', 'candy_lollipop_sphere', 'candy_cane_cluster', 'candy_gummy_flower']
            },
            phases: createDefaultPhases(
                '#c7d2fe', '#fbcfe8', '#fdf4ff', '#fffbeb',
                '#f472b6', '#fbcfe8', '#fdf2f8', '#fb923c',
                '#312e81', '#4338ca', '#6366f1', '#818cf8'
            )
        },
        meadow: {
            id: 'meadow',
            name: 'Meadow',
            terrain: {
                colorLow: '#76d149',
                colorHigh: '#89e05e',
                colorDirt: '#dcb58a',
                colorPath: '#bd9973',
                colorSand: '#f2e1b8',
                presetName: 'Lush Green',
                isToonMode: true
            },
            water: {
                color: '#4da9e8',
                opacity: 0.82,
                reflectivity: 0.65,
                roughness: 0.18,
                metalness: 0.05,
                clearcoat: 0.8,
                clearcoatRoughness: 0.15,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#ffffff',
                cloudEmissive: '#fff6ea',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#ffffff',
                shoreWidth: 0.8
            },
            vegetation: {
                treeScale: 22.5,
                treeDensity: 200,
                bushScale: 1.0,
                bushDensity: 0,
                bioluminescence: 0.35,
                canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600', '#ff7700', '#ff1744'],
                trunkColors: ['#ffffff', '#fff3e0', '#ffe4e6', '#e0f7fa'],
                activePreset: 'candy',
                selectedTreeModelIds: ['veg_cartoon_1', 'veg_cartoon_2', 'veg_bigtree_1', 'veg_tree_broadleaf_1']
            },
            phases: createDefaultPhases(
                '#8cbce6', '#8cbce6', '#dcf2ff', '#fffaeb',
                '#dd5e42', '#dd5e42', '#6a4055', '#ff7722',
                '#18182c', '#18182c', '#444470', '#6677aa'
            )
        },
        archipelago: {
            id: 'archipelago',
            name: 'Archipelago',
            terrain: {
                colorLow: '#6ee7b7',
                colorHigh: '#93c5fd',
                colorDirt: '#e2e8f0',
                colorPath: '#c4b5fd',
                colorSand: '#fef08a',
                presetName: 'Ghibli Pastel',
                isToonMode: true
            },
            water: {
                color: '#38bdf8',
                opacity: 0.75,
                reflectivity: 0.80,
                roughness: 0.12,
                metalness: 0.05,
                clearcoat: 0.9,
                clearcoatRoughness: 0.12,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#ffffff',
                cloudEmissive: '#f0f9ff',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#bae6fd',
                shoreWidth: 1.0
            },
            vegetation: {
                treeScale: 22.5,
                treeDensity: 200,
                bushScale: 1.1,
                bushDensity: 0,
                bioluminescence: 0.35,
                canopyColors: ['#ff69b4', '#ffb6c1', '#fbcfe8', '#c4b5fd', '#93c5fd', '#ffffff'],
                trunkColors: ['#fff3e0', '#ffe4e6', '#d6d3d1'],
                activePreset: 'archipelago',
                selectedTreeModelIds: ['veg_cherry_blossom', 'veg_palm_a', 'veg_cartoon_7', 'veg_clover_2']
            },
            phases: createDefaultPhases(
                '#7dd3fc', '#7dd3fc', '#e0f2fe', '#fffbeb',
                '#f43f5e', '#f43f5e', '#831843', '#fb923c',
                '#0f172a', '#0f172a', '#38bdf8', '#818cf8'
            )
        },
        geothermal: {
            id: 'geothermal',
            name: 'Geothermal',
            terrain: {
                colorLow: '#d97706',
                colorHigh: '#f59e0b',
                colorDirt: '#27272a',
                colorPath: '#9a3412',
                colorSand: '#fde68a',
                presetName: 'Autumn Warmth',
                isToonMode: true
            },
            water: {
                color: '#0284c7',
                opacity: 0.88,
                reflectivity: 0.55,
                roughness: 0.25,
                metalness: 0.10,
                clearcoat: 0.7,
                clearcoatRoughness: 0.2,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#fed7aa',
                cloudEmissive: '#ffedd5',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#fed7aa',
                shoreWidth: 1.1
            },
            vegetation: {
                treeScale: 22.5,
                treeDensity: 200,
                bushScale: 0.95,
                bushDensity: 0,
                bioluminescence: 0.35,
                canopyColors: ['#ff3300', '#ff7700', '#ffaa00', '#cc1100', '#f59e0b'],
                trunkColors: ['#27272a', '#3f3f46', '#1c1917'],
                activePreset: 'geothermal',
                selectedTreeModelIds: ['veg_cartoon_8', 'veg_cartoon_10', 'veg_tree_var4']
            },
            phases: createDefaultPhases(
                '#fdba74', '#fdba74', '#ffedd5', '#fff7ed',
                '#dc2626', '#dc2626', '#450a0a', '#ea580c',
                '#1c1917', '#1c1917', '#78350f', '#f97316'
            )
        },
        estuary: {
            id: 'estuary',
            name: 'Estuary',
            terrain: {
                colorLow: '#10b981',
                colorHigh: '#06b6d4',
                colorDirt: '#ec4899',
                colorPath: '#a855f7',
                colorSand: '#fed7aa',
                presetName: 'Candy Meadow',
                isToonMode: true
            },
            water: {
                color: '#06b6d4',
                opacity: 0.70,
                reflectivity: 0.85,
                roughness: 0.10,
                metalness: 0.05,
                clearcoat: 0.95,
                clearcoatRoughness: 0.10,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#a7f3d0',
                cloudEmissive: '#ccfbf1',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#00f5d4',
                shoreWidth: 1.2
            },
            vegetation: {
                treeScale: 22.5,
                treeDensity: 200,
                bushScale: 1.25,
                bushDensity: 0,
                bioluminescence: 0.35,
                canopyColors: ['#00f5d4', '#00bbf9', '#f72585', '#7209b7', '#4cc9f0', '#10b981'],
                trunkColors: ['#ffffff', '#e0f2fe', '#fce7f3'],
                activePreset: 'estuary',
                selectedTreeModelIds: ['veg_palm_a', 'veg_palm_c', 'veg_fantasy_jungle', 'veg_clover_2']
            },
            phases: createDefaultPhases(
                '#34d399', '#34d399', '#a7f3d0', '#ecfdf5',
                '#8b5cf6', '#8b5cf6', '#4c1d95', '#c084fc',
                '#064e3b', '#064e3b', '#047857', '#00f5d4'
            )
        },
        redwood: {
            id: 'redwood',
            name: 'Redwood',
            terrain: {
                colorLow: '#15803d',
                colorHigh: '#166534',
                colorDirt: '#78350f',
                colorPath: '#522e18',
                colorSand: '#cbd5e1',
                presetName: 'Alpine Highlands',
                isToonMode: true
            },
            water: {
                color: '#0369a1',
                opacity: 0.85,
                reflectivity: 0.60,
                roughness: 0.20,
                metalness: 0.05,
                clearcoat: 0.75,
                clearcoatRoughness: 0.18,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#ffffff',
                cloudEmissive: '#f1f5f9',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#e2e8f0',
                shoreWidth: 0.8
            },
            vegetation: {
                treeScale: 22.5,
                treeDensity: 200,
                bushScale: 1.15,
                bushDensity: 0,
                bioluminescence: 0.35,
                canopyColors: ['#15803d', '#166534', '#14532d', '#22c55e', '#4ade80'],
                trunkColors: ['#78350f', '#451a03', '#522e18'],
                activePreset: 'redwood',
                selectedTreeModelIds: ['veg_cartoon_11', 'veg_cartoon_12', 'veg_bigtree_1', 'veg_tree_var4']
            },
            phases: createDefaultPhases(
                '#64748b', '#64748b', '#cbd5e1', '#f8fafc',
                '#b45309', '#b45309', '#451a03', '#f59e0b',
                '#022c22', '#022c22', '#15803d', '#4ade80'
            )
        },
        sky_citadel: {
            id: 'sky_citadel',
            name: 'Citadel',
            terrain: {
                colorLow: '#e0e7ff',
                colorHigh: '#f3e8ff',
                colorDirt: '#ddd6fe',
                colorPath: '#c084fc',
                colorSand: '#fae8ff',
                presetName: 'Celestial Haven',
                isToonMode: true
            },
            water: {
                color: '#67e8f9',
                opacity: 0.88,
                reflectivity: 0.85,
                roughness: 0.10,
                metalness: 0.05,
                clearcoat: 0.9,
                clearcoatRoughness: 0.10,
                isToonMode: false
            },
            bloom: {
                globalStrength: 0.0,
                globalRadius: 0.0,
                globalThreshold: 0.70,
                cloudBloom: 0.0,
                cloudColor: '#ffffff',
                cloudEmissive: '#fff0f5',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#e0e7ff',
                shoreWidth: 1.2
            },
            vegetation: {
                treeScale: 5.0,
                treeDensity: 0,
                bushScale: 1.0,
                bushDensity: 0,
                canopyColors: ['#e0e7ff', '#f3e8ff', '#fae8ff', '#fce7f3', '#c4b5fd', '#bae6fd'],
                trunkColors: ['#ffffff', '#fdf4ff', '#e0e7ff'],
                activePreset: 'celestial',
                selectedTreeModelIds: []
            },
            phases: [
                {
                    bg: '#a5b4fc', fog: '#c7d2fe', fogNear: 200, fogFar: 4200,
                    amb: '#ede9fe', ambI: 0.6,
                    dir: '#fffbeb', dirI: 0.9,
                    dirPos: { x: 250, y: 350, z: -200 },
                    hemi: 0.45,
                    sunI: 0.9, sunC: '#fffae0',
                    sunPos: { x: 350, y: 400, z: -850 },
                    sunScale: 1.0,
                    starOp: 0.0
                },
                {
                    bg: '#e879f9', fog: '#f472b6', fogNear: 150, fogFar: 3600,
                    amb: '#701a75', ambI: 0.5,
                    dir: '#fb923c', dirI: 0.85,
                    dirPos: { x: 0, y: 45, z: -600 },
                    hemi: 0.35,
                    sunI: 1.0, sunC: '#ff5511',
                    sunPos: { x: 0, y: 15, z: -700 },
                    sunScale: 1.6,
                    starOp: 0.1
                },
                {
                    bg: '#1e1b4b', fog: '#312e81', fogNear: 100, fogFar: 3200,
                    amb: '#4338ca', ambI: 0.7,
                    dir: '#818cf8', dirI: 0.6,
                    dirPos: { x: 100, y: 250, z: -100 },
                    hemi: 0.4,
                    sunI: 0.0, sunC: '#000000',
                    sunPos: { x: 0, y: -300, z: -800 },
                    sunScale: 0.1,
                    starOp: 0.95
                }
            ]
        }
    }
};

const STORAGE_KEY = 'ghibli_flight_biome_editor_v18';

export class ConfigManager {
    public config: AppConfig;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): AppConfig {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.biomes) {
                    return this.mergeWithFactory(parsed);
                }
            }
        } catch (err) {
            console.warn('Failed to load saved config from localStorage, using factory defaults', err);
        }
        return JSON.parse(JSON.stringify(FACTORY_CONFIG));
    }

    private mergeWithFactory(custom: Partial<AppConfig>): AppConfig {
        const base = JSON.parse(JSON.stringify(FACTORY_CONFIG)) as AppConfig;
        if (custom.activeBiomeId) base.activeBiomeId = custom.activeBiomeId;
        if (custom.globalBloom) base.globalBloom = { ...base.globalBloom, ...custom.globalBloom };
        if (custom.cloud) base.cloud = { ...base.cloud, ...custom.cloud };
        if (Array.isArray(custom.placedProps)) base.placedProps = custom.placedProps;
        if (Array.isArray(custom.skyCastles)) base.skyCastles = custom.skyCastles;
        if (custom.skyCitadel) base.skyCitadel = { ...(base.skyCitadel || { layerFogEnabled: true, layerFogAltitude: 260, layerFogDensity: 1.0, layerFogColor: '#ffffff', layerFogEmissive: '#fff0f5', layerFogBloom: 0.0 }), ...custom.skyCitadel };

        if (custom.biomes) {
            for (const key of Object.keys(base.biomes) as BiomeId[]) {
                if (custom.biomes[key]) {
                    const cb = custom.biomes[key];
                    if (cb.terrain) base.biomes[key].terrain = { ...base.biomes[key].terrain, ...cb.terrain };
                    if (cb.water) base.biomes[key].water = { ...base.biomes[key].water, ...cb.water };
                    if (cb.bloom) base.biomes[key].bloom = { ...base.biomes[key].bloom, ...cb.bloom };
                    if (cb.vegetation) {
                        const mergedModels: Record<string, ModelVegetationConfig> = {
                            ...(base.biomes[key].vegetation.models || {})
                        };
                        if (cb.vegetation.models) {
                            for (const [mId, mCfg] of Object.entries(cb.vegetation.models)) {
                                mergedModels[mId] = {
                                    ...(mergedModels[mId] || {}),
                                    ...mCfg
                                };
                            }
                        }

                        base.biomes[key].vegetation = { 
                            ...base.biomes[key].vegetation, 
                            ...cb.vegetation,
                            selectedTreeModelIds: Array.isArray(cb.vegetation.selectedTreeModelIds)
                                ? cb.vegetation.selectedTreeModelIds
                                : base.biomes[key].vegetation.selectedTreeModelIds,
                            models: mergedModels
                        };
                    }
                    if (cb.phases && Array.isArray(cb.phases)) {
                        for (let p = 0; p < 3; p++) {
                            if (cb.phases[p]) {
                                base.biomes[key].phases[p] = { ...base.biomes[key].phases[p], ...cb.phases[p] };
                            }
                        }
                    }
                }
            }
        }
        return base;
    }

    public getActiveBiomeConfig(): BiomeConfig {
        return this.config.biomes[this.config.activeBiomeId] || this.config.biomes.meadow;
    }

    public getBiomeConfig(id: BiomeId): BiomeConfig {
        return this.config.biomes[id] || this.config.biomes.meadow;
    }

    public saveGlobalDefaults(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            fetch('/api/save-config-to-disk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            }).catch(() => {});
        } catch (err) {
            console.error('Failed to save defaults to localStorage', err);
        }
    }

    public saveBiomeDefault(id: BiomeId): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            fetch('/api/save-config-to-disk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            }).catch(() => {});
        } catch (err) {
            console.error(`Failed to save defaults for biome ${id}`, err);
        }
    }

    private autoSaveTimer: any = null;

    public triggerAutoSave(): void {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveGlobalDefaults();
        }, 350);
    }

    public resetBiomeDefaults(id: BiomeId): BiomeConfig {
        const factoryBiome = FACTORY_CONFIG.biomes[id];
        if (factoryBiome) {
            this.config.biomes[id] = JSON.parse(JSON.stringify(factoryBiome));
            this.saveBiomeDefault(id);
        }
        return this.getBiomeConfig(id);
    }

    public resetFactoryDefaults(): AppConfig {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            console.error('Failed to clear localStorage', err);
        }
        this.config = JSON.parse(JSON.stringify(FACTORY_CONFIG));
        return this.config;
    }

    public exportJSON(): string {
        return JSON.stringify(this.config, null, 2);
    }

    public async saveConfigToDisk(): Promise<{ success: boolean; message: string }> {
        this.saveGlobalDefaults();
        try {
            const res = await fetch('/api/save-config-to-disk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
            if (res.ok) {
                const data = await res.json();
                return { success: true, message: data.message || 'Saved permanently to local disk' };
            }
            return { success: false, message: `Server returned status ${res.status}` };
        } catch (err) {
            console.warn('Local disk persistence endpoint not reachable, saved to browser storage', err);
            return { success: false, message: 'Saved to browser storage (Local disk server offline)' };
        }
    }

    public async syncFromDisk(): Promise<boolean> {
        try {
            const res = await fetch('/api/load-config-from-disk');
            if (res.ok) {
                const data = await res.json();
                if (data && data.version === FACTORY_CONFIG.version && data.biomes) {
                    this.config = this.mergeWithFactory(data);
                    this.saveGlobalDefaults();
                    return true;
                }
            }
        } catch (err) {
            // Silently ignore if offline or not in dev server mode
        }
        return false;
    }

    public importJSON(jsonString: string): boolean {
        try {
            const parsed = JSON.parse(jsonString);
            this.config = this.mergeWithFactory(parsed);
            this.saveGlobalDefaults();
            return true;
        } catch (err) {
            console.error('Invalid JSON configuration', err);
            return false;
        }
    }
}

export const globalConfigManager = new ConfigManager();

