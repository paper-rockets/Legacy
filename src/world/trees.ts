import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeightJS, getDominantBiome, BiomeId } from './noise';
import { gradientMap } from './terrain';
import { globalConfigManager } from '../core/config';

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAWN_RADIUS = 700;
const REBUILD_THRESHOLD = 20;
const MAX_CAPACITY = 800;
const MIN_TREE_HEIGHT = 4.5;
const MAX_TREE_HEIGHT = 24.0;

export type PresetKey = 'candy' | 'cotton' | 'lollipop' | 'mints' | 'berry' | 'archipelago' | 'geothermal' | 'estuary' | 'redwood' | 'biome_auto';

export interface ColorPreset {
    name: string;
    canopyColors: string[];
    trunkColors: string[];
}

export const BIOME_VEG_PRESETS: Record<string, ColorPreset> = {
    candy: {
        name: 'Candy Mix',
        canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600', '#ff7700', '#ff1744'],
        trunkColors: ['#ffffff', '#fff3e0', '#ffe4e6', '#e0f7fa']
    },
    cotton: {
        name: 'Cotton Candy',
        canopyColors: ['#00bfff', '#60a5fa', '#ff66cc', '#f43f5e', '#c084fc', '#ffaa00', '#ffea00'],
        trunkColors: ['#ffffff', '#ffeef5', '#e0f2fe']
    },
    lollipop: {
        name: 'Lollipop',
        canopyColors: ['#ff0033', '#ff6600', '#39ff14', '#00f0ff', '#9900ff', '#ff007f', '#ffd700'],
        trunkColors: ['#ffffff', '#ffedd5', '#ffd1dc', '#935116']
    },
    mints: {
        name: 'Spearmint & Ice',
        canopyColors: ['#00ff88', '#10ff9e', '#00f5d4', '#00c8ff', '#38bdf8', '#00e676'],
        trunkColors: ['#ffffff', '#d1fae5', '#e0f2fe']
    },
    berry: {
        name: 'Wild Berry',
        canopyColors: ['#ff0066', '#d90429', '#9d4edd', '#3a0ca3', '#d00000', '#f72585'],
        trunkColors: ['#ffffff', '#fce7f3', '#6a0dad']
    },
    archipelago: {
        name: 'Sakura & Cloud Blossom',
        canopyColors: ['#ff69b4', '#ffb6c1', '#fbcfe8', '#c4b5fd', '#93c5fd', '#ffffff'],
        trunkColors: ['#fff3e0', '#ffe4e6', '#d6d3d1']
    },
    archipelago_crystal: {
        name: 'Cyan Crystal Flora',
        canopyColors: ['#00f5d4', '#38bdf8', '#7dd3fc', '#bae6fd', '#a7f3d0'],
        trunkColors: ['#ffffff', '#e2e8f0', '#cbd5e1']
    },
    archipelago_lavender: {
        name: 'Lavender Mist',
        canopyColors: ['#a855f7', '#c084fc', '#e9d5ff', '#d8b4fe', '#818cf8'],
        trunkColors: ['#faf5ff', '#f3e8ff', '#e9d5ff']
    },
    geothermal: {
        name: 'Ash & Lava Ember',
        canopyColors: ['#ff3300', '#ff7700', '#ffaa00', '#cc1100', '#f59e0b'],
        trunkColors: ['#27272a', '#3f3f46', '#1c1917']
    },
    geothermal_magma: {
        name: 'Molten Magma',
        canopyColors: ['#ef4444', '#dc2626', '#b91c1c', '#f97316', '#fbbf24'],
        trunkColors: ['#18181b', '#292524', '#44403c']
    },
    geothermal_sulfur: {
        name: 'Sulfur & Caldera Gold',
        canopyColors: ['#eab308', '#facc15', '#fef08a', '#ca8a04', '#84cc16'],
        trunkColors: ['#3f3f46', '#52525b', '#27272a']
    },
    estuary: {
        name: 'Bioluminescent Coral',
        canopyColors: ['#00f5d4', '#00bbf9', '#f72585', '#7209b7', '#4cc9f0', '#10b981'],
        trunkColors: ['#ffffff', '#e0f2fe', '#fce7f3']
    },
    estuary_neon: {
        name: 'Neon Lagoon',
        canopyColors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'],
        trunkColors: ['#0f172a', '#1e293b', '#334155']
    },
    estuary_spirit: {
        name: 'Spirit Blossom',
        canopyColors: ['#f472b6', '#38bdf8', '#818cf8', '#34d399', '#fbcfe8'],
        trunkColors: ['#fdf4ff', '#fae8ff', '#f5d0fe']
    },
    redwood: {
        name: 'Ancient Giant Redwood',
        canopyColors: ['#15803d', '#166534', '#14532d', '#22c55e', '#4ade80'],
        trunkColors: ['#78350f', '#451a03', '#522e18']
    },
    redwood_golden: {
        name: 'Golden Forest',
        canopyColors: ['#eab308', '#ca8a04', '#a16207', '#65a30d', '#84cc16'],
        trunkColors: ['#5c2c10', '#431407', '#78350f']
    },
    redwood_conifer: {
        name: 'Deep Conifer',
        canopyColors: ['#064e3b', '#065f46', '#047857', '#0f766e', '#115e59'],
        trunkColors: ['#3b1c0b', '#2e1407', '#4a2511']
    }
};

