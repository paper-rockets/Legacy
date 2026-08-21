import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Deterministic Procedural Noise ──────────────────────────────────────────
const perm = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
    perm[i] = ((i * 137 + 43) ^ (i * 31)) & 255;
}

export function snoise(x: number, z: number): number {
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

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// ── Geothermal Ridge Height Generators ──────────────────────────────────────

// Base height (current in production)
function heightGeothermalBaseline(x: number, z: number): number {
    const broad = snoise(x * 0.0025, z * 0.0025) * 44.0 + 36.0;
    const ridgeNoise = snoise(x * 0.006 + 200, z * 0.006 - 200) * 12.0;
    const smoothDetail = snoise(x * 0.012, z * 0.012) * 3.5;
    let y = broad + ridgeNoise + smoothDetail;

    const calderaNoise = snoise(x * 0.0018 + 700, z * 0.0018 - 700);
    if (calderaNoise < -0.22) {
        const calderaDepth = smoothstep(-0.22, -0.65, calderaNoise) * 28.0;
        y -= calderaDepth;
    }
    return Math.max(2.0, y);
}

// Option 1: Softened Noise Frequencies (matches 12.5m vertex grid)
function heightGeothermalOption1(x: number, z: number): number {
    const broad = snoise(x * 0.0022, z * 0.0022) * 42.0 + 34.0;
    const ridgeNoise = snoise(x * 0.0045 + 200, z * 0.0045 - 200) * 9.5;
    const gentleDetail = snoise(x * 0.0065, z * 0.0065) * 2.2;
    let y = broad + ridgeNoise + gentleDetail;

    const calderaNoise = snoise(x * 0.0016 + 700, z * 0.0016 - 700);
    if (calderaNoise < -0.20) {
        const calderaDepth = smoothstep(-0.20, -0.70, calderaNoise) * 26.0;
        y -= calderaDepth;
    }
    return Math.max(2.0, y);
}

// Option 3: Procedural Shoreline Flattening near Water Level (y = 2.5)
function heightGeothermalOption3(x: number, z: number): number {
    let y = heightGeothermalOption1(x, z);
    // Smooth plateau transition around water line y = 2.5
    if (y > 1.6 && y < 4.2) {
        const t = (y - 1.6) / (4.2 - 1.6);
        const eased = t * t * (3.0 - 2.0 * t);
        y = 1.6 + eased * (4.2 - 1.6);
    }
    return y;
}

// ── Colors for Geothermal Ridge ─────────────────────────────────────────────
const colLow = new THREE.Color('#f97316');
const colHigh = new THREE.Color('#fbbf24');
const colDirt = new THREE.Color('#78350f');
const colPath = new THREE.Color('#ea580c');
const colSand = new THREE.Color('#fef08a');

// ── Gradient Texture for Toon Material ──────────────────────────────────────
const gradientColors = new Uint8Array([
    130, 130, 130, 255,
    195, 195, 195, 255,
    255, 255, 255, 255
]);
const gradientMap = new THREE.DataTexture(gradientColors, 3, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

// ── Still Reflective Water Shader ───────────────────────────────────────────
function createStillWaterMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uWaterColor: { value: new THREE.Color('#06b6d4') },
            uDeepColor: { value: new THREE.Color('#0891b2') },
            uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
            uReflectivity: { value: 0.35 }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform vec3 uWaterColor;
            uniform vec3 uDeepColor;
            uniform vec3 uSunDir;
            uniform float uReflectivity;

            varying vec3 vWorldPos;
            varying vec3 vNormal;

            void main() {
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                vec3 norm = normalize(vNormal);

                // Subtle Fresnel calculation
                float fresnel = pow(1.0 - max(dot(norm, viewDir), 0.0), 3.0);
                vec3 skySheen = vec3(0.75, 0.88, 0.98);

                // Base still water blend
                vec3 baseColor = mix(uDeepColor, uWaterColor, 0.6);
                vec3 color = mix(baseColor, skySheen, fresnel * uReflectivity);

                // Soft specular sun glint
                vec3 halfVec = normalize(uSunDir + viewDir);
                float spec = pow(max(dot(norm, halfVec), 0.0), 48.0) * 0.35;
                color += vec3(spec);

                gl_FragColor = vec4(color, 0.94);
            }
        `,
        transparent: false,
        depthWrite: true,
        depthTest: true
    });
}

function createStillWaterMesh(size: number = 1600): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mat = createStillWaterMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 2.5;
    return mesh;
}

// ── Helper: CPU Vertex Color Assignment ─────────────────────────────────────
function applyVertexColors(geo: THREE.PlaneGeometry, heightFn: (x: number, z: number) => number, widenTransitions: boolean = false) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colorArr = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = heightFn(x, z);
        pos.setY(i, h);

        const macroNoise = snoise(x * 0.006, z * 0.006) * 3.0;

        const grassWeight = widenTransitions
            ? smoothstep(1.0, 52.0, h + macroNoise)
            : smoothstep(2.0, 44.0, h + macroNoise);

        let r = colLow.r * (1.0 - grassWeight) + colHigh.r * grassWeight;
        let g = colLow.g * (1.0 - grassWeight) + colHigh.g * grassWeight;
        let b = colLow.b * (1.0 - grassWeight) + colHigh.b * grassWeight;

        const dirtWeight = widenTransitions
            ? smoothstep(32.0, 80.0, h + macroNoise * 0.4)
            : smoothstep(36.0, 74.0, h + macroNoise * 0.5);

        if (dirtWeight > 0.0) {
            r = r * (1.0 - dirtWeight) + colDirt.r * dirtWeight;
            g = g * (1.0 - dirtWeight) + colDirt.g * dirtWeight;
            b = b * (1.0 - dirtWeight) + colDirt.b * dirtWeight;
        }

        const sandWeight = widenTransitions
            ? smoothstep(6.0, 1.5, h)
            : smoothstep(5.2, 1.8, h);

        if (sandWeight > 0.0) {
            r = r * (1.0 - sandWeight) + colSand.r * sandWeight;
            g = g * (1.0 - sandWeight) + colSand.g * sandWeight;
            b = b * (1.0 - sandWeight) + colSand.b * sandWeight;
        }

        colorArr[i * 3] = r;
        colorArr[i * 3 + 1] = g;
        colorArr[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();
    pos.needsUpdate = true;
}

// ── Terrain Builders for 4 Options ──────────────────────────────────────────

// Option 1: Softened Noise Frequencies (128x128 grid)
function buildOption1Terrain(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1600, 1600, 128, 128);
    geo.rotateX(-Math.PI / 2);
    applyVertexColors(geo, heightGeothermalOption1, true);

    const mat = new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap,
        dithering: true
    });
    return new THREE.Mesh(geo, mat);
}

// Option 2: Fragment-Shader Pixel-Perfect Color & Shore Blend (128x128 grid)
function buildOption2Terrain(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1600, 1600, 128, 128);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, heightGeothermalBaseline(x, z));
    }
    geo.computeVertexNormals();
    pos.needsUpdate = true;

    const customMat = new THREE.ShaderMaterial({
        uniforms: {
            uColorLow: { value: colLow },
            uColorHigh: { value: colHigh },
            uColorDirt: { value: colDirt },
            uColorSand: { value: colSand },
            uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform vec3 uColorLow;
            uniform vec3 uColorHigh;
            uniform vec3 uColorDirt;
            uniform vec3 uColorSand;
            uniform vec3 uLightDir;

            varying vec3 vWorldPos;
            varying vec3 vNormal;

            void main() {
                vec3 norm = normalize(vNormal);
                float h = vWorldPos.y;

                // 1. Pixel-level grass gradient
                float grassWeight = clamp((h - 2.0) / (44.0 - 2.0), 0.0, 1.0);
                grassWeight = grassWeight * grassWeight * (3.0 - 2.0 * grassWeight);
                vec3 col = mix(uColorLow, uColorHigh, grassWeight);

                // 2. Pixel-level mountain dirt/rock transition
                float slope = 1.0 - norm.y;
                float dirtWeight = clamp((h + slope * 18.0 - 36.0) / (74.0 - 36.0), 0.0, 1.0);
                dirtWeight = dirtWeight * dirtWeight * (3.0 - 2.0 * dirtWeight);
                col = mix(col, uColorDirt, dirtWeight);

                // 3. Pixel-level shoreline sand blend
                float sandWeight = clamp((5.2 - h) / (5.2 - 1.8), 0.0, 1.0);
                sandWeight = sandWeight * sandWeight * (3.0 - 2.0 * sandWeight);
                col = mix(col, uColorSand, sandWeight);

                // Simple toon shading step
                float NdotL = max(dot(norm, uLightDir), 0.0);
                float toonLight = NdotL > 0.6 ? 1.0 : (NdotL > 0.25 ? 0.76 : 0.52);

                gl_FragColor = vec4(col * toonLight, 1.0);
            }
        `
    });

    return new THREE.Mesh(geo, customMat);
}

