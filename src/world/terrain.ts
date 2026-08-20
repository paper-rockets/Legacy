import * as THREE from 'three';
import { terrainHeightJS, terrainHeightWithWeights, smoothstep, getPathStrength, getBiomeWeights, snoise, BiomeId } from './noise';
import { TerrainColorsSettings, globalConfigManager } from '../core/config';
import { setupFacetedBarycentricGeometry } from './volumetricClouds';

const gradientColors = new Uint8Array([
    130, 130, 130, 255, // Shadow
    195, 195, 195, 255, // Midtone
    255, 255, 255, 255  // Highlight
]);
export const gradientMap = new THREE.DataTexture(gradientColors, 3, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

export const TERRAIN_PALETTES: Record<string, TerrainColorsSettings> = {
    'Marshmallow Pastel': {
        colorLow: '#fffbf5',
        colorHigh: '#fce7f3',
        colorDirt: '#e9d5ff',
        colorPath: '#fed7aa',
        colorSand: '#ffffff',
        presetName: 'Marshmallow Pastel',
        isToonMode: true
    },
    'Lush Green': {
        colorLow: '#76d149',
        colorHigh: '#89e05e',
        colorDirt: '#dcb58a',
        colorPath: '#bd9973',
        colorSand: '#f2e1b8',
        presetName: 'Lush Green',
        isToonMode: true
    },
    'Ghibli Pastel': {
        colorLow: '#6ee7b7',
        colorHigh: '#93c5fd',
        colorDirt: '#e2e8f0',
        colorPath: '#c4b5fd',
        colorSand: '#fef08a',
        presetName: 'Ghibli Pastel',
        isToonMode: true
    },
    'Autumn Warmth': {
        colorLow: '#d97706',
        colorHigh: '#f59e0b',
        colorDirt: '#27272a',
        colorPath: '#9a3412',
        colorSand: '#fde68a',
        presetName: 'Autumn Warmth',
        isToonMode: true
    },
    'Candy Meadow': {
        colorLow: '#10b981',
        colorHigh: '#06b6d4',
        colorDirt: '#ec4899',
        colorPath: '#a855f7',
        colorSand: '#fed7aa',
        presetName: 'Candy Meadow',
        isToonMode: true
    },
    'Alpine Highlands': {
        colorLow: '#15803d',
        colorHigh: '#166534',
        colorDirt: '#78350f',
        colorPath: '#522e18',
        colorSand: '#cbd5e1',
        presetName: 'Alpine Highlands',
        isToonMode: true
    },
    'Celestial Haven': {
        colorLow: '#e0e7ff',
        colorHigh: '#f3e8ff',
        colorDirt: '#ddd6fe',
        colorPath: '#c084fc',
        colorSand: '#fae8ff',
        presetName: 'Celestial Haven',
        isToonMode: true
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
    public crystalMat: THREE.ShaderMaterial;
    public isToonMode: boolean = true;
    public terrainStyle: 'toon' | 'standard' | 'crystal' = 'toon';

    public crystalParams = {
        glassTransmission: 0.65,
        iridescence: 1.35,
        specularGlint: 2.2,
        bevelGleam: 1.1,
        veinGlow: 1.0,
        glassRefraction: 1.52,
        glassTint: 1.0,
        veinScale: 1.0,
        showGroundCrystals: true
    };

    public crystalUniforms: Record<string, { value: any }>;

    private geometry: THREE.PlaneGeometry;
    private lastGridX: number = -99999;
    private lastGridZ: number = -99999;
    public lastPlayerX: number = 0;
    public lastPlayerZ: number = 0;
    public gridStride: number = 12.5;
    public currentRes: number = 128;

    private biomeColors: Record<BiomeId, BiomeColorSet> = {
        candyland: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        meadow: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        archipelago: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        geothermal: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        estuary: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        redwood: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() },
        sky_citadel: { low: new THREE.Color(), high: new THREE.Color(), dirt: new THREE.Color(), path: new THREE.Color(), sand: new THREE.Color() }
    };

    private shoreBloomUniform = { value: 0.0 };
    private shoreColorUniform = { value: new THREE.Color(0xffffff) };
    private shoreWaterYUniform = { value: 2.5 };
    private shoreWidthUniform = { value: 0.8 };

    constructor(scene: THREE.Scene, initialRes: number = 128, initialStride?: number) {
        this.currentRes = initialRes;
        this.gridStride = initialStride ?? (1600 / initialRes);

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
                    varying highp float vCustomWorldY;
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
                    varying highp float vCustomWorldY;
                ` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    `
                    #include <emissivemap_fragment>
                    if (uShoreBloom > 0.001) {
                        float shoreDiff = abs(vCustomWorldY - uShoreWaterY);
                        if (shoreDiff < uShoreWidth) {
                            float shoreFactor = smoothstep(uShoreWidth, 0.0, shoreDiff);
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

        // ── Translucent Prismatic Glass Crystal Terrain Shader ────────────────
        this.crystalUniforms = {
            uTime: { value: 0.0 },
            uSunPos: { value: new THREE.Vector3(0, 150, -260) },
            uSunColor: { value: new THREE.Color(0xfffdf7) },
            uSkyTopColor: { value: new THREE.Color(0x1e3a8a) },
            uSkyHorizonColor: { value: new THREE.Color(0x60a5fa) },
            uGlassTransmission: { value: this.crystalParams.glassTransmission },
            uIridescence: { value: this.crystalParams.iridescence },
            uSpecularGlint: { value: this.crystalParams.specularGlint },
            uFacetBevelGleam: { value: this.crystalParams.bevelGleam },
            uCrystalVeinGlow: { value: this.crystalParams.veinGlow },
            uGlassRefraction: { value: this.crystalParams.glassRefraction },
            uGlassTint: { value: this.crystalParams.glassTint },
            uVeinScale: { value: this.crystalParams.veinScale },
            uShoreBloom: this.shoreBloomUniform,
            uShoreColor: this.shoreColorUniform,
            uShoreWaterY: this.shoreWaterYUniform,
            uShoreWidth: this.shoreWidthUniform
        };

        const crystalVertShader = /* glsl */ `
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vColor;
            varying vec3 vNormal;

            void main() {
                vColor = color;
                vNormal = normal;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vViewDir = normalize(cameraPosition - worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const crystalFragShader = /* glsl */ `
            uniform float uTime;
            uniform vec3 uSunPos;
            uniform vec3 uSunColor;
            uniform vec3 uSkyTopColor;
            uniform vec3 uSkyHorizonColor;
            uniform float uGlassTransmission;
            uniform float uIridescence;
            uniform float uSpecularGlint;
            uniform float uCrystalVeinGlow;
            uniform float uGlassRefraction;
            uniform float uGlassTint;
            uniform float uVeinScale;
            uniform float uShoreBloom;
            uniform vec3 uShoreColor;
            uniform float uShoreWaterY;
            uniform float uShoreWidth;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vColor;
            varying vec3 vNormal;

            vec3 evalSpectralPrism(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.0);
            }

            void main() {
                // True geometric flat facet face normal for crystal terrain facets
                vec3 fdx = dFdx(vWorldPos);
                vec3 fdy = dFdy(vWorldPos);
                vec3 faceNormal = normalize(cross(fdx, fdy));
                if (!gl_FrontFacing) faceNormal = -faceNormal;

                vec3 V = normalize(vViewDir);
                vec3 sunDir = normalize(uSunPos - vWorldPos);
                vec3 H = normalize(sunDir + V);

                // 1. Crystal Glass Body Tint from Biome & Vertex Colors
                vec3 glassBodyTint = vColor * uGlassTint;

                // 2. Optical Glass Refraction & Transmission with IOR
                float ior = max(1.1, uGlassRefraction);
                float disp = 0.035;
                vec3 refractR = refract(-V, faceNormal, 1.0 / (ior - disp));
                vec3 refractG = refract(-V, faceNormal, 1.0 / ior);
                vec3 refractB = refract(-V, faceNormal, 1.0 / (ior + disp));

                float rSkyH = clamp(refractR.y * 0.5 + 0.5, 0.0, 1.0);
                float gSkyH = clamp(refractG.y * 0.5 + 0.5, 0.0, 1.0);
                float bSkyH = clamp(refractB.y * 0.5 + 0.5, 0.0, 1.0);

                vec3 rCol = mix(uSkyHorizonColor, uSkyTopColor, pow(rSkyH, 0.65));
                vec3 gCol = mix(uSkyHorizonColor, uSkyTopColor, pow(gSkyH, 0.65));
                vec3 bCol = mix(uSkyHorizonColor, uSkyTopColor, pow(bSkyH, 0.65));
                vec3 transmittedSky = vec3(rCol.r, gCol.g, bCol.b);

                float backlight = max(0.0, dot(-faceNormal, sunDir));
                float forwardWash = max(0.0, dot(-sunDir, -V));
                vec3 transmittedSun = uSunColor * (pow(backlight, 4.0) * 1.6 + pow(forwardWash, 2.0) * 0.85);

                vec3 glassInterior = (transmittedSky * 0.75 + transmittedSun + vec3(0.12, 0.15, 0.22)) * glassBodyTint;

                // 3. Dielectric Fresnel Reflection & Edge Luminescence
                float NdotV = clamp(dot(faceNormal, V), 0.0, 1.0);
                float F0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
                float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 3.8);
                vec3 fresnelGlow = vec3(0.88, 0.95, 1.0) * fresnel * 1.25;

                // 4. Directional Facet Highlight & Shadow Contrast
                float NdotL = max(0.0, dot(faceNormal, sunDir));
                float facetShading = mix(0.60, 1.30, NdotL);

                // Sharp Diamond Specular Reflection
                float NdotH = max(0.0, dot(faceNormal, H));
                float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.6;

                // 5. Chromatic Dispersion Glints
                float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
                float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
                vec3 spectralRainbow = evalSpectralPrism(prismT);
                float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 1.9;
                vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

                // 6. Glowing Subsurface Crystal Veins & Strata
                float veinNoise1 = sin((vWorldPos.x * 0.045 + vWorldPos.z * 0.035) * uVeinScale);
                float veinNoise2 = cos((vWorldPos.x * 0.025 - vWorldPos.z * 0.055) * uVeinScale);
                float veinPattern = abs(veinNoise1 + veinNoise2);
                float veinMask = smoothstep(0.32, 0.0, veinPattern);
                vec3 veinColor = mix(vec3(0.22, 0.74, 0.97), vec3(0.96, 0.45, 0.71), sin(vWorldPos.x * 0.015 * uVeinScale) * 0.5 + 0.5);
                vec3 crystalVeins = veinColor * veinMask * uCrystalVeinGlow * 2.8;

                // 7. Surface Reflections
                vec3 reflectRay = reflect(-V, faceNormal);
                float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

                vec3 finalColor = mix(glassInterior * facetShading, reflectedSky, fresnel * 0.85);
                finalColor += uSunColor * specular;
                finalColor += chromaticHighlights;
                finalColor += fresnelGlow;
                finalColor += crystalVeins;

                // Shoreline Glow
                if (uShoreBloom > 0.001) {
                    float shoreDiff = abs(vWorldPos.y - uShoreWaterY);
                    if (shoreDiff < uShoreWidth) {
                        float shoreFactor = smoothstep(uShoreWidth, 0.0, shoreDiff);
                        finalColor += uShoreColor * (uShoreBloom * shoreFactor * 2.0);
                    }
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        this.crystalMat = new THREE.ShaderMaterial({
            uniforms: this.crystalUniforms,
            vertexShader: crystalVertShader,
            fragmentShader: crystalFragShader,
            dithering: true
        });

        this.reloadColorsFromConfig(false);

        const activeTerrainCfg = activeBiome.terrain;
        if (activeTerrainCfg.terrainStyle) {
            this.terrainStyle = activeTerrainCfg.terrainStyle;
        } else if (activeTerrainCfg.isCrystalMode) {
            this.terrainStyle = 'crystal';
        } else {
            this.terrainStyle = (activeTerrainCfg.isToonMode ?? true) ? 'toon' : 'standard';
        }

        this.updateActiveMaterial();

        const baseGeo = new THREE.PlaneGeometry(1600, 1600, initialRes, initialRes);
        baseGeo.rotateX(-Math.PI / 2);
        this.geometry = setupFacetedBarycentricGeometry(baseGeo) as THREE.PlaneGeometry;
        this.mesh = new THREE.Mesh(this.geometry, this.terrainMat);
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        this.update(0, 0);
    }

    private updateActiveMaterial(): void {
        if (this.terrainStyle === 'crystal') {
            this.terrainMat = this.crystalMat;
        } else if (this.terrainStyle === 'standard') {
            this.terrainMat = this.standardMat;
        } else {
            this.terrainMat = this.toonMat;
        }
        if (this.mesh) {
            this.mesh.material = this.terrainMat;
        }
    }

    public reloadColorsFromConfig(redraw: boolean = true): void {
        const biomes: BiomeId[] = ['candyland', 'meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];
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
        if (activeCfg.terrainStyle) {
            this.terrainStyle = activeCfg.terrainStyle;
        } else if (activeCfg.isCrystalMode) {
            this.terrainStyle = 'crystal';
        } else if (activeCfg.isToonMode !== undefined) {
            this.terrainStyle = activeCfg.isToonMode ? 'toon' : 'standard';
        }

        if (activeCfg.glassTransmission !== undefined) this.crystalParams.glassTransmission = activeCfg.glassTransmission;
        if (activeCfg.iridescence !== undefined) this.crystalParams.iridescence = activeCfg.iridescence;
        if (activeCfg.specularGlint !== undefined) this.crystalParams.specularGlint = activeCfg.specularGlint;
        if (activeCfg.bevelGleam !== undefined) this.crystalParams.bevelGleam = activeCfg.bevelGleam;
        if (activeCfg.veinGlow !== undefined) this.crystalParams.veinGlow = activeCfg.veinGlow;
        if (activeCfg.glassRefraction !== undefined) this.crystalParams.glassRefraction = activeCfg.glassRefraction;
        if (activeCfg.glassTint !== undefined) this.crystalParams.glassTint = activeCfg.glassTint;
        if (activeCfg.veinScale !== undefined) this.crystalParams.veinScale = activeCfg.veinScale;

        this.syncCrystalUniforms();
        this.updateActiveMaterial();

        if (redraw && this.mesh) {
            this.invalidateAndRedraw();
        }
    }

    public syncCrystalUniforms(): void {
        if (!this.crystalUniforms) return;
        this.crystalUniforms.uGlassTransmission.value = this.crystalParams.glassTransmission;
        this.crystalUniforms.uIridescence.value = this.crystalParams.iridescence;
        this.crystalUniforms.uSpecularGlint.value = this.crystalParams.specularGlint;
        this.crystalUniforms.uFacetBevelGleam.value = this.crystalParams.bevelGleam;
        this.crystalUniforms.uCrystalVeinGlow.value = this.crystalParams.veinGlow;
        this.crystalUniforms.uGlassRefraction.value = this.crystalParams.glassRefraction;
        this.crystalUniforms.uGlassTint.value = this.crystalParams.glassTint;
        this.crystalUniforms.uVeinScale.value = this.crystalParams.veinScale;
    }

    public setTerrainStyle(style: 'toon' | 'standard' | 'crystal', biomeId?: BiomeId): void {
        this.terrainStyle = style;
        this.isToonMode = style === 'toon';
        const bId = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(bId);
        if (bCfg) {
            bCfg.terrain.terrainStyle = style;
            bCfg.terrain.isToonMode = style === 'toon';
            bCfg.terrain.isCrystalMode = style === 'crystal';
        }
        this.updateActiveMaterial();
    }

    public setCrystalParams(params: Partial<typeof this.crystalParams>, biomeId?: BiomeId): void {
        Object.assign(this.crystalParams, params);
        const bId = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(bId);
        if (bCfg) {
            if (params.glassTransmission !== undefined) bCfg.terrain.glassTransmission = params.glassTransmission;
            if (params.iridescence !== undefined) bCfg.terrain.iridescence = params.iridescence;
            if (params.specularGlint !== undefined) bCfg.terrain.specularGlint = params.specularGlint;
            if (params.bevelGleam !== undefined) bCfg.terrain.bevelGleam = params.bevelGleam;
            if (params.veinGlow !== undefined) bCfg.terrain.veinGlow = params.veinGlow;
            if (params.glassRefraction !== undefined) bCfg.terrain.glassRefraction = params.glassRefraction;
            if (params.glassTint !== undefined) bCfg.terrain.glassTint = params.glassTint;
            if (params.veinScale !== undefined) bCfg.terrain.veinScale = params.veinScale;
            if (params.showGroundCrystals !== undefined) bCfg.terrain.showGroundCrystals = params.showGroundCrystals;
        }
        this.syncCrystalUniforms();
    }

    public setToonMode(isToon: boolean, biomeId?: BiomeId): void {
        this.setTerrainStyle(isToon ? 'toon' : 'standard', biomeId);
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
        if (colors.terrainStyle) {
            this.setTerrainStyle(colors.terrainStyle, biomeId);
        } else if (colors.isToonMode !== undefined) {
            this.setToonMode(colors.isToonMode, biomeId);
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
        const baseGeo = new THREE.PlaneGeometry(1600, 1600, res, res);
        baseGeo.rotateX(-Math.PI / 2);
        this.geometry = setupFacetedBarycentricGeometry(baseGeo) as THREE.PlaneGeometry;
        this.mesh.geometry = this.geometry;
        this.lastGridX = -99999;
        this.lastGridZ = -99999;
        this.update(px, pz);
    }

    public update(playerX: number, playerZ: number, dt: number = 0.016): void {
        this.lastPlayerX = playerX;
        this.lastPlayerZ = playerZ;

        if (this.crystalUniforms) {
            this.crystalUniforms.uTime.value += dt;
        }

        const gridX = Math.floor(playerX / this.gridStride) * this.gridStride;
        const gridZ = Math.floor(playerZ / this.gridStride) * this.gridStride;

        if (gridX === this.lastGridX && gridZ === this.lastGridZ) return;

        this.mesh.position.set(gridX, 0, gridZ);

        const pos = this.geometry.attributes.position as THREE.BufferAttribute;
        if (!this.geometry.attributes.color) {
            this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.geometry.attributes.color as THREE.BufferAttribute;

        const biomes: BiomeId[] = ['candyland', 'meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const w = getBiomeWeights(worldX, worldZ);
            const h = terrainHeightWithWeights(worldX, worldZ, w);
            pos.setY(i, h);

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

            // Smooth macro-variation
            const macroNoise = snoise(worldX * 0.005, worldZ * 0.005) * 3.5;

            // 1. Smooth Lowland to Highland gradient
            const grassWeight = smoothstep(2.0, 44.0, h + macroNoise);
            let r = lowR * (1.0 - grassWeight) + highR * grassWeight;
            let g = lowG * (1.0 - grassWeight) + highG * grassWeight;
            let b = lowB * (1.0 - grassWeight) + highB * grassWeight;

            // 2. Continuous mountain dirt/rock transition
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

            // 4. Exploration pathways
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

        this.geometry.computeVertexNormals();
        pos.needsUpdate = true;
        if (this.geometry.attributes.normal) {
            (this.geometry.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
        }
        colors.needsUpdate = true;

        this.lastGridX = gridX;
        this.lastGridZ = gridZ;
    }
}
