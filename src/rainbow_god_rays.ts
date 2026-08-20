import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
    RainbowSpectralPass,
    BiomeVolumetricRayPillar,
    SpectralParticleSystem,
    RAINBOW_PALETTES
} from './world/rainbowGodRays';
import {
    FacetedCrystalCloud,
    GroundCrystalFormations,
    CloudRainbowRays,
    setupFacetedBarycentricGeometry
} from './world/volumetricClouds';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// ── Simplex Noise Engine ────────────────────────────────────────────────────
const perm = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
    perm[i] = ((i * 137 + 43) ^ (i * 31)) & 255;
}

function snoise(x: number, z: number): number {
    let n0 = 0.0, n1 = 0.0, n2 = 0.0;
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (x + z) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(z + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Z0 = j - t;
    const x0 = x - X0;
    const z0 = z - Z0;
    let i1 = 0, j1 = 0;
    if (x0 > z0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const z1 = z0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const z2 = z0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    let t0 = 0.5 - x0 * x0 - z0 * z0;
    if (t0 < 0) n0 = 0.0;
    else {
        t0 *= t0;
        n0 = t0 * t0 * (x0 * (gi0 > 5 ? 1 : -1) + z0 * (gi0 % 2 === 0 ? 1 : -1));
    }

    let t1 = 0.5 - x1 * x1 - z1 * z1;
    if (t1 < 0) n1 = 0.0;
    else {
        t1 *= t1;
        n1 = t1 * t1 * (x1 * (gi1 > 5 ? 1 : -1) + z1 * (gi1 % 2 === 0 ? 1 : -1));
    }

    let t2 = 0.5 - x2 * x2 - z2 * z2;
    if (t2 < 0) n2 = 0.0;
    else {
        t2 *= t2;
        n2 = t2 * t2 * (x2 * (gi2 > 5 ? 1 : -1) + z2 * (gi2 % 2 === 0 ? 1 : -1));
    }

    return 70.0 * (n0 + n1 + n2);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// ── Biome Profiles ──────────────────────────────────────────────────────────
export interface BiomeProfile {
    id: string;
    name: string;
    description: string;
    beaconPos: THREE.Vector3;
    cameraPos: THREE.Vector3;
    cameraTarget: THREE.Vector3;
    sunElevation: number;
    sunAzimuth: number;
    skyTop: string;
    skyHorizon: string;
    palette: string;
    heightFn: (x: number, z: number) => number;
    colorFn: (x: number, y: number, z: number, normal: THREE.Vector3) => THREE.Color;
}

export const BIOMES: Record<string, BiomeProfile> = {
    meadow: {
        id: 'meadow',
        name: 'Lush Meadow',
        description: 'Vast emerald pasture stretching to the horizon under a towering rainbow storm cloud',
        beaconPos: new THREE.Vector3(0, 16, 0),
        cameraPos: new THREE.Vector3(0, 16, 25),
        cameraTarget: new THREE.Vector3(0, 52, -140),
        sunElevation: 30,
        sunAzimuth: 180,
        skyTop: '#162d73',
        skyHorizon: '#3b82c4',
        palette: 'Spectral Prismatic',
        heightFn: (x, z) => {
            const h1 = snoise(x * 0.002, z * 0.002) * 12.0 + 10.0;
            const h2 = snoise(x * 0.006 + 50, z * 0.006 + 50) * 4.0;
            return Math.max(2.0, h1 + h2);
        },
        colorFn: (x, y, z, norm) => {
            const slope = 1.0 - Math.max(0, norm.y);
            const brightGrass = new THREE.Color('#4ade80');
            const deepGrass = new THREE.Color('#15803d');
            const soil = new THREE.Color('#78350f');

            let col = brightGrass.clone().lerp(deepGrass, smoothstep(6, 20, y));
            if (slope > 0.35) col.lerp(soil, smoothstep(0.35, 0.75, slope));
            return col;
        }
    },
    candyland: {
        id: 'candyland',
        name: 'Candyland',
        description: 'Pastel marshmallow dunes, cotton candy ridges, and sugar swirls',
        beaconPos: new THREE.Vector3(0, 24, 0),
        cameraPos: new THREE.Vector3(0, 28, 45),
        cameraTarget: new THREE.Vector3(0, 50, -100),
        sunElevation: 32,
        sunAzimuth: 180,
        skyTop: '#d946ef',
        skyHorizon: '#fed7aa',
        palette: 'Auroral Pastel',
        heightFn: (x, z) => {
            const broad = snoise(x * 0.0025, z * 0.0025) * 20.0 + 16.0;
            const marshmallow = Math.sin(x * 0.008) * Math.cos(z * 0.008) * 7.0;
            return Math.max(3.0, broad + marshmallow);
        },
        colorFn: (x, y, z) => {
            const pink = new THREE.Color('#f472b6');
            const cyan = new THREE.Color('#7dd3fc');
            const cream = new THREE.Color('#fffbf5');
            const swirlVal = snoise(x * 0.01, z * 0.01);
            let col = cream.clone();
            if (swirlVal > 0.1) col.lerp(pink, 0.6);
            else col.lerp(cyan, 0.6);
            return col;
        }
    },
    geothermal: {
        id: 'geothermal',
        name: 'Geothermal Ridge',
        description: 'Obsidian terraced volcanic cliffs and bubbling mineral calderas',
        beaconPos: new THREE.Vector3(0, 30, 0),
        cameraPos: new THREE.Vector3(0, 36, 60),
        cameraTarget: new THREE.Vector3(0, 52, -90),
        sunElevation: 24,
        sunAzimuth: 195,
        skyTop: '#0f172a',
        skyHorizon: '#ea580c',
        palette: 'Solar Prism',
        heightFn: (x, z) => {
            const base = snoise(x * 0.003, z * 0.003) * 32.0 + 22.0;
            return Math.max(2.0, base);
        },
        colorFn: (x, y, z, norm) => {
            const slope = 1.0 - Math.max(0, norm.y);
            const obsidian = new THREE.Color('#18181b');
            const sulfur = new THREE.Color('#eab308');
            let col = obsidian.clone();
            if (slope < 0.25) col.lerp(sulfur, 0.45);
            return col;
        }
    },
    redwood: {
        id: 'redwood',
        name: 'Colossal Redwood',
        description: 'Towering mountain slopes, grand pine ridges, and deep mossy earth',
        beaconPos: new THREE.Vector3(0, 40, 0),
        cameraPos: new THREE.Vector3(0, 48, 70),
        cameraTarget: new THREE.Vector3(0, 55, -80),
        sunElevation: 28,
        sunAzimuth: 175,
        skyTop: '#064e3b',
        skyHorizon: '#6ee7b7',
        palette: 'Cosmic Opal',
        heightFn: (x, z) => {
            const ridge = snoise(x * 0.002, z * 0.002) * 45.0 + 30.0;
            return Math.max(4.0, ridge);
        },
        colorFn: (x, y, z, norm) => {
            const moss = new THREE.Color('#15803d');
            const pineBark = new THREE.Color('#451a03');
            let col = moss.clone();
            if (norm.y < 0.75) col.lerp(pineBark, 0.6);
            return col;
        }
    },
    archipelago: {
        id: 'archipelago',
        name: 'Floating Archipelago',
        description: 'Soaring emerald spires and high-altitude floating plateaus',
        beaconPos: new THREE.Vector3(0, 50, 0),
        cameraPos: new THREE.Vector3(0, 60, 80),
        cameraTarget: new THREE.Vector3(0, 60, -70),
        sunElevation: 34,
        sunAzimuth: 185,
        skyTop: '#0284c7',
        skyHorizon: '#bae6fd',
        palette: 'Neon Aurora',
        heightFn: (x, z) => {
            const spire = Math.pow(Math.max(0, snoise(x * 0.003, z * 0.003) * 0.5 + 0.5), 2.2) * 75.0;
            return Math.max(1.0, spire);
        },
        colorFn: (x, y, z, norm) => {
            const grass = new THREE.Color('#22c55e');
            const cliff = new THREE.Color('#475569');
            let col = grass.clone();
            if (norm.y < 0.7) col.lerp(cliff, 0.75);
            return col;
        }
    },
    estuary: {
        id: 'estuary',
        name: 'Bioluminescent Estuary',
        description: 'Shallow crystal waters, sandbars, and twilight bioluminescence',
        beaconPos: new THREE.Vector3(0, 10, 0),
        cameraPos: new THREE.Vector3(0, 18, 35),
        cameraTarget: new THREE.Vector3(0, 45, -110),
        sunElevation: 18,
        sunAzimuth: 195,
        skyTop: '#1e1b4b',
        skyHorizon: '#06b6d4',
        palette: 'Fairy Mist',
        heightFn: (x, z) => {
            const flats = snoise(x * 0.002, z * 0.002) * 7.0 + 5.0;
            return Math.max(0.5, flats);
        },
        colorFn: (x, y, z) => {
            const sand = new THREE.Color('#fef08a');
            const wetSand = new THREE.Color('#0d9488');
            let col = sand.clone();
            if (y < 3.5) col.lerp(wetSand, 0.7);
            return col;
        }
    },
    sky_citadel: {
        id: 'sky_citadel',
        name: 'Cloud Citadel',
        description: 'High celestial cloud sanctuary with golden light and pearl mist',
        beaconPos: new THREE.Vector3(0, 75, 0),
        cameraPos: new THREE.Vector3(0, 85, 95),
        cameraTarget: new THREE.Vector3(0, 75, -70),
        sunElevation: 38,
        sunAzimuth: 180,
        skyTop: '#4338ca',
        skyHorizon: '#fde047',
        palette: 'Spectral Prismatic',
        heightFn: (x, z) => {
            const cloudTerrace = snoise(x * 0.002, z * 0.002) * 40.0 + 60.0;
            return Math.max(30.0, cloudTerrace);
        },
        colorFn: (x, y, z, norm) => {
            const gold = new THREE.Color('#f59e0b');
            const pearl = new THREE.Color('#ffffff');
            let col = pearl.clone();
            if (norm.y > 0.8) col.lerp(gold, 0.35);
            return col;
        }
    },
    prism_sanctum: {
        id: 'prism_sanctum',
        name: 'Prism Sanctum',
        description: 'Luminous rolling crystal hills with glowing gemstone veins, glass spires, and clear walking paths',
        beaconPos: new THREE.Vector3(0, 32, 0),
        cameraPos: new THREE.Vector3(0, 34, 55),
        cameraTarget: new THREE.Vector3(0, 48, -90),
        sunElevation: 26,
        sunAzimuth: 180,
        skyTop: '#0f172a',
        skyHorizon: '#38bdf8',
        palette: 'Spectral Prismatic',
        heightFn: (x, z) => {
            const distCenter = Math.hypot(x, z);
            const dMainAxis = Math.abs(x - Math.sin(z * 0.007) * 42.0);
            const dCrossAxis = Math.abs(z - Math.cos(x * 0.006) * 48.0);
            const dRing1 = Math.abs(distCenter - 130.0);
            const dRing2 = Math.abs(distCenter - 270.0);
            const dDiag1 = Math.abs(x - z) * 0.7071;
            const dDiag2 = Math.abs(x + z) * 0.7071;
            let pathDist = Math.min(dMainAxis, dCrossAxis, dRing1, dRing2, dDiag1, dDiag2);
            if (distCenter < 36.0) pathDist = 0.0;

            const broadHills = snoise(x * 0.0032, z * 0.0032) * 32.0 + 26.0;
            const midHills = snoise(x * 0.0075 + 80.0, z * 0.0075 - 80.0) * 14.0;
            const rollingDetail = snoise(x * 0.016 + 140.0, z * 0.016 + 90.0) * 5.0;
            const hillRidges = (1.0 - Math.abs(snoise(x * 0.005 + 120.0, z * 0.005 - 120.0))) * 18.0;
            const rawHillHeight = broadHills + midHills + rollingDetail + hillRidges;

            const pathBaseHeight = snoise(x * 0.0032, z * 0.0032) * 24.0 + 20.0;
            const pathMask = smoothstep(18.0, 5.0, pathDist);
            const finalHeight = rawHillHeight * (1.0 - pathMask * 0.75) + pathBaseHeight * (pathMask * 0.75);

            return Math.max(6.0, finalHeight);
        },
        colorFn: (x, y, z, norm) => {
            const slope = 1.0 - Math.max(0, norm.y);
            const obsidian = new THREE.Color('#0b0f19');
            const crystalVeinCyan = new THREE.Color('#38bdf8');
            const crystalVeinMagenta = new THREE.Color('#f472b6');
            const crystalAmethyst = new THREE.Color('#a855f7');

            const veinNoise = snoise(x * 0.025, z * 0.025);
            let col = obsidian.clone();
            if (Math.abs(veinNoise) < 0.15) {
                const veinBlend = smoothstep(0.15, 0.0, Math.abs(veinNoise));
                const veinColor = veinNoise > 0 ? crystalVeinCyan : crystalVeinMagenta;
                col.lerp(veinColor, veinBlend * 0.9);
            } else if (slope > 0.35) {
                col.lerp(crystalAmethyst, smoothstep(0.35, 0.75, slope) * 0.55);
            }
            return col;
        }
    }
};

// ── Application Master Class ────────────────────────────────────────────────
export class RainbowGodRaysApp {
    public container: HTMLElement;
    public renderer: THREE.WebGLRenderer;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public controls: OrbitControls;
    public composer: EffectComposer;
    public renderPass: RenderPass;
    public bloomPass: UnrealBloomPass;
    public rainbowPass: RainbowSpectralPass;

    // World Elements
    public terrainMesh!: THREE.Mesh;
    public waterMesh!: THREE.Mesh;
    public sunMesh!: THREE.Mesh;
    public sunLight!: THREE.DirectionalLight;
    public hemiLight!: THREE.HemisphereLight;
    public ambientLight!: THREE.AmbientLight;
    public skyDome!: THREE.Mesh;

    // 3D Volumetric Cloud & Ray Systems
    public crystalCloud!: FacetedCrystalCloud;
    public groundCrystals!: GroundCrystalFormations;
    public cloudRainbowRays!: CloudRainbowRays;
    public volumetricPillar!: BiomeVolumetricRayPillar;
    public particleSystem!: SpectralParticleSystem;
    public citadelGroup!: THREE.Group;

    // App State & Modes
    public activeBiomeId: string = 'meadow';
    public activePresetMode: 'photo_crepuscular' | 'celestial_beacon' | 'hybrid' = 'photo_crepuscular';
    public cameraMode: 'ground' | 'orbit' | 'cinematic' | 'beacon' = 'ground';

    public isCloudAndRaysVisible: boolean = true;
    public isRayPillarVisible: boolean = false;
    public isScreenRayVisible: boolean = true;
    public isParticlesVisible: boolean = false;

    private clock = new THREE.Clock();
    private cinematicAngle: number = 0;
    private targetCameraPos = new THREE.Vector3();
    private targetLookAt = new THREE.Vector3();
    private isTransitioning: boolean = false;
    private transitionProgress: number = 1.0;
    private startCameraPos = new THREE.Vector3();
    private startLookAt = new THREE.Vector3();

    constructor(container: HTMLElement) {
        this.container = container;

        // 1. Scene & Camera Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.5, 3000);
        // Horizon Vista looking directly at the towering cloud and rainbow shafts
        this.camera.position.set(0, 16, 25);

        // 2. High Performance WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.78;
        this.container.appendChild(this.renderer.domElement);

        // 3. Orbit Controls (Cloned exact movement parameters from the game)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.045;
        this.controls.rotateSpeed = 0.45;
        this.controls.zoomSpeed = 0.60;
        this.controls.panSpeed = 0.45;
        // Allow the camera to sit low and tilt up at the towering cloud; clamping at
        // the horizon would snap "Horizon Vista" back to eye level and flatten the shot.
        this.controls.maxPolarAngle = Math.PI * 0.85;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 600;
        this.controls.target.set(0, 52, -140);

        // 4. Sky & Lighting Setup
        this.initSkyAndLighting();

        // 5. Post-Processing Pipeline
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.42,
            0.70,
            0.88
        );
        this.composer.addPass(this.bloomPass);

        this.rainbowPass = new RainbowSpectralPass(
            this.scene,
            this.camera,
            this.sunMesh,
            window.innerWidth,
            window.innerHeight
        );
        this.rainbowPass.renderToScreen = true;
        this.composer.addPass(this.rainbowPass);

        // 6. World Generation
        this.initTerrain();
        this.initWater();
        this.initVolumetricCloudAndRainbowRays();

        // Apply default preset: Photo-Realistic Panoramic Crepuscular Rays
        this.applyPresetMode('photo_crepuscular');

        // 7. Event Listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // 8. Start Loop
        this.animate();
    }

    private initSkyAndLighting() {
        // Sun Mesh (Emitter positioned behind the towering cloud)
        const sunGeo = new THREE.SphereGeometry(24, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.sunMesh.position.set(0, 140, -250);
        this.scene.add(this.sunMesh);

        // Strong Directional Sunlight for crisp facet illumination and shadow contrast
        this.sunLight = new THREE.DirectionalLight(0xfffaee, 3.2);
        this.sunLight.position.copy(this.sunMesh.position);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 20;
        this.sunLight.shadow.camera.far = 850;
        this.sunLight.shadow.camera.left = -220;
        this.sunLight.shadow.camera.right = 220;
        this.sunLight.shadow.camera.top = 220;
        this.sunLight.shadow.camera.bottom = -220;
        this.sunLight.shadow.bias = -0.0002;
        this.sunLight.shadow.normalBias = 0.04;
        this.scene.add(this.sunLight);

        // Ambient & Hemisphere Lighting
        this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.40);
        this.scene.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0xbfdbfe, 0x166534, 0.50);
        this.scene.add(this.hemiLight);

        // Dynamic Shader-Driven Ghibli-Inspired Sky Dome with Procedural Toon Clouds
        const skyGeo = new THREE.SphereGeometry(1400, 32, 16);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                uTopColor: { value: new THREE.Color('#162d73') },
                uMidColor: { value: new THREE.Color('#38bdf8') },
                uHorizonColor: { value: new THREE.Color('#fed7aa') },
                uSunPos: { value: this.sunMesh.position },
                uSunColor: { value: new THREE.Color('#fff7ed') },
                uTime: { value: 0.0 }
            },
            vertexShader: /* glsl */ `
                varying vec3 vWorldPos;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uTopColor;
                uniform vec3 uMidColor;
                uniform vec3 uHorizonColor;
                uniform vec3 uSunPos;
                uniform vec3 uSunColor;
                uniform float uTime;

                varying vec3 vWorldPos;

                // Ghibli Cloud Procedural Noise Functions
                float hash2D(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }

                float noise2D(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash2D(i + vec2(0.0, 0.0)), hash2D(i + vec2(1.0, 0.0)), u.x),
                               mix(hash2D(i + vec2(0.0, 1.0)), hash2D(i + vec2(1.0, 1.0)), u.x), u.y);
                }

                float fbm2D(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                    for (int i = 0; i < 5; i++) {
                        v += a * noise2D(p);
                        p = rot * p * 2.0 + vec2(100.0);
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    vec3 dir = normalize(vWorldPos);
                    float h = clamp(dir.y, 0.0, 1.0);

                    // 1. Ghibli 3-Tier Anime Sky Gradient
                    vec3 skyBase = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.35, h));
                    skyBase = mix(skyBase, uTopColor, smoothstep(0.35, 0.95, h));

                    // Luminous warm horizon haze band
                    float haze = pow(1.0 - h, 5.0);
                    skyBase = mix(skyBase, vec3(1.0, 0.94, 0.88), haze * 0.42);

                    // 2. Procedural Stylized Ghibli Cumulus Clouds
                    if (dir.y > 0.02) {
                        vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.8;
                        vec2 wind = vec2(uTime * 0.012, uTime * 0.006);

                        vec2 q = vec2(fbm2D(cloudUv + wind), fbm2D(cloudUv + vec2(5.2, 1.3) + wind));
                        vec2 r = vec2(fbm2D(cloudUv + 4.0 * q + vec2(1.7, 9.2)), fbm2D(cloudUv + 4.0 * q + vec2(8.3, 2.8)));
                        float cloudNoise = fbm2D(cloudUv + 4.0 * r + wind * 0.5);

                        float cloudCoverage = 0.46;
                        float cloudDensity = smoothstep(1.0 - cloudCoverage, 1.0, cloudNoise);

                        if (cloudDensity > 0.01) {
                            vec3 sunDir = normalize(uSunPos);
                            float sunDot = max(0.0, dot(dir, sunDir));

                            vec3 cloudHighlight = vec3(1.0, 0.98, 0.94);
                            vec3 cloudMidtone = mix(vec3(0.92, 0.95, 1.0), vec3(1.0, 0.92, 0.86), sunDot * 0.5);
                            vec3 cloudShadow = mix(vec3(0.40, 0.45, 0.65), vec3(0.55, 0.50, 0.68), 0.5);

                            vec3 cloudColor = mix(cloudShadow, cloudMidtone, smoothstep(0.15, 0.55, cloudDensity));
                            cloudColor = mix(cloudColor, cloudHighlight, smoothstep(0.55, 0.90, cloudDensity));

                            // Silver lining around sun
                            float silverLining = pow(sunDot, 12.0) * smoothstep(0.05, 0.4, cloudDensity) * (1.0 - smoothstep(0.7, 0.95, cloudDensity));
                            cloudColor += vec3(1.0, 0.96, 0.88) * silverLining * 2.0;

                            float horizonFade = smoothstep(0.02, 0.22, dir.y);
                            float alpha = cloudDensity * horizonFade * 0.92;

                            skyBase = mix(skyBase, cloudColor, alpha);
                        }
                    }

                    // 3. Sun Disc & Atmospheric Aura
                    vec3 sunDir = normalize(uSunPos);
                    float sunDot = max(0.0, dot(dir, sunDir));
                    skyBase += uSunColor * pow(sunDot, 8.0) * 0.15;
                    skyBase += uSunColor * pow(sunDot, 128.0) * 0.65;

                    gl_FragColor = vec4(skyBase, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });
        this.skyDome = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyDome);

        // Hardware-Accelerated Exponential Fog (Establishing depth from 15-20m)
        this.scene.fog = new THREE.FogExp2(0x8bc4ec, 0.0135);
    }

    public standardTerrainMaterial!: THREE.MeshStandardMaterial;
    public crystalTerrainMaterial!: THREE.ShaderMaterial;
    public isCrystalTerrainMode: boolean = false;

    private initTerrain() {
        const size = 520;
        const segments = 192;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);

        this.standardTerrainMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.05,
            flatShading: false
        });

        // ── Translucent Prismatic Faceted Crystal Ground Shader ──────────────
        const uniforms = {
            uTime: { value: 0.0 },
            uSunPos: { value: this.sunMesh.position },
            uSunColor: { value: new THREE.Color(0xfffdf7) },
            uSkyTopColor: { value: new THREE.Color(0x0f172a) },
            uSkyHorizonColor: { value: new THREE.Color(0x38bdf8) },
            uGlassTransmission: { value: 0.90 },
            uIOR: { value: 1.62 },
            uDispersion: { value: 0.035 },
            uFresnelPower: { value: 3.8 },
            uFresnelIntensity: { value: 1.45 },
            uFresnelColor: { value: new THREE.Color(0xe0f2fe) },
            uIridescence: { value: 1.35 },
            uSpecularGlint: { value: 2.2 },
            uFacetContrast: { value: 0.45 },
            uCrystalVeinGlow: { value: 1.5 }
        };

        const crystalVertShader = /* glsl */ `
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vColor;

            void main() {
                vColor = color;
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
            uniform float uIOR;
            uniform float uDispersion;
            uniform float uFresnelPower;
            uniform float uFresnelIntensity;
            uniform vec3 uFresnelColor;
            uniform float uIridescence;
            uniform float uSpecularGlint;
            uniform float uFacetContrast;
            uniform float uCrystalVeinGlow;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vColor;

            vec3 evalSpectralPrism(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.0);
            }

            void main() {
                // True geometric flat facet face normal
                vec3 fdx = dFdx(vWorldPos);
                vec3 fdy = dFdy(vWorldPos);
                vec3 faceNormal = normalize(cross(fdx, fdy));
                if (!gl_FrontFacing) faceNormal = -faceNormal;

                vec3 V = normalize(vViewDir);
                vec3 sunDir = normalize(uSunPos - vWorldPos);
                vec3 H = normalize(sunDir + V);

                // 1. Crystal Glass Body Tint from Biome
                vec3 glassBodyTint = vColor;

                // 2. Optical Glass Refraction & Transmission with IOR & Dispersion
                float ior = max(1.1, uIOR);
                float disp = uDispersion * 0.04;
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
                vec3 transmittedSun = uSunColor * (pow(backlight, 4.0) * 1.75 + pow(forwardWash, 2.0) * 0.90);

                vec3 glassInterior = (transmittedSky * 0.85 + transmittedSun + vec3(0.12, 0.15, 0.22)) * glassBodyTint;

                // 3. Dielectric Fresnel Reflection & Edge Luminescence
                float NdotV = clamp(dot(faceNormal, V), 0.0, 1.0);
                float F0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
                float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, uFresnelPower);
                vec3 fresnelGlow = uFresnelColor * fresnel * uFresnelIntensity;

                // 4. Directional Facet Contrast
                float NdotL = max(0.0, dot(faceNormal, sunDir));
                float facetShading = mix(1.0 - uFacetContrast, 1.0 + uFacetContrast * 0.5, NdotL);

                // Sharp Diamond Specular Reflection
                float NdotH = max(0.0, dot(faceNormal, H));
                float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.8;

                // 5. Chromatic Dispersion Glints
                float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
                float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
                vec3 spectralRainbow = evalSpectralPrism(prismT);
                float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 2.0;
                vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

                // 6. Glowing Subsurface Crystal Veins & Strata
                float veinNoise1 = sin(vWorldPos.x * 0.045 + vWorldPos.z * 0.035);
                float veinNoise2 = cos(vWorldPos.x * 0.025 - vWorldPos.z * 0.055);
                float veinPattern = abs(veinNoise1 + veinNoise2);
                float veinMask = smoothstep(0.32, 0.0, veinPattern);
                vec3 veinColor = mix(vec3(0.22, 0.74, 0.97), vec3(0.96, 0.45, 0.71), sin(vWorldPos.x * 0.015) * 0.5 + 0.5);
                vec3 crystalVeins = veinColor * veinMask * uCrystalVeinGlow * 2.8;

                // 7. Surface Reflections
                vec3 reflectRay = reflect(-V, faceNormal);
                float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

                vec3 finalColor = mix(glassInterior * facetShading, reflectedSky, fresnel * 0.82);
                finalColor += uSunColor * specular;
                finalColor += chromaticHighlights;
                finalColor += fresnelGlow;
                finalColor += crystalVeins;

                float glassAlpha = clamp(fresnel * 0.65 + (1.0 - uGlassTransmission) * 0.32 + 0.12, 0.12, 0.90);

                gl_FragColor = vec4(finalColor, glassAlpha);
            }
        `;

        this.crystalTerrainMaterial = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: crystalVertShader,
            fragmentShader: crystalFragShader,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide
        });

        this.terrainMesh = new THREE.Mesh(geo, this.standardTerrainMaterial);
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = true;
        this.scene.add(this.terrainMesh);

        this.updateTerrainGeometry();
    }

    public updateTerrainGeometry() {
        const profile = BIOMES[this.activeBiomeId] || BIOMES.meadow;
        const isCrystal = this.activeBiomeId === 'prism_sanctum' || this.isCrystalTerrainMode;

        const size = 520;
        const segments = isCrystal ? 80 : 192;
        let geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const vertexCount = posAttr.count;

        for (let i = 0; i < vertexCount; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = profile.heightFn(x, z);
            posAttr.setY(i, y);
        }

        geo.computeVertexNormals();

        if (isCrystal) {
            const nonIndexedGeo = setupFacetedBarycentricGeometry(geo);
            const nonIndexPos = nonIndexedGeo.attributes.position as THREE.BufferAttribute;
            const nonIndexNorm = nonIndexedGeo.attributes.normal as THREE.BufferAttribute;
            const nonIndexCount = nonIndexPos.count;
            const colors = new Float32Array(nonIndexCount * 3);
            const tempNormal = new THREE.Vector3();

            for (let i = 0; i < nonIndexCount; i++) {
                const x = nonIndexPos.getX(i);
                const y = nonIndexPos.getY(i);
                const z = nonIndexPos.getZ(i);
                tempNormal.set(nonIndexNorm.getX(i), nonIndexNorm.getY(i), nonIndexNorm.getZ(i));

                const col = profile.colorFn(x, y, z, tempNormal);
                colors[i * 3 + 0] = col.r;
                colors[i * 3 + 1] = col.g;
                colors[i * 3 + 2] = col.b;
            }

            nonIndexedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            this.terrainMesh.geometry.dispose();
            this.terrainMesh.geometry = nonIndexedGeo;
            this.terrainMesh.material = this.crystalTerrainMaterial;
        } else {
            const normAttr = geo.attributes.normal as THREE.BufferAttribute;
            const colors = new Float32Array(vertexCount * 3);
            const tempNormal = new THREE.Vector3();

            for (let i = 0; i < vertexCount; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);
                tempNormal.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));

                const col = profile.colorFn(x, y, z, tempNormal);
                colors[i * 3 + 0] = col.r;
                colors[i * 3 + 1] = col.g;
                colors[i * 3 + 2] = col.b;
            }

            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            this.terrainMesh.geometry.dispose();
            this.terrainMesh.geometry = geo;
            this.terrainMesh.material = this.standardTerrainMaterial;
        }
    }

    private initWater() {
        // Water is omitted: regular rolling hills terrain without water
        const waterGeo = new THREE.BufferGeometry();
        const waterMat = new THREE.MeshBasicMaterial({ visible: false });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.visible = false;
    }

    private initVolumetricCloudAndRainbowRays() {
        // 1. Faceted Prismatic Crystal Cloud Mass
        this.crystalCloud = new FacetedCrystalCloud();
        this.scene.add(this.crystalCloud.group);

        // 2. Ground-Level Cut-Glass Crystal Spires & Formations
        this.groundCrystals = new GroundCrystalFormations(this.crystalCloud.crystalMaterial);
        this.scene.add(this.groundCrystals.group);
        this.groundCrystals.group.visible = false;

        // 3. Physical 3D Rainbow Crepuscular Rays Bursting Directly From Crystal Cloud Base
        this.cloudRainbowRays = new CloudRainbowRays();
        this.scene.add(this.cloudRainbowRays.group);

        // 4. Biome Volumetric Ray Pillar & Particles (Celestial Beacon Preset)
        this.volumetricPillar = new BiomeVolumetricRayPillar();
        this.scene.add(this.volumetricPillar.group);

        this.particleSystem = new SpectralParticleSystem(95, 550);
        this.scene.add(this.particleSystem.points);

        // 5. Cloud Citadel Floating Celestial Palace & Spire Island
        this.initCitadelCastle();

        this.syncBiomeToVisuals();
    }

    private initCitadelCastle() {
        this.citadelGroup = new THREE.Group();
        this.citadelGroup.name = 'CitadelSkyIsland';
        this.citadelGroup.position.set(0, 50, -80);
        this.scene.add(this.citadelGroup);

        // Procedural cloud cushion supporting the castle
        const cloudGeo = new THREE.IcosahedronGeometry(26, 2);
        cloudGeo.scale(2.2, 0.45, 1.8);
        const cloudMat = new THREE.MeshToonMaterial({
            color: new THREE.Color(0xfffbeb),
            emissive: new THREE.Color(0xfff6ea),
            emissiveIntensity: 0.25,
            transparent: true,
            opacity: 0.95
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudMesh.position.set(0, -6, 0);
        this.citadelGroup.add(cloudMesh);

        // Surrounding cloud wisps
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const wispGeo = new THREE.IcosahedronGeometry(12, 1);
            wispGeo.scale(1.5, 0.4, 1.2);
            const wispMesh = new THREE.Mesh(wispGeo, cloudMat);
            wispMesh.position.set(Math.cos(angle) * 36, -8 + (i % 2) * 3, Math.sin(angle) * 30);
            this.citadelGroup.add(wispMesh);
        }

        // Load Fairytale Castle Model
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/gltf/');
        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        loader.setMeshoptDecoder(MeshoptDecoder);

        const candidatePaths = [
            '/Assets/Sky/fairytale_castle_high_compressed.glb',
            './Assets/Sky/fairytale_castle_high_compressed.glb',
            'Assets/Sky/fairytale_castle_high_compressed.glb'
        ];

        let pathIdx = 0;
        const tryLoad = () => {
            if (pathIdx >= candidatePaths.length) return;
            const currentPath = candidatePaths[pathIdx++];
            loader.load(
                currentPath,
                (gltf) => {
                    const model = gltf.scene;
                    model.scale.setScalar(1.5);
                    const bbox = new THREE.Box3().setFromObject(model);
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    model.position.set(-center.x, -bbox.min.y, -center.z);

                    model.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            const m = child as THREE.Mesh;
                            m.castShadow = true;
                            m.receiveShadow = true;
                        }
                    });

                    this.citadelGroup.add(model);
                },
                undefined,
                () => {
                    tryLoad();
                }
            );
        };
        tryLoad();

        this.citadelGroup.visible = (this.activeBiomeId === 'sky_citadel');
    }

    public applyPresetMode(mode: 'photo_crepuscular' | 'celestial_beacon' | 'hybrid') {
        this.activePresetMode = mode;

        if (mode === 'photo_crepuscular') {
            // Faceted Crystal Cloud + Downward Rainbow Ray Fans
            this.isCloudAndRaysVisible = true;
            this.crystalCloud.group.visible = true;
            this.cloudRainbowRays.group.visible = true;
            this.cloudRainbowRays.params.intensity = 1.45;
            this.cloudRainbowRays.params.rainbowSat = 1.0;

            this.isScreenRayVisible = true;
            this.rainbowPass.params.horizontalSpectrum = 1.0;
            this.rainbowPass.params.exposure = 0.75;
            this.rainbowPass.params.density = 0.90;
            this.rainbowPass.params.weight = 0.30;
            this.rainbowPass.params.palette = 'Spectral Prismatic';

            this.isRayPillarVisible = false;
            this.isParticlesVisible = false;

            this.setCameraMode('ground');
        } else if (mode === 'celestial_beacon') {
            // Original Magical Abduction / Pillar Mode
            this.isCloudAndRaysVisible = false;
            this.crystalCloud.group.visible = false;
            this.cloudRainbowRays.group.visible = false;

            this.isScreenRayVisible = true;
            this.rainbowPass.params.horizontalSpectrum = 0.0;
            this.rainbowPass.params.exposure = 0.85;
            this.rainbowPass.params.density = 0.88;
            this.rainbowPass.params.weight = 0.35;

            this.isRayPillarVisible = true;
            this.isParticlesVisible = true;

            this.setCameraMode('orbit');
        } else if (mode === 'hybrid') {
            // Both Faceted Crystal Cloud Rays and Biome Beacon active
            this.isCloudAndRaysVisible = true;
            this.crystalCloud.group.visible = true;
            this.cloudRainbowRays.group.visible = true;
            this.cloudRainbowRays.params.intensity = 1.1;

            this.isScreenRayVisible = true;
            this.rainbowPass.params.horizontalSpectrum = 0.5;
            this.rainbowPass.params.exposure = 0.75;

            this.isRayPillarVisible = true;
            this.isParticlesVisible = true;

            this.setCameraMode('orbit');
        }
    }

    public setBiome(biomeId: string) {
        if (!BIOMES[biomeId]) return;
        this.activeBiomeId = biomeId;

        const profile = BIOMES[biomeId];
        this.updateTerrainGeometry();
        this.syncBiomeToVisuals();

        // Smooth camera transition
        this.startCameraPos.copy(this.camera.position);
        this.startLookAt.copy(this.controls.target);
        this.targetCameraPos.copy(profile.cameraPos);
        this.targetLookAt.copy(profile.cameraTarget);
        this.isTransitioning = true;
        this.transitionProgress = 0;
    }

    public syncBiomeToVisuals() {
        const profile = BIOMES[this.activeBiomeId] || BIOMES.meadow;

        // Position Volumetric Pillar and Particles over biome beacon
        this.volumetricPillar.setPosition(profile.beaconPos.x, profile.beaconPos.y, profile.beaconPos.z);
        this.particleSystem.points.position.set(profile.beaconPos.x, profile.beaconPos.y, profile.beaconPos.z);

        // Update Rainbow Palette
        this.setPalette(profile.palette);

        // Update Sun Position
        this.setSunPosition(profile.sunElevation, profile.sunAzimuth);

        // Update Sky
        const topCol = new THREE.Color(profile.skyTop);
        const horizCol = new THREE.Color(profile.skyHorizon);
        const midCol = topCol.clone().lerp(horizCol, 0.45);

        const skyMat = this.skyDome.material as THREE.ShaderMaterial;
        if (skyMat && skyMat.uniforms) {
            skyMat.uniforms.uTopColor.value.copy(topCol);
            skyMat.uniforms.uMidColor.value.copy(midCol);
            skyMat.uniforms.uHorizonColor.value.copy(horizCol);
        }

        // Hardware-Accelerated Exponential Fog
        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color.copy(horizCol).lerp(new THREE.Color(0xffffff), 0.20);
            this.scene.fog.density = (this.activeBiomeId === 'prism_sanctum') ? 0.014 : 0.008;
        }

        // Keep the cloud vapour and glass lit by the same sky it hangs in
        if (this.crystalCloud) {
            this.crystalCloud.setSkyColors(topCol, horizCol);
        }
        // Show ground crystal formations when in Prism Sanctum
        if (this.groundCrystals) {
            this.groundCrystals.group.visible = this.activeBiomeId === 'prism_sanctum';
        }
        // Show Cloud Citadel castle island when in Cloud Citadel
        if (this.citadelGroup) {
            this.citadelGroup.visible = this.activeBiomeId === 'sky_citadel';
        }
        if (this.activeBiomeId === 'prism_sanctum') {
            this.bloomPass.strength = 0.62;
            this.bloomPass.radius = 0.82;
        } else {
            this.bloomPass.strength = 0.42;
            this.bloomPass.radius = 0.70;
        }
    }

    public setPalette(paletteName: string) {
        if (!RAINBOW_PALETTES[paletteName]) return;
        this.rainbowPass.setPalette(paletteName);
        this.volumetricPillar.setPalette(paletteName);
        this.particleSystem.setPalette(paletteName);
    }

    public setSunPosition(elevationDeg: number, azimuthDeg: number) {
        const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
        const theta = THREE.MathUtils.degToRad(azimuthDeg);
        const sunDist = 300;

        const x = sunDist * Math.sin(phi) * Math.sin(theta);
        const y = sunDist * Math.cos(phi);
        const z = sunDist * Math.sin(phi) * Math.cos(theta);

        this.sunMesh.position.set(x, y, z);
        this.sunLight.position.copy(this.sunMesh.position);

        const skyMat = this.skyDome.material as THREE.ShaderMaterial;
        if (skyMat && skyMat.uniforms) {
            skyMat.uniforms.uSunPos.value.copy(this.sunMesh.position);
        }
    }

    public setCameraMode(mode: 'ground' | 'orbit' | 'cinematic' | 'beacon') {
        this.cameraMode = mode;
        const profile = BIOMES[this.activeBiomeId] || BIOMES.meadow;

        if (mode === 'ground') {
            this.controls.enabled = true;
            this.camera.position.set(0, 16, 25);
            this.controls.target.set(0, 52, -140);
        } else if (mode === 'orbit') {
            this.controls.enabled = true;
            this.camera.position.set(0, 60, 180);
            this.controls.target.set(0, 30, 0);
        } else if (mode === 'cinematic') {
            this.controls.enabled = false;
        } else if (mode === 'beacon') {
            this.controls.enabled = true;
            this.camera.position.copy(profile.cameraPos);
            this.controls.target.copy(profile.beaconPos);
        }
    }

    private onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.rainbowPass.setSize(width, height);
        this.bloomPass.setSize(width, height);
    }

    private animate = () => {
        requestAnimationFrame(this.animate);

        const dt = Math.min(this.clock.getDelta(), 0.1);
        const elapsedTime = this.clock.getElapsedTime();

        // 1. Camera Transitions & Modes (Matching game 2.8*dt slerp rate)
        if (this.isTransitioning) {
            this.transitionProgress += dt * 2.8;
            const t = smoothstep(0, 1, Math.min(1, this.transitionProgress));
            this.camera.position.lerpVectors(this.startCameraPos, this.targetCameraPos, t);
            this.controls.target.lerpVectors(this.startLookAt, this.targetLookAt, t);

            if (this.transitionProgress >= 1.0) {
                this.isTransitioning = false;
            }
        } else if (this.cameraMode === 'cinematic') {
            this.cinematicAngle += dt * 0.08;
            const radius = 140;
            const camX = Math.cos(this.cinematicAngle) * radius;
            const camZ = Math.sin(this.cinematicAngle) * radius - 50;
            const camY = 30 + Math.sin(this.cinematicAngle * 1.3) * 10;

            this.camera.position.set(camX, camY, camZ);
            this.controls.target.set(0, 52, -140);
        }

        this.controls.update();

        // Animate Skydome
        const skyMat = this.skyDome.material as THREE.ShaderMaterial;
        if (skyMat && skyMat.uniforms && skyMat.uniforms.uTime) {
            skyMat.uniforms.uTime.value += dt;
        }

        // Update Crystal Terrain Shader Uniforms
        if (this.crystalTerrainMaterial && this.crystalTerrainMaterial.uniforms) {
            this.crystalTerrainMaterial.uniforms.uTime.value += dt;
            this.crystalTerrainMaterial.uniforms.uSunPos.value.copy(this.sunMesh.position);
            if (this.crystalCloud) {
                this.crystalTerrainMaterial.uniforms.uGlassTransmission.value = this.crystalCloud.params.glassTransmission;
                this.crystalTerrainMaterial.uniforms.uIOR.value = this.crystalCloud.params.ior;
                this.crystalTerrainMaterial.uniforms.uDispersion.value = this.crystalCloud.params.dispersion;
                this.crystalTerrainMaterial.uniforms.uFresnelPower.value = this.crystalCloud.params.fresnelPower;
                this.crystalTerrainMaterial.uniforms.uFresnelIntensity.value = this.crystalCloud.params.fresnelIntensity;
                this.crystalTerrainMaterial.uniforms.uIridescence.value = this.crystalCloud.params.iridescence;
                this.crystalTerrainMaterial.uniforms.uSpecularGlint.value = this.crystalCloud.params.specularGlint;
                this.crystalTerrainMaterial.uniforms.uFacetContrast.value = this.crystalCloud.params.facetContrast;
            }
        }

        // 2. Faceted Crystal Cloud & Downward Rainbow Rays Animation
        if (this.isCloudAndRaysVisible) {
            if (this.crystalCloud) {
                this.crystalCloud.update(dt, this.sunMesh.position);
            }
            if (this.cloudRainbowRays) {
                this.cloudRainbowRays.update(dt, this.camera.position);
            }
        }

        // 3. Ground Crystal Spires & Floating Shards Animation
        if (this.groundCrystals && this.groundCrystals.group.visible) {
            this.groundCrystals.update(dt);
        }

        // 4. Celestial Beacon Light Pillar & Particles
        if (this.isRayPillarVisible) {
            this.volumetricPillar.update(dt);
        }
        this.volumetricPillar.group.visible = this.isRayPillarVisible;

        if (this.isParticlesVisible) {
            this.particleSystem.update(dt, 550);
        }
        this.particleSystem.points.visible = this.isParticlesVisible;

        // 5. Screen-Space Rainbow Pass
        this.rainbowPass.params.enabled = this.isScreenRayVisible;
        this.rainbowPass.update(dt);

        // 6. Cloud Citadel Floating Island Bob
        if (this.citadelGroup && this.citadelGroup.visible) {
            this.citadelGroup.position.y = 50 + Math.sin(elapsedTime * 0.75) * 1.8;
            this.citadelGroup.rotation.y = Math.sin(elapsedTime * 0.2) * 0.04;
        }

        // 7. Water Animation (if present and visible)
        if (this.waterMesh && this.waterMesh.visible) {
            this.waterMesh.position.y = 2.5 + Math.sin(elapsedTime * 1.2) * 0.2;
        }

        // 8. Post-Processing Composer Render
        this.composer.render();
    };
}
