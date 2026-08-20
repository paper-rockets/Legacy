import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeightJS, getDominantBiome, BiomeId } from './noise';
import { gradientMap } from './terrain';
import { globalConfigManager, ModelVegetationConfig, getDefaultModelConfig, VegetationTextureStyle } from '../core/config';

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAWN_RADIUS = 380;
const REBUILD_THRESHOLD = 45;
const MAX_CAPACITY = 800;
const MIN_TREE_HEIGHT = 4.5;
const MAX_TREE_HEIGHT = 24.0;

export type PresetKey = 'candy' | 'cotton' | 'lollipop' | 'mints' | 'berry' | 'archipelago' | 'geothermal' | 'estuary' | 'redwood' | 'biome_auto';

export interface ColorPreset {
    name: string;
    canopyColors: string[];
    leafColors: string[];
    trunkColors: string[];
}

export const BIOME_VEG_PRESETS: Record<string, ColorPreset> = {
    candyland_pastel: {
        name: 'Candyland Pastel',
        canopyColors: ['#f472b6', '#93c5fd', '#fde047', '#c084fc', '#ffffff', '#ffb6c1', '#a7f3d0'],
        leafColors: ['#f43f5e', '#ffffff', '#38bdf8', '#c084fc', '#facc15'],
        trunkColors: ['#ffffff', '#fffbf0', '#ffe4e6', '#f0f9ff']
    },
    original: {
        name: 'Original Colors',
        canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600'],
        leafColors: ['#22c55e', '#16a34a', '#15803d', '#4ade80'],
        trunkColors: ['#5c3a21', '#451a03', '#78350f', '#ffffff']
    },
    candy: {
        name: 'Candy Mix',
        canopyColors: ['#ff1493', '#ff69b4', '#b026ff', '#8a2be2', '#00d2ff', '#00ff88', '#ffe600', '#ff7700', '#ff1744'],
        leafColors: ['#00ff88', '#10ff9e', '#00f5d4', '#4ade80', '#22c55e'],
        trunkColors: ['#ffffff', '#fff3e0', '#ffe4e6', '#e0f7fa']
    },
    cotton: {
        name: 'Cotton Candy',
        canopyColors: ['#00bfff', '#60a5fa', '#ff66cc', '#f43f5e', '#c084fc', '#ffaa00', '#ffea00'],
        leafColors: ['#67e8f9', '#a5f3fc', '#a7f3d0', '#86efac'],
        trunkColors: ['#ffffff', '#ffeef5', '#e0f2fe']
    },
    lollipop: {
        name: 'Lollipop',
        canopyColors: ['#ff0033', '#ff6600', '#39ff14', '#00f0ff', '#9900ff', '#ff007f', '#ffd700'],
        leafColors: ['#39ff14', '#00ff88', '#22c55e', '#16a34a'],
        trunkColors: ['#ffffff', '#ffedd5', '#ffd1dc', '#935116']
    },
    mints: {
        name: 'Spearmint & Ice',
        canopyColors: ['#00ff88', '#10ff9e', '#00f5d4', '#00c8ff', '#38bdf8', '#00e676'],
        leafColors: ['#00ff88', '#10ff9e', '#34d399', '#6ee7b7'],
        trunkColors: ['#ffffff', '#d1fae5', '#e0f2fe']
    },
    berry: {
        name: 'Wild Berry',
        canopyColors: ['#ff0066', '#d90429', '#9d4edd', '#3a0ca3', '#d00000', '#f72585'],
        leafColors: ['#059669', '#10b981', '#34d399', '#047857'],
        trunkColors: ['#ffffff', '#fce7f3', '#6a0dad']
    },
    archipelago: {
        name: 'Sakura & Cloud Blossom',
        canopyColors: ['#ff69b4', '#ffb6c1', '#fbcfe8', '#c4b5fd', '#93c5fd', '#ffffff'],
        leafColors: ['#86efac', '#bbf7d0', '#6ee7b7', '#4ade80'],
        trunkColors: ['#fff3e0', '#ffe4e6', '#d6d3d1']
    },
    archipelago_crystal: {
        name: 'Cyan Crystal Flora',
        canopyColors: ['#00f5d4', '#38bdf8', '#7dd3fc', '#bae6fd', '#a7f3d0'],
        leafColors: ['#38bdf8', '#7dd3fc', '#a7f3d0', '#6ee7b7'],
        trunkColors: ['#ffffff', '#e2e8f0', '#cbd5e1']
    },
    archipelago_lavender: {
        name: 'Lavender Mist',
        canopyColors: ['#a855f7', '#c084fc', '#e9d5ff', '#d8b4fe', '#818cf8'],
        leafColors: ['#c084fc', '#a855f7', '#86efac', '#a7f3d0'],
        trunkColors: ['#faf5ff', '#f3e8ff', '#e9d5ff']
    },
    geothermal: {
        name: 'Ash & Lava Ember',
        canopyColors: ['#ff3300', '#ff7700', '#ffaa00', '#cc1100', '#f59e0b'],
        leafColors: ['#84cc16', '#a3e635', '#65a30d', '#4d7c0f'],
        trunkColors: ['#27272a', '#3f3f46', '#1c1917']
    },
    geothermal_magma: {
        name: 'Molten Magma',
        canopyColors: ['#ef4444', '#dc2626', '#b91c1c', '#f97316', '#fbbf24'],
        leafColors: ['#ca8a04', '#eab308', '#84cc16', '#65a30d'],
        trunkColors: ['#18181b', '#292524', '#44403c']
    },
    geothermal_sulfur: {
        name: 'Sulfur & Caldera Gold',
        canopyColors: ['#eab308', '#facc15', '#fef08a', '#ca8a04', '#84cc16'],
        leafColors: ['#84cc16', '#a3e635', '#65a30d', '#ca8a04'],
        trunkColors: ['#3f3f46', '#52525b', '#27272a']
    },
    estuary: {
        name: 'Bioluminescent Coral',
        canopyColors: ['#00f5d4', '#00bbf9', '#f72585', '#7209b7', '#4cc9f0', '#10b981'],
        leafColors: ['#00f5d4', '#10b981', '#34d399', '#00e676'],
        trunkColors: ['#ffffff', '#e0f2fe', '#fce7f3']
    },
    estuary_neon: {
        name: 'Neon Lagoon',
        canopyColors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'],
        leafColors: ['#10b981', '#06b6d4', '#00ff88', '#22c55e'],
        trunkColors: ['#0f172a', '#1e293b', '#334155']
    },
    estuary_spirit: {
        name: 'Spirit Blossom',
        canopyColors: ['#f472b6', '#38bdf8', '#818cf8', '#34d399', '#fbcfe8'],
        leafColors: ['#34d399', '#6ee7b7', '#a7f3d0', '#fbcfe8'],
        trunkColors: ['#fdf4ff', '#fae8ff', '#f5d0fe']
    },
    redwood: {
        name: 'Ancient Giant Redwood',
        canopyColors: ['#15803d', '#166534', '#14532d', '#22c55e', '#4ade80'],
        leafColors: ['#15803d', '#166534', '#22c55e', '#14532d'],
        trunkColors: ['#78350f', '#451a03', '#522e18']
    },
    redwood_golden: {
        name: 'Golden Forest',
        canopyColors: ['#eab308', '#ca8a04', '#a16207', '#65a30d', '#84cc16'],
        leafColors: ['#65a30d', '#84cc16', '#a3e635', '#a16207'],
        trunkColors: ['#5c2c10', '#431407', '#78350f']
    },
    redwood_conifer: {
        name: 'Deep Conifer',
        canopyColors: ['#064e3b', '#065f46', '#047857', '#0f766e', '#115e59'],
        leafColors: ['#065f46', '#047857', '#064e3b', '#0f766e'],
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

function strHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) | 1;
}

// ── GLB Geometry Loader (Accurate Stem/Trunk, Leaf, Flower & Original Colors) ─

function extractVertexColorFromTexture(
    img: any,
    u: number,
    v: number,
    fallback: [number, number, number]
): [number, number, number] {
    if (!img) return fallback;
    const w = img.width || (img.naturalWidth || 64);
    const h = img.height || (img.naturalHeight || 64);
    if (!w || !h) return fallback;

    let canvas = img._cachedCanvas;
    let ctx = img._cachedCtx;
    if (!canvas) {
        try {
            canvas = document.createElement('canvas');
            canvas.width = Math.min(w, 256);
            canvas.height = Math.min(h, 256);
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                img._cachedCanvas = canvas;
                img._cachedCtx = ctx;
            }
        } catch {
            return fallback;
        }
    }
    if (!ctx) return fallback;
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(u * canvas.width)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor((1 - v) * canvas.height)));
    try {
        const d = ctx.getImageData(px, py, 1, 1).data;
        return [d[0] / 255, d[1] / 255, d[2] / 255];
    } catch {
        return fallback;
    }
}

function attachAttributes(geo: THREE.BufferGeometry, partType: number, defaultColor: [number, number, number]): THREE.BufferGeometry {
    const nonIndexed = geo.toNonIndexed ? geo.toNonIndexed() : geo;
    const count = nonIndexed.attributes.position.count;
    if (!nonIndexed.attributes.normal) nonIndexed.computeVertexNormals();
    if (!nonIndexed.attributes.uv) {
        nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const partTypes = new Float32Array(count).fill(partType);
    nonIndexed.setAttribute('aPartType', new THREE.BufferAttribute(partTypes, 1));

    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i * 3] = defaultColor[0];
        colors[i * 3 + 1] = defaultColor[1];
        colors[i * 3 + 2] = defaultColor[2];
    }
    nonIndexed.setAttribute('aOriginalColor', new THREE.BufferAttribute(colors, 3));
    return nonIndexed;
}

function attachStripedAttributes(geo: THREE.BufferGeometry, partType: number): THREE.BufferGeometry {
    const nonIndexed = geo.toNonIndexed ? geo.toNonIndexed() : geo;
    const count = nonIndexed.attributes.position.count;
    if (!nonIndexed.attributes.normal) nonIndexed.computeVertexNormals();
    if (!nonIndexed.attributes.uv) {
        nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const partTypes = new Float32Array(count).fill(partType);
    nonIndexed.setAttribute('aPartType', new THREE.BufferAttribute(partTypes, 1));

    const pos = nonIndexed.attributes.position;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const stripe = Math.sin((y * 5.0 + Math.atan2(z, x) * 2.0) * Math.PI * 0.5);
        if (stripe > 0.0) {
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 1.0;
            colors[i * 3 + 2] = 1.0;
        } else {
            colors[i * 3] = 0.95;
            colors[i * 3 + 1] = 0.35;
            colors[i * 3 + 2] = 0.50;
        }
    }
    nonIndexed.setAttribute('aOriginalColor', new THREE.BufferAttribute(colors, 3));
    return nonIndexed;
}