// Option 3: Procedural Shoreline Flattening Ease (128x128 grid)
function buildOption3Terrain(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1600, 1600, 128, 128);
    geo.rotateX(-Math.PI / 2);
    applyVertexColors(geo, heightGeothermalOption3, true);

    const mat = new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap,
        dithering: true
    });
    return new THREE.Mesh(geo, mat);
}

// Option 4: Adaptive Concentric Dual-Ring Mesh (Dense Inner 96x96, Sparser Outer)
function buildOption4Terrain(): THREE.Group {
    const group = new THREE.Group();

    // Inner high-density grid: 400m x 400m with 96x96 vertices (stride 4.16m)
    const innerGeo = new THREE.PlaneGeometry(400, 400, 96, 96);
    innerGeo.rotateX(-Math.PI / 2);
    applyVertexColors(innerGeo, heightGeothermalBaseline, false);

    const innerMat = new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap,
        dithering: true
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    // Outer grid: 1600m x 1600m with 64x64 vertices (stride 25m)
    const outerGeo = new THREE.PlaneGeometry(1600, 1600, 64, 64);
    outerGeo.rotateX(-Math.PI / 2);
    applyVertexColors(outerGeo, heightGeothermalBaseline, true);

    const outerMat = new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap,
        dithering: true
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    return group;
}

