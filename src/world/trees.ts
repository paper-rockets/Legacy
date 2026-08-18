import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeightJS } from './noise';
import { gradientMap } from './terrain';

// ── Constants ──────────────────────────────────────────────────────────────────

const SPAWN_RADIUS = 700;
const REBUILD_THRESHOLD = 20;
const MAX_CAPACITY = 800;
const MIN_TREE_HEIGHT = 4.5;
const MAX_TREE_HEIGHT = 24.0;

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
            new THREE.Color(0xff3388),  // vibrant candy pink
            new THREE.Color(0xff66bb),  // bright bubblegum
            new THREE.Color(0xb537f2),  // vivid purple
            new THREE.Color(0x8b22ff),  // electric violet
            new THREE.Color(0x38bdf8),  // electric sky blue
            new THREE.Color(0x10b981),  // vibrant mint green
            new THREE.Color(0xfacc15),  // lemon drop
            new THREE.Color(0xf97316),  // orange taffy
            new THREE.Color(0xf43f5e),  // cherry candy
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // glowing sugar white
            new THREE.Color(0xfff3e0),  // vanilla cream
            new THREE.Color(0xffe4e6),  // marshmallow pink
            new THREE.Color(0xe2e8f0),  // frosted silver
        ],
    },
    cotton: {
        name: 'Cotton Candy',
        canopyColors: [
            new THREE.Color(0x38bdf8),  // vibrant sky blue
            new THREE.Color(0x60a5fa),  // cornflower blue
            new THREE.Color(0xf472b6),  // hot cotton pink
            new THREE.Color(0xec4899),  // sweet magenta
            new THREE.Color(0xc084fc),  // bright lilac
            new THREE.Color(0xfb923c),  // peach glaze
            new THREE.Color(0xfde047),  // lemon sugar
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // pure sugar white
            new THREE.Color(0xffeef5),  // lavender white
            new THREE.Color(0xe0f2fe),  // ice blue white
        ],
    },
    lollipop: {
        name: 'Lollipop',
        canopyColors: [
            new THREE.Color(0xef4444),  // bright cherry red
            new THREE.Color(0xf97316),  // neon orange
            new THREE.Color(0x84cc16),  // sour apple lime
            new THREE.Color(0x06b6d4),  // electric cyan
            new THREE.Color(0x9333ea),  // grape purple
            new THREE.Color(0xf43f5e),  // ruby strawberry
            new THREE.Color(0xeab308),  // bright lemon
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // white sugar stick
            new THREE.Color(0xffedd5),  // toasted sugar
            new THREE.Color(0xffd1dc),  // candy cane pink
            new THREE.Color(0x78350f),  // dark chocolate
        ],
    },
    mints: {
        name: 'Mints',
        canopyColors: [
            new THREE.Color(0x10b981),  // rich spearmint
            new THREE.Color(0x34d399),  // vibrant mint
            new THREE.Color(0x2dd4bf),  // electric turquoise
            new THREE.Color(0x06b6d4),  // bright cyan
            new THREE.Color(0x38bdf8),  // cool ice blue
            new THREE.Color(0x059669),  // deep peppermint
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // frosted white
            new THREE.Color(0xd1fae5),  // mint cream
            new THREE.Color(0xe0f2fe),  // icy white
        ],
    },
    berry: {
        name: 'Berry',
        canopyColors: [
            new THREE.Color(0xe11d48),  // wild raspberry
            new THREE.Color(0xbe185d),  // dark strawberry
            new THREE.Color(0x9333ea),  // wild berry violet
            new THREE.Color(0x4f46e5),  // blueberry indigo
            new THREE.Color(0xc026d3),  // sweet plum
            new THREE.Color(0xf43f5e),  // candied cranberry
        ],
        trunkColors: [
            new THREE.Color(0xffffff),  // cream white
            new THREE.Color(0xfce7f3),  // berry milk
            new THREE.Color(0x581c87),  // blackberry wood
            new THREE.Color(0x451a03),  // rich chocolate
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
                ctx.fillStyle = 'rgba(255, 230, 245, 0.65)';
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

    ctx.strokeStyle = 'rgba(255, 215, 230, 0.55)';
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
            const name = (mesh.name || (mesh.parent ? mesh.parent.name : '')).toLowerCase();

            // Filter out glitch base blobs and terrain discs (crone, spheres, unnamed)
            if (name.includes('crone') || name.startsWith('spheres') || !mesh.name || mesh.name.trim() === '') {
                return;
            }

            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            if (!geo.getAttribute('normal')) geo.computeVertexNormals();

            const clean = new THREE.BufferGeometry();
            clean.setAttribute('position', geo.getAttribute('position'));
            clean.setAttribute('normal', geo.getAttribute('normal'));
            if (geo.index) clean.setIndex(geo.index);

            if (name.includes('wood') || name.includes('stick') || name.includes('trunk') || name.includes('branch')) {
                trunkGeos.push(clean);
            } else if (name.includes('sphere') || name.includes('leaf') || name.includes('leaves') || name.includes('canopy')) {
                canopyGeos.push(clean);
            }
        }
    });

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
    // 3 GLB Tree Types (Separated Trunk & Canopy)
    private glbTrunkInsts: THREE.InstancedMesh[] = [];
    private glbCanopyInsts: THREE.InstancedMesh[] = [];

    // Bushes (2 varieties)
    private bushInsts: THREE.InstancedMesh[] = [];

    // Materials
    private trunkMat!: THREE.MeshToonMaterial;
    private canopyMat!: THREE.MeshToonMaterial;
    private bushMat!: THREE.MeshToonMaterial;

    // Emissive Glow Uniforms (Dynamic Vibrant Self-Illumination at Night)
    private canopyGlowUniform = { value: 0.2 };
    private trunkGlowUniform = { value: 0.1 };
    private bushGlowUniform = { value: 0.2 };

    // Public settings (defaults: scale 600%, density 800, bush scale 100%, bush density 250)
    public treeScale = 6.0;
    public treeDensity = 800;
    public bushScale = 1.0;
    public bushDensity = 250;
    public glowMultiplier = 1.0;
    public activePresetKey: PresetKey = 'candy';

    // Internal state
    private lastX = -99999;
    private lastZ = -99999;
    private dirty = true;
    private ready = false;
    private currentGlow = 0.2;
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

        // Strictly load only the 3 Cartoon tree GLB models
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

        // ── Materials with Instance Color Glow Shaders ─────────────────────────

        // Tree Trunk Material
        this.trunkMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: stripeTex,
            gradientMap,
            dithering: true,
        });
        this.trunkMat.onBeforeCompile = (shader) => {
            shader.uniforms.uGlowIntensity = this.trunkGlowUniform;
            shader.fragmentShader = `uniform float uGlowIntensity;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    totalEmissiveRadiance += vInstanceColor.rgb * (uGlowIntensity * 0.4);
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * (uGlowIntensity * 0.4);
                #endif
                `
            );
        };

        // Tree Canopy Material
        this.canopyMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: swirlTex,
            gradientMap,
            dithering: true,
        });
        this.canopyMat.onBeforeCompile = (shader) => {
            shader.uniforms.uGlowIntensity = this.canopyGlowUniform;
            shader.fragmentShader = `uniform float uGlowIntensity;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    totalEmissiveRadiance += vInstanceColor.rgb * uGlowIntensity;
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * uGlowIntensity;
                #endif
                `
            );
        };

        // Bush Material
        this.bushMat = new THREE.MeshToonMaterial({
            color: 0xffffff,
            map: sugarTex,
            gradientMap,
            dithering: true,
        });
        this.bushMat.onBeforeCompile = (shader) => {
            shader.uniforms.uGlowIntensity = this.bushGlowUniform;
            shader.fragmentShader = `uniform float uGlowIntensity;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                #ifdef USE_INSTANCING_COLOR
                    totalEmissiveRadiance += vInstanceColor.rgb * uGlowIntensity;
                #else
                    totalEmissiveRadiance += diffuseColor.rgb * uGlowIntensity;
                #endif
                `
            );
        };

        // Helper to setup InstancedMesh with pre-allocated instanceColor attribute
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

    // ── Twilight & Night Glow (Glow stick radiance at night) ─────────────────

    updateGlow(dt: number, timePhase: number): void {
        if (!this.ready) return;
        // Day (0): 0.15 (crisp daytime candy luminescence)
        // Dusk (1): 0.50 (warm twilight glow)
        // Twilight / Night (2): 1.25 (vibrant neon glow stick radiance)
        const baseTarget = [0.15, 0.50, 1.25][timePhase] ?? 0.15;
        const target = baseTarget * this.glowMultiplier;
        this.currentGlow += (target - this.currentGlow) * Math.min(1, dt * 2.5);

        this.canopyGlowUniform.value = this.currentGlow;
        this.trunkGlowUniform.value = this.currentGlow * 0.65;
        this.bushGlowUniform.value = this.currentGlow;
    }

    // ── Rebuild Instance Matrices and Colors ───────────────────────────────────

    private rebuild(px: number, pz: number): void {
        const preset = COLOR_PRESETS[this.activePresetKey] || COLOR_PRESETS.candy;
        const canopyColors = preset.canopyColors;
        const trunkColors = preset.trunkColors;

        // ── 1. Rebuild Trees (Only the 3 Cartoon Trees) ─────────────────────────

        const glbCounts = [0, 0, 0];

        if (this.treeDensity > 0) {
            const area = Math.PI * SPAWN_RADIUS * SPAWN_RADIUS;
            const treeGridSpacing = Math.max(14, Math.sqrt(area / this.treeDensity));

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

                    // Strictly green lowland valleys and plains (height 4.5 to 24.0)
                    const h = terrainHeightJS(x, z);
                    if (h < MIN_TREE_HEIGHT || h > MAX_TREE_HEIGHT) continue;

                    const rotation = rng() * Math.PI * 2;
                    const scaleVar = this.treeScale * (0.85 + rng() * 0.3);
                    const canopyColor = canopyColors[Math.floor(rng() * canopyColors.length)];
                    const trunkColor = trunkColors[Math.floor(rng() * trunkColors.length)];

                    this.dummy.position.set(x, h, z);
                    this.dummy.rotation.set(0, rotation, 0);
                    this.dummy.scale.set(scaleVar, scaleVar, scaleVar);
                    this.dummy.updateMatrix();

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

        // Commit tree counts and update GPU buffers
        for (let i = 0; i < 3; i++) {
            this.glbTrunkInsts[i].count = glbCounts[i];
            this.glbTrunkInsts[i].instanceMatrix.needsUpdate = true;
            if (this.glbTrunkInsts[i].instanceColor) this.glbTrunkInsts[i].instanceColor.needsUpdate = true;

            this.glbCanopyInsts[i].count = glbCounts[i];
            this.glbCanopyInsts[i].instanceMatrix.needsUpdate = true;
            if (this.glbCanopyInsts[i].instanceColor) this.glbCanopyInsts[i].instanceColor.needsUpdate = true;
        }

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

    setBushScale(s: number): void {
        this.bushScale = Math.max(0.5, Math.min(4.0, s));
        this.dirty = true;
    }

    setBushDensity(n: number): void {
        this.bushDensity = Math.max(0, Math.min(800, Math.round(n)));
        this.dirty = true;
    }

    setGlowMultiplier(m: number): void {
        this.glowMultiplier = Math.max(0.0, Math.min(2.5, m));
    }

    setPreset(key: PresetKey): void {
        if (COLOR_PRESETS[key]) {
            this.activePresetKey = key;
            this.dirty = true;
        }
    }
}
