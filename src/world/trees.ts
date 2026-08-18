import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeightJS } from './noise';
import { gradientMap } from './terrain';

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAWN_RADIUS = 650;
const REBUILD_THRESHOLD = 20;
const MAX_PER_TYPE = 600;
const MAX_BUSH_PER_TYPE = 400;
const MIN_TREE_HEIGHT = 5.0;
const MAX_TREE_HEIGHT = 30.0;

const CANDY_COLORS: THREE.Color[] = [
    new THREE.Color(0xff77a9),  // pink
    new THREE.Color(0xff9ec6),  // light pink
    new THREE.Color(0xffb6d9),  // pale pink
    new THREE.Color(0xc77dff),  // purple
    new THREE.Color(0xa855f7),  // violet
    new THREE.Color(0xd8b4fe),  // lavender
    new THREE.Color(0x6ee7b7),  // mint
    new THREE.Color(0xa7f3d0),  // light mint
    new THREE.Color(0x34d399),  // emerald mint
    new THREE.Color(0xc4b5fd),  // periwinkle
    new THREE.Color(0xddd6fe),  // soft violet
    new THREE.Color(0xfde68a),  // lemon
    new THREE.Color(0xfbbf24),  // amber
    new THREE.Color(0xfb7185),  // coral
    new THREE.Color(0xfda4af),  // salmon
];

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

function cellSeed(cx: number, cz: number): number {
    let h = (cx * 73856093) ^ (cz * 19349663);
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    return Math.abs(h) | 1;
}

// ── GLB Geometry Loader ────────────────────────────────────────────────────────

async function loadTreeGeometry(url: string, loader: GLTFLoader): Promise<THREE.BufferGeometry> {
    const gltf = await loader.loadAsync(url);
    const geometries: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            if (!geo.getAttribute('normal')) geo.computeVertexNormals();

            // Strip to position + normal for clean instancing
            const clean = new THREE.BufferGeometry();
            clean.setAttribute('position', geo.getAttribute('position'));
            clean.setAttribute('normal', geo.getAttribute('normal'));
            if (geo.index) clean.setIndex(geo.index);
            geometries.push(clean);
        }
    });

    if (geometries.length === 0) throw new Error(`No mesh found in ${url}`);
    const merged = geometries.length === 1 ? geometries[0] : (mergeGeometries(geometries, false) || geometries[0]);

    // Normalize geometry: center X/Z, base bottom at Y = 0, target height ~ 6.0 units
    merged.computeBoundingBox();
    const box = merged.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const bottomY = box.min.y;
    merged.translate(-center.x, -bottomY, -center.z);

    if (size.y > 0.001) {
        const targetHeight = 6.0;
        const scaleFactor = targetHeight / size.y;
        merged.scale(scaleFactor, scaleFactor, scaleFactor);
    }
    merged.computeVertexNormals();
    return merged;
}

// ── TreeSystem ─────────────────────────────────────────────────────────────────

export class TreeSystem {
    // InstancedMeshes
    private glbInsts: THREE.InstancedMesh[] = [];
    private lolliTrunkInst!: THREE.InstancedMesh;
    private lolliCanopyInst!: THREE.InstancedMesh;
    private bushInsts: THREE.InstancedMesh[] = [];

    // Materials (stored for emissive control)
    private treeMat!: THREE.MeshToonMaterial;
    private trunkMat!: THREE.MeshToonMaterial;
    private canopyMat!: THREE.MeshToonMaterial;
    private bushMat!: THREE.MeshToonMaterial;

    // Public settings
    public treeScale = 1.5;
    public treeDensity = 200;
    public lollipopRatio = 0.25;

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

    // ── Initialisation (loads GLBs, creates all meshes) ────────────────────────

