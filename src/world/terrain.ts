import * as THREE from 'three';
import { terrainHeightJS, smoothstep, getPathStrength, getBiomeWeights, snoise, BiomeId } from './noise';
import { TerrainColorsSettings, globalConfigManager } from '../core/config';

const gradientColors = new Uint8Array([
    130, 130, 130, 255, // Deep shadow
    185, 185, 185, 255, // Midtone
    230, 230, 230, 255, // Soft highlight
    255, 255, 255, 255  // Full light
]);
export const gradientMap = new THREE.DataTexture(gradientColors, 4, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.LinearFilter;
gradientMap.magFilter = THREE.LinearFilter;
gradientMap.generateMipmaps = false;

export const TERRAIN_PALETTES: Record<string, TerrainColorsSettings> = {
    'Lush Green': {
        colorLow: '#76d149',
        colorHigh: '#89e05e',
        colorDirt: '#dcb58a',
        colorPath: '#bd9973',
        colorSand: '#f2e1b8',
        presetName: 'Lush Green'
    },
    'Autumn Warmth': {
        colorLow: '#d97706',
        colorHigh: '#f59e0b',
        colorDirt: '#9a3412',
        colorPath: '#7c2d12',
        colorSand: '#fde68a',
        presetName: 'Autumn Warmth'
    },
    'Ghibli Pastel': {
        colorLow: '#6ee7b7',
        colorHigh: '#93c5fd',
        colorDirt: '#fbcfe8',
        colorPath: '#c4b5fd',
        colorSand: '#fef08a',
        presetName: 'Ghibli Pastel'
    },
    'Alpine Highlands': {
        colorLow: '#15803d',
        colorHigh: '#22c55e',
        colorDirt: '#64748b',
        colorPath: '#475569',
        colorSand: '#e2e8f0',
        presetName: 'Alpine Highlands'
    },
    'Candy Meadow': {
        colorLow: '#10b981',
        colorHigh: '#f43f5e',
        colorDirt: '#a855f7',
        colorPath: '#ec4899',
        colorSand: '#fed7aa',
        presetName: 'Candy Meadow'
    }
};

interface BiomeColorSet {
    low: THREE.Color;
    high: THREE.Color;
    dirt: THREE.Color;
    path: THREE.Color;
    sand: THREE.Color;
}

export class TerrainSystem {
    public mesh: THREE.Mesh;
    public terrainMat: THREE.Material;
    public toonMat: THREE.MeshToonMaterial;
    public standardMat: THREE.MeshStandardMaterial;
    public isToonMode: boolean = true;
    private geometry: THREE.PlaneGeometry;
    private lastGridX: number = -99999;
    private lastGridZ: number = -99999;
    public lastPlayerX: number = 0;
    public lastPlayerZ: number = 0;
    public gridStride: number = 12.5;
    public currentRes: number = 128;

    private biomeColors: Record<BiomeId, BiomeColorSet> = {
        meadow: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        archipelago: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        geothermal: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        estuary: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        redwood: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() }
    };

    private vLow = new THREE.Color();
    private vHigh = new THREE.Color();
    private vDirt = new THREE.Color();
    private vPath = new THREE.Color();
    private vSand = new THREE.Color();
    private tempColor = new THREE.Color();

    private shoreBloomUniform = { value: 0.0 };
    private shoreColorUniform = { value: new THREE.Color(0xffffff) };
    private shoreWaterYUniform = { value: 2.5 };
    private shoreWidthUniform = { value: 0.8 };

    constructor(scene: THREE.Scene, initialRes: number = 128, initialStride?: number) {
        this.currentRes = initialRes;
        this.gridStride = initialStride ?? (1600 / initialRes);

        this.reloadColorsFromConfig();

        const activeBiome = globalConfigManager.getActiveBiomeConfig();
        this.shoreBloomUniform.value = activeBiome.bloom.shoreBloom;
        this.shoreColorUniform.value.set(activeBiome.bloom.shoreColor);
        this.shoreWidthUniform.value = activeBiome.bloom.shoreWidth;

        const attachShoreShader = (mat: THREE.Material) => {
            mat.onBeforeCompile = (shader) => {
                shader.uniforms.uShoreBloom = this.shoreBloomUniform;
                shader.uniforms.uShoreColor = this.shoreColorUniform;
                shader.uniforms.uShoreWaterY = this.shoreWaterYUniform;
                shader.uniforms.uShoreWidth = this.shoreWidthUniform;

                shader.vertexShader = `
                    varying float vCustomWorldY;
                ` + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <worldpos_vertex>',
                    `
                    #include <worldpos_vertex>
                    vCustomWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
                    `
                );

                shader.fragmentShader = `
                    uniform float uShoreBloom;
                    uniform vec3 uShoreColor;
                    uniform float uShoreWaterY;
                    uniform float uShoreWidth;
                    varying float vCustomWorldY;
                ` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    `
                    #include <emissivemap_fragment>
                    if (uShoreBloom > 0.001) {
                        float diff = abs(vCustomWorldY - uShoreWaterY);
                        if (diff < uShoreWidth) {
                            float shoreFactor = smoothstep(uShoreWidth, 0.0, diff);
                            totalEmissiveRadiance += uShoreColor * (uShoreBloom * shoreFactor * 2.0);
                        }
                    }
                    `
                );
            };
        };

        this.toonMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            vertexColors: true,
            gradientMap,
            dithering: true
        });
        attachShoreShader(this.toonMat);

        this.standardMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.0,
            dithering: true
        });
        attachShoreShader(this.standardMat);

        this.isToonMode = activeBiome.terrain.isToonMode ?? true;
        this.terrainMat = this.isToonMode ? this.toonMat : this.standardMat;

        this.geometry = new THREE.PlaneGeometry(1600, 1600, initialRes, initialRes);
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh = new THREE.Mesh(this.geometry, this.terrainMat);
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        this.update(0, 0);
    }

    public reloadColorsFromConfig(redraw: boolean = true): void {
        const biomes: BiomeId[] = ['meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];
        for (const b of biomes) {
            const cfg = globalConfigManager.getBiomeConfig(b).terrain;
            const set = this.biomeColors[b];
            set.low.set(cfg.colorLow);
            set.high.set(cfg.colorHigh);
            set.dirt.set(cfg.colorDirt);
            set.path.set(cfg.colorPath);
            set.sand.set(cfg.colorSand);
        }
        const activeCfg = globalConfigManager.getActiveBiomeConfig().terrain;
        if (activeCfg.isToonMode !== undefined) {
            this.isToonMode = activeCfg.isToonMode;
            this.terrainMat = this.isToonMode ? this.toonMat : this.standardMat;
            if (this.mesh) this.mesh.material = this.terrainMat;
        }
        if (redraw && this.mesh) {
            this.invalidateAndRedraw();
        }
    }

    public setToonMode(isToon: boolean, biomeId?: BiomeId): void {
        this.isToonMode = isToon;
        const bId = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(bId);
        if (bCfg) {
            bCfg.terrain.isToonMode = isToon;
        }
        this.terrainMat = this.isToonMode ? this.toonMat : this.standardMat;
        if (this.mesh) {
            this.mesh.material = this.terrainMat;
        }
    }

    public setBiomeTerrainColors(biomeId: BiomeId, colors: Partial<TerrainColorsSettings>, playerX?: number, playerZ?: number): void {
        const cfg = globalConfigManager.getBiomeConfig(biomeId).terrain;
        if (colors.colorLow) {
            cfg.colorLow = colors.colorLow;
            this.biomeColors[biomeId].low.set(colors.colorLow);
        }
        if (colors.colorHigh) {
            cfg.colorHigh = colors.colorHigh;
            this.biomeColors[biomeId].high.set(colors.colorHigh);
        }
        if (colors.colorDirt) {
            cfg.colorDirt = colors.colorDirt;
            this.biomeColors[biomeId].dirt.set(colors.colorDirt);
        }
        if (colors.colorPath) {
            cfg.colorPath = colors.colorPath;
            this.biomeColors[biomeId].path.set(colors.colorPath);
        }
        if (colors.colorSand) {
            cfg.colorSand = colors.colorSand;
            this.biomeColors[biomeId].sand.set(colors.colorSand);
        }
        if (colors.presetName) {
            cfg.presetName = colors.presetName;
        }
        if (colors.isToonMode !== undefined) {
            cfg.isToonMode = colors.isToonMode;
            if (biomeId === globalConfigManager.config.activeBiomeId) {
                this.isToonMode = colors.isToonMode;
                this.terrainMat = this.isToonMode ? this.toonMat : this.standardMat;
                if (this.mesh) this.mesh.material = this.terrainMat;
            }
        }

        const px = playerX !== undefined ? playerX : this.lastPlayerX;
        const pz = playerZ !== undefined ? playerZ : this.lastPlayerZ;
        this.lastGridX = -99999;
        this.lastGridZ = -99999;
        this.update(px, pz);
    }

    public applyBiomePalette(biomeId: BiomeId, paletteName: string, playerX?: number, playerZ?: number): void {
        const pal = TERRAIN_PALETTES[paletteName];
        if (pal) {
            this.setBiomeTerrainColors(biomeId, pal, playerX, playerZ);
        }
    }

    public setTerrainColors(colors: Partial<TerrainColorsSettings>, playerX?: number, playerZ?: number): void {
        this.setBiomeTerrainColors(globalConfigManager.config.activeBiomeId, colors, playerX, playerZ);
    }

    public applyPalette(paletteName: string, playerX?: number, playerZ?: number): void {
        this.applyBiomePalette(globalConfigManager.config.activeBiomeId, paletteName, playerX, playerZ);
    }

    public setShoreBloom(intensity: number, colorHex?: string, width?: number, biomeId?: BiomeId): void {
        const bId = biomeId || globalConfigManager.config.activeBiomeId;
        const blm = globalConfigManager.getBiomeConfig(bId).bloom;

        this.shoreBloomUniform.value = Math.max(0.0, Math.min(3.0, intensity));
        blm.shoreBloom = this.shoreBloomUniform.value;

        if (colorHex) {
            this.shoreColorUniform.value.set(colorHex);
            blm.shoreColor = colorHex;
        }
        if (width !== undefined) {
            this.shoreWidthUniform.value = Math.max(0.1, Math.min(3.0, width));
            blm.shoreWidth = this.shoreWidthUniform.value;
        }
    }

    public invalidateAndRedraw(): void {
        this.lastGridX = -99999;
        this.lastGridZ = -99999;
        this.update(this.lastPlayerX, this.lastPlayerZ);
    }

    public setResolution(res: number, stride: number, playerX?: number, playerZ?: number): void {
        const px = playerX !== undefined ? playerX : this.lastPlayerX;
        const pz = playerZ !== undefined ? playerZ : this.lastPlayerZ;

        const computedStride = stride || (1600 / res);
        if (this.currentRes === res && this.gridStride === computedStride) return;
        this.currentRes = res;
        this.gridStride = computedStride;
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry(1600, 1600, res, res);
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.geometry = this.geometry;
        this.lastGridX = -99999;
        this.lastGridZ = -99999;
        this.update(px, pz);
    }

    public update(playerX: number, playerZ: number): void {
        this.lastPlayerX = playerX;
        this.lastPlayerZ = playerZ;

        const gridX = Math.floor(playerX / this.gridStride) * this.gridStride;
        const gridZ = Math.floor(playerZ / this.gridStride) * this.gridStride;

        if (gridX === this.lastGridX && gridZ === this.lastGridZ) return;

        this.mesh.position.set(gridX, 0, gridZ);

        const pos = this.geometry.attributes.position as THREE.BufferAttribute;
        if (!this.geometry.attributes.color) {
            this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.geometry.attributes.color as THREE.BufferAttribute;
        const normals = this.geometry.attributes.normal as THREE.BufferAttribute;

        const biomes: BiomeId[] = ['meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];
        const delta = 2.0;

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const h = terrainHeightJS(worldX, worldZ);
            pos.setY(i, h);

            // Analytical normal via central difference (smooth, continuous curvature without low-poly faceting)
            const hL = terrainHeightJS(worldX - delta, worldZ);
            const hR = terrainHeightJS(worldX + delta, worldZ);
            const hD = terrainHeightJS(worldX, worldZ - delta);
            const hU = terrainHeightJS(worldX, worldZ + delta);

            const nx = (hL - hR) / (2.0 * delta);
            const nz = (hD - hU) / (2.0 * delta);
            const ny = 1.0;
            const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

            normals.setXYZ(i, nx * invLen, ny * invLen, nz * invLen);

            const w = getBiomeWeights(worldX, worldZ);

            let lowR = 0, lowG = 0, lowB = 0;
            let highR = 0, highG = 0, highB = 0;
            let dirtR = 0, dirtG = 0, dirtB = 0;
            let pathR = 0, pathG = 0, pathB = 0;
            let sandR = 0, sandG = 0, sandB = 0;

            for (const b of biomes) {
                const weight = w[b];
                if (weight <= 0.0001) continue;
                const bc = this.biomeColors[b];
                lowR += bc.low.r * weight; lowG += bc.low.g * weight; lowB += bc.low.b * weight;
                highR += bc.high.r * weight; highG += bc.high.g * weight; highB += bc.high.b * weight;
                dirtR += bc.dirt.r * weight; dirtG += bc.dirt.g * weight; dirtB += bc.dirt.b * weight;
                pathR += bc.path.r * weight; pathG += bc.path.g * weight; pathB += bc.path.b * weight;
                sandR += bc.sand.r * weight; sandG += bc.sand.g * weight; sandB += bc.sand.b * weight;
            }

            // Smooth macro-variation (low frequency to prevent aliasing across grid cells)
            const macroNoise = snoise(worldX * 0.008, worldZ * 0.008) * 3.5;

            // 1. Smooth Lowland to Highland grass gradient (0m to 44m)
            const grassWeight = smoothstep(2.0, 44.0, h + macroNoise);
            let r = lowR * (1.0 - grassWeight) + highR * grassWeight;
            let g = lowG * (1.0 - grassWeight) + highG * grassWeight;
            let b = lowB * (1.0 - grassWeight) + highB * grassWeight;

            // 2. Continuous mountain dirt/rock transition (smoothly blends from 36m up to 74m)
            const dirtWeight = smoothstep(36.0, 74.0, h + macroNoise * 0.5);
            if (dirtWeight > 0.0) {
                r = r * (1.0 - dirtWeight) + dirtR * dirtWeight;
                g = g * (1.0 - dirtWeight) + dirtG * dirtWeight;
                b = b * (1.0 - dirtWeight) + dirtB * dirtWeight;
            }

            // 3. Smooth shoreline sand blend below 5.2m
            const sandWeight = smoothstep(5.2, 1.8, h);
            if (sandWeight > 0.0) {
                r = r * (1.0 - sandWeight) + sandR * sandWeight;
                g = g * (1.0 - sandWeight) + sandG * sandWeight;
                b = b * (1.0 - sandWeight) + sandB * sandWeight;
            }

            // 4. Village and exploration pathways
            const pStrength = getPathStrength(worldX, worldZ);
            if (pStrength > 0.0) {
                const pathMask = smoothstep(3.0, 7.0, h);
                const pathWeight = pStrength * pathMask * (1.0 - dirtWeight) * (1.0 - sandWeight);
                if (pathWeight > 0.001) {
                    r = r * (1.0 - pathWeight) + pathR * pathWeight;
                    g = g * (1.0 - pathWeight) + pathG * pathWeight;
                    b = b * (1.0 - pathWeight) + pathB * pathWeight;
                }
            }

            colors.setXYZ(i, r, g, b);
        }

        pos.needsUpdate = true;
        normals.needsUpdate = true;
        colors.needsUpdate = true;

        this.lastGridX = gridX;
        this.lastGridZ = gridZ;
    }
}