function buildSpiralLollipopGeometry(): THREE.BufferGeometry {
    // White sweet treat stick with candy cane red spiral stripe
    const stickRaw = new THREE.CylinderGeometry(0.13, 0.15, 5.2, 8).translate(0, 2.6, 0);
    const stick = attachStripedAttributes(stickRaw, 0.0);

    // Thick glossy candy disc with smooth round bevel
    const disc = attachAttributes(new THREE.CylinderGeometry(2.3, 2.3, 0.55, 18).rotateX(Math.PI / 2).translate(0, 5.2, 0), 2.0, [0.96, 0.48, 0.74]);

    // Concentric swirl rings (lightweight, smooth normals)
    const ringOuter = attachAttributes(new THREE.TorusGeometry(1.75, 0.30, 8, 18).translate(0, 5.2, 0), 1.0, [0.72, 0.88, 1.0]);
    const ringMid = attachAttributes(new THREE.TorusGeometry(1.10, 0.24, 8, 16).translate(0, 5.2, 0), 2.0, [1.0, 0.95, 0.60]);
    const ringInner = attachAttributes(new THREE.TorusGeometry(0.52, 0.18, 6, 12).translate(0, 5.2, 0), 1.0, [0.98, 0.60, 0.82]);
    const center = attachAttributes(new THREE.SphereGeometry(0.48, 8, 8).scale(1, 1, 0.7).translate(0, 5.2, 0), 2.0, [1.0, 1.0, 1.0]);

    // Decorative candy ribbon wrapper collar
    const collar = attachAttributes(new THREE.TorusGeometry(0.48, 0.14, 6, 12).rotateX(Math.PI / 2).translate(0, 2.7, 0), 1.0, [1.0, 0.95, 0.98]);

    const merged = mergeGeometries([stick, disc, ringOuter, ringMid, ringInner, center, collar], false) || disc;
    return merged;
}

function buildSphericalLollipopGeometry(): THREE.BufferGeometry {
    // Treat stick
    const stickRaw = new THREE.CylinderGeometry(0.13, 0.15, 4.8, 8).translate(0, 2.4, 0);
    const stick = attachStripedAttributes(stickRaw, 0.0);

    // Big round glossy pop
    const sphere = attachAttributes(new THREE.SphereGeometry(1.85, 16, 12).translate(0, 4.8, 0), 2.0, [0.85, 0.65, 0.98]);

    // Tilted sugar crystal halo ring
    const ring = attachAttributes(new THREE.TorusGeometry(1.55, 0.20, 8, 18).rotateX(Math.PI / 3.8).rotateZ(0.2).translate(0, 4.8, 0), 1.0, [1.0, 0.92, 0.55]);

    // Fluted wrapper twist collar
    const collar = attachAttributes(new THREE.ConeGeometry(0.65, 0.75, 8).rotateX(Math.PI).translate(0, 3.2, 0), 1.0, [1.0, 1.0, 1.0]);
    const gemTop = attachAttributes(new THREE.SphereGeometry(0.38, 8, 8).translate(0, 6.7, 0), 2.0, [0.98, 0.40, 0.65]);

    const merged = mergeGeometries([stick, sphere, ring, collar, gemTop], false) || sphere;
    return merged;
}

function buildCandyCaneGeometry(): THREE.BufferGeometry {
    const shaft = new THREE.CylinderGeometry(0.14, 0.14, 2.8, 8).translate(0, 1.4, 0);
    const hook = new THREE.TorusGeometry(0.6, 0.14, 8, 12, Math.PI).rotateZ(-Math.PI).translate(0.6, 2.8, 0);
    const tip = new THREE.SphereGeometry(0.14, 6, 6).translate(1.2, 2.8, 0);
    const base = new THREE.SphereGeometry(0.14, 6, 6).translate(0, 0.05, 0);
    const nonAttrMerged = mergeGeometries([shaft, hook, tip, base], false) || shaft;
    const finalGeo = attachStripedAttributes(nonAttrMerged, 2.0);
    return finalGeo;
}

function buildCandyCaneClusterGeometry(): THREE.BufferGeometry {
    const cane1 = buildCandyCaneGeometry();
    
    const cane2 = buildCandyCaneGeometry();
    cane2.scale(0.85, 0.85, 0.85);
    cane2.rotateZ(0.15);
    cane2.rotateY(2.1);
    cane2.translate(0.45, 0, 0.35);

    const cane3 = buildCandyCaneGeometry();
    cane3.scale(0.75, 0.75, 0.75);
    cane3.rotateZ(-0.12);
    cane3.rotateY(4.2);
    cane3.translate(-0.4, 0, -0.25);

    const merged = mergeGeometries([cane1, cane2, cane3], false) || cane1;
    return merged;
}

function buildCottonCandyTreeGeometry(): THREE.BufferGeometry {
    const stick = attachAttributes(new THREE.CylinderGeometry(0.18, 0.22, 4.5, 8).translate(0, 2.25, 0), 0.0, [1, 0.95, 0.98]);
    const puffCenter = attachAttributes(new THREE.IcosahedronGeometry(1.7, 1).scale(1.15, 0.95, 1.1).translate(0, 5.2, 0), 2.0, [0.98, 0.60, 0.82]);
    const puffL = attachAttributes(new THREE.IcosahedronGeometry(1.25, 1).scale(1.0, 0.85, 0.95).translate(-1.1, 4.6, 0.35), 2.0, [0.60, 0.85, 1.0]);
    const puffR = attachAttributes(new THREE.IcosahedronGeometry(1.3, 1).scale(1.0, 0.9, 1.0).translate(1.05, 4.7, -0.3), 1.0, [1.0, 0.92, 0.55]);
    const puffF = attachAttributes(new THREE.IcosahedronGeometry(1.15, 1).scale(0.95, 0.85, 1.0).translate(0.2, 4.4, 0.95), 2.0, [0.95, 0.55, 0.78]);
    const puffB = attachAttributes(new THREE.IcosahedronGeometry(1.2, 1).scale(1.0, 0.85, 0.9).translate(-0.3, 4.5, -0.95), 1.0, [0.75, 0.65, 1.0]);

    const merged = mergeGeometries([stick, puffCenter, puffL, puffR, puffF, puffB], false) || puffCenter;
    return merged;
}

function buildGummyFlowerGeometry(): THREE.BufferGeometry {
    const stem = attachAttributes(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 8).translate(0, 1.1, 0), 0.0, [0.15, 0.85, 0.45]);
    const p1 = attachAttributes(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 0.5, 1).translate(0, 2.2, 0.6), 2.0, [1.0, 0.85, 0.2]);
    const p2 = attachAttributes(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 0.5, 1).translate(0.57, 2.2, 0.18), 2.0, [1.0, 0.85, 0.2]);
    const p3 = attachAttributes(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 0.5, 1).translate(0.35, 2.2, -0.48), 2.0, [1.0, 0.85, 0.2]);
    const p4 = attachAttributes(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 0.5, 1).translate(-0.35, 2.2, -0.48), 2.0, [1.0, 0.85, 0.2]);
    const p5 = attachAttributes(new THREE.SphereGeometry(0.45, 8, 6).scale(1, 0.5, 1).translate(-0.57, 2.2, 0.18), 2.0, [1.0, 0.85, 0.2]);
    const center = attachAttributes(new THREE.SphereGeometry(0.42, 8, 8).translate(0, 2.35, 0), 1.0, [0.98, 0.25, 0.45]);
    const merged = mergeGeometries([stem, p1, p2, p3, p4, p5, center], false) || center;
    return merged;
}