// ── Deterministic RNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function cellSeed(cx: number, cz: number, offset: number = 0): number {
    let h = (cx * 73856093) ^ (cz * 19349663) ^ (offset * 83492791);
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    return Math.abs(h) | 1;
}

// ── GLB Geometry Loader (Split Trunk vs Canopy) ────────────────────────────────

async function loadTreeGeometries(
    url: string,
    loader: GLTFLoader,
    customScale: number = 1.0
): Promise<{ trunkGeo: THREE.BufferGeometry; canopyGeo: THREE.BufferGeometry }> {
    const gltf = await loader.loadAsync(encodeURI(url));
    const trunkGeos: THREE.BufferGeometry[] = [];
    const canopyGeos: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);

    const allMeshes: THREE.Mesh[] = [];
    let modelMinY = Infinity;
    let modelMaxY = -Infinity;

    gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry.computeBoundingBox();
            const bb = mesh.geometry.boundingBox;
            if (bb) {
                const min = bb.min.clone().applyMatrix4(mesh.matrixWorld);
                const max = bb.max.clone().applyMatrix4(mesh.matrixWorld);
                modelMinY = Math.min(modelMinY, min.y, max.y);
                modelMaxY = Math.max(modelMaxY, min.y, max.y);
            }
            allMeshes.push(mesh);
        }
    });

    const modelHeight = Math.max(0.001, modelMaxY - modelMinY);

    for (const mesh of allMeshes) {
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrixWorld);
        if (!geo.getAttribute('normal')) geo.computeVertexNormals();

        const clean = new THREE.BufferGeometry();
        clean.setAttribute('position', geo.getAttribute('position'));
        clean.setAttribute('normal', geo.getAttribute('normal'));
        if (geo.index) clean.setIndex(geo.index);

        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const matName = mat ? (Array.isArray(mat) ? mat.map(m => m.name).join(' ') : mat.name) : '';
        const name = (mesh.name + ' ' + (mesh.parent ? mesh.parent.name : '') + ' ' + matName).toLowerCase();

        // 1. Explicit keyword check
        const isTrunkName = name.includes('wood') || name.includes('stick') || name.includes('trunk') || 
                            name.includes('branch') || name.includes('bark') || name.includes('stem') || 
                            name.includes('brown');
        const isCanopyName = name.includes('leaf') || name.includes('leaves') || name.includes('canopy') || 
                             name.includes('bubble') || name.includes('crown') || name.includes('foliage') || 
                             name.includes('yellow') || name.includes('green') || name.includes('sphere') ||
                             name.includes('crone');

        if (isTrunkName && !isCanopyName) {
            trunkGeos.push(clean);
            continue;
        }
        if (isCanopyName && !isTrunkName) {
            canopyGeos.push(clean);
            continue;
        }

        // 2. Position-based check for multi-mesh models without explicit keywords (e.g. Archipelago TreeAsset_4/5/6)
        if (allMeshes.length > 1) {
            geo.computeBoundingBox();
            const bb = geo.boundingBox!;
            const meshCenterY = (bb.min.y + bb.max.y) / 2;
            const relY = (meshCenterY - modelMinY) / modelHeight;
            // Lower 42% of tree height is trunk, upper part is canopy
            if (relY < 0.42 || (bb.min.y <= modelMinY + 0.05 * modelHeight && bb.max.y < modelMinY + 0.65 * modelHeight)) {
                trunkGeos.push(clean);
            } else {
                canopyGeos.push(clean);
            }
            continue;
        }

        // 3. Single-mesh model (e.g. tree_Tree_9.glb) - Split triangles by vertex height
        const pos = clean.attributes.position as THREE.BufferAttribute;
        const index = clean.index;
        const splitY = modelMinY + modelHeight * 0.32;

        const trunkIndices: number[] = [];
        const canopyIndices: number[] = [];
        const triCount = index ? index.count / 3 : pos.count / 3;

        for (let i = 0; i < triCount; i++) {
            const i0 = index ? index.getX(i * 3) : i * 3;
            const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
            const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

            const y0 = pos.getY(i0);
            const y1 = pos.getY(i1);
            const y2 = pos.getY(i2);
            const avgY = (y0 + y1 + y2) / 3;

            if (avgY < splitY) {
                trunkIndices.push(i0, i1, i2);
            } else {
                canopyIndices.push(i0, i1, i2);
            }
        }

        if (trunkIndices.length > 0) {
            const tGeo = clean.clone();
            tGeo.setIndex(trunkIndices);
            trunkGeos.push(tGeo.toNonIndexed ? tGeo.toNonIndexed() : tGeo);
        }
        if (canopyIndices.length > 0) {
            const cGeo = clean.clone();
            cGeo.setIndex(canopyIndices);
            canopyGeos.push(cGeo.toNonIndexed ? cGeo.toNonIndexed() : cGeo);
        }
    }

    const mergedTrunk = trunkGeos.length > 0 ? (trunkGeos.length === 1 ? trunkGeos[0] : (mergeGeometries(trunkGeos, false) || trunkGeos[0])) : new THREE.BufferGeometry();
    const mergedCanopy = canopyGeos.length > 0 ? (canopyGeos.length === 1 ? canopyGeos[0] : (mergeGeometries(canopyGeos, false) || canopyGeos[0])) : new THREE.BufferGeometry();

    const combinedGeos: THREE.BufferGeometry[] = [];
    if (trunkGeos.length > 0) combinedGeos.push(mergedTrunk);
    if (canopyGeos.length > 0) combinedGeos.push(mergedCanopy);
    const combined = mergeGeometries(combinedGeos, false);

    if (combined) {
        combined.computeBoundingBox();
        const box = combined.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const bottomY = box.min.y;

        const baseScaleFactor = size.y > 0.001 ? 6.0 / size.y : 1.0;
        const scaleFactor = baseScaleFactor * customScale;

        if (mergedTrunk.attributes.position) {
            mergedTrunk.translate(-center.x, -bottomY, -center.z);
            mergedTrunk.scale(scaleFactor, scaleFactor, scaleFactor);
            mergedTrunk.computeVertexNormals();
        }
        if (mergedCanopy.attributes.position) {
            mergedCanopy.translate(-center.x, -bottomY, -center.z);
            mergedCanopy.scale(scaleFactor, scaleFactor, scaleFactor);
            mergedCanopy.computeVertexNormals();
        }
    }

    if (!mergedTrunk.attributes.position) {
        mergedTrunk.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 0,0,0, 0,0,0]), 3));
        mergedTrunk.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
    }
    if (!mergedCanopy.attributes.position) {
        mergedCanopy.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 0,0,0, 0,0,0]), 3));
        mergedCanopy.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
    }

    return { trunkGeo: mergedTrunk, canopyGeo: mergedCanopy };
}