    async init(): Promise<void> {
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
        gltfLoader.setDRACOLoader(dracoLoader);

        // Load GLB tree geometries in parallel
        const [geo1, geo2, geo3] = await Promise.all([
            loadTreeGeometry('/Assets/Cartoon/Cartoon_Trees_Tree_1.glb', gltfLoader),
            loadTreeGeometry('/Assets/Cartoon/Cartoon_Trees_Tree_2.glb', gltfLoader),
            loadTreeGeometry('/Assets/Cartoon/Cartoon_Trees_Tree_3.glb', gltfLoader),
        ]);
        const glbGeos = [geo1, geo2, geo3];

        // ── Materials ──────────────────────────────────────────────────────────

        // Candy-tinted tree material (white base so instanceColor IS the color)
        this.treeMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            emissive: new THREE.Color(0xffddee),
            emissiveIntensity: 0.0,
            dithering: true,
        });

        // Lollipop trunk -- cream-white with subtle bloom glow
        this.trunkMat = new THREE.MeshToonMaterial({
            color: 0xfff8f0,
            gradientMap,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.12,
            dithering: true,
        });

        // Lollipop canopy -- colored by instanceColor
        this.canopyMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            emissive: new THREE.Color(0xffddee),
            emissiveIntensity: 0.0,
            dithering: true,
        });

        // Bush material
        this.bushMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
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

        // ── GLB Tree InstancedMeshes ───────────────────────────────────────────

        for (let i = 0; i < 3; i++) {
            const inst = setupInstMesh(glbGeos[i], this.treeMat, MAX_PER_TYPE, true);
            this.glbInsts.push(inst);
        }

        // ── Lollipop Geometry ──────────────────────────────────────────────────

        // Trunk: slim tapered cylinder, base at y=0
        const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 3.5, 8);
        trunkGeo.translate(0, 1.75, 0);
        trunkGeo.computeVertexNormals();

        // Canopy: deformed sphere for organic candy look, sitting on top of trunk
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

        this.lolliTrunkInst = setupInstMesh(trunkGeo, this.trunkMat, MAX_PER_TYPE, true);
        this.lolliCanopyInst = setupInstMesh(canopyGeo, this.canopyMat, MAX_PER_TYPE, true);

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
            const inst = setupInstMesh(geo, this.bushMat, MAX_BUSH_PER_TYPE, false);
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

    // ── Twilight Glow (call every frame, independent of rebuild) ───────────────

    updateGlow(dt: number, timePhase: number): void {
        if (!this.ready) return;
        const target = [0.0, 0.08, 0.35][timePhase] ?? 0.0;
        this.currentEmissive += (target - this.currentEmissive) * Math.min(1, dt * 2);

        this.treeMat.emissiveIntensity = this.currentEmissive;
        this.trunkMat.emissiveIntensity = 0.12 + this.currentEmissive;
        this.canopyMat.emissiveIntensity = this.currentEmissive;
        this.bushMat.emissiveIntensity = this.currentEmissive;
    }

    // ── Rebuild All Instance Matrices ──────────────────────────────────────────

    private rebuild(px: number, pz: number): void {
        // Zero density -- hide everything
        if (this.treeDensity <= 0) {
            for (const inst of this.glbInsts) inst.count = 0;
            this.lolliTrunkInst.count = 0;
            this.lolliCanopyInst.count = 0;
            for (const inst of this.bushInsts) inst.count = 0;
            return;
        }

        // Grid spacing derived from density -- gives Poisson-like spacing
        const area = Math.PI * SPAWN_RADIUS * SPAWN_RADIUS;
        const gridSpacing = Math.max(14, Math.sqrt(area / this.treeDensity));

        const glbCounts = [0, 0, 0];
        let lolliCount = 0;
        const bushCounts = [0, 0];

        const minCX = Math.floor((px - SPAWN_RADIUS) / gridSpacing);
        const maxCX = Math.ceil((px + SPAWN_RADIUS) / gridSpacing);
        const minCZ = Math.floor((pz - SPAWN_RADIUS) / gridSpacing);
        const maxCZ = Math.ceil((pz + SPAWN_RADIUS) / gridSpacing);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const rng = mulberry32(cellSeed(cx, cz));

                // Jitter position within cell (avoid edges for natural spacing)
                const x = (cx + 0.2 + rng() * 0.6) * gridSpacing;
                const z = (cz + 0.2 + rng() * 0.6) * gridSpacing;

                // Circular distance check
                const ddx = x - px;
                const ddz = z - pz;
                if (ddx * ddx + ddz * ddz > SPAWN_RADIUS * SPAWN_RADIUS) continue;

                // Green lowland terrain only (strictly height 5.0 to 30.0)
                const h = terrainHeightJS(x, z);
                if (h < MIN_TREE_HEIGHT || h > MAX_TREE_HEIGHT) continue;

                // Shared placement properties
                const rotation = rng() * Math.PI * 2;
                const scaleVar = this.treeScale * (0.85 + rng() * 0.3);
                const colorIdx = Math.floor(rng() * CANDY_COLORS.length);
                const isLolli = rng() < this.lollipopRatio;

                this.dummy.position.set(x, h, z);
                this.dummy.rotation.set(0, rotation, 0);
                this.dummy.scale.set(scaleVar, scaleVar, scaleVar);
                this.dummy.updateMatrix();

                if (isLolli) {
                    if (lolliCount < MAX_PER_TYPE) {
                        this.lolliTrunkInst.setMatrixAt(lolliCount, this.dummy.matrix);
                        this.lolliCanopyInst.setMatrixAt(lolliCount, this.dummy.matrix);
                        this.lolliCanopyInst.setColorAt(lolliCount, CANDY_COLORS[colorIdx]);
                        lolliCount++;
                    }
                } else {
                    const typeIdx = Math.floor(rng() * 3);
                    if (glbCounts[typeIdx] < MAX_PER_TYPE) {
                        const idx = glbCounts[typeIdx];
                        this.glbInsts[typeIdx].setMatrixAt(idx, this.dummy.matrix);
                        this.glbInsts[typeIdx].setColorAt(idx, CANDY_COLORS[colorIdx]);
                        glbCounts[typeIdx]++;
                    }
                }

                // Companion bush (40% chance, placed nearby on green lowland terrain)
                if (rng() < 0.4) {
                    const bType = rng() < 0.5 ? 0 : 1;
                    if (bushCounts[bType] < MAX_BUSH_PER_TYPE) {
                        const bx = x + (rng() - 0.5) * 12;
                        const bz = z + (rng() - 0.5) * 12;
                        const bh = terrainHeightJS(bx, bz);
                        if (bh >= MIN_TREE_HEIGHT && bh <= MAX_TREE_HEIGHT) {
                            const bScale = this.treeScale * 0.55 * (0.7 + rng() * 0.6);
                            this.dummy.position.set(bx, bh, bz);
                            this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
                            this.dummy.scale.set(bScale, bScale * 0.75, bScale);
                            this.dummy.updateMatrix();

                            const bIdx = bushCounts[bType];
                            this.bushInsts[bType].setMatrixAt(bIdx, this.dummy.matrix);
                            this.bushInsts[bType].setColorAt(bIdx, CANDY_COLORS[Math.floor(rng() * CANDY_COLORS.length)]);
                            bushCounts[bType]++;
                        }
                    }
                }
            }
        }

        // Commit instance counts and flag buffers dirty
        for (let i = 0; i < 3; i++) {
            this.glbInsts[i].count = glbCounts[i];
            this.glbInsts[i].instanceMatrix.needsUpdate = true;
            if (this.glbInsts[i].instanceColor) this.glbInsts[i].instanceColor.needsUpdate = true;
        }

        this.lolliTrunkInst.count = lolliCount;
        this.lolliTrunkInst.instanceMatrix.needsUpdate = true;
        this.lolliCanopyInst.count = lolliCount;
        this.lolliCanopyInst.instanceMatrix.needsUpdate = true;
        if (this.lolliCanopyInst.instanceColor) this.lolliCanopyInst.instanceColor.needsUpdate = true;

        for (let i = 0; i < 2; i++) {
            this.bushInsts[i].count = bushCounts[i];
            this.bushInsts[i].instanceMatrix.needsUpdate = true;
            if (this.bushInsts[i].instanceColor) this.bushInsts[i].instanceColor.needsUpdate = true;
        }
    }

    // ── Public Setters (trigger rebuild on next update) ────────────────────────

    setScale(s: number): void {
        this.treeScale = Math.max(0.5, Math.min(6.0, s));
        this.dirty = true;
    }

    setDensity(n: number): void {
        this.treeDensity = Math.max(0, Math.min(600, Math.round(n)));
        this.dirty = true;
    }

    setLollipopRatio(r: number): void {
        this.lollipopRatio = Math.max(0, Math.min(1, r));
        this.dirty = true;
    }
}