async function loadTreeGeometries(
    source: string | ArrayBuffer,
    loader: GLTFLoader,
    customScale: number = 1.0
): Promise<{ trunkGeo: THREE.BufferGeometry; canopyGeo: THREE.BufferGeometry; treeGeo: THREE.BufferGeometry; map?: THREE.Texture }> {
    if (typeof source === 'string' && source.startsWith('procedural:')) {
        const type = source.replace('procedural:', '');
        let geo: THREE.BufferGeometry;
        if (type === 'candy_cotton_cloud') {
            geo = buildCottonCandyTreeGeometry();
        } else if (type === 'candy_lollipop_spiral') {
            geo = buildSpiralLollipopGeometry();
        } else if (type === 'candy_lollipop_sphere') {
            geo = buildSphericalLollipopGeometry();
        } else if (type === 'candy_cane_single') {
            geo = buildCandyCaneGeometry();
        } else if (type === 'candy_cane_cluster') {
            geo = buildCandyCaneClusterGeometry();
        } else if (type === 'candy_gummy_flower') {
            geo = buildGummyFlowerGeometry();
        } else {
            geo = buildSpiralLollipopGeometry();
        }
        if (customScale !== 1.0) {
            geo.scale(customScale, customScale, customScale);
        }
        return { treeGeo: geo, trunkGeo: geo, canopyGeo: geo };
    }

    let gltf: any;
    if (typeof source === 'string') {
        const cleanPath = source.replace(/^\.?\//, '');
        const finalPath = source.startsWith('http') ? source : `./${cleanPath}`;
        gltf = await loader.loadAsync(encodeURI(finalPath));
    } else {
        gltf = await new Promise<any>((resolve, reject) => {
            loader.parse(source, '', (g) => resolve(g), (err) => reject(err));
        });
    }
    gltf.scene.updateMatrixWorld(true);

    const allMeshes: THREE.Mesh[] = [];
    let modelMinY = Infinity, modelMaxY = -Infinity;
    let modelMinX = Infinity, modelMaxX = -Infinity;
    let modelMinZ = Infinity, modelMaxZ = -Infinity;

    let primaryMap: THREE.Texture | undefined = undefined;

    gltf.scene.traverse((child: any) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry.computeBoundingBox();
            const bb = mesh.geometry.boundingBox;
            if (bb) {
                const min = bb.min.clone().applyMatrix4(mesh.matrixWorld);
                const max = bb.max.clone().applyMatrix4(mesh.matrixWorld);
                modelMinY = Math.min(modelMinY, min.y, max.y);
                modelMaxY = Math.max(modelMaxY, min.y, max.y);
                modelMinX = Math.min(modelMinX, min.x, max.x);
                modelMaxX = Math.max(modelMaxX, min.x, max.x);
                modelMinZ = Math.min(modelMinZ, min.z, max.z);
                modelMaxZ = Math.max(modelMaxZ, min.z, max.z);
            }
            if (!primaryMap) {
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                if (mat && (mat as THREE.MeshStandardMaterial).map) {
                    primaryMap = (mat as THREE.MeshStandardMaterial).map || undefined;
                }
            }
            allMeshes.push(mesh);
        }
    });

    const modelHeight = Math.max(0.001, modelMaxY - modelMinY);
    const modelCenterX = (modelMinX + modelMaxX) / 2;
    const modelCenterZ = (modelMinZ + modelMaxZ) / 2;
    const modelWidth = Math.max(0.001, Math.hypot(modelMaxX - modelMinX, modelMaxZ - modelMinZ));

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
                const pos = worldGeo.getAttribute('position') as THREE.BufferAttribute;
                const norm = worldGeo.getAttribute('normal') as THREE.BufferAttribute;
                const uv = worldGeo.getAttribute('uv') as THREE.BufferAttribute | undefined;
                const col = worldGeo.getAttribute('color') as THREE.BufferAttribute | undefined;

                if (worldGeo.index) {
                    const indices = worldGeo.index.array.slice(g.start, g.start + g.count);
                    subGeo.setAttribute('position', pos);
                    if (norm) subGeo.setAttribute('normal', norm);
                    if (uv) subGeo.setAttribute('uv', uv);
                    if (col) subGeo.setAttribute('color', col);
                    subGeo.setIndex(new THREE.BufferAttribute(indices, 1));
                } else {
                    const pArr = pos.array.slice(g.start * 3, (g.start + g.count) * 3);
                    subGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
                    if (norm) {
                        const nArr = norm.array.slice(g.start * 3, (g.start + g.count) * 3);
                        subGeo.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
                    }
                    if (uv) {
                        const uvArr = uv.array.slice(g.start * 2, (g.start + g.count) * 2);
                        subGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
                    }
                    if (col) {
                        const colArr = col.array.slice(g.start * 3, (g.start + g.count) * 3);
                        subGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
                    }
                }
                const nonIndexed = subGeo.toNonIndexed ? subGeo.toNonIndexed() : subGeo;
                const gMat = Array.isArray(mesh.material) ? mesh.material[g.materialIndex] : mesh.material;
                subParts.push({ geo: nonIndexed, mesh, mat: gMat });
            }
        } else {
            const clean = new THREE.BufferGeometry();
            clean.setAttribute('position', worldGeo.getAttribute('position'));
            if (worldGeo.getAttribute('normal')) clean.setAttribute('normal', worldGeo.getAttribute('normal'));
            if (worldGeo.getAttribute('uv')) clean.setAttribute('uv', worldGeo.getAttribute('uv'));
            if (worldGeo.getAttribute('color')) clean.setAttribute('color', worldGeo.getAttribute('color'));
            if (worldGeo.index) clean.setIndex(worldGeo.index);
            const nonIndexed = clean.toNonIndexed ? clean.toNonIndexed() : clean;
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            subParts.push({ geo: nonIndexed, mesh, mat });
        }
    }

    // Process every subpart and assign aPartType, aOriginalColor, UVs, and normals
    const processedGeos: THREE.BufferGeometry[] = [];

    for (const sp of subParts) {
        const mat = sp.mat;
        const matName = (mat ? mat.name : '').toLowerCase();
        const meshName = (sp.mesh ? sp.mesh.name : '').toLowerCase();
        const parentName = (sp.mesh && sp.mesh.parent ? sp.mesh.parent.name : '').toLowerCase();
        const name = `${meshName} ${parentName} ${matName}`;

        const isExplicitFlower = name.includes('flower') || name.includes('flowers') || name.includes('petal') || 
                                 name.includes('blossom') || name.includes('bloom') ||
                                 name.includes('palettematerial002') || name.includes('palettematerial003') || 
                                 name.includes('palettematerial004') || name.includes('palettematerial005') ||
                                 name.includes('roof') || name.includes('spire') || name.includes('dome') || 
                                 name.includes('sail') || name.includes('flag') || name.includes('banner');

        const isExplicitTrunk = name.includes('wood') || name.includes('trunk') || name.includes('stick') || 
                                name.includes('branch') || name.includes('bark') || name.includes('wood_trunk') ||
                                name.includes('palettematerial001') || name.includes('hull') || name.includes('keel') || 
                                name.includes('mast') || name.includes('wall') || name.includes('tower') || 
                                name.includes('base') || name.includes('foundation') || name.includes('stone') || 
                                name.includes('rock') || name.includes('cube') || name.includes('cylind');

        const isExplicitLeaves = name.includes('leaves_canopy') || name.includes('leaves_large') || 
                                 name.includes('leaves_normaltree') || name.includes('leaves_hanging') ||
                                 name.includes('leaf') || name.includes('leaves') || name.includes('foliage') || 
                                 name.includes('frond') || name.includes('clover') || name.includes('tree.002') ||
                                 name.includes('tree.1') || name.includes('tree.001') || name.includes('crone');

        const isCastle = name.includes('castle');
        const isShip = name.includes('ship') || name.includes('boat') || name.includes('galleon');

        const geo = sp.geo;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;
        const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
        const colAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
        const vertCount = pos.count;

        const partTypes = new Float32Array(vertCount);
        const originalColors = new Float32Array(vertCount * 3);

        const stdMat = mat as (THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined);
        const mapImg = (stdMat && stdMat.map && (stdMat.map as any).image) ? (stdMat.map as any).image : undefined;

        for (let i = 0; i < vertCount; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);

            const relY = Math.max(0, Math.min(1, (y - modelMinY) / modelHeight));
            const horizDist = Math.hypot(x - modelCenterX, z - modelCenterZ);
            const relHoriz = horizDist / (modelWidth * 0.5);

            let partType = 0.0;
            if (isExplicitFlower) {
                partType = 2.0; // Flower / Petal / Canopy / Roof / Sail
            } else if (isExplicitTrunk && !isExplicitLeaves) {
                partType = 0.0; // Stem / Trunk / Wall / Hull
            } else if (isExplicitLeaves) {
                if (name.includes('flower') || name.includes('bush') || name.includes('normaltree') || name.includes('hanging') || name.includes('frond') || name.includes('clover')) {
                    partType = 1.0; // Leaf / Foliage / Frond
                } else {
                    partType = 2.0; // Tree Canopy
                }
            } else if (isCastle) {
                if (relY > 0.65) {
                    partType = 2.0; // Roofs & Spires
                } else if (relY > 0.32) {
                    partType = 1.0; // Accent & Trim
                } else {
                    partType = 0.0; // Building & Walls
                }
            } else if (isShip) {
                if (relY > 0.60) {
                    partType = 2.0; // Sails & Rigging
                } else if (relY > 0.30) {
                    partType = 1.0; // Cabin & Deck
                } else {
                    partType = 0.0; // Hull & Keel
                }
            } else if (subParts.length === 1) {
                // Single-mesh models
                if (name.includes('flower')) {
                    if (relY > 0.60) {
                        partType = 2.0; // Flower head / petals
                    } else if (relHoriz > 0.16) {
                        partType = 1.0; // Ground / stem leaves
                    } else {
                        partType = 0.0; // Stem stalk
                    }
                } else if (name.includes('clover')) {
                    if (relY < 0.28) {
                        partType = 0.0; // Clover stalk
                    } else {
                        partType = 1.0; // Clover leaves
                    }
                } else if (name.includes('tree') || name.includes('bigtree')) {
                    if (relY < 0.35) {
                        partType = 0.0; // Trunk
                    } else {
                        partType = 2.0; // Canopy
                    }
                } else {
                    partType = relY < 0.35 ? 0.0 : (relY > 0.70 ? 2.0 : 1.0);
                }
            } else {
                partType = relY < 0.35 ? 0.0 : (relY > 0.70 ? 2.0 : 1.0);
            }

            partTypes[i] = partType;

            // Determine Original Color
            let r = 0.6, g = 0.6, b = 0.6;
            if (colAttr) {
                r = colAttr.getX(i);
                g = colAttr.getY(i);
                b = colAttr.getZ(i);
            } else if (mapImg && uv) {
                const uVal = uv.getX(i);
                const vVal = uv.getY(i);
                const fallback: [number, number, number] = partType === 0.0 ? [0.45, 0.28, 0.18] : (partType === 1.0 ? [0.18, 0.55, 0.22] : [0.95, 0.35, 0.45]);
                [r, g, b] = extractVertexColorFromTexture(mapImg, uVal, vVal, fallback);
            } else if (stdMat && stdMat.color) {
                r = stdMat.color.r;
                g = stdMat.color.g;
                b = stdMat.color.b;
            } else {
                if (partType === 0.0) { r = 0.45; g = 0.28; b = 0.18; }
                else if (partType === 1.0) { r = 0.18; g = 0.55; b = 0.22; }
                else { r = 0.95; g = 0.35; b = 0.45; }
            }

            originalColors[i * 3] = r;
            originalColors[i * 3 + 1] = g;
            originalColors[i * 3 + 2] = b;
        }

        const cleanGeo = new THREE.BufferGeometry();
        cleanGeo.setAttribute('position', pos);
        if (norm) {
            cleanGeo.setAttribute('normal', norm);
        } else {
            cleanGeo.computeVertexNormals();
        }
        if (uv) {
            cleanGeo.setAttribute('uv', uv);
        } else {
            cleanGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertCount * 2), 2));
        }
        cleanGeo.setAttribute('aPartType', new THREE.Float32BufferAttribute(partTypes, 1));
        cleanGeo.setAttribute('aOriginalColor', new THREE.Float32BufferAttribute(originalColors, 3));
        processedGeos.push(cleanGeo);
    }

    const mergedTree = processedGeos.length === 1 ? processedGeos[0] : (mergeGeometries(processedGeos, false) || processedGeos[0]);

    if (mergedTree && mergedTree.attributes.position) {
        mergedTree.computeBoundingBox();
        const box = mergedTree.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const bottomY = box.min.y;

        const baseScaleFactor = size.y > 0.001 ? 6.0 / size.y : 1.0;
        const scaleFactor = baseScaleFactor * customScale;

        mergedTree.translate(-center.x, -bottomY, -center.z);
        mergedTree.scale(scaleFactor, scaleFactor, scaleFactor);
        if (!mergedTree.getAttribute('normal')) {
            mergedTree.computeVertexNormals();
        }
    }

    return { treeGeo: mergedTree, trunkGeo: mergedTree, canopyGeo: mergedTree, map: primaryMap };
}

export interface TreeCatalogItem {
    id: string;
    name: string;
    category: string;
    path: string;
    previewImage: string;
    scaleMultiplier?: number;
    description: string;
}