interface TreeModelConfig {
    path: string;
    scaleMultiplier?: number;
}

const BIOME_TREE_CONFIGS: Record<BiomeId, TreeModelConfig[]> = {
    meadow: [
        { path: '/Assets/Cartoon/Cartoon_Trees_Tree_1.glb' },
        { path: '/Assets/Cartoon/Cartoon_Trees_Tree_2.glb' },
        { path: '/Assets/Cartoon/Cartoon_Trees_Tree_3.glb' },
    ],
    redwood: [
        { path: '/Assets/Cartoon 4/LPTree_Tree_Type0_04_Model_balanced_instanced_l1_superhigh.glb', scaleMultiplier: 1.2 },
        { path: '/Assets/Cartoon 4/LPTree_Tree_Type3_03_Model_instanced_l2_superhigh.glb' },
        { path: '/Assets/Cartoon 4/LPTree_Tree_Type3_05_Model_balanced_instanced_l1_superhigh.glb' },
        { path: '/Assets/Cartoon 4/Lowpolytree_6_yellow_superhigh.glb' },
    ],
    archipelago: [
        { path: '/Assets/Bubble/TreeAsset_4_instanced_l2_superhigh.glb' },
        { path: '/Assets/Bubble/TreeAsset_5_instanced_l2_superhigh.glb' },
        { path: '/Assets/Bubble/TreeAsset_6_instanced_l2_superhigh.glb' },
    ],
    estuary: [
        { path: '/Assets/Cartoon 2/Cartoon_Trees_Tree_1.glb' },
        { path: '/Assets/Cartoon 2/Cartoon_Trees_Tree_2.glb' },
        { path: '/Assets/Cartoon 2/Cartoon_Trees_Tree_3.glb' },
    ],
    geothermal: [
        { path: '/Assets/Cartoon 3/low_poly_tree_1_Tree_1.glb' },
        { path: '/Assets/Cartoon 3/tree_Tree_9.glb' },
    ],
};

