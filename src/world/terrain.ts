import * as THREE from 'three';
import { terrainHeightJS, smoothstep, getPathStrength, getBiomeWeights, BiomeId } from './noise';
import { TerrainColorsSettings, globalConfigManager } from '../core/config';

const gradientColors = new Uint8Array([
    160, 160, 160, 255, // Shadows
    255, 255, 255, 255  // Light
]);
export const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
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
    public terrainMat: THREE.MeshToonMaterial;
    private geometry: THREE.PlaneGeometry;
    private lastGridX: number = -99999;
    private lastGridZ: number = -99999;
    public lastPlayerX: number = 0;
    public lastPlayerZ: number = 0;
    public gridStride: number = 6.25;
    public currentRes: number = 256;

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

    private shoreBloomUniform = { value: 0.75 };
    private shoreColorUniform = { value: new THREE.Color(0xffffff) };
    private shoreWaterYUniform = { value: 2.5 };
    private shoreWidthUniform = { value: 0.8 };

    constructor(scene: THREE.Scene, initialRes: number = 256, initialStride?: number) {
        this.currentRes = initialRes;
        this.gridStride = initialStride ?? (1600 / initialRes);

        this.reloadColorsFromConfig();

        const activeBiome = globalConfigManager.getActiveBiomeConfig();
        this.shoreBloomUniform.value = activeBiome.bloom.shoreBloom;
        this.shoreColorUniform.value.set(activeBiome.bloom.shoreColor);
        this.shoreWidthUniform.value = activeBiome.bloom.shoreWidth;

        this.terrainMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            vertexColors: true,
            gradientMap,
            dithering: true
        });

        this.terrainMat.onBeforeCompile = (shader) => {
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
        if (redraw && this.mesh) {
            this.invalidateAndRedraw();
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

        const biomes: BiomeId[] = ['meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const h = terrainHeightJS(worldX, worldZ);
            pos.setY(i, h);

            const w = getBiomeWeights(worldX, worldZ);

            this.vLow.setRGB(0, 0, 0);
            this.vHigh.setRGB(0, 0, 0);
            this.vDirt.setRGB(0, 0, 0);
            this.vPath.setRGB(0, 0, 0);
            this.vSand.setRGB(0, 0, 0);

            for (const b of biomes) {
                const weight = w[b];
                if (weight <= 0.0001) continue;
                const bc = this.biomeColors[b];
                this.vLow.r += bc.low.r * weight; this.vLow.g += bc.low.g * weight; this.vLow.b += bc.low.b * weight;
                this.vHigh.r += bc.high.r * weight; this.vHigh.g += bc.high.g * weight; this.vHigh.b += bc.high.b * weight;
                this.vDirt.r += bc.dirt.r * weight; this.vDirt.g += bc.dirt.g * weight; this.vDirt.b += bc.dirt.b * weight;
                this.vPath.r += bc.path.r * weight; this.vPath.g += bc.path.g * weight; this.vPath.b += bc.path.b * weight;
                this.vSand.r += bc.sand.r * weight; this.vSand.g += bc.sand.g * weight; this.vSand.b += bc.sand.b * weight;
            }

            let blend = Math.min(Math.max(h / 38.0, 0), 1);
            const patchNoise = (Math.sin(worldX * 0.08) + Math.cos(worldZ * 0.08)) * 0.15;
            blend = Math.min(Math.max(blend + patchNoise, 0), 1);

            if (h > 42) {
                this.tempColor.lerpColors(this.vHigh, this.vDirt, smoothstep(42, 62, h));
            } else if (h < 2.8) {
                this.tempColor.copy(this.vSand);
            } else if (h < 4.2) {
                this.tempColor.lerpColors(this.vSand, this.vLow, smoothstep(2.8, 4.2, h));
            } else {
                this.tempColor.lerpColors(this.vLow, this.vHigh, smoothstep(0, 1, blend));
                const pStrength = getPathStrength(worldX, worldZ);
                const pathMask = smoothstep(4.5, 7.0, h);
                if (pStrength > 0 && pathMask > 0) {
                    this.tempColor.lerp(this.vPath, pStrength * pathMask);
                }
            }
            colors.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
        }

        this.geometry.computeVertexNormals();
        pos.needsUpdate = true;
        colors.needsUpdate = true;

        this.lastGridX = gridX;
        this.lastGridZ = gridZ;
    }
}