export const TREE_CATALOG: TreeCatalogItem[] = [
    // Candyland (5 colorful procedural candy models)
    { id: 'candy_cotton_cloud', name: 'Cotton Candy Tree', category: 'Trees', path: 'procedural:candy_cotton_cloud', previewImage: '/Assets/Previews/candy_cotton_cloud.png', scaleMultiplier: 1.2, description: 'Fluffy pastel cloud of cotton candy on a sweet stick' },
    { id: 'candy_lollipop_spiral', name: 'Spiral Lollipop Tree', category: 'Trees', path: 'procedural:candy_lollipop_spiral', previewImage: '/Assets/Previews/candy_lollipop_spiral.png', scaleMultiplier: 1.1, description: 'Swirling pastel lollipop tree on a white stick' },
    { id: 'candy_lollipop_sphere', name: 'Round Candy Pop', category: 'Trees', path: 'procedural:candy_lollipop_sphere', previewImage: '/Assets/Previews/candy_lollipop_sphere.png', scaleMultiplier: 1.0, description: 'Glossy spherical pastel lollipop' },
    { id: 'candy_cane_cluster', name: 'Candy Cane Cluster', category: 'Flowers & Flora', path: 'procedural:candy_cane_cluster', previewImage: '/Assets/Previews/candy_cane_cluster.png', scaleMultiplier: 0.85, description: 'Cluster of sweet candy canes' },
    { id: 'candy_gummy_flower', name: 'Gummy Blossom Flora', category: 'Flowers & Flora', path: 'procedural:candy_gummy_flower', previewImage: '/Assets/Previews/candy_gummy_flower.png', scaleMultiplier: 0.75, description: 'Bright gummy blossom with sweet gumdrop center' },
    { id: 'candy_cane_single', name: 'Candy Cane Flora', category: 'Flowers & Flora', path: 'procedural:candy_cane_single', previewImage: '/Assets/Previews/veg_flower3_single.png', scaleMultiplier: 0.75, description: 'Classic striped candy cane flower' },

    // Vegetation (23 models)
    { id: 'veg_bigtree_1', name: 'Big Tree Var 1', category: 'Trees', path: '/Assets/Vegetation/BigTree2_Var1.glb', previewImage: '/Assets/Previews/veg_bigtree_1.png', scaleMultiplier: 1.1, description: 'Large branching deciduous tree' },
    { id: 'veg_bush_flowers', name: 'Flowering Bush', category: 'Flowers & Flora', path: '/Assets/Vegetation/Bush_Common_Flowers.glb', previewImage: '/Assets/Previews/veg_bush_flowers.png', scaleMultiplier: 0.85, description: 'Dense bush with colorful blossoms' },
    { id: 'veg_cartoon_1', name: 'Stylized Oak 1', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_1.glb', previewImage: '/Assets/Previews/veg_cartoon_1.png', scaleMultiplier: 1.0, description: 'Lush round canopy oak' },
    { id: 'veg_cartoon_2', name: 'Stylized Oak 2', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_2.glb', previewImage: '/Assets/Previews/veg_cartoon_2.png', scaleMultiplier: 1.0, description: 'Branching stylized oak' },
    { id: 'veg_cartoon_7', name: 'Round Canopy Tree', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_7.glb', previewImage: '/Assets/Previews/veg_cartoon_7.png', scaleMultiplier: 1.0, description: 'Compact spherical tree' },
    { id: 'veg_cartoon_8', name: 'Tall Oval Tree', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_8.glb', previewImage: '/Assets/Previews/veg_cartoon_8.png', scaleMultiplier: 1.0, description: 'Elongated oval canopy' },
    { id: 'veg_cartoon_10', name: 'Slender Spire Tree', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_10.glb', previewImage: '/Assets/Previews/veg_cartoon_10.png', scaleMultiplier: 1.0, description: 'Slender tapered canopy' },
    { id: 'veg_cartoon_11', name: 'Poplar Tree', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_11.glb', previewImage: '/Assets/Previews/veg_cartoon_11.png', scaleMultiplier: 1.0, description: 'Tall slender poplar' },
    { id: 'veg_cartoon_12', name: 'Wide Spire Tree', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Pack_Tree_12.glb', previewImage: '/Assets/Previews/veg_cartoon_12.png', scaleMultiplier: 1.0, description: 'Wide flared stylized tree' },
    { id: 'veg_tree_broadleaf_1', name: 'Broadleaf Tree 1', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Tree_1.glb', previewImage: '/Assets/Previews/veg_tree_broadleaf_1.png', scaleMultiplier: 1.0, description: 'Classic stylized broadleaf' },
    { id: 'veg_tree_broadleaf_2', name: 'Broadleaf Tree 2', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Tree_2.glb', previewImage: '/Assets/Previews/veg_tree_broadleaf_2.png', scaleMultiplier: 1.0, description: 'Curved stylized broadleaf' },
    { id: 'veg_tree_broadleaf_3', name: 'Flowering Broadleaf', category: 'Trees', path: '/Assets/Vegetation/Cartoon_Trees_Tree_3.glb', previewImage: '/Assets/Previews/veg_tree_broadleaf_3.png', scaleMultiplier: 1.0, description: 'Flowering stylized tree' },
    { id: 'veg_clover_2', name: 'Giant Clover', category: 'Flowers & Flora', path: '/Assets/Vegetation/Clover_2.glb', previewImage: '/Assets/Previews/veg_clover_2.png', scaleMultiplier: 0.75, description: 'Stylized clover flora' },
    { id: 'veg_fantasy_jungle', name: 'Fantasy Jungle Tree', category: 'Trees', path: '/Assets/Vegetation/fantasy_jungle_tree.glb', previewImage: '/Assets/Previews/veg_fantasy_jungle.png', scaleMultiplier: 1.2, description: 'Exotic hanging jungle tree' },
    { id: 'veg_flower2_var3', name: 'Wildflower Var 3', category: 'Flowers & Flora', path: '/Assets/Vegetation/Flower2_Var3.glb', previewImage: '/Assets/Previews/veg_flower2_var3.png', scaleMultiplier: 0.75, description: 'Delicate wildflower bloom' },
    { id: 'veg_flower3_group', name: 'Flower Cluster', category: 'Flowers & Flora', path: '/Assets/Vegetation/Flower_3_Group.glb', previewImage: '/Assets/Previews/veg_flower3_group.png', scaleMultiplier: 0.8, description: 'Group of meadow flowers' },
    { id: 'veg_flower3_single', name: 'Single Flower 3', category: 'Flowers & Flora', path: '/Assets/Vegetation/Flower_3_Single.glb', previewImage: '/Assets/Previews/veg_flower3_single.png', scaleMultiplier: 0.75, description: 'Single tall meadow flower' },
    { id: 'veg_flower4_single', name: 'Single Flower 4', category: 'Flowers & Flora', path: '/Assets/Vegetation/Flower_4_Single.glb', previewImage: '/Assets/Previews/veg_flower4_single.png', scaleMultiplier: 0.75, description: 'Single stylized blooming flower' },
    { id: 'veg_flower_var4', name: 'Wildflower Var 4', category: 'Flowers & Flora', path: '/Assets/Vegetation/Flower_Var4.glb', previewImage: '/Assets/Previews/veg_flower_var4.png', scaleMultiplier: 0.75, description: 'Vibrant single wildflower' },
    { id: 'veg_palm_a', name: 'Tropical Palm A', category: 'Trees', path: '/Assets/Vegetation/GEO_PalmTree_A.glb', previewImage: '/Assets/Previews/veg_palm_a.png', scaleMultiplier: 1.0, description: 'Curved tropical palm tree' },
    { id: 'veg_palm_c', name: 'Tropical Palm C', category: 'Trees', path: '/Assets/Vegetation/GEO_PalmTree_C.glb', previewImage: '/Assets/Previews/veg_palm_c.png', scaleMultiplier: 1.0, description: 'Straight tropical palm tree' },
    { id: 'veg_cherry_blossom', name: 'Blossom Tree', category: 'Trees', path: '/Assets/Vegetation/tree_Tree_10.glb', previewImage: '/Assets/Previews/veg_cherry_blossom.png', scaleMultiplier: 1.0, description: 'Delicate blossom tree' },
    { id: 'veg_tree_var4', name: 'Stylized Tree Var 4', category: 'Trees', path: '/Assets/Vegetation/Tree_Var4.glb', previewImage: '/Assets/Previews/veg_tree_var4.png', scaleMultiplier: 1.0, description: 'Stylized woodland tree' },

    // Castles (9 models)
    { id: 'castle_med_0', name: 'Fairytale Castle Med', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'Medieval fairytale castle with spires' },
    { id: 'castle_med_2', name: 'Fairytale Castle Med 2', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed (2).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'Twin-spire castle' },
    { id: 'castle_med_3', name: 'Fairytale Castle Med 3', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed (3).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'Grand multi-tower castle' },
    { id: 'castle_med_4', name: 'Fairytale Castle Med 4', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed (4).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'Fortified keep with battlements' },
    { id: 'castle_med_5', name: 'Fairytale Castle Med 5', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed (5).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'High palace complex' },
    { id: 'castle_med_6', name: 'Fairytale Castle Med 6', category: 'Castle', path: '/Assets/Sky/fairytale_castle_med_compressed (6).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'Royal citadel and spires' },
    { id: 'castle_high_0', name: 'Fairytale Castle High', category: 'Castle', path: '/Assets/Sky/fairytale_castle_high_compressed.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'High-detail fairytale castle' },
    { id: 'castle_high_1', name: 'Fairytale Castle High 1', category: 'Castle', path: '/Assets/Sky/fairytale_castle_high_compressed (1).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 2.2, description: 'High-detail castle variant' },
    { id: 'caste_instanced', name: 'Imperial Fortress Keep', category: 'Castle', path: '/Assets/Sky/Caste_compressed_instanced_l1.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', scaleMultiplier: 1.0, description: 'Colossal stone fortress and keep' },

    // Ships & Other (6 models)
    { id: 'ship_golden_galleon', name: 'Golden Galleon', category: 'Ship / Other', path: '/Assets/Other/Golden_Galleon_compressed_80_instanced_l1.glb', previewImage: '/Assets/Previews/other_golden_galleon.png', scaleMultiplier: 2.0, description: 'Majestic multi-deck galleon' },
    { id: 'ship_etire_boat', name: 'Etire Boat', category: 'Ship / Other', path: '/Assets/Other/Etire_boat.glb', previewImage: '/Assets/Previews/other_etire_boat.png', scaleMultiplier: 1.5, description: 'Classic coastal boat' },
    { id: 'ship_boat_1', name: 'Ship Boat 1', category: 'Ship / Other', path: '/Assets/Other/ship_boat_1.glb', previewImage: '/Assets/Previews/other_ship_1.png', scaleMultiplier: 1.5, description: 'Exploration sailing sloop' },
    { id: 'ship_boat_2', name: 'Ship Boat 2', category: 'Ship / Other', path: '/Assets/Other/ship_boat_2.glb', previewImage: '/Assets/Previews/other_ship_2.png', scaleMultiplier: 1.5, description: 'Merchant trading vessel' },
    { id: 'ship_boat_3', name: 'Ship Boat 3', category: 'Ship / Other', path: '/Assets/Other/ship_boat_3.glb', previewImage: '/Assets/Previews/other_ship_3.png', scaleMultiplier: 1.5, description: 'Coastal transport ship' },
    { id: 'ship_boat_4', name: 'Ship Boat 4', category: 'Ship / Other', path: '/Assets/Other/ship_boat_4.glb', previewImage: '/Assets/Previews/other_ship_4.png', scaleMultiplier: 1.5, description: 'Two-masted schooner' }
];

export const DEFAULT_BIOME_TREE_IDS: Record<BiomeId, string[]> = {
    candyland: ['candy_cotton_cloud', 'candy_lollipop_spiral', 'candy_lollipop_sphere', 'candy_cane_cluster', 'candy_gummy_flower'],
    meadow: ['veg_cartoon_1', 'veg_cartoon_2', 'veg_bigtree_1', 'veg_tree_broadleaf_1'],
    archipelago: ['veg_cherry_blossom', 'veg_palm_a', 'veg_cartoon_7', 'veg_clover_2'],
    geothermal: ['veg_cartoon_8', 'veg_cartoon_10', 'veg_tree_var4'],
    estuary: ['veg_palm_a', 'veg_palm_c', 'veg_fantasy_jungle', 'veg_clover_2'],
    redwood: ['veg_cartoon_11', 'veg_cartoon_12', 'veg_bigtree_1', 'veg_tree_var4'],
    sky_citadel: []
};

function isVegetationAllowed(x: number, z: number, y: number, biome: BiomeId): boolean {
    if (y < 3.2) return false;
    
    // Check slope around the sample point
    const hR = terrainHeightJS(x + 2.5, z);
    const hF = terrainHeightJS(x, z + 2.5);
    const slope = Math.max(Math.abs(hR - y), Math.abs(hF - y)) / 2.5;

    if (biome === 'candyland') {
        // Candyland: soft marshmallow hills and dunes
        return y <= 45.0 && slope < 0.85;
    } else if (biome === 'archipelago') {
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
    treeGeo: THREE.BufferGeometry;
    treeInst: THREE.InstancedMesh;
}

// ── TreeSystem ─────────────────────────────────────────────────────────────────

export class TreeSystem {
    public catalogModelMap: Map<string, LoadedCatalogEntry> = new Map();
    public catalogKeys: string[] = [];

    // Bushes (2 varieties)
    private bushInsts: THREE.InstancedMesh[] = [];

    // Materials
    private treeMat!: THREE.MeshToonMaterial;
    private bushMat!: THREE.MeshToonMaterial;

    // Bioluminescence & Color Mode Uniforms
    private bioluminescenceUniform = { value: 0.8 };
    private timePhaseGlowUniform = { value: 0.0 };
    private useOriginalColorUniform = { value: 0.0 };
    private leafColorUniform = { value: new THREE.Color(0.20, 0.58, 0.22) };

    // Candy Specular & Reflectivity Uniforms
    private candyGlossUniform = { value: 1.35 };
    private sugarSparkleUniform = { value: 0.85 };
    private candyTranslucencyUniform = { value: 0.70 };

    // Glow State
    private currentTimePhaseGlow = 0.0;

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

    public loader!: GLTFLoader;

    constructor(private scene: THREE.Scene) {}

    public setupInstMesh(geo: THREE.BufferGeometry, mat: THREE.Material, capacity: number, castShadow: boolean = false): THREE.InstancedMesh {
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        if (!geo.boundingBox) geo.computeBoundingBox();
        const inst = new THREE.InstancedMesh(geo, mat, capacity);
        inst.count = 0;
        inst.visible = false;
        inst.castShadow = false;
        inst.receiveShadow = true;
        inst.frustumCulled = true;
        inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        const trunkColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        inst.geometry.setAttribute('aTrunkColor', trunkColorAttr);
        const leafColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        inst.geometry.setAttribute('aLeafColor', leafColorAttr);
        const colorModeAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
        inst.geometry.setAttribute('aColorMode', colorModeAttr);
        const textureStyleAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
        inst.geometry.setAttribute('aTextureStyle', textureStyleAttr);
        const glowFactorAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
        inst.geometry.setAttribute('aGlowFactor', glowFactorAttr);
        this.scene.add(inst);
        return inst;
    }

    async init(): Promise<void> {
        this.loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/gltf/');
        this.loader.setDRACOLoader(dracoLoader);
        this.loader.setMeshoptDecoder(MeshoptDecoder);

        // ── 1. Unified 1-Mesh Tree MeshToonMaterial ────────────────────────────
        this.treeMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide,
            alphaTest: 0.25,
            transparent: false,
            depthWrite: true,
        });
        this.treeMat.onBeforeCompile = (shader) => {
            shader.uniforms.uBioluminescence = this.bioluminescenceUniform;
            shader.uniforms.uTimePhaseGlow = this.timePhaseGlowUniform;
            shader.uniforms.uCandyGloss = this.candyGlossUniform;
            shader.uniforms.uSugarSparkle = this.sugarSparkleUniform;
            shader.uniforms.uCandyTranslucency = this.candyTranslucencyUniform;
            shader.uniforms.uLeafColor = this.leafColorUniform;

            shader.vertexShader = `
                attribute float aPartType;
                attribute vec3 aOriginalColor;
                attribute vec3 aTrunkColor;
                attribute vec3 aLeafColor;
                attribute float aColorMode;
                attribute float aTextureStyle;
                attribute float aGlowFactor;
                varying float vPartType;
                varying vec3 vOriginalColor;
                varying vec3 vTrunkColor;
                varying vec3 vLeafColor;
                varying vec3 vCanopyColor;
                varying float vColorMode;
                varying float vTextureStyle;
                varying float vGlowFactor;
                varying vec2 vTreeUv;
                varying vec3 vTreeWorldNormal;
                varying vec3 vTreeWorldPos;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vPartType = aPartType;
                vOriginalColor = aOriginalColor;
                vTrunkColor = aTrunkColor;
                vLeafColor = aLeafColor;
                vColorMode = aColorMode;
                vTextureStyle = aTextureStyle;
                vGlowFactor = aGlowFactor;
                vTreeWorldNormal = normalize(mat3(instanceMatrix) * normal);
                vTreeWorldPos = (instanceMatrix * vec4(position, 1.0)).xyz;
                #ifdef USE_UV
                    vTreeUv = uv;
                #else
                    vTreeUv = vec2(0.0);
                #endif
                #ifdef USE_INSTANCING_COLOR
                    vCanopyColor = instanceColor;
                #else
                    vCanopyColor = vec3(1.0);
                #endif
                `
            );

            shader.fragmentShader = `
                uniform float uBioluminescence;
                uniform float uTimePhaseGlow;
                uniform float uCandyGloss;
                uniform float uSugarSparkle;
                uniform float uCandyTranslucency;
                uniform vec3 uLeafColor;
                varying float vPartType;
                varying vec3 vOriginalColor;
                varying vec3 vTrunkColor;
                varying vec3 vLeafColor;
                varying vec3 vCanopyColor;
                varying float vColorMode;
                varying float vTextureStyle;
                varying float vGlowFactor;
                varying vec2 vTreeUv;
                varying vec3 vTreeWorldNormal;
                varying vec3 vTreeWorldPos;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                vec3 finalTreeColor;
                #ifdef USE_MAP
                    vec4 texCol = texture2D(map, vTreeUv);
                    if (texCol.a < 0.25) discard;
                #endif
                if (vColorMode > 0.5) {
                    #ifdef USE_MAP
                        finalTreeColor = texCol.rgb;
                    #else
                        finalTreeColor = vOriginalColor;
                    #endif
                } else {
                    if (vPartType > 1.5) {
                        finalTreeColor = vCanopyColor;
                    } else if (vPartType > 0.5) {
                        finalTreeColor = vLeafColor;
                    } else {
                        finalTreeColor = vTrunkColor;
                    }
                }

                // Reflective Candy Coating & Glossy Specular highlights
                vec3 viewDir = normalize(cameraPosition - vTreeWorldPos);
                vec3 norm = normalize(vTreeWorldNormal);
                float NdotV = clamp(dot(norm, viewDir), 0.0, 1.0);
                float fresnel = (1.0 - NdotV) * (1.0 - NdotV);

                vec3 halfVec = normalize(vec3(0.38, 0.76, 0.52) + viewDir);
                float NdotH = clamp(dot(norm, halfVec), 0.0, 1.0);
                float spec = NdotH * NdotH * NdotH * NdotH;

                vec3 candyGlossSheen = vec3(1.0, 0.96, 0.98) * (fresnel * uCandyGloss * 0.25 + spec * uCandyGloss * 0.45);

                // Multi-Style Texture Shaders:
                if (vColorMode > 0.5 || vTextureStyle < 0.5) {
                    // 0. Original Textures
                    diffuseColor.rgb = finalTreeColor;
                } else if (vTextureStyle < 1.5) {
                    // 1. Candy Gloss & Reflectivity
                    diffuseColor.rgb = finalTreeColor + candyGlossSheen * 0.85;
                } else if (vTextureStyle < 2.5) {
                    // 2. Cotton Candy Puff
                    diffuseColor.rgb = finalTreeColor * 1.05 + candyGlossSheen * 0.35;
                } else if (vTextureStyle < 3.5) {
                    // 3. Foliage Flutter
                    diffuseColor.rgb = finalTreeColor + candyGlossSheen * 0.30;
                } else if (vTextureStyle < 4.5) {
                    // 4. Prismatic Crystal
                    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (fresnel + vec3(0.0, 0.33, 0.67)));
                    diffuseColor.rgb = mix(finalTreeColor, rainbow, 0.20 * fresnel) + candyGlossSheen * 0.65;
                } else if (vTextureStyle < 5.5) {
                    // 5. Woodland Moss & Bark
                    diffuseColor.rgb = finalTreeColor * 0.95 + candyGlossSheen * 0.15;
                } else {
                    // 6. Velvet Petal Bloom
                    diffuseColor.rgb = finalTreeColor * (1.0 + 0.25 * fresnel) + candyGlossSheen * 0.20;
                }
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                vec3 baseCanopyCol = (vColorMode > 0.5) ? vOriginalColor : vCanopyColor;
                vec3 baseLeafCol   = (vColorMode > 0.5) ? vOriginalColor : vLeafColor;

                // Glowing neon glow stick: trunk remains white, canopy & leaves glow their vivid saturated color
                vec3 glowStickCol;
                if (vPartType < 0.5) {
                    glowStickCol = vec3(0.95, 0.95, 1.0); // Trunk remains pure crisp white
                } else {
                    vec3 col = (vPartType > 1.5) ? baseCanopyCol : baseLeafCol;
                    float maxC = max(col.r, max(col.g, max(col.b, 0.001)));
                    vec3 saturatedHue = col / maxC; // Saturated chromatic hue
                    glowStickCol = mix(saturatedHue, col, 0.2) * 1.75;
                }

                float glow = uBioluminescence * uTimePhaseGlow * vGlowFactor;
                totalEmissiveRadiance += glowStickCol * glow;
                `
            );
        };

        // Bush Material
        this.bushMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide,
            alphaTest: 0.25,
            transparent: false,
            depthWrite: true,
        });
        this.bushMat.onBeforeCompile = (shader) => {
            shader.uniforms.uBioluminescence = this.bioluminescenceUniform;
            shader.uniforms.uTimePhaseGlow = this.timePhaseGlowUniform;
            shader.fragmentShader = `uniform float uBioluminescence;\nuniform float uTimePhaseGlow;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    vec3 col = vInstanceColor.rgb;
                    float maxC = max(col.r, max(col.g, max(col.b, 0.001)));
                    vec3 saturatedHue = col / maxC;
                    vec3 glowCol = mix(saturatedHue, col, 0.2) * 1.75;
                    totalEmissiveRadiance += glowCol * (uBioluminescence * uTimePhaseGlow * 1.5);
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * (uBioluminescence * uTimePhaseGlow * 1.5);
                #endif
                `
            );
        };

        // ── 2. Instantly load priority models (procedural & starting biome models) ────
        const initialBiomeId = globalConfigManager.config.activeBiomeId || 'candyland';
        const initialBiomeCfg = globalConfigManager.getBiomeConfig(initialBiomeId);
        const initialModelIds = new Set(
            initialBiomeCfg?.vegetation?.selectedTreeModelIds || DEFAULT_BIOME_TREE_IDS[initialBiomeId] || []
        );

        // Priority items load synchronously during init; background items stream in later
        const priorityItems = TREE_CATALOG.filter(it => it.path.startsWith('procedural:') || initialModelIds.has(it.id));
        const backgroundItems = TREE_CATALOG.filter(it => !it.path.startsWith('procedural:') && !initialModelIds.has(it.id));

        await Promise.all(priorityItems.map(it => this.ensureModelLoaded(it)));

        // ── 3. Bush Geometries ─────────────────────────────────────────────────
        const bushRoundGeo = new THREE.IcosahedronGeometry(1.4, 1);
        bushRoundGeo.translate(0, 0.4, 0);
        const bushFlatGeo = new THREE.IcosahedronGeometry(1.8, 1);
        bushFlatGeo.translate(0, 0.3, 0);

        for (const geo of [bushRoundGeo, bushFlatGeo]) {
            const inst = this.setupInstMesh(geo, this.bushMat, MAX_CAPACITY, false);
            this.bushInsts.push(inst);
        }

        this.ready = true;
        this.dirty = true;

        // Progressively stream remaining catalog models in background with delays to keep 60fps solid
        (async () => {
            for (const item of backgroundItems) {
                await this.ensureModelLoaded(item);
                await new Promise(r => setTimeout(r, 80));
            }
        })();
    }

    public async ensureModelLoaded(item: TreeCatalogItem): Promise<LoadedCatalogEntry | null> {
        if (this.catalogModelMap.has(item.id)) {
            return this.catalogModelMap.get(item.id)!;
        }
        try {
            const geo = await loadTreeGeometries(item.path, this.loader, item.scaleMultiplier ?? 1.0);
            let mat = this.treeMat;
            if (geo.map) {
                mat = this.treeMat.clone();
                mat.map = geo.map;
                mat.needsUpdate = true;
            }
            const treeInst = this.setupInstMesh(geo.treeGeo, mat, MAX_CAPACITY, false);
            const entry: LoadedCatalogEntry = {
                item,
                treeGeo: geo.treeGeo,
                treeInst
            };
            this.catalogModelMap.set(item.id, entry);
            if (!this.catalogKeys.includes(item.id)) {
                this.catalogKeys.push(item.id);
            }
            this.dirty = true;
            return entry;
        } catch (err) {
            console.warn(`[TreeSystem] Failed to load catalog item ${item.name} (${item.path}):`, err);
            return null;
        }
    }

    public async loadCustomTreeModel(
        name: string,
        source: string | ArrayBuffer,
        scaleMultiplier: number = 1.0
    ): Promise<TreeCatalogItem> {
        const cleanName = name.replace(/\.glb$/i, '').trim() || 'Custom Tree';
        const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const geo = await loadTreeGeometries(source, this.loader, scaleMultiplier);
        let mat = this.treeMat;
        if (geo.map) {
            mat = this.treeMat.clone();
            mat.map = geo.map;
            mat.needsUpdate = true;
        }
        const treeInst = this.setupInstMesh(geo.treeGeo, mat, MAX_CAPACITY, true);
        const item: TreeCatalogItem = {
            id,
            name: cleanName,
            category: 'Custom / Loaded',
            path: typeof source === 'string' ? source : 'Uploaded Custom File',
            previewImage: '/Assets/Previews/veg_cartoon_1.png',
            scaleMultiplier,
            description: 'Custom loaded 3D tree asset'
        };
        const entry: LoadedCatalogEntry = {
            item,
            treeGeo: geo.treeGeo,
            treeInst
        };
        this.catalogModelMap.set(id, entry);
        this.catalogKeys.push(id);
        TREE_CATALOG.push(item);

        // Also add to active biome's selected models and rebuild
        const bCfg = globalConfigManager.getActiveBiomeConfig();
        if (bCfg && bCfg.vegetation) {
            const cur = bCfg.vegetation.selectedTreeModelIds || [];
            bCfg.vegetation.selectedTreeModelIds = [...cur, id];
        }
        this.forceRebuild();
        return item;
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
        const veg = activeBiome.vegetation;
        const bioVal = veg.bioluminescence !== undefined ? veg.bioluminescence : 0.8;
        this.bioluminescenceUniform.value = bioVal;

        this.candyGlossUniform.value = veg.candyGloss !== undefined ? veg.candyGloss : 1.35;
        this.sugarSparkleUniform.value = veg.sugarSparkle !== undefined ? veg.sugarSparkle : 0.85;
        this.candyTranslucencyUniform.value = veg.candyTranslucency !== undefined ? veg.candyTranslucency : 0.70;

        // Automated time-phase calculation: Day = 0.0 (nothing), Dusk = 0.50 (half), Twilight = 1.00 (brightest)
        const timePhaseTargets = [0.0, 0.50, 1.00];
        const target = timePhaseTargets[timePhase] ?? 0.0;
        this.currentTimePhaseGlow += (target - this.currentTimePhaseGlow) * Math.min(1, dt * 4.0);
        this.timePhaseGlowUniform.value = this.currentTimePhaseGlow;
    }

    // Graphics Profile
    public graphicsProfile: 'high_performance' | 'regular' = 'high_performance';

    public setGraphicsProfile(profile: 'high_performance' | 'regular'): void {
        this.graphicsProfile = profile;
        this.forceRebuild();
    }

    // ── Rebuild Instanced Meshes ───────────────────────────────────────────────

    rebuild(playerX: number, playerZ: number): void {
        if (!this.ready) return;

        const treeGridSpacing = 16.0;
        const px = playerX;
        const pz = playerZ;
        const activeSpawnRadius = (this.graphicsProfile === 'regular') ? 220 : SPAWN_RADIUS;

        const minCX = Math.floor((px - activeSpawnRadius) / treeGridSpacing);
        const maxCX = Math.ceil((px + activeSpawnRadius) / treeGridSpacing);
        const minCZ = Math.floor((pz - activeSpawnRadius) / treeGridSpacing);
        const maxCZ = Math.ceil((pz + activeSpawnRadius) / treeGridSpacing);

        const modelCounts: Map<string, number> = new Map();
        for (const key of this.catalogKeys) {
            modelCounts.set(key, 0);
        }

        // Spatial Collision Occupancy Grid to guarantee no trees/flowers/bushes clip
        const placedOccupancy: { x: number; z: number; radius: number }[] = [];
        const occGrid = new Map<number, number[]>();
        const occGridSize = 20.0;

        const getGridKey = (gx: number, gz: number) => ((gx + 2000) * 4000) + (gz + 2000);

        const canPlace = (pxPos: number, pzPos: number, rad: number): boolean => {
            const gx = Math.floor(pxPos / occGridSize);
            const gz = Math.floor(pzPos / occGridSize);
            for (let nx = gx - 1; nx <= gx + 1; nx++) {
                for (let nz = gz - 1; nz <= gz + 1; nz++) {
                    const indices = occGrid.get(getGridKey(nx, nz));
                    if (indices) {
                        for (let i = 0; i < indices.length; i++) {
                            const other = placedOccupancy[indices[i]];
                            const dx = pxPos - other.x;
                            const dz = pzPos - other.z;
                            const reqDist = rad + other.radius;
                            if (dx * dx + dz * dz < reqDist * reqDist) {
                                return false;
                            }
                        }
                    }
                }
            }
            return true;
        };

        const registerPlace = (pxPos: number, pzPos: number, rad: number) => {
            const idx = placedOccupancy.length;
            placedOccupancy.push({ x: pxPos, z: pzPos, radius: rad });
            const gx = Math.floor(pxPos / occGridSize);
            const gz = Math.floor(pzPos / occGridSize);
            const key = getGridKey(gx, gz);
            let arr = occGrid.get(key);
            if (!arr) {
                arr = [];
                occGrid.set(key, arr);
            }
            arr.push(idx);
        };

        const allBiomes: BiomeId[] = ['candyland', 'meadow', 'archipelago', 'geothermal', 'estuary', 'redwood', 'sky_citadel'];
        const biomeActiveModels: Record<BiomeId, LoadedCatalogEntry[]> = {
            candyland: [],
            meadow: [],
            archipelago: [],
            geothermal: [],
            estuary: [],
            redwood: [],
            sky_citadel: []
        };

        for (const b of allBiomes) {
            const bCfg = globalConfigManager.getBiomeConfig(b);
            const userModelIds = bCfg.vegetation.selectedTreeModelIds !== undefined
                ? bCfg.vegetation.selectedTreeModelIds
                : (DEFAULT_BIOME_TREE_IDS[b] || []);
            
            const entries: LoadedCatalogEntry[] = [];
            for (const mId of userModelIds) {
                const entry = this.catalogModelMap.get(mId);
                if (entry) {
                    entries.push(entry);
                } else {
                    const catItem = TREE_CATALOG.find(it => it.id === mId);
                    if (catItem) this.ensureModelLoaded(catItem);
                }
            }
            biomeActiveModels[b] = entries;
        }

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const x = (cx + 0.5) * treeGridSpacing;
                const z = (cz + 0.5) * treeGridSpacing;

                const dx = x - px;
                const dz = z - pz;
                if (dx * dx + dz * dz > (activeSpawnRadius + treeGridSpacing) ** 2) continue;

                const biome = getDominantBiome(x, z);
                const biomeCfg = globalConfigManager.getBiomeConfig(biome);
                const veg = biomeCfg.vegetation;

                const activeModels = biomeActiveModels[biome];
                if (!activeModels || activeModels.length === 0) continue;

                for (let mIdx = 0; mIdx < activeModels.length; mIdx++) {
                    const selectedModel = activeModels[mIdx];
                    const modelKey = selectedModel.item.id;
                    const mCfg = (veg.models && veg.models[modelKey]) ? veg.models[modelKey] : getDefaultModelConfig(modelKey);
                    
                    const mDensity = mCfg.density !== undefined ? mCfg.density : (veg.treeDensity || 200);
                    if (mDensity <= 0) continue;
                    
                    const densityMult = (this.graphicsProfile === 'regular') ? 0.65 : 1.0;
                    const densityChance = (mDensity / 800.0) * densityMult;
                    const modelRng = mulberry32(cellSeed(cx, cz, strHash(modelKey)));
                    if (modelRng() > densityChance) continue;

                    const currentCount = modelCounts.get(modelKey) || 0;
                    if (currentCount >= MAX_CAPACITY) continue;

                    // Independent Scale per model
                    const mScale = (mCfg.scale !== undefined) ? mCfg.scale : (veg.treeScale || 6.0);
                    let baseScale = mScale * 0.16;
                    if (biome === 'redwood') baseScale *= 1.35;
                    if (biome === 'estuary') baseScale *= 0.85;

                    // Clearance radius: flowers need ~1.8m, regular trees ~3.6m
                    const isFlora = selectedModel.item.category === 'Flowers & Flora';
                    const clearanceRadius = Math.max(isFlora ? 1.8 : 3.6, baseScale * (isFlora ? 0.65 : 1.2));

                    // Deterministic 2-attempt candidate placement to find non-colliding spot
                    let placed = false;
                    let instX = 0, instZ = 0;
                    for (let attempt = 0; attempt < 2; attempt++) {
                        const u = 0.15 + (attempt * 0.40) + (modelRng() * 0.30);
                        const v = 0.15 + (attempt * 0.40) + (modelRng() * 0.30);
                        const candX = (cx + u) * treeGridSpacing;
                        const candZ = (cz + v) * treeGridSpacing;

                        const cDx = candX - px;
                        const cDz = candZ - pz;
                        if (cDx * cDx + cDz * cDz > activeSpawnRadius * activeSpawnRadius) continue;

                        if (canPlace(candX, candZ, clearanceRadius)) {
                            instX = candX;
                            instZ = candZ;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) continue;

                    const instY = terrainHeightJS(instX, instZ);
                    if (!isVegetationAllowed(instX, instZ, instY, biome)) continue;

                    // Register this location in spatial grid to block overlaps
                    registerPlace(instX, instZ, clearanceRadius);

                    const sizeVariation = 0.85 + modelRng() * 0.35;
                    const scaleX = baseScale * sizeVariation;
                    const scaleY = baseScale * (0.9 + modelRng() * 0.25);
                    const scaleZ = baseScale * sizeVariation;

                    const rotY = modelRng() * Math.PI * 2;
                    const tiltX = (modelRng() - 0.5) * 0.08;
                    const tiltZ = (modelRng() - 0.5) * 0.08;

                    this.dummy.position.set(instX, instY - 0.15, instZ);
                    this.dummy.rotation.set(tiltX, rotY, tiltZ);
                    this.dummy.scale.set(scaleX, scaleY, scaleZ);
                    this.dummy.updateMatrix();

                    selectedModel.treeInst.setMatrixAt(currentCount, this.dummy.matrix);

                    // Independent Canopy Color selection per model
                    const canopyPalette = (mCfg.canopyColors && mCfg.canopyColors.length > 0) ? mCfg.canopyColors : (veg.canopyColors.length > 0 ? veg.canopyColors : ['#ff1493', '#00d2ff', '#00ff88']);
                    const canopyHex = canopyPalette[Math.floor(modelRng() * canopyPalette.length)];
                    this.tempColor.set(canopyHex);
                    this.tempColor.getHSL(this.tempHSL);
                    this.tempHSL.l = THREE.MathUtils.clamp(this.tempHSL.l + (modelRng() - 0.5) * 0.08, 0.1, 0.9);
                    this.tempHSL.s = THREE.MathUtils.clamp(this.tempHSL.s + (modelRng() - 0.5) * 0.06, 0.2, 1.0);
                    this.tempColor.setHSL(this.tempHSL.h, this.tempHSL.s, this.tempHSL.l);
                    selectedModel.treeInst.setColorAt(currentCount, this.tempColor);

                    // Independent Leaf / Foliage Color selection per model
                    const leafPalette = (mCfg.leafColors && mCfg.leafColors.length > 0) ? mCfg.leafColors : ['#22c55e', '#16a34a', '#15803d', '#4ade80'];
                    const leafHex = leafPalette[Math.floor(modelRng() * leafPalette.length)];
                    this.tempColor.set(leafHex);
                    const leafAttr = selectedModel.treeInst.geometry.getAttribute('aLeafColor') as THREE.InstancedBufferAttribute;
                    if (leafAttr) {
                        leafAttr.setXYZ(currentCount, this.tempColor.r, this.tempColor.g, this.tempColor.b);
                    }

                    // Independent Trunk / Stem Color selection per model
                    const trunkPalette = (mCfg.trunkColors && mCfg.trunkColors.length > 0) ? mCfg.trunkColors : (veg.trunkColors.length > 0 ? veg.trunkColors : ['#5c3a21', '#451a03']);
                    const trunkHex = trunkPalette[Math.floor(modelRng() * trunkPalette.length)];
                    this.tempColor.set(trunkHex);
                    const trunkAttr = selectedModel.treeInst.geometry.getAttribute('aTrunkColor') as THREE.InstancedBufferAttribute;
                    if (trunkAttr) {
                        trunkAttr.setXYZ(currentCount, this.tempColor.r, this.tempColor.g, this.tempColor.b);
                    }

                    // Independent Color Mode (Original vs Custom) per model
                    const isOriginal = (mCfg.useOriginalColors || mCfg.activePreset === 'original' || veg.activePreset === 'original') ? 1.0 : 0.0;
                    const colorModeAttr = selectedModel.treeInst.geometry.getAttribute('aColorMode') as THREE.InstancedBufferAttribute;
                    if (colorModeAttr) {
                        colorModeAttr.setX(currentCount, isOriginal);
                    }

                    // Independent Texture Style selection per model with biome fallback
                    const styleKey = (mCfg.textureStyle) ? mCfg.textureStyle : (veg.textureStyle || 'candy');
                    let styleCode = 1.0; // default candy
                    if (styleKey === 'original' || isOriginal > 0.5) styleCode = 0.0;
                    else if (styleKey === 'candy') styleCode = 1.0;
                    else if (styleKey === 'cotton_candy') styleCode = 2.0;
                    else if (styleKey === 'flutter') styleCode = 3.0;
                    else if (styleKey === 'crystal') styleCode = 4.0;
                    else if (styleKey === 'woodland') styleCode = 5.0;
                    else if (styleKey === 'velvet') styleCode = 6.0;

                    const styleAttr = selectedModel.treeInst.geometry.getAttribute('aTextureStyle') as THREE.InstancedBufferAttribute;
                    if (styleAttr) {
                        styleAttr.setX(currentCount, styleCode);
                    }

                    // Glow-in-the-dark glow stick activator for subset of trees during dusk/twilight
                    const isGlowEnabled = veg.glowStickEnabled !== false;
                    const glowRatio = veg.glowStickRatio !== undefined ? veg.glowStickRatio : 0.18;
                    const glowIntensity = veg.glowStickIntensity !== undefined ? veg.glowStickIntensity : 2.8;

                    const isGlowTree = isGlowEnabled && (modelRng() < glowRatio);
                    const glowVal = isGlowTree ? glowIntensity : 0.0;
                    const glowAttr = selectedModel.treeInst.geometry.getAttribute('aGlowFactor') as THREE.InstancedBufferAttribute;
                    if (glowAttr) {
                        glowAttr.setX(currentCount, glowVal);
                    }

                    modelCounts.set(modelKey, currentCount + 1);
                }
            }
        }

        // Commit tree counts and update buffers across all catalog models
        for (const [key, entry] of this.catalogModelMap.entries()) {
            const count = modelCounts.get(key) || 0;
            entry.treeInst.count = count;
            const isVisible = count > 0;
            entry.treeInst.visible = isVisible;
            if (isVisible) {
                if (entry.treeInst.instanceMatrix) entry.treeInst.instanceMatrix.needsUpdate = true;
                if (entry.treeInst.instanceColor) entry.treeInst.instanceColor.needsUpdate = true;
                const trunkAttr = entry.treeInst.geometry.getAttribute('aTrunkColor');
                if (trunkAttr) trunkAttr.needsUpdate = true;
                const leafAttr = entry.treeInst.geometry.getAttribute('aLeafColor');
                if (leafAttr) leafAttr.needsUpdate = true;
                const colorModeAttr = entry.treeInst.geometry.getAttribute('aColorMode');
                if (colorModeAttr) colorModeAttr.needsUpdate = true;
                const textureStyleAttr = entry.treeInst.geometry.getAttribute('aTextureStyle');
                if (textureStyleAttr) textureStyleAttr.needsUpdate = true;
                const glowAttr = entry.treeInst.geometry.getAttribute('aGlowFactor');
                if (glowAttr) glowAttr.needsUpdate = true;
            }
        }

        // ── 2. Rebuild Bushes (with spatial clearance against trees & bushes) ──
        let bushCount0 = 0, bushCount1 = 0;
        const bushSpacing = 22.0;
        const bMinCX = Math.floor((px - activeSpawnRadius * 0.7) / bushSpacing);
        const bMaxCX = Math.ceil((px + activeSpawnRadius * 0.7) / bushSpacing);
        const bMinCZ = Math.floor((pz - activeSpawnRadius * 0.7) / bushSpacing);
        const bMaxCZ = Math.ceil((pz + activeSpawnRadius * 0.7) / bushSpacing);

        for (let cx = bMinCX; cx <= bMaxCX; cx++) {
            for (let cz = bMinCZ; cz <= bMaxCZ; cz++) {
                const rng = mulberry32(cellSeed(cx, cz, 303));
                const x = (cx + 0.1 + rng() * 0.8) * bushSpacing;
                const z = (cz + 0.1 + rng() * 0.8) * bushSpacing;

                const dx = x - px;
                const dz = z - pz;
                if (dx * dx + dz * dz > (activeSpawnRadius * 0.7) ** 2) continue;

                const y = terrainHeightJS(x, z);
                const biome = getDominantBiome(x, z);
                if (!isVegetationAllowed(x, z, y, biome)) continue;
                const biomeCfg = globalConfigManager.getBiomeConfig(biome);
                const veg = biomeCfg.vegetation;

                if (!veg.bushDensity || veg.bushDensity <= 0) continue;
                const bushChance = (veg.bushDensity / 400.0) * ((this.graphicsProfile === 'regular') ? 0.6 : 1.0);
                if (rng() > bushChance) continue;

                const bScale = veg.bushScale * (0.8 + rng() * 0.4);
                const bushClearance = Math.max(1.8, bScale * 0.9);
                if (!canPlace(x, z, bushClearance)) continue;
                registerPlace(x, z, bushClearance);

                const variant = rng() > 0.5 ? 1 : 0;
                const inst = this.bushInsts[variant];
                const idx = variant === 0 ? bushCount0 : bushCount1;
                if (idx >= MAX_CAPACITY) continue;

                this.dummy.position.set(x, y - 0.05, z);
                this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
                this.dummy.scale.set(bScale, bScale * (0.8 + rng() * 0.4), bScale);
                this.dummy.updateMatrix();

                inst.setMatrixAt(idx, this.dummy.matrix);

                // Flowering bush colors: Keep natural green foliage and royal purple blossoms as originally designed
                const bushHex = variant === 0 
                    ? (rng() > 0.3 ? '#3f8a27' : '#2e7d32') // Lush green foliage
                    : (rng() > 0.4 ? '#9333ea' : '#a855f7'); // Vibrant purple blossoms
                this.tempColor.set(bushHex);
                inst.setColorAt(idx, this.tempColor);

                if (variant === 0) bushCount0++;
                else bushCount1++;
            }
        }

        this.bushInsts[0].count = bushCount0;
        this.bushInsts[0].visible = bushCount0 > 0;
        if (bushCount0 > 0) {
            if (this.bushInsts[0].instanceMatrix) this.bushInsts[0].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[0].instanceColor) this.bushInsts[0].instanceColor.needsUpdate = true;
        }

        this.bushInsts[1].count = bushCount1;
        this.bushInsts[1].visible = bushCount1 > 0;
        if (bushCount1 > 0) {
            if (this.bushInsts[1].instanceMatrix) this.bushInsts[1].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[1].instanceColor) this.bushInsts[1].instanceColor.needsUpdate = true;
        }
    }

    // ── External API for DevEditor ─────────────────────────────────────────────

    public getModelConfig(biomeId: BiomeId, modelId: string): ModelVegetationConfig {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        if (!veg.models) veg.models = {};
        if (!veg.models[modelId]) {
            veg.models[modelId] = getDefaultModelConfig(modelId);
        }
        return veg.models[modelId];
    }

    public setModelScale(biomeId: BiomeId, modelId: string, scale: number): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.scale = Math.max(0.1, Math.min(50.0, scale));
        cfg.enabled = true;
        this.forceRebuild();
    }

    public setModelDensity(biomeId: BiomeId, modelId: string, density: number): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.density = Math.max(0, Math.min(800, Math.round(density)));
        cfg.enabled = true;
        this.forceRebuild();
    }

    public setModelColorMode(biomeId: BiomeId, modelId: string, useOriginal: boolean): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.useOriginalColors = useOriginal;
        if (useOriginal) {
            cfg.activePreset = 'original';
            cfg.textureStyle = 'original';
        } else if (cfg.activePreset === 'original') {
            cfg.activePreset = 'custom';
            cfg.textureStyle = 'candy';
        }
        this.forceRebuild();
    }

    public setModelTextureStyle(biomeId: BiomeId, modelId: string, style: VegetationTextureStyle): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.textureStyle = style;
        if (style === 'original') {
            cfg.useOriginalColors = true;
        } else {
            cfg.useOriginalColors = false;
        }
        this.forceRebuild();
    }

    public setModelCanopyColors(biomeId: BiomeId, modelId: string, colors: string[]): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.canopyColors = [...colors];
        cfg.useOriginalColors = false;
        cfg.activePreset = 'custom';
        this.forceRebuild();
    }

    public setModelLeafColors(biomeId: BiomeId, modelId: string, colors: string[]): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.leafColors = [...colors];
        cfg.useOriginalColors = false;
        cfg.activePreset = 'custom';
        this.forceRebuild();
    }

    public setModelTrunkColors(biomeId: BiomeId, modelId: string, colors: string[]): void {
        const cfg = this.getModelConfig(biomeId, modelId);
        cfg.trunkColors = [...colors];
        cfg.useOriginalColors = false;
        cfg.activePreset = 'custom';
        this.forceRebuild();
    }

    public applyModelPreset(biomeId: BiomeId, modelId: string, presetKey: string): void {
        const preset = BIOME_VEG_PRESETS[presetKey];
        if (preset) {
            const cfg = this.getModelConfig(biomeId, modelId);
            cfg.canopyColors = [...preset.canopyColors];
            if (preset.leafColors) cfg.leafColors = [...preset.leafColors];
            cfg.trunkColors = [...preset.trunkColors];
            cfg.activePreset = presetKey;
            cfg.useOriginalColors = (presetKey === 'original');
            this.forceRebuild();
        }
    }

    public setBiomeTreeScale(biomeId: BiomeId, scale: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.treeScale = Math.max(0.5, Math.min(30.0, scale));
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
        veg.activePreset = 'custom';
        this.forceRebuild();
    }

    public setBiomeTrunkColors(biomeId: BiomeId, colors: string[]): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.trunkColors = colors;
        veg.activePreset = 'custom';
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
            veg.selectedTreeModelIds = current.filter(id => id !== modelId);
        } else {
            veg.selectedTreeModelIds = [...current, modelId];
        }
        this.forceRebuild();
    }

    public setBiomeTreeModelSelected(biomeId: BiomeId, modelId: string, selected: boolean): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        const current = veg.selectedTreeModelIds || [];
        if (selected) {
            if (!current.includes(modelId)) {
                veg.selectedTreeModelIds = [...current, modelId];
            }
        } else {
            veg.selectedTreeModelIds = current.filter(id => id !== modelId);
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
            if (biomeId === globalConfigManager.config.activeBiomeId) {
                this.useOriginalColorUniform.value = (presetKey === 'original') ? 1.0 : 0.0;
            }
            this.forceRebuild();
        }
    }

    public setBioluminescence(intensity: number, biomeId?: BiomeId): void {
        const bId = biomeId || globalConfigManager.config.activeBiomeId;
        const veg = globalConfigManager.getBiomeConfig(bId).vegetation;
        veg.bioluminescence = Math.max(0.0, Math.min(1.0, intensity));
        if (bId === globalConfigManager.config.activeBiomeId) {
            this.bioluminescenceUniform.value = veg.bioluminescence;
        }
    }

    public setBiomeBloomAndGlow(biomeId: BiomeId, bloomProps: Partial<any>): void {
        if (bloomProps.treeBloom !== undefined || bloomProps.treeCanopyGlow !== undefined) {
            const val = (bloomProps.treeBloom ?? bloomProps.treeCanopyGlow ?? 1.0) / 2.0;
            this.setBioluminescence(val, biomeId);
        }
    }

    public setPreset(key: string): void {
        this.applyBiomeVegPreset(globalConfigManager.config.activeBiomeId, key);
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

    public setBiomeGlowStickEnabled(biomeId: BiomeId, enabled: boolean): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.glowStickEnabled = enabled;
        this.forceRebuild();
    }

    public setBiomeGlowStickRatio(biomeId: BiomeId, ratio: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.glowStickRatio = Math.max(0.01, Math.min(1.0, ratio));
        this.forceRebuild();
    }

    public setBiomeGlowStickIntensity(biomeId: BiomeId, intensity: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.glowStickIntensity = Math.max(0.0, Math.min(6.0, intensity));
        this.forceRebuild();
    }

    public setBiomeCandyGloss(biomeId: BiomeId, val: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.candyGloss = Math.max(0.0, Math.min(3.0, val));
        this.candyGlossUniform.value = veg.candyGloss;
    }

    public setBiomeSugarSparkle(biomeId: BiomeId, val: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.sugarSparkle = Math.max(0.0, Math.min(3.0, val));
        this.sugarSparkleUniform.value = veg.sugarSparkle;
    }

    public setBiomeCandyTranslucency(biomeId: BiomeId, val: number): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.candyTranslucency = Math.max(0.0, Math.min(2.0, val));
        this.candyTranslucencyUniform.value = veg.candyTranslucency;
    }

    public setBiomeTextureStyle(biomeId: BiomeId, style: VegetationTextureStyle): void {
        const veg = globalConfigManager.getBiomeConfig(biomeId).vegetation;
        veg.textureStyle = style;
        if (style === 'original') {
            veg.candyGloss = 0.0;
            veg.sugarSparkle = 0.0;
            this.candyGlossUniform.value = 0.0;
            this.sugarSparkleUniform.value = 0.0;
        }
        this.forceRebuild();
    }

    public forceRebuild(): void {
        this.dirty = true;
        if (this.rebuildRafId === null) {
            this.rebuildRafId = requestAnimationFrame(() => {
                this.rebuildRafId = null;
                const px = this.lastX !== -99999 ? this.lastX : 0;
                const pz = this.lastZ !== -99999 ? this.lastZ : 0;
                this.rebuild(px, pz);
                this.dirty = false;
            });
        }
    }
}