// ── Application State & Viewport Setup ──────────────────────────────────────
interface ViewportItem {
    id: string;
    title: string;
    description: string;
    polyCount: string;
    perfRating: string;
    scene: THREE.Scene;
    terrainMesh: THREE.Object3D;
    waterMesh: THREE.Mesh;
}

export function initTerrainComparisonApp() {
    const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);

    const mainCamera = new THREE.PerspectiveCamera(48, 1, 1, 4000);
    mainCamera.position.set(0, 120, 220);

    const controls = new OrbitControls(mainCamera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 30;
    controls.maxDistance = 850;
    controls.target.set(0, 25, 0);

    // Lighting setup for each scene
    function setupLights(scene: THREE.Scene) {
        const amb = new THREE.AmbientLight(0xfff7ed, 1.4);
        scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffecd2, 1.8);
        dir.position.set(200, 300, 150);
        scene.add(dir);
        const hemi = new THREE.HemisphereLight(0x93c5fd, 0xd97706, 0.6);
        scene.add(hemi);
        scene.background = new THREE.Color(0xfdba74);
        scene.fog = new THREE.Fog(0xfdba74, 300, 1400);
    }

    // Build the 4 distinct Scenes
    const viewports: ViewportItem[] = [];

    // 1. Option 1
    const scene1 = new THREE.Scene();
    setupLights(scene1);
    const terrain1 = buildOption1Terrain();
    const water1 = createStillWaterMesh(1600);
    scene1.add(terrain1);
    scene1.add(water1);
    viewports.push({
        id: 'opt1',
        title: 'Option 1: Softened Noise Frequencies',
        description: 'Matches mathematical noise octaves directly to the 12.5m vertex grid. Removes polygon saw-teeth on ridges and caldera drops with zero performance cost.',
        polyCount: '32,768 Triangles (128x128)',
        perfRating: 'Maximum (Zero Shader/Geometry Overhead)',
        scene: scene1,
        terrainMesh: terrain1,
        waterMesh: water1
    });

    // 2. Option 2
    const scene2 = new THREE.Scene();
    setupLights(scene2);
    const terrain2 = buildOption2Terrain();
    const water2 = createStillWaterMesh(1600);
    scene2.add(terrain2);
    scene2.add(water2);
    viewports.push({
        id: 'opt2',
        title: 'Option 2: Fragment-Shader Pixel Colors',
        description: 'Moves color transitions (grass, dirt, sand) to per-pixel GLSL evaluation. Color boundaries are silky smooth without angular triangle stepping.',
        polyCount: '32,768 Triangles (128x128)',
        perfRating: 'Very High (Frees CPU vertex loop)',
        scene: scene2,
        terrainMesh: terrain2,
        waterMesh: water2
    });

    // 3. Option 3
    const scene3 = new THREE.Scene();
    setupLights(scene3);
    const terrain3 = buildOption3Terrain();
    const water3 = createStillWaterMesh(1600);
    scene3.add(terrain3);
    scene3.add(water3);
    viewports.push({
        id: 'opt3',
        title: 'Option 3: Shoreline Flattening Ease',
        description: 'Applies procedural plateau easing at water level (y = 2.5). Prevents flat water from slicing diagonally through steep polygons for clean organic shores.',
        polyCount: '32,768 Triangles (128x128)',
        perfRating: 'Maximum (Zero Extra Draw Calls)',
        scene: scene3,
        terrainMesh: terrain3,
        waterMesh: water3
    });

    // 4. Option 4
    const scene4 = new THREE.Scene();
    setupLights(scene4);
    const terrain4 = buildOption4Terrain();
    const water4 = createStillWaterMesh(1600);
    scene4.add(terrain4);
    scene4.add(water4);
    viewports.push({
        id: 'opt4',
        title: 'Option 4: Concentric Dual-Ring Grid',
        description: 'Dense 4m inner grid around the viewer + 25m outer horizon grid. Delivers high geometric sharpness up close while keeping total triangle count low.',
        polyCount: '26,624 Triangles (96x96 + 64x64)',
        perfRating: 'Very High (18% fewer triangles overall)',
        scene: scene4,
        terrainMesh: terrain4,
        waterMesh: water4
    });

    // ── UI States ───────────────────────────────────────────────────────────
    let currentLayout: 'split' | 'opt1' | 'opt2' | 'opt3' | 'opt4' = 'split';
    let isWireframe: boolean = false;
    let isWaterVisible: boolean = true;
    let isAutoOrbit: boolean = false;

    function updateWireframe() {
        viewports.forEach(vp => {
            if (vp.terrainMesh instanceof THREE.Mesh) {
                (vp.terrainMesh.material as THREE.Material).wireframe = isWireframe;
            } else if (vp.terrainMesh instanceof THREE.Group) {
                vp.terrainMesh.children.forEach(child => {
                    if (child instanceof THREE.Mesh) {
                        (child.material as THREE.Material).wireframe = isWireframe;
                    }
                });
            }
        });
    }

    function updateWaterVisibility() {
        viewports.forEach(vp => {
            vp.waterMesh.visible = isWaterVisible;
        });
    }

    // ── DOM Bindings ────────────────────────────────────────────────────────
    const btnSplit = document.getElementById('btn-view-split');
    const btnOpt1 = document.getElementById('btn-view-opt1');
    const btnOpt2 = document.getElementById('btn-view-opt2');
    const btnOpt3 = document.getElementById('btn-view-opt3');
    const btnOpt4 = document.getElementById('btn-view-opt4');

    const btnWireframe = document.getElementById('btn-toggle-wireframe');
    const btnWater = document.getElementById('btn-toggle-water');
    const btnAutoFly = document.getElementById('btn-toggle-autofly');
    const btnResetCam = document.getElementById('btn-reset-cam');

    const overlayGrid = document.getElementById('overlay-grid');
    const cardOpt1 = document.getElementById('card-opt1');
    const cardOpt2 = document.getElementById('card-opt2');
    const cardOpt3 = document.getElementById('card-opt3');
    const cardOpt4 = document.getElementById('card-opt4');

    function setActiveLayout(layout: 'split' | 'opt1' | 'opt2' | 'opt3' | 'opt4') {
        currentLayout = layout;

        const navBtns = [btnSplit, btnOpt1, btnOpt2, btnOpt3, btnOpt4];
        navBtns.forEach(b => b?.classList.remove('active'));

        if (layout === 'split') btnSplit?.classList.add('active');
        if (layout === 'opt1') btnOpt1?.classList.add('active');
        if (layout === 'opt2') btnOpt2?.classList.add('active');
        if (layout === 'opt3') btnOpt3?.classList.add('active');
        if (layout === 'opt4') btnOpt4?.classList.add('active');

        if (overlayGrid) {
            if (layout === 'split') {
                overlayGrid.className = 'grid-4way';
                cardOpt1?.classList.remove('hidden');
                cardOpt2?.classList.remove('hidden');
                cardOpt3?.classList.remove('hidden');
                cardOpt4?.classList.remove('hidden');
            } else {
                overlayGrid.className = 'grid-single';
                cardOpt1?.classList.toggle('hidden', layout !== 'opt1');
                cardOpt2?.classList.toggle('hidden', layout !== 'opt2');
                cardOpt3?.classList.toggle('hidden', layout !== 'opt3');
                cardOpt4?.classList.toggle('hidden', layout !== 'opt4');
            }
        }
    }

    btnSplit?.addEventListener('click', () => setActiveLayout('split'));
    btnOpt1?.addEventListener('click', () => setActiveLayout('opt1'));
    btnOpt2?.addEventListener('click', () => setActiveLayout('opt2'));
    btnOpt3?.addEventListener('click', () => setActiveLayout('opt3'));
    btnOpt4?.addEventListener('click', () => setActiveLayout('opt4'));

    btnWireframe?.addEventListener('click', () => {
        isWireframe = !isWireframe;
        btnWireframe.classList.toggle('active', isWireframe);
        btnWireframe.textContent = isWireframe ? 'WIREFRAME: ON' : 'WIREFRAME: OFF';
        updateWireframe();
    });

    btnWater?.addEventListener('click', () => {
        isWaterVisible = !isWaterVisible;
        btnWater.classList.toggle('active', isWaterVisible);
        btnWater.textContent = isWaterVisible ? 'WATER: STILL BLUE (ON)' : 'WATER: HIDDEN';
        updateWaterVisibility();
    });

    btnAutoFly?.addEventListener('click', () => {
        isAutoOrbit = !isAutoOrbit;
        btnAutoFly.classList.toggle('active', isAutoOrbit);
        btnAutoFly.textContent = isAutoOrbit ? 'FLIGHT SIM: ON' : 'FLIGHT SIM: OFF';
    });

    btnResetCam?.addEventListener('click', () => {
        mainCamera.position.set(0, 120, 220);
        controls.target.set(0, 25, 0);
        controls.update();
    });

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Animation Loop ──────────────────────────────────────────────────────
    let clock = new THREE.Clock();
    let flightAngle = 0;

    function render() {
        requestAnimationFrame(render);
        const dt = clock.getDelta();

        if (isAutoOrbit) {
            flightAngle += dt * 0.25;
            const radius = 220;
            mainCamera.position.x = Math.sin(flightAngle) * radius;
            mainCamera.position.z = Math.cos(flightAngle) * radius;
            mainCamera.position.y = 85 + Math.sin(flightAngle * 1.5) * 35;
            controls.target.set(0, 20, 0);
        } else {
            controls.update();
        }

        const width = window.innerWidth;
        const height = window.innerHeight;

        if (currentLayout === 'split') {
            const halfW = Math.floor(width / 2);
            const halfH = Math.floor(height / 2);
            mainCamera.aspect = halfW / halfH;
            mainCamera.updateProjectionMatrix();

            // 1. Top-Left (Option 1)
            renderer.setViewport(0, halfH, halfW, halfH);
            renderer.setScissor(0, halfH, halfW, halfH);
            renderer.render(viewports[0].scene, mainCamera);

            // 2. Top-Right (Option 2)
            renderer.setViewport(halfW, halfH, halfW, halfH);
            renderer.setScissor(halfW, halfH, halfW, halfH);
            renderer.render(viewports[1].scene, mainCamera);

            // 3. Bottom-Left (Option 3)
            renderer.setViewport(0, 0, halfW, halfH);
            renderer.setScissor(0, 0, halfW, halfH);
            renderer.render(viewports[2].scene, mainCamera);

            // 4. Bottom-Right (Option 4)
            renderer.setViewport(halfW, 0, halfW, halfH);
            renderer.setScissor(halfW, 0, halfW, halfH);
            renderer.render(viewports[3].scene, mainCamera);
        } else {
            mainCamera.aspect = width / height;
            mainCamera.updateProjectionMatrix();
            renderer.setViewport(0, 0, width, height);
            renderer.setScissor(0, 0, width, height);

            let selectedIndex = 0;
            if (currentLayout === 'opt1') selectedIndex = 0;
            if (currentLayout === 'opt2') selectedIndex = 1;
            if (currentLayout === 'opt3') selectedIndex = 2;
            if (currentLayout === 'opt4') selectedIndex = 3;

            renderer.render(viewports[selectedIndex].scene, mainCamera);
        }
    }

    render();
}

// Auto-run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerrainComparisonApp);
} else {
    initTerrainComparisonApp();
}
