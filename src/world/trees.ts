import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeightJS } from './noise';
import { gradientMap } from './terrain';

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAWN_RADIUS = 650;
const REBUILD_THRESHOLD = 20;
const MAX_CAPACITY = 800;
const MIN_TREE_HEIGHT = 5.0;
const MAX_TREE_HEIGHT = 30.0;

// ── Candy Color Presets ────────────────────────────────────────────────────────

export type PresetKey = 'candy' | 'cotton' | 'lollipop' | 'mints' | 'berry';

export interface ColorPreset {
    name: string;
    canopyColors: THREE.Color[];
    trunkColors: THREE.Color[];
}

export const COLOR_PRESETS: Record<PresetKey, ColorPreset> = {
    candy: {
        name: 'Candy Mix',
        canopyColors: [
            new THREE.Color(0xff77a9),  // bubblegum pink
            new THREE.Color(0xff9ec6),  // pastel pink
            new THREE.Color(0xc77dff),  // bright purple
            new THREE.Color(0xa855f7),  // violet
            new THREE.Color(0xd8b4fe),  // lavender
            new THREE.Color(0x6ee7b7),  // mint
            new THREE.Color(0x38bdf8),  // sky blue
            new THREE.Color(0xfde68a),  // lemon candy
            new THREE.Color(0xfb7185),  // coral sweet
            new THREE.Color(0xfda4af),  // salmon taffy
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // sugar white
            new THREE.Color(0xfff5ea),  // vanilla cream
            new THREE.Color(0xffe8ec),  // marshmallow
            new THREE.Color(0xd4a373),  // caramel
        ],
    },
    cotton: {
        name: 'Cotton Candy',
        canopyColors: [
            new THREE.Color(0x93c5fd),  // baby blue
            new THREE.Color(0xbfdbfe),  // soft ice blue
            new THREE.Color(0xfbcfe8),  // soft candy pink
            new THREE.Color(0xf472b6),  // fluffy magenta
            new THREE.Color(0xe9d5ff),  // soft lilac
            new THREE.Color(0xfed7aa),  // peach whip
            new THREE.Color(0xfef08a),  // buttercream
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // pure sugar white
            new THREE.Color(0xfff0f5),  // lavender white
            new THREE.Color(0xf0f9ff),  // ice white
        ],
    },
    lollipop: {
        name: 'Lollipop',
        canopyColors: [
            new THREE.Color(0xef4444),  // cherry red
            new THREE.Color(0xf97316),  // orange soda
            new THREE.Color(0x84cc16),  // sour lime
            new THREE.Color(0x06b6d4),  // electric blue
            new THREE.Color(0x8b5cf6),  // grape purple
            new THREE.Color(0xec4899),  // hot pink
            new THREE.Color(0xeab308),  // sunny lemon
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // white stick
            new THREE.Color(0xffedd5),  // toasted sugar
            new THREE.Color(0x6b4226),  // chocolate stick
            new THREE.Color(0xffd1dc),  // candy cane pink
        ],
    },
    mints: {
        name: 'Mints',
        canopyColors: [
            new THREE.Color(0x34d399),  // spearmint
            new THREE.Color(0x6ee7b7),  // light mint
            new THREE.Color(0xa7f3d0),  // frosted green
            new THREE.Color(0x2dd4bf),  // turquoise
            new THREE.Color(0x38bdf8),  // peppermint ice
            new THREE.Color(0x0284c7),  // deep cool blue
            new THREE.Color(0xccfbf1),  // icy seafoam
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // frosted white
            new THREE.Color(0xe0f2fe),  // cool ice
            new THREE.Color(0xd1fae5),  // mint cream
        ],
    },
    berry: {
        name: 'Berry',
        canopyColors: [
            new THREE.Color(0xdb2777),  // wild raspberry
            new THREE.Color(0xbe185d),  // dark strawberry
            new THREE.Color(0x7c3aed),  // blackberry violet
            new THREE.Color(0x4f46e5),  // blueberry indigo
            new THREE.Color(0xc026d3),  // sweet plum
            new THREE.Color(0xf43f5e),  // candied cranberry
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // cream white
            new THREE.Color(0x5c3d2e),  // dark chocolate
            new THREE.Color(0xfce7f3),  // berry milk
        ],
    },
};

// ── Procedural Candy Textures ──────────────────────────────────────────────────

function createCandySwirlTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    const cx = 128, cy = 128;
    for (let r = 0; r < 128; r += 1) {
        for (let a = 0; a < Math.PI * 2; a += 0.04) {
            const spiral = a + r * 0.12;
            const val = Math.sin(spiral * 6);
            if (val > 0.1) {
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                ctx.fillStyle = 'rgba(255, 235, 245, 0.65)';
                ctx.fillRect(x, y, 2, 2);
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
}

function createCandyStripeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = 'rgba(255, 220, 235, 0.55)';
    ctx.lineWidth = 12;
    for (let x = -128; x < 256; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 128, 128);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    return tex;
}

function createSugarSparkleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);

    for (let i = 0; i < 700; i++) {
        const x = Math.floor(Math.random() * 128);
        const y = Math.floor(Math.random() * 128);
        const alpha = 0.15 + Math.random() * 0.35;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
}

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
    loader: GLTFLoader
): Promise<{ trunkGeo: THREE.BufferGeometry; canopyGeo: THREE.BufferGeometry }> {
    const gltf = await loader.loadAsync(url);
    const trunkGeos: THREE.BufferGeometry[] = [];
    const canopyGeos: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            if (!geo.getAttribute('normal')) geo.computeVertexNormals();

            const clean = new THREE.BufferGeometry();
            clean.setAttribute('position', geo.getAttribute('position'));
            clean.setAttribute('normal', geo.getAttribute('normal'));
            if (geo.index) clean.setIndex(geo.index);

            const name = (mesh.name || (mesh.parent ? mesh.parent.name : '')).toLowerCase();
            if (name.includes('wood') || name.includes('stick') || name.includes('trunk') || name.includes('branch')) {
                trunkGeos.push(clean);
            } else {
                canopyGeos.push(clean);
            }
        }
    });

    const mergedTrunk = trunkGeos.length > 0 ? (trunkGeos.length === 1 ? trunkGeos[0] : (mergeGeometries(trunkGeos, false) || trunkGeos[0])) : new THREE.BufferGeometry();
    const mergedCanopy = canopyGeos.length > 0 ? (canopyGeos.length === 1 ? canopyGeos[0] : (mergeGeometries(canopyGeos, false) || canopyGeos[0])) : new THREE.BufferGeometry();

    // Compute combined bounding box for identical alignment
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

        const scaleFactor = size.y > 0.001 ? 6.0 / size.y : 1.0;

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

    return { trunkGeo: mergedTrunk, canopyGeo: mergedCanopy };
}

// ── TreeSystem ─────────────────────────────────────────────────────────────────

export class TreeSystem {
    // InstancedMeshes: 3 GLB Tree Types (separated trunk & canopy)
    private glbTrunkInsts: THREE.InstancedMesh[] = [];
    private glbCanopyInsts: THREE.InstancedMesh[] = [];

    // Lollipop Tree (separated trunk & canopy)
    private lolliTrunkInst!: THREE.InstancedMesh;
    private lolliCanopyInst!: THREE.InstancedMesh;

    // Bushes (2 varieties)
    private bushInsts: THREE.InstancedMesh[] = [];

    // Materials
    private trunkMat!: THREE.MeshToonMaterial;
    private canopyMat!: THREE.MeshToonMaterial;
    private lolliTrunkMat!: THREE.MeshToonMaterial;
    private lolliCanopyMat!: THREE.MeshToonMaterial;
    private bushMat!: THREE.MeshToonMaterial;

    // Public settings
    public treeScale = 1.5;
    public treeDensity = 200;
    public lollipopRatio = 0.25;
    public bushScale = 1.0;
    public bushDensity = 250;
    public activePresetKey: PresetKey = 'candy';

    // Internal state
    private lastX = -99999;
    private lastZ = -99999;
    private dirty = true;
    private ready = false;
    private currentEmissive = 0;
    private scene: THREE.Scene;
    private dummy = new THREE.Object3D();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    // ── Initialisation ─────────────────────────────────────────────────────────