function isVegetationAllowed(x: number, z: number, y: number, biome: BiomeId): boolean {
    if (y < 3.2) return false;
    
    // Check slope around the sample point
    const hR = terrainHeightJS(x + 2.5, z);
    const hF = terrainHeightJS(x, z + 2.5);
    const slope = Math.max(Math.abs(hR - y), Math.abs(hF - y)) / 2.5;

    if (biome === 'archipelago') {
        // Archipelago: strictly land only (green & beige terrain), no trees on mountain spires or cliffs
        return y <= 33.0 && slope < 0.70;
    } else if (biome === 'redwood') {
        // Redwood: valleys and forest land only, no trees on high mountains
        return y <= 38.0 && slope < 0.85;
    } else if (biome === 'geothermal') {
        // Geothermal: land and ridges only, no high bare peaks
        return y <= 36.0 && slope < 0.85;
    } else {
        // Meadow and Estuary: land only, not high peaks
        return y <= 40.0 && slope < 0.90;
    }
}

// ── TreeSystem ─────────────────────────────────────────────────────────────────

export class TreeSystem {
    // Biome-Specific GLB Tree InstancedMeshes (Trunk & Canopy separated)
    private biomeTreeTrunkInsts: Record<BiomeId, THREE.InstancedMesh[]> = {
        meadow: [],
        archipelago: [],
        geothermal: [],
        estuary: [],
        redwood: []
    };
    private biomeTreeCanopyInsts: Record<BiomeId, THREE.InstancedMesh[]> = {
        meadow: [],
        archipelago: [],
        geothermal: [],
        estuary: [],
        redwood: []
    };

    // Bushes (2 varieties)
    private bushInsts: THREE.InstancedMesh[] = [];

    // Materials
    private trunkMat!: THREE.MeshToonMaterial;
    private canopyMat!: THREE.MeshToonMaterial;
    private bushMat!: THREE.MeshToonMaterial;

    // Emissive Glow & Bloom Uniforms
    private canopyGlowUniform = { value: 0.35 };
    private trunkGlowUniform = { value: 0.75 };
    private bushGlowUniform = { value: 0.35 };
    private treeBloomUniform = { value: 1.0 };
    private bushBloomUniform = { value: 1.0 };

    // Glow State
    private currentCanopyGlow = 0.0;
    private currentTrunkGlow = 0.75;
    private currentBushGlow = 0.0;

    // Spatial & Loading State
    public ready: boolean = false;
    private dirty: boolean = true;
    public lastX: number = -99999;
    public lastZ: number = -99999;

    // Temporary Math Objects (Zero Garbage Collection)
    private dummy = new THREE.Object3D();
    private tempColor = new THREE.Color();
    private tempHSL = { h: 0, s: 0, l: 0 };

    constructor(private scene: THREE.Scene) {}

