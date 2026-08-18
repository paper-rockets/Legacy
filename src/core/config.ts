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
}

export interface VegetationBiomeSettings {
    treeScale: number;
    treeDensity: number;
    bushScale: number;
    bushDensity: number;
    canopyColors: string[];
    trunkColors: string[];
    activePreset: string;
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
    biomes: Record<BiomeId, BiomeConfig>;
}

function createDefaultPhases(
    dayBg: string, dayFog: string, dayAmb: string, dayDir: string,
    duskBg: string, duskFog: string, duskAmb: string, duskDir: string,
    twiBg: string, twiFog: string, twiAmb: string, twiDir: string
): [EnvPhaseConfig, EnvPhaseConfig, EnvPhaseConfig] {
    return [
        {
            // Day
            bg: dayBg, fog: dayFog, fogNear: 200, fogFar: 720,
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
            bg: duskBg, fog: duskFog, fogNear: 180, fogFar: 680,
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
            bg: twiBg, fog: twiFog, fogNear: 180, fogFar: 700,
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
    version: 3,
    activeBiomeId: 'meadow',
    globalBloom: {
        strength: 0.0,
        radius: 0.40,
        threshold: 0.80
    },
    cloud: {
        bloom: 0.0,
        color: '#ffffff',
        emissive: '#fff6ea'
    },
    biomes: {
        meadow: {
            id: 'meadow',
            name: 'Lush Meadow',
            terrain: {
                colorLow: '#76d149',
                colorHigh: '#89e05e',
                colorDirt: '#dcb58a',
                colorPath: '#bd9973',
                colorSand: '#f2e1b8',
                presetName: 'Lush Green'
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
                globalRadius: 0.40,
                globalThreshold: 0.80,
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
                treeScale: 6.0,
                treeDensity: 800,
                bushScale: 1.0,
                bushDensity: 250,
                canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600', '#ff7700', '#ff1744'],
                trunkColors: ['#ffffff', '#fff3e0', '#ffe4e6', '#e0f7fa'],
                activePreset: 'candy'
            },
            phases: createDefaultPhases(
                '#8cbce6', '#8cbce6', '#dcf2ff', '#fffaeb',
                '#dd5e42', '#dd5e42', '#6a4055', '#ff7722',
                '#18182c', '#18182c', '#444470', '#6677aa'
            )
        },
        archipelago: {
            id: 'archipelago',
            name: 'Floating Archipelago',
            terrain: {
                colorLow: '#6ee7b7',
                colorHigh: '#93c5fd',
                colorDirt: '#e2e8f0',
                colorPath: '#c4b5fd',
                colorSand: '#fef08a',
                presetName: 'Ghibli Pastel'
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
                globalRadius: 0.40,
                globalThreshold: 0.80,
                cloudBloom: 0.0,
                cloudColor: '#ffffff',
                cloudEmissive: '#f0f9ff',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#e0f2fe',
                shoreWidth: 1.0
            },
            vegetation: {
                treeScale: 4.8,
                treeDensity: 550,
                bushScale: 1.1,
                bushDensity: 220,
                canopyColors: ['#ff69b4', '#ffb6c1', '#fbcfe8', '#c4b5fd', '#93c5fd', '#ffffff'],
                trunkColors: ['#fff3e0', '#ffe4e6', '#d6d3d1'],
                activePreset: 'archipelago'
            },
            phases: createDefaultPhases(
                '#7dd3fc', '#7dd3fc', '#e0f2fe', '#fffbeb',
                '#f43f5e', '#f43f5e', '#831843', '#fb923c',
                '#0f172a', '#0f172a', '#38bdf8', '#818cf8'
            )
        },
        geothermal: {
            id: 'geothermal',
            name: 'Geothermal Ridge',
            terrain: {
                colorLow: '#d97706',
                colorHigh: '#f59e0b',
                colorDirt: '#27272a',
                colorPath: '#9a3412',
                colorSand: '#fde68a',
                presetName: 'Autumn Warmth'
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
                globalRadius: 0.40,
                globalThreshold: 0.80,
                cloudBloom: 0.0,
                cloudColor: '#fed7aa',
                cloudEmissive: '#ffedd5',
                treeBloom: 0.0,
                treeCanopyGlow: 0.0,
                treeTrunkGlow: 0.0,
                bushBloom: 0.0,
                bushGlow: 0.0,
                shoreBloom: 0.0,
                shoreColor: '#ffedd5',
                shoreWidth: 1.1
            },
            vegetation: {
                treeScale: 5.2,
                treeDensity: 450,
                bushScale: 0.95,
                bushDensity: 180,
                canopyColors: ['#ff3300', '#ff7700', '#ffaa00', '#cc1100', '#71717a'],
                trunkColors: ['#27272a', '#3f3f46', '#57534e'],
                activePreset: 'geothermal'
            },
            phases: createDefaultPhases(
                '#fdba74', '#fdba74', '#ffedd5', '#fff7ed',
                '#dc2626', '#dc2626', '#450a0a', '#ea580c',
                '#1c1917', '#1c1917', '#78350f', '#f97316'
            )
        },
        estuary: {
            id: 'estuary',
            name: 'Bioluminescent Estuary',
            terrain: {
                colorLow: '#10b981',
                colorHigh: '#06b6d4',
                colorDirt: '#ec4899',
                colorPath: '#a855f7',
                colorSand: '#fed7aa',
                presetName: 'Candy Meadow'
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
                globalRadius: 0.40,
                globalThreshold: 0.80,
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
                treeScale: 4.2,
                treeDensity: 600,
                bushScale: 1.25,
                bushDensity: 280,
                canopyColors: ['#00f5d4', '#00bbf9', '#f72585', '#7209b7', '#4cc9f0', '#10b981'],
                trunkColors: ['#ffffff', '#e0f2fe', '#fce7f3'],
                activePreset: 'estuary'
            },
            phases: createDefaultPhases(
                '#5eead4', '#5eead4', '#ccfbf1', '#ecfdf5',
                '#c026d3', '#c026d3', '#4a044e', '#d946ef',
                '#09090b', '#09090b', '#06b6d4', '#ec4899'
            )
        },
        redwood: {
            id: 'redwood',
            name: 'Colossal Redwood',
            terrain: {
                colorLow: '#15803d',
                colorHigh: '#166534',
                colorDirt: '#78350f',
                colorPath: '#451a03',
                colorSand: '#d6d3d1',
                presetName: 'Alpine Highlands'
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
                globalRadius: 0.40,
                globalThreshold: 0.80,
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
                treeScale: 8.5,
                treeDensity: 650,
                bushScale: 1.15,
                bushDensity: 220,
                canopyColors: ['#15803d', '#166534', '#14532d', '#22c55e', '#4ade80'],
                trunkColors: ['#78350f', '#451a03', '#522e18'],
                activePreset: 'redwood'
            },
            phases: createDefaultPhases(
                '#64748b', '#64748b', '#cbd5e1', '#f8fafc',
                '#b45309', '#b45309', '#451a03', '#f59e0b',
                '#022c22', '#022c22', '#15803d', '#4ade80'
            )
        }
    }
};

const STORAGE_KEY = 'ghibli_flight_biome_editor_v3';

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
                if (parsed && parsed.version === FACTORY_CONFIG.version && parsed.biomes) {
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

        if (custom.biomes) {
            for (const key of Object.keys(base.biomes) as BiomeId[]) {
                if (custom.biomes[key]) {
                    const cb = custom.biomes[key];
                    if (cb.terrain) base.biomes[key].terrain = { ...base.biomes[key].terrain, ...cb.terrain };
                    if (cb.water) base.biomes[key].water = { ...base.biomes[key].water, ...cb.water };
                    if (cb.bloom) base.biomes[key].bloom = { ...base.biomes[key].bloom, ...cb.bloom };
                    if (cb.vegetation) base.biomes[key].vegetation = { ...base.biomes[key].vegetation, ...cb.vegetation };
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
        } catch (err) {
            console.error('Failed to save defaults to localStorage', err);
        }
    }

    public saveBiomeDefault(id: BiomeId): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (err) {
            console.error(`Failed to save defaults for biome ${id}`, err);
        }
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