    async init(): Promise<void> {
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
        gltfLoader.setDRACOLoader(dracoLoader);

        // Load 3 GLB tree models in parallel
        const [t1, t2, t3] = await Promise.all([
            loadTreeGeometries('/Assets/Cartoon/Cartoon_Trees_Tree_1.glb', gltfLoader),
            loadTreeGeometries('/Assets/Cartoon/Cartoon_Trees_Tree_2.glb', gltfLoader),
            loadTreeGeometries('/Assets/Cartoon/Cartoon_Trees_Tree_3.glb', gltfLoader),
        ]);
        const glbTrees = [t1, t2, t3];

        // ── Textures ───────────────────────────────────────────────────────────
        const swirlTex = createCandySwirlTexture();
        const stripeTex = createCandyStripeTexture();
        const sugarTex = createSugarSparkleTexture();

        // ── Materials (Different for trunk vs canopy) ──────────────────────────

        // Tree Trunk: candy-striped / smooth cream bark with subtle bloom
        this.trunkMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: stripeTex,
            gradientMap,
            emissive: new THREE.Color(0xfff0ea),
            emissiveIntensity: 0.08,
            dithering: true,
        });

        // Tree Canopy: swirl-textured candy canopy
        this.canopyMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: swirlTex,
            gradientMap,
            emissive: new THREE.Color(0xffddee),
            emissiveIntensity: 0.0,
            dithering: true,
        });

        // Lollipop Trunk: glowing white candy stick
        this.lolliTrunkMat = new THREE.MeshToonMaterial({
            color: 0xfffcf7,
            map: stripeTex,
            gradientMap,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.16,
            dithering: true,
        });

        // Lollipop Canopy: vibrant candy top with swirl
        this.lolliCanopyMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: swirlTex,
            gradientMap,
            emissive: new THREE.Color(0xffddee),
            emissiveIntensity: 0.0,
            dithering: true,
        });

        // Bush Material: sugar-crystal dithered sheen
        this.bushMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: sugarTex,
            gradientMap,
            emissive: new THREE.Color(0xffddee),
            emissiveIntensity: 0.0,
            dithering: true,
        });

        // Helper to setup InstancedMesh with pre-allocated color attribute
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

        // ── 3 GLB Tree InstancedMeshes (Trunk + Canopy separate) ───────────────

        for (let i = 0; i < 3; i++) {
            const trunkInst = setupInstMesh(glbTrees[i].trunkGeo, this.trunkMat, MAX_CAPACITY, true);
            const canopyInst = setupInstMesh(glbTrees[i].canopyGeo, this.canopyMat, MAX_CAPACITY, true);
            this.glbTrunkInsts.push(trunkInst);
            this.glbCanopyInsts.push(canopyInst);
        }

        // ── Lollipop Geometry ──────────────────────────────────────────────────

        const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 3.5, 8);
        trunkGeo.translate(0, 1.75, 0);
        trunkGeo.computeVertexNormals();

        const canopyGeo = new THREE.IcosahedronGeometry(1.8, 2);
        const cp = canopyGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < cp.count; i++) {
            const x = cp.getX(i);
            let y = cp.getY(i);
            const z = cp.getZ(i);
            y += Math.sin(x * 2.2) * Math.cos(z * 2.2) * 0.2;
            cp.setXYZ(i, x, y, z);
        }
        canopyGeo.computeVertexNormals();
        canopyGeo.translate(0, 4.5, 0);

        this.lolliTrunkInst = setupInstMesh(trunkGeo, this.lolliTrunkMat, MAX_CAPACITY, true);
        this.lolliCanopyInst = setupInstMesh(canopyGeo, this.lolliCanopyMat, MAX_CAPACITY, true);

        // ── Bush Geometries ────────────────────────────────────────────────────

        // Round bush: flattened icosahedron with billow
        const bushRoundGeo = new THREE.IcosahedronGeometry(1.4, 2);
        const brp = bushRoundGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < brp.count; i++) {
            const x = brp.getX(i);
            let y = brp.getY(i);
            const z = brp.getZ(i);
            y *= 0.6;
            if (y < 0) y *= 0.3;
            y += Math.max(0, Math.sin(x * 3) * Math.cos(z * 3) * 0.25);
            brp.setXYZ(i, x, y, z);
        }
        bushRoundGeo.computeVertexNormals();
        bushRoundGeo.translate(0, 0.4, 0);

        // Flat/wide bush: heavily squashed
        const bushFlatGeo = new THREE.IcosahedronGeometry(1.8, 2);
        const bfp = bushFlatGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < bfp.count; i++) {
            let x = bfp.getX(i);
            let y = bfp.getY(i);
            const z = bfp.getZ(i);
            x *= 1.3;
            y *= 0.35;
            if (y < 0) y *= 0.2;
            bfp.setXYZ(i, x, y, z);
        }
        bushFlatGeo.computeVertexNormals();
        bushFlatGeo.translate(0, 0.3, 0);

        for (const geo of [bushRoundGeo, bushFlatGeo]) {
            const inst = setupInstMesh(geo, this.bushMat, MAX_CAPACITY, false);
            this.bushInsts.push(inst);
        }

        this.ready = true;
        this.dirty = true;
    }

    // ── Per-Frame Update ───────────────────────────────────────────────────────

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

    // ── Twilight Glow ──────────────────────────────────────────────────────────

    updateGlow(dt: number, timePhase: number): void {
        if (!this.ready) return;
        const target = [0.0, 0.08, 0.35][timePhase] ?? 0.0;
        this.currentEmissive += (target - this.currentEmissive) * Math.min(1, dt * 2);

        this.trunkMat.emissiveIntensity = 0.08 + this.currentEmissive * 0.5;
        this.canopyMat.emissiveIntensity = this.currentEmissive;
        this.lolliTrunkMat.emissiveIntensity = 0.16 + this.currentEmissive;
        this.lolliCanopyMat.emissiveIntensity = this.currentEmissive;
        this.bushMat.emissiveIntensity = this.currentEmissive;
    }

    // ── Rebuild Instance Matrices and Colors ───────────────────────────────────

    private rebuild(px: number, pz: number): void {
        const preset = COLOR_PRESETS[this.activePresetKey] || COLOR_PRESETS.candy;
        const canopyColors = preset.canopyColors;
        const trunkColors = preset.trunkColors;

        // ── 1. Rebuild Trees ───────────────────────────────────────────────────

        const glbCounts = [0, 0, 0];
        let lolliCount = 0;

        if (this.treeDensity > 0) {
            const area = Math.PI * SPAWN_RADIUS * SPAWN_RADIUS;
            const treeGridSpacing = Math.max(12, Math.sqrt(area / this.treeDensity));

            const minCX = Math.floor((px - SPAWN_RADIUS) / treeGridSpacing);
            const maxCX = Math.ceil((px + SPAWN_RADIUS) / treeGridSpacing);
            const minCZ = Math.floor((pz - SPAWN_RADIUS) / treeGridSpacing);
            const maxCZ = Math.ceil((pz + SPAWN_RADIUS) / treeGridSpacing);

            for (let cx = minCX; cx <= maxCX; cx++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const rng = mulberry32(cellSeed(cx, cz, 101));

                    const x = (cx + 0.15 + rng() * 0.7) * treeGridSpacing;
                    const z = (cz + 0.15 + rng() * 0.7) * treeGridSpacing;

                    const ddx = x - px;
                    const ddz = z - pz;
                    if (ddx * ddx + ddz * ddz > SPAWN_RADIUS * SPAWN_RADIUS) continue;

                    // Strictly green lowland terrain (height 5.0 to 30.0)
                    const h = terrainHeightJS(x, z);
                    if (h < MIN_TREE_HEIGHT || h > MAX_TREE_HEIGHT) continue;

                    const rotation = rng() * Math.PI * 2;
                    const scaleVar = this.treeScale * (0.85 + rng() * 0.3);
                    const canopyColor = canopyColors[Math.floor(rng() * canopyColors.length)];
                    const trunkColor = trunkColors[Math.floor(rng() * trunkColors.length)];
                    const isLolli = rng() < this.lollipopRatio;

                    this.dummy.position.set(x, h, z);
                    this.dummy.rotation.set(0, rotation, 0);
                    this.dummy.scale.set(scaleVar, scaleVar, scaleVar);
                    this.dummy.updateMatrix();

                    if (isLolli) {
                        if (lolliCount < MAX_CAPACITY) {
                            this.lolliTrunkInst.setMatrixAt(lolliCount, this.dummy.matrix);
                            this.lolliTrunkInst.setColorAt(lolliCount, trunkColor);

                            this.lolliCanopyInst.setMatrixAt(lolliCount, this.dummy.matrix);
                            this.lolliCanopyInst.setColorAt(lolliCount, canopyColor);
                            lolliCount++;
                        }
                    } else {
                        const typeIdx = Math.floor(rng() * 3);
                        if (glbCounts[typeIdx] < MAX_CAPACITY) {
                            const idx = glbCounts[typeIdx];
                            this.glbTrunkInsts[typeIdx].setMatrixAt(idx, this.dummy.matrix);
                            this.glbTrunkInsts[typeIdx].setColorAt(idx, trunkColor);

                            this.glbCanopyInsts[typeIdx].setMatrixAt(idx, this.dummy.matrix);
                            this.glbCanopyInsts[typeIdx].setColorAt(idx, canopyColor);
                            glbCounts[typeIdx]++;
                        }
                    }
                }
            }
        }

        // Commit tree counts and update buffers
        for (let i = 0; i < 3; i++) {
            this.glbTrunkInsts[i].count = glbCounts[i];
            this.glbTrunkInsts[i].instanceMatrix.needsUpdate = true;
            if (this.glbTrunkInsts[i].instanceColor) this.glbTrunkInsts[i].instanceColor.needsUpdate = true;

            this.glbCanopyInsts[i].count = glbCounts[i];
            this.glbCanopyInsts[i].instanceMatrix.needsUpdate = true;
            if (this.glbCanopyInsts[i].instanceColor) this.glbCanopyInsts[i].instanceColor.needsUpdate = true;
        }

        this.lolliTrunkInst.count = lolliCount;
        this.lolliTrunkInst.instanceMatrix.needsUpdate = true;
        if (this.lolliTrunkInst.instanceColor) this.lolliTrunkInst.instanceColor.needsUpdate = true;

        this.lolliCanopyInst.count = lolliCount;
        this.lolliCanopyInst.instanceMatrix.needsUpdate = true;
        if (this.lolliCanopyInst.instanceColor) this.lolliCanopyInst.instanceColor.needsUpdate = true;

        // ── 2. Rebuild Independent Bushes ──────────────────────────────────────

        const bushCounts = [0, 0];

        if (this.bushDensity > 0) {
            const area = Math.PI * SPAWN_RADIUS * SPAWN_RADIUS;
            const bushGridSpacing = Math.max(10, Math.sqrt(area / this.bushDensity));

            const minBX = Math.floor((px - SPAWN_RADIUS) / bushGridSpacing);
            const maxBX = Math.ceil((px + SPAWN_RADIUS) / bushGridSpacing);
            const minBZ = Math.floor((pz - SPAWN_RADIUS) / bushGridSpacing);
            const maxBZ = Math.ceil((pz + SPAWN_RADIUS) / bushGridSpacing);

            for (let cx = minBX; cx <= maxBX; cx++) {
                for (let cz = minBZ; cz <= maxBZ; cz++) {
                    const rng = mulberry32(cellSeed(cx, cz, 404));

                    const x = (cx + 0.1 + rng() * 0.8) * bushGridSpacing;
                    const z = (cz + 0.1 + rng() * 0.8) * bushGridSpacing;

                    const ddx = x - px;
                    const ddz = z - pz;
                    if (ddx * ddx + ddz * ddz > SPAWN_RADIUS * SPAWN_RADIUS) continue;

                    const h = terrainHeightJS(x, z);
                    if (h < MIN_TREE_HEIGHT || h > MAX_TREE_HEIGHT) continue;

                    const bType = rng() < 0.5 ? 0 : 1;
                    if (bushCounts[bType] >= MAX_CAPACITY) continue;

                    const bScale = this.bushScale * (0.8 + rng() * 0.5);
                    const bColor = canopyColors[Math.floor(rng() * canopyColors.length)];

                    this.dummy.position.set(x, h, z);
                    this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
                    this.dummy.scale.set(bScale, bScale * 0.75, bScale);
                    this.dummy.updateMatrix();

                    const bIdx = bushCounts[bType];
                    this.bushInsts[bType].setMatrixAt(bIdx, this.dummy.matrix);
                    this.bushInsts[bType].setColorAt(bIdx, bColor);
                    bushCounts[bType]++;
                }
            }
        }

        // Commit bush counts
        for (let i = 0; i < 2; i++) {
            this.bushInsts[i].count = bushCounts[i];
            this.bushInsts[i].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[i].instanceColor) this.bushInsts[i].instanceColor.needsUpdate = true;
        }
    }

    // ── Public Setters ─────────────────────────────────────────────────────────

    setScale(s: number): void {
        this.treeScale = Math.max(0.5, Math.min(6.0, s));
        this.dirty = true;
    }

    setDensity(n: number): void {
        this.treeDensity = Math.max(0, Math.min(800, Math.round(n)));
        this.dirty = true;
    }

    setLollipopRatio(r: number): void {
        this.lollipopRatio = Math.max(0, Math.min(1, r));
        this.dirty = true;
    }

    setBushScale(s: number): void {
        this.bushScale = Math.max(0.5, Math.min(4.0, s));
        this.dirty = true;
    }

    setBushDensity(n: number): void {
        this.bushDensity = Math.max(0, Math.min(800, Math.round(n)));
        this.dirty = true;
    }

    setPreset(key: PresetKey): void {
        if (COLOR_PRESETS[key]) {
            this.activePresetKey = key;
            this.dirty = true;
        }
    }
}