    async init(): Promise<void> {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/gltf/');
        loader.setDRACOLoader(dracoLoader);

        // ── 1. Separate Trunk & Canopy MeshToonMaterials ───────────────────────
        this.trunkMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true,
        });
        this.trunkMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTrunkGlow = this.trunkGlowUniform;
            shader.uniforms.uTreeBloom = this.treeBloomUniform;
            shader.fragmentShader = `uniform float uTrunkGlow;\nuniform float uTreeBloom;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    vec3 col = vInstanceColor.rgb;
                    float maxC = max(col.r, max(col.g, col.b));
                    vec3 normCol = maxC > 0.01 ? (col / maxC) : col;
                    totalEmissiveRadiance += normCol * (uTrunkGlow * 0.45 * uTreeBloom);
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * (uTrunkGlow * 0.45 * uTreeBloom);
                #endif
                `
            );
        };

        this.canopyMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true,
        });
        this.canopyMat.onBeforeCompile = (shader) => {
            shader.uniforms.uGlowIntensity = this.canopyGlowUniform;
            shader.uniforms.uTreeBloom = this.treeBloomUniform;
            shader.fragmentShader = `uniform float uGlowIntensity;\nuniform float uTreeBloom;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    vec3 col = vInstanceColor.rgb;
                    float maxC = max(col.r, max(col.g, col.b));
                    vec3 normCol = maxC > 0.01 ? (col / maxC) : col;
                    totalEmissiveRadiance += normCol * (uGlowIntensity * 1.5 * uTreeBloom);
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * (uGlowIntensity * 1.5 * uTreeBloom);
                #endif
                `
            );
        };

        // Bush Material
        this.bushMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true,
        });
        this.bushMat.onBeforeCompile = (shader) => {
            shader.uniforms.uBushGlow = this.bushGlowUniform;
            shader.uniforms.uBushBloom = this.bushBloomUniform;
            shader.fragmentShader = `uniform float uBushGlow;\nuniform float uBushBloom;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    vec3 col = vInstanceColor.rgb;
                    float maxC = max(col.r, max(col.g, col.b));
                    vec3 normCol = maxC > 0.01 ? (col / maxC) : col;
                    totalEmissiveRadiance += normCol * (uBushGlow * 1.3 * uBushBloom);
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * (uBushGlow * 1.3 * uBushBloom);
                #endif
                `
            );
        };

        const setupInstMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, capacity: number, castShadow: boolean = true) => {
            const inst = new THREE.InstancedMesh(geo, mat, capacity);
            inst.count = 0;
            inst.castShadow = castShadow;
            inst.receiveShadow = true;
            inst.frustumCulled = false;
            inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
            this.scene.add(inst);
            return inst;
        };

        // ── 2. Load Biome Tree Models ──────────────────────────────────────────
        const biomes: BiomeId[] = ['meadow', 'redwood', 'archipelago', 'estuary', 'geothermal'];
        const loadedBiomes = await Promise.all(
            biomes.map(async (biomeKey) => {
                const configs = BIOME_TREE_CONFIGS[biomeKey];
                const models = await Promise.all(
                    configs.map(cfg => loadTreeGeometries(cfg.path, loader, cfg.scaleMultiplier ?? 1.0))
                );
                return { biomeKey, models };
            })
        );

        for (const { biomeKey, models } of loadedBiomes) {
            for (const { trunkGeo, canopyGeo } of models) {
                const trunkInst = setupInstMesh(trunkGeo, this.trunkMat, MAX_CAPACITY, true);
                const canopyInst = setupInstMesh(canopyGeo, this.canopyMat, MAX_CAPACITY, true);
                this.biomeTreeTrunkInsts[biomeKey].push(trunkInst);
                this.biomeTreeCanopyInsts[biomeKey].push(canopyInst);
            }
        }

        // ── 3. Bush Geometries ─────────────────────────────────────────────────
        const bushRoundGeo = new THREE.IcosahedronGeometry(1.4, 2);
        bushRoundGeo.translate(0, 0.4, 0);
        const bushFlatGeo = new THREE.IcosahedronGeometry(1.8, 2);
        bushFlatGeo.translate(0, 0.3, 0);

        for (const geo of [bushRoundGeo, bushFlatGeo]) {
            const inst = setupInstMesh(geo, this.bushMat, MAX_CAPACITY, false);
            this.bushInsts.push(inst);
        }

        this.ready = true;
        this.dirty = true;
    }

    update(playerX: number, playerZ: number): void {
        if (!this.ready) return;

        const dx = playerX - this.lastX;
        const dz = playerZ - this.lastZ;
        if (!this.dirty && dx * dx + dz * dz < REBUILD_THRESHOLD * REBUILD_THRESHOLD) return;

        this.rebuild(playerX, playerZ);
        this.lastX = playerX;
        this.lastZ = playerZ;
        this.dirty = false;
    }

    updateGlow(dt: number, timePhase: number): void {
        if (!this.ready) return;

        const activeBiome = globalConfigManager.getActiveBiomeConfig();
        const blm = activeBiome.bloom;

        this.treeBloomUniform.value = blm.treeBloom;
        this.bushBloomUniform.value = blm.bushBloom;

        // Trunk base glow
        const trunkTarget = 0.75 * blm.treeTrunkGlow;
        this.currentTrunkGlow += (trunkTarget - this.currentTrunkGlow) * Math.min(1, dt * 2.5);
        this.trunkGlowUniform.value = this.currentTrunkGlow;

        // Canopy glowstick effect (Day = 0, Dusk = 0.5, Night = 1.35)
        const NIGHT_MAX = 1.35;
        const DUSK_50 = NIGHT_MAX * 0.50;
        const canopyTarget = ([0.0, DUSK_50, NIGHT_MAX][timePhase] ?? 0.0) * blm.treeCanopyGlow;
        this.currentCanopyGlow += (canopyTarget - this.currentCanopyGlow) * Math.min(1, dt * 2.5);
        this.canopyGlowUniform.value = this.currentCanopyGlow;

        // Bush glowstick effect
        const bushTarget = ([0.0, DUSK_50, NIGHT_MAX][timePhase] ?? 0.0) * blm.bushGlow;
        this.currentBushGlow += (bushTarget - this.currentBushGlow) * Math.min(1, dt * 2.5);
        this.bushGlowUniform.value = this.currentBushGlow;
    }

    // ── Rebuild Instanced Meshes ───────────────────────────────────────────────

    public rebuild(px: number, pz: number): void {
        if (!this.ready) return;

        const biomeCounts: Record<BiomeId, number[]> = {
            meadow: new Array(this.biomeTreeTrunkInsts.meadow.length).fill(0),
            archipelago: new Array(this.biomeTreeTrunkInsts.archipelago.length).fill(0),
            geothermal: new Array(this.biomeTreeTrunkInsts.geothermal.length).fill(0),
            estuary: new Array(this.biomeTreeTrunkInsts.estuary.length).fill(0),
            redwood: new Array(this.biomeTreeTrunkInsts.redwood.length).fill(0),
        };

        const area = Math.PI * SPAWN_RADIUS * SPAWN_RADIUS;
        const treeGridSpacing = 16.0;

        const minCX = Math.floor((px - SPAWN_RADIUS) / treeGridSpacing);
        const maxCX = Math.ceil((px + SPAWN_RADIUS) / treeGridSpacing);
        const minCZ = Math.floor((pz - SPAWN_RADIUS) / treeGridSpacing);
        const maxCZ = Math.ceil((pz + SPAWN_RADIUS) / treeGridSpacing);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const rng = mulberry32(cellSeed(cx, cz, 101));

                const x = (cx + 0.15 + rng() * 0.7) * treeGridSpacing;
                const z = (cz + 0.15 + rng() * 0.7) * treeGridSpacing;

                const dx = x - px;
                const dz = z - pz;
                if (dx * dx + dz * dz > SPAWN_RADIUS * SPAWN_RADIUS) continue;

                const y = terrainHeightJS(x, z);
                const biome = getDominantBiome(x, z);
                if (!isVegetationAllowed(x, z, y, biome)) continue;
                const biomeCfg = globalConfigManager.getBiomeConfig(biome);
                const veg = biomeCfg.vegetation;

                // Density filter
                const densityChance = veg.treeDensity / 800.0;
                if (rng() > densityChance) continue;

                const trunkList = this.biomeTreeTrunkInsts[biome];
                const canopyList = this.biomeTreeCanopyInsts[biome];
                const numVariants = trunkList.length;
                if (numVariants === 0) continue;

                const variantIndex = Math.floor(rng() * numVariants);
                const trunkInst = trunkList[variantIndex];
                const canopyInst = canopyList[variantIndex];
                const idx = biomeCounts[biome][variantIndex];
                if (idx >= MAX_CAPACITY) continue;

                // Scale factor per biome with instance variation
                let baseScale = veg.treeScale * 0.16;
                if (biome === 'redwood') baseScale *= 1.35;
                if (biome === 'estuary') baseScale *= 0.85;

                const sizeVariation = 0.85 + rng() * 0.35;
                const scaleX = baseScale * sizeVariation;
                const scaleY = baseScale * (0.9 + rng() * 0.25);
                const scaleZ = baseScale * sizeVariation;

                const rotY = rng() * Math.PI * 2;
                const tiltX = (rng() - 0.5) * 0.08;
                const tiltZ = (rng() - 0.5) * 0.08;

                this.dummy.position.set(x, y - 0.15, z);
                this.dummy.rotation.set(tiltX, rotY, tiltZ);
                this.dummy.scale.set(scaleX, scaleY, scaleZ);
                this.dummy.updateMatrix();

                trunkInst.setMatrixAt(idx, this.dummy.matrix);
                canopyInst.setMatrixAt(idx, this.dummy.matrix);

                // Canopy Color selection with per-tree instance variation
                const canopyPalette = veg.canopyColors.length > 0 ? veg.canopyColors : ['#ff1493', '#00d2ff', '#00ff88'];
                const canopyHex = canopyPalette[Math.floor(rng() * canopyPalette.length)];
                this.tempColor.set(canopyHex);
                this.tempColor.getHSL(this.tempHSL);
                this.tempHSL.l = THREE.MathUtils.clamp(this.tempHSL.l + (rng() - 0.5) * 0.08, 0.1, 0.9);
                this.tempHSL.s = THREE.MathUtils.clamp(this.tempHSL.s + (rng() - 0.5) * 0.06, 0.2, 1.0);
                this.tempColor.setHSL(this.tempHSL.h, this.tempHSL.s, this.tempHSL.l);
                canopyInst.setColorAt(idx, this.tempColor);

                // Trunk Color selection with per-tree instance variation
                const trunkPalette = veg.trunkColors.length > 0 ? veg.trunkColors : ['#ffffff', '#fff3e0'];
                const trunkHex = trunkPalette[Math.floor(rng() * trunkPalette.length)];
                this.tempColor.set(trunkHex);
                trunkInst.setColorAt(idx, this.tempColor);

                biomeCounts[biome][variantIndex]++;
            }
        }

        // Commit tree counts and update buffers
        const allBiomes: BiomeId[] = ['meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];
        for (const b of allBiomes) {
            for (let v = 0; v < this.biomeTreeTrunkInsts[b].length; v++) {
                const trunk = this.biomeTreeTrunkInsts[b][v];
                const canopy = this.biomeTreeCanopyInsts[b][v];
                const count = biomeCounts[b][v];
                trunk.count = count;
                canopy.count = count;
                if (trunk.instanceMatrix) trunk.instanceMatrix.needsUpdate = true;
                if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
                if (canopy.instanceMatrix) canopy.instanceMatrix.needsUpdate = true;
                if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
            }
        }

        // ── 2. Rebuild Bushes ──────────────────────────────────────────────────
        let bushCount0 = 0, bushCount1 = 0;
        const bushSpacing = 22.0;
        const bMinCX = Math.floor((px - SPAWN_RADIUS * 0.7) / bushSpacing);
        const bMaxCX = Math.ceil((px + SPAWN_RADIUS * 0.7) / bushSpacing);
        const bMinCZ = Math.floor((pz - SPAWN_RADIUS * 0.7) / bushSpacing);
        const bMaxCZ = Math.ceil((pz + SPAWN_RADIUS * 0.7) / bushSpacing);

        for (let cx = bMinCX; cx <= bMaxCX; cx++) {
            for (let cz = bMinCZ; cz <= bMaxCZ; cz++) {
                const rng = mulberry32(cellSeed(cx, cz, 303));
                const x = (cx + 0.1 + rng() * 0.8) * bushSpacing;
                const z = (cz + 0.1 + rng() * 0.8) * bushSpacing;

                const dx = x - px;
                const dz = z - pz;
                if (dx * dx + dz * dz > (SPAWN_RADIUS * 0.7) ** 2) continue;

                const y = terrainHeightJS(x, z);
                const biome = getDominantBiome(x, z);
                if (!isVegetationAllowed(x, z, y, biome)) continue;
                const biomeCfg = globalConfigManager.getBiomeConfig(biome);
                const veg = biomeCfg.vegetation;

                const bushChance = veg.bushDensity / 400.0;
                if (rng() > bushChance) continue;

                const variant = rng() > 0.5 ? 1 : 0;
                const inst = this.bushInsts[variant];
                const idx = variant === 0 ? bushCount0 : bushCount1;
                if (idx >= MAX_CAPACITY) continue;

                const bScale = veg.bushScale * (0.8 + rng() * 0.4);
                this.dummy.position.set(x, y - 0.05, z);
                this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
                this.dummy.scale.set(bScale, bScale * (0.8 + rng() * 0.4), bScale);
                this.dummy.updateMatrix();

                inst.setMatrixAt(idx, this.dummy.matrix);

                const palette = veg.canopyColors.length > 0 ? veg.canopyColors : ['#ff1493', '#00ff88'];
                this.tempColor.set(palette[Math.floor(rng() * palette.length)]);
                inst.setColorAt(idx, this.tempColor);

                if (variant === 0) bushCount0++;
                else bushCount1++;
            }
        }

        if (this.bushInsts[0]) {
            this.bushInsts[0].count = bushCount0;
            if (this.bushInsts[0].instanceMatrix) this.bushInsts[0].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[0].instanceColor) this.bushInsts[0].instanceColor.needsUpdate = true;
        }
        if (this.bushInsts[1]) {
            this.bushInsts[1].count = bushCount1;
            if (this.bushInsts[1].instanceMatrix) this.bushInsts[1].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[1].instanceColor) this.bushInsts[1].instanceColor.needsUpdate = true;
        }
    }

    // ── Live Setters per Biome ─────────────────────────────────────────────────

    public setBiomeTreeScale(biomeId: BiomeId, scale: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.treeScale = Math.max(0.5, Math.min(15.0, scale));
        this.forceRebuild();
    }

    public setBiomeTreeDensity(biomeId: BiomeId, density: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.treeDensity = Math.max(0, Math.min(800, Math.round(density)));
        this.forceRebuild();
    }

    public setBiomeBushScale(biomeId: BiomeId, scale: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.bushScale = Math.max(0.2, Math.min(5.0, scale));
        this.forceRebuild();
    }

    public setBiomeBushDensity(biomeId: BiomeId, density: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.bushDensity = Math.max(0, Math.min(800, Math.round(density)));
        this.forceRebuild();
    }

    public setBiomeCanopyColors(biomeId: BiomeId, colors: string[]): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.canopyColors = colors;
        this.forceRebuild();
    }

    public setBiomeTrunkColors(biomeId: BiomeId, colors: string[]): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.trunkColors = colors;
        this.forceRebuild();
    }

    public applyBiomeVegPreset(biomeId: BiomeId, presetKey: string): void {
        const preset = BIOME_VEG_PRESETS[presetKey];
        if (preset) {
            const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
            veg.canopyColors = [...preset.canopyColors];
            veg.trunkColors = [...preset.trunkColors];
            veg.activePreset = presetKey;
            this.forceRebuild();
        }
    }

    public setBiomeBloomAndGlow(biomeId: BiomeId, bloomProps: Partial<any>): void {
        const blm = globalConfigManager.getBiomeConfig(biomeId).bloom;
        Object.assign(blm, bloomProps);
        if (biomeId === globalConfigManager.config.activeBiomeId) {
            if (blm.treeBloom !== undefined) this.treeBloomUniform.value = blm.treeBloom;
            if (blm.bushBloom !== undefined) this.bushBloomUniform.value = blm.bushBloom;
            if (blm.treeTrunkGlow !== undefined) this.trunkGlowUniform.value = 0.75 * blm.treeTrunkGlow;
            if (blm.treeCanopyGlow !== undefined) this.canopyGlowUniform.value = this.currentCanopyGlow * blm.treeCanopyGlow;
            if (blm.bushGlow !== undefined) this.bushGlowUniform.value = this.currentBushGlow * blm.bushGlow;
        }
    }

    public setPreset(key: string): void {
        this.applyBiomeVegPreset(globalConfigManager.config.activeBiomeId, key);
    }

    public setTreeBloomIntensity(intensity: number): void {
        this.setBiomeBloomAndGlow(globalConfigManager.config.activeBiomeId, { treeBloom: intensity });
    }

    public setCanopyGlowMultiplier(m: number): void {
        this.setBiomeBloomAndGlow(globalConfigManager.config.activeBiomeId, { treeCanopyGlow: m });
    }

    public setTrunkGlowMultiplier(m: number): void {
        this.setBiomeBloomAndGlow(globalConfigManager.config.activeBiomeId, { treeTrunkGlow: m });
    }

    public setBushBloomIntensity(intensity: number): void {
        this.setBiomeBloomAndGlow(globalConfigManager.config.activeBiomeId, { bushBloom: intensity });
    }

    public setBushGlowMultiplier(m: number): void {
        this.setBiomeBloomAndGlow(globalConfigManager.config.activeBiomeId, { bushGlow: m });
    }

    public setScale(s: number): void {
        this.setBiomeTreeScale(globalConfigManager.config.activeBiomeId, s);
    }

    public setDensity(n: number): void {
        this.setBiomeTreeDensity(globalConfigManager.config.activeBiomeId, n);
    }

    public setBushScale(s: number): void {
        this.setBiomeBushScale(globalConfigManager.config.activeBiomeId, s);
    }

    public setBushDensity(n: number): void {
        this.setBiomeBushDensity(globalConfigManager.config.activeBiomeId, n);
    }

    public forceRebuild(): void {
        this.dirty = true;
        if (this.lastX !== -99999) {
            this.rebuild(this.lastX, this.lastZ);
            this.dirty = false;
        }
    }
}
