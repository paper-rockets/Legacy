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

    const hasNamedRoots = gltf.scene.children.some(c => c.name && c.name.trim().length > 0);

    gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            // Ignore unnamed orphan root meshes when named tree nodes exist
            if (hasNamedRoots && child.parent === gltf.scene && (!child.name || child.name.trim() === '')) {
                return;
            }
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

    interface SubPart {
        geo: THREE.BufferGeometry;
        mesh: THREE.Mesh;
        mat?: THREE.Material;
    }

    const subParts: SubPart[] = [];

    for (const mesh of allMeshes) {
        const worldGeo = mesh.geometry.clone();
        worldGeo.applyMatrix4(mesh.matrixWorld);
        if (!worldGeo.getAttribute('normal')) worldGeo.computeVertexNormals();

        if (worldGeo.groups && worldGeo.groups.length > 1) {
            for (const g of worldGeo.groups) {
                const subGeo = new THREE.BufferGeometry();
                subGeo.setAttribute('position', worldGeo.getAttribute('position'));
                subGeo.setAttribute('normal', worldGeo.getAttribute('normal'));
                if (worldGeo.getAttribute('uv')) subGeo.setAttribute('uv', worldGeo.getAttribute('uv'));

                if (worldGeo.index) {
                    const indices = worldGeo.index.array.slice(g.start, g.start + g.count);
                    subGeo.setIndex(new THREE.BufferAttribute(indices, 1));
                } else {
                    const pos = worldGeo.getAttribute('position') as THREE.BufferAttribute;
                    const norm = worldGeo.getAttribute('normal') as THREE.BufferAttribute;
                    const pArr = pos.array.slice(g.start * 3, (g.start + g.count) * 3);
                    subGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
                    if (norm) {
                        const nArr = norm.array.slice(g.start * 3, (g.start + g.count) * 3);
                        subGeo.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
                    }
                }
                const nonIndexed = subGeo.toNonIndexed ? subGeo.toNonIndexed() : subGeo;
                const gMat = Array.isArray(mesh.material) ? mesh.material[g.materialIndex] : mesh.material;
                subParts.push({ geo: nonIndexed, mesh, mat: gMat });
            }
        } else {
            const clean = new THREE.BufferGeometry();
            clean.setAttribute('position', worldGeo.getAttribute('position'));
            clean.setAttribute('normal', worldGeo.getAttribute('normal'));
            if (worldGeo.getAttribute('uv')) clean.setAttribute('uv', worldGeo.getAttribute('uv'));
            if (worldGeo.index) clean.setIndex(worldGeo.index);
            const nonIndexed = clean.toNonIndexed ? clean.toNonIndexed() : clean;
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            subParts.push({ geo: nonIndexed, mesh, mat });
        }
    }

    if (subParts.length > 1) {
        for (const sp of subParts) {
            const mat = sp.mat;
            const matName = mat ? mat.name : '';
            const name = (sp.mesh.name + ' ' + (sp.mesh.parent ? sp.mesh.parent.name : '') + ' ' + matName).toLowerCase();

            // 1. Explicit keyword check
            const isTrunkName = name.includes('wood') || name.includes('stick') || name.includes('trunk') || 
                                name.includes('branch') || name.includes('bark') || name.includes('stem') || 
                                name.includes('brown') || name.includes('holz') || name.includes('stamm');
            const isCanopyName = name.includes('leaf') || name.includes('leaves') || name.includes('canopy') || 
                                 name.includes('bubble') || name.includes('crown') || name.includes('foliage') || 
                                 name.includes('yellow') || name.includes('green') || name.includes('sphere') || 
                                 name.includes('crone') || name.includes('krone') || name.includes('laub');

            if (isTrunkName && !isCanopyName) {
                trunkGeos.push(sp.geo);
                continue;
            }
            if (isCanopyName && !isTrunkName) {
                canopyGeos.push(sp.geo);
                continue;
            }

            // 2. Material color check
            const col = (mat as THREE.MeshStandardMaterial)?.color;
            if (col) {
                if (col.r > col.g * 1.18 && col.b < col.r * 0.85) {
                    trunkGeos.push(sp.geo);
                    continue;
                } else if (col.g > col.r * 1.05 || (col.g > 0.35 && col.b > col.r)) {
                    canopyGeos.push(sp.geo);
                    continue;
                }
            }

            // 3. Position-based check
            sp.geo.computeBoundingBox();
            const bb = sp.geo.boundingBox!;
            const meshCenterY = (bb.min.y + bb.max.y) / 2;
            const relY = (meshCenterY - modelMinY) / modelHeight;
            if (relY < 0.42 || (bb.min.y <= modelMinY + 0.05 * modelHeight && bb.max.y < modelMinY + 0.65 * modelHeight)) {
                trunkGeos.push(sp.geo);
            } else {
                canopyGeos.push(sp.geo);
            }
        }
    }

    // Fallback or single-mesh model: if either trunkGeos or canopyGeos is empty, split triangles by height
    if (trunkGeos.length === 0 || canopyGeos.length === 0) {
        trunkGeos.length = 0;
        canopyGeos.length = 0;

        const allGeos = subParts.map(sp => sp.geo);
        const mergedAll = allGeos.length === 1 ? allGeos[0] : (mergeGeometries(allGeos, false) || allGeos[0]);
        const nonIndexed = mergedAll.toNonIndexed ? mergedAll.toNonIndexed() : mergedAll;
        const pos = nonIndexed.attributes.position as THREE.BufferAttribute;
        const norm = nonIndexed.attributes.normal as THREE.BufferAttribute | undefined;
        const splitY = modelMinY + modelHeight * 0.38;

        const trunkPositions: number[] = [];
        const canopyPositions: number[] = [];
        const trunkNormals: number[] = [];
        const canopyNormals: number[] = [];

        const triCount = pos.count / 3;
        for (let i = 0; i < triCount; i++) {
            const i0 = i * 3, i1 = i * 3 + 1, i2 = i * 3 + 2;
            const y0 = pos.getY(i0), y1 = pos.getY(i1), y2 = pos.getY(i2);
            const avgY = (y0 + y1 + y2) / 3;

            const targetPos = avgY < splitY ? trunkPositions : canopyPositions;
            const targetNorm = avgY < splitY ? trunkNormals : canopyNormals;

            for (const idx of [i0, i1, i2]) {
                targetPos.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
                if (norm) {
                    targetNorm.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
                } else {
                    targetNorm.push(0, 1, 0);
                }
            }
        }

        if (trunkPositions.length > 0) {
            const tGeo = new THREE.BufferGeometry();
            tGeo.setAttribute('position', new THREE.Float32BufferAttribute(trunkPositions, 3));
            tGeo.setAttribute('normal', new THREE.Float32BufferAttribute(trunkNormals, 3));
            trunkGeos.push(tGeo);
        }
        if (canopyPositions.length > 0) {
            const cGeo = new THREE.BufferGeometry();
            cGeo.setAttribute('position', new THREE.Float32BufferAttribute(canopyPositions, 3));
            cGeo.setAttribute('normal', new THREE.Float32BufferAttribute(canopyNormals, 3));
            canopyGeos.push(cGeo);
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

export interface TreeCatalogItem {
    id: string;
    name: string;
    category: string;
    path: string;
    scaleMultiplier?: number;
    description: string;
}

export const TREE_CATALOG: TreeCatalogItem[] = [
    { id: 'cartoon_1', name: 'Cartoon Oak 1', category: 'Stylized', path: '/Assets/Cartoon/Cartoon_Trees_Tree_1.glb', scaleMultiplier: 1.0, description: 'Lush round canopy oak' },
    { id: 'cartoon_2', name: 'Cartoon Oak 2', category: 'Stylized', path: '/Assets/Cartoon/Cartoon_Trees_Tree_2.glb', scaleMultiplier: 1.0, description: 'Branching stylized tree' },
    { id: 'cartoon_3', name: 'Cartoon Oak 3', category: 'Stylized', path: '/Assets/Cartoon/Cartoon_Trees_Tree_3.glb', scaleMultiplier: 1.0, description: 'Compact flowering tree' },
    { id: 'bubble_4', name: 'Bubble Blossom A', category: 'Bubble', path: '/Assets/Bubble/TreeAsset_4_instanced_l2_superhigh.glb', scaleMultiplier: 1.0, description: 'Spherical cloud blossom tree' },
    { id: 'bubble_5', name: 'Bubble Blossom B', category: 'Bubble', path: '/Assets/Bubble/TreeAsset_5_instanced_l2_superhigh.glb', scaleMultiplier: 1.0, description: 'Triple bubble canopy tree' },
    { id: 'bubble_6', name: 'Bubble Blossom C', category: 'Bubble', path: '/Assets/Bubble/TreeAsset_6_instanced_l2_superhigh.glb', scaleMultiplier: 1.0, description: 'Clustered bubble canopy' },
    { id: 'redwood_04', name: 'Giant Redwood Spire', category: 'Conifer', path: '/Assets/Cartoon 4/LPTree_Tree_Type0_04_Model_balanced_instanced_l1_superhigh.glb', scaleMultiplier: 1.25, description: 'Colossal ancient sequoia' },
    { id: 'redwood_03', name: 'Towering Pine', category: 'Conifer', path: '/Assets/Cartoon 4/LPTree_Tree_Type3_03_Model_instanced_l2_superhigh.glb', scaleMultiplier: 1.0, description: 'Alpine high-altitude pine' },
    { id: 'redwood_05', name: 'Ancient Sequoia', category: 'Conifer', path: '/Assets/Cartoon 4/LPTree_Tree_Type3_05_Model_balanced_instanced_l1_superhigh.glb', scaleMultiplier: 1.0, description: 'Dense tiered pine' },
    { id: 'yellow_poly', name: 'Golden Conifer', category: 'Conifer', path: '/Assets/Cartoon 4/Lowpolytree_6_yellow_superhigh.glb', scaleMultiplier: 1.0, description: 'Golden tapered pine' },
    { id: 'estuary_1', name: 'Coral Palm 1', category: 'Tropical', path: '/Assets/Cartoon 5/LowPoly-Tree-02_Tree_1_instanced.glb', scaleMultiplier: 1.0, description: 'Flared coral mangrove palm' },
    { id: 'estuary_4', name: 'Coral Palm 2', category: 'Tropical', path: '/Assets/Cartoon 5/LowPoly-Tree-02_Tree_4_instanced.glb', scaleMultiplier: 1.0, description: 'Twin branching lagoon palm' },
    { id: 'estuary_7', name: 'Coral Shrub', category: 'Tropical', path: '/Assets/Cartoon 5/LowPoly-Tree-02_Tree_7_instanced.glb', scaleMultiplier: 1.0, description: 'Low coastal coral shrub' },
    { id: 'geo_1', name: 'Ash Pine', category: 'Volcanic', path: '/Assets/Cartoon 3/low_poly_tree_1_Tree_1.glb', scaleMultiplier: 1.0, description: 'Charred ridge pine' },
    { id: 'geo_9', name: 'Basalt Spire', category: 'Volcanic', path: '/Assets/Cartoon 3/tree_Tree_9.glb', scaleMultiplier: 1.0, description: 'Hardy geothermal canopy' },
    { id: 'pack_1', name: 'Low Poly Oak', category: 'Low Poly', path: '/Separated_Trees/Cartoon_Trees_Pack_Tree_1.glb', scaleMultiplier: 1.0, description: 'Minimalist low-poly oak' },
    { id: 'pack_5', name: 'Low Poly Pine', category: 'Low Poly', path: '/Separated_Trees/Cartoon_Trees_Pack_Tree_5.glb', scaleMultiplier: 1.0, description: 'Layered polygonal pine' },
    { id: 'pack_8', name: 'Low Poly Bush Tree', category: 'Low Poly', path: '/Separated_Trees/Cartoon_Trees_Pack_Tree_8.glb', scaleMultiplier: 1.0, description: 'Rounded low-poly tree' },
    { id: 'cherry_1', name: 'Cherry Blossom', category: 'Blossom', path: '/Separated_Trees/Cherry+Blossom-Tree_Pack+JSGraphics_CGTrader_Tree_1.glb', scaleMultiplier: 1.0, description: 'Delicate blossom branch tree' },
    { id: 'rock_tree_2', name: 'Rock Cedar', category: 'Alpine', path: '/Separated_Trees/tree_X12_+X1_Rock_Pack_Tree_2.glb', scaleMultiplier: 1.0, description: 'Rugged cliffside cedar' },
    { id: 'rock_tree_6', name: 'Highland Juniper', category: 'Alpine', path: '/Separated_Trees/tree_X12_+X1_Rock_Pack_Tree_6.glb', scaleMultiplier: 1.0, description: 'Twisted highland juniper' },
];

export const DEFAULT_BIOME_TREE_IDS: Record<BiomeId, string[]> = {
    meadow: ['cartoon_1', 'cartoon_2', 'cartoon_3'],
    archipelago: ['bubble_4', 'bubble_5', 'bubble_6'],
    geothermal: ['geo_1', 'geo_9'],
    estuary: ['estuary_1', 'estuary_4', 'estuary_7'],
    redwood: ['redwood_04', 'redwood_03', 'redwood_05', 'yellow_poly']
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

interface LoadedCatalogEntry {
    item: TreeCatalogItem;
    trunkGeo: THREE.BufferGeometry;
    canopyGeo: THREE.BufferGeometry;
    trunkInst: THREE.InstancedMesh;
    canopyInst: THREE.InstancedMesh;
}

// ── TreeSystem ─────────────────────────────────────────────────────────────────

export class TreeSystem {
    public catalogModelMap: Map<string, LoadedCatalogEntry> = new Map();
    public catalogKeys: string[] = [];

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
    private rebuildRafId: number | null = null;

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

        // ── 2. Pre-Load Entire Tree Catalog ────────────────────────────────────
        const loadPromises = TREE_CATALOG.map(async (item) => {
            try {
                const geo = await loadTreeGeometries(item.path, loader, item.scaleMultiplier ?? 1.0);
                const trunkInst = setupInstMesh(geo.trunkGeo, this.trunkMat, MAX_CAPACITY, true);
                const canopyInst = setupInstMesh(geo.canopyGeo, this.canopyMat, MAX_CAPACITY, true);
                const entry: LoadedCatalogEntry = {
                    item,
                    trunkGeo: geo.trunkGeo,
                    canopyGeo: geo.canopyGeo,
                    trunkInst,
                    canopyInst
                };
                this.catalogModelMap.set(item.id, entry);
                this.catalogKeys.push(item.id);
            } catch (err) {
                console.warn(`[TreeSystem] Failed to load catalog item ${item.name} (${item.path}):`, err);
            }
        });

        await Promise.all(loadPromises);

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

    updateGlow(dt: number, timePhase: number, activeBiomeId?: BiomeId): void {
        if (!this.ready) return;

        const bId = activeBiomeId || globalConfigManager.config.activeBiomeId;
        const activeBiome = globalConfigManager.getBiomeConfig(bId);
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

        // Model instance count map
        const modelCounts: Map<string, number> = new Map();
        for (const key of this.catalogKeys) {
            modelCounts.set(key, 0);
        }

        const treeGridSpacing = 16.0;

        const minCX = Math.floor((px - SPAWN_RADIUS) / treeGridSpacing);
        const maxCX = Math.ceil((px + SPAWN_RADIUS) / treeGridSpacing);
        const minCZ = Math.floor((pz - SPAWN_RADIUS) / treeGridSpacing);
        const maxCZ = Math.ceil((pz + SPAWN_RADIUS) / treeGridSpacing);

        // Precompute active model entries per biome for ultra-fast loop
        const allBiomes: BiomeId[] = ['meadow', 'archipelago', 'geothermal', 'estuary', 'redwood'];
        const biomeActiveModels: Record<BiomeId, LoadedCatalogEntry[]> = {
            meadow: [],
            archipelago: [],
            geothermal: [],
            estuary: [],
            redwood: []
        };

        for (const b of allBiomes) {
            const bCfg = globalConfigManager.getBiomeConfig(b);
            const userModelIds = bCfg.vegetation.selectedTreeModelIds && bCfg.vegetation.selectedTreeModelIds.length > 0 
                ? bCfg.vegetation.selectedTreeModelIds 
                : DEFAULT_BIOME_TREE_IDS[b];
            
            const entries: LoadedCatalogEntry[] = [];
            for (const mId of userModelIds) {
                const entry = this.catalogModelMap.get(mId);
                if (entry) entries.push(entry);
            }
            // Fallback if none found
            if (entries.length === 0) {
                for (const fallbackId of DEFAULT_BIOME_TREE_IDS[b]) {
                    const fallbackEntry = this.catalogModelMap.get(fallbackId);
                    if (fallbackEntry) entries.push(fallbackEntry);
                }
            }
            biomeActiveModels[b] = entries;
        }

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

                const activeModels = biomeActiveModels[biome];
                if (!activeModels || activeModels.length === 0) continue;

                const variantIndex = Math.floor(rng() * activeModels.length);
                const selectedModel = activeModels[variantIndex];
                const modelKey = selectedModel.item.id;
                const currentCount = modelCounts.get(modelKey) || 0;
                if (currentCount >= MAX_CAPACITY) continue;

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

                selectedModel.trunkInst.setMatrixAt(currentCount, this.dummy.matrix);
                selectedModel.canopyInst.setMatrixAt(currentCount, this.dummy.matrix);

                // Canopy Color selection with per-tree instance variation
                const canopyPalette = veg.canopyColors.length > 0 ? veg.canopyColors : ['#ff1493', '#00d2ff', '#00ff88'];
                const canopyHex = canopyPalette[Math.floor(rng() * canopyPalette.length)];
                this.tempColor.set(canopyHex);
                this.tempColor.getHSL(this.tempHSL);
                this.tempHSL.l = THREE.MathUtils.clamp(this.tempHSL.l + (rng() - 0.5) * 0.08, 0.1, 0.9);
                this.tempHSL.s = THREE.MathUtils.clamp(this.tempHSL.s + (rng() - 0.5) * 0.06, 0.2, 1.0);
                this.tempColor.setHSL(this.tempHSL.h, this.tempHSL.s, this.tempHSL.l);
                selectedModel.canopyInst.setColorAt(currentCount, this.tempColor);

                // Trunk Color selection with per-tree instance variation
                const trunkPalette = veg.trunkColors.length > 0 ? veg.trunkColors : ['#ffffff', '#fff3e0'];
                const trunkHex = trunkPalette[Math.floor(rng() * trunkPalette.length)];
                this.tempColor.set(trunkHex);
                selectedModel.trunkInst.setColorAt(currentCount, this.tempColor);

                modelCounts.set(modelKey, currentCount + 1);
            }
        }

        // Commit tree counts and update buffers across all catalog models
        for (const [key, entry] of this.catalogModelMap.entries()) {
            const count = modelCounts.get(key) || 0;
            entry.trunkInst.count = count;
            entry.canopyInst.count = count;
            if (entry.trunkInst.instanceMatrix) entry.trunkInst.instanceMatrix.needsUpdate = true;
            if (entry.trunkInst.instanceColor) entry.trunkInst.instanceColor.needsUpdate = true;
            if (entry.canopyInst.instanceMatrix) entry.canopyInst.instanceMatrix.needsUpdate = true;
            if (entry.canopyInst.instanceColor) entry.canopyInst.instanceColor.needsUpdate = true;
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
        veg.treeScale = Math.max(0.5, Math.min(50.0, scale));
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

    public setBiomeTreeModels(biomeId: BiomeId, modelIds: string[]): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.selectedTreeModelIds = [...modelIds];
        this.forceRebuild();
    }

    public selectSingleBiomeTreeModel(biomeId: BiomeId, modelId: string): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.selectedTreeModelIds = [modelId];
        this.forceRebuild();
    }

    public toggleBiomeTreeModel(biomeId: BiomeId, modelId: string): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        const current = veg.selectedTreeModelIds || [];
        if (current.includes(modelId)) {
            if (current.length > 1) {
                veg.selectedTreeModelIds = current.filter(id => id !== modelId);
            }
        } else {
            veg.selectedTreeModelIds = [...current, modelId];
        }
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
        if (this.rebuildRafId === null) {
            this.rebuildRafId = requestAnimationFrame(() => {
                this.rebuildRafId = null;
                if (this.lastX !== -99999) {
                    this.rebuild(this.lastX, this.lastZ);
                    this.dirty = false;
                }
            });
        }
    }
}

