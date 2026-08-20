import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { terrainHeightJS, getDominantBiome, BiomeId } from './noise';
import { globalConfigManager, PlacedWorldProp } from '../core/config';

export interface WorldPropCatalogItem {
    id: string;
    name: string;
    category: string;
    path: string;
    previewImage: string;
    defaultScale: number;
    description: string;
}

export const WORLD_PROP_CATALOG: WorldPropCatalogItem[] = [
    // Candyland & Landmarks
    { id: 'prop_candy_heart', name: 'Heart of Candyland', category: 'Candyland & Landmarks', path: 'procedural:candy_heart', previewImage: '/Assets/Previews/veg_flower3_single.png', defaultScale: 3.2, description: 'Grand glowing sweet candy heart landmark in the center of Candyland' },
    { id: 'prop_candy_planet_1', name: 'Strawberry Swirl Planet', category: 'Candyland & Landmarks', path: 'procedural:candy_planet_1', previewImage: '/Assets/Previews/candy_lollipop_spiral.png', defaultScale: 2.8, description: 'Floating hard candy planet with spinning crystalline sugar ring' },
    { id: 'prop_candy_planet_2', name: 'Bubblegum Cyan Planet', category: 'Candyland & Landmarks', path: 'procedural:candy_planet_2', previewImage: '/Assets/Previews/candy_lollipop_sphere.png', defaultScale: 2.5, description: 'Floating hard candy planet with golden planetary ring' },
    { id: 'prop_candy_planet_3', name: 'Mint Lime Sugar Planet', category: 'Candyland & Landmarks', path: 'procedural:candy_planet_3', previewImage: '/Assets/Previews/candy_cotton_cloud.png', defaultScale: 2.6, description: 'Floating hard candy planet with lavender planetary ring' },

    // Castles & Towers (9 models)
    { id: 'other_castle_high', name: 'Fairytale Castle High', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_high_compressed.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.5, description: 'Grand fairytale castle with towers and spires' },
    { id: 'other_castle_high_1', name: 'Fairytale Castle High Variant', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_high_compressed (1).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.5, description: 'Detailed fairytale fortress' },
    { id: 'other_castle_med_0', name: 'Fairytale Castle Med', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'Medieval fairytale castle with spires' },
    { id: 'other_castle_med_2', name: 'Fairytale Castle Med 2', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed (2).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'Twin-spire castle variant 2' },
    { id: 'other_castle_med_3', name: 'Fairytale Castle Med 3', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed (3).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'Grand multi-tower castle variant 3' },
    { id: 'other_castle_med_4', name: 'Fairytale Castle Med 4', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed (4).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'Fortified keep with battlements variant 4' },
    { id: 'other_castle_med_5', name: 'Fairytale Castle Med 5', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed (5).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'High palace complex variant 5' },
    { id: 'other_castle_med_6', name: 'Fairytale Castle Med 6', category: 'Castles & Towers', path: '/Assets/Sky/fairytale_castle_med_compressed (6).glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 2.2, description: 'Royal citadel and spires variant 6' },
    { id: 'other_caste_instanced', name: 'Imperial Fortress Keep', category: 'Castles & Towers', path: '/Assets/Sky/Caste_compressed_instanced_l1.glb', previewImage: '/Assets/Sky/multiviewer-export (7).png', defaultScale: 1.0, description: 'Colossal stone fortress and keep' },

    // Ships & Vessels (6 models)
    { id: 'other_golden_galleon', name: 'Golden Galleon Warship', category: 'Ships & Vessels', path: '/Assets/Other/Golden_Galleon_compressed_80_instanced_l1.glb', previewImage: '/Assets/Previews/other_golden_galleon.png', defaultScale: 2.0, description: 'Multi-masted golden galleon ship' },
    { id: 'other_etire_boat', name: 'Etire Motor Boat', category: 'Ships & Vessels', path: '/Assets/Other/Etire_boat.glb', previewImage: '/Assets/Previews/other_etire_boat.png', defaultScale: 1.2, description: 'Motor boat with cabin' },
    { id: 'other_ship_1', name: 'Sailboat Sloop 1', category: 'Ships & Vessels', path: '/Assets/Other/ship_boat_1.glb', previewImage: '/Assets/Previews/other_ship_1.png', defaultScale: 1.2, description: 'White hull sailing sloop' },
    { id: 'other_ship_2', name: 'Clipper Vessel 2', category: 'Ships & Vessels', path: '/Assets/Other/ship_boat_2.glb', previewImage: '/Assets/Previews/other_ship_2.png', defaultScale: 1.2, description: 'Blue hull sailing clipper' },
    { id: 'other_ship_3', name: 'Yacht Cruiser 3', category: 'Ships & Vessels', path: '/Assets/Other/ship_boat_3.glb', previewImage: '/Assets/Previews/other_ship_3.png', defaultScale: 1.2, description: 'Compact sailing yacht cruiser' },
    { id: 'other_ship_4', name: 'Schooner Frigate 4', category: 'Ships & Vessels', path: '/Assets/Other/ship_boat_4.glb', previewImage: '/Assets/Previews/other_ship_4.png', defaultScale: 1.2, description: 'Tall-masted schooner frigate' }
];

function buildCandyHeartModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'CandyHeartLandmark';

    const shape = new THREE.Shape();
    const x = 0, y = 0;
    shape.moveTo(x + 2.5, y + 2.5);
    shape.bezierCurveTo(x + 2.5, y + 2.5, x + 2.0, y, x, y);
    shape.bezierCurveTo(x - 3.0, y, x - 3.0, y + 3.5, x - 3.0, y + 3.5);
    shape.bezierCurveTo(x - 3.0, y + 5.5, x - 1.0, y + 7.7, x + 2.5, y + 10.0);
    shape.bezierCurveTo(x + 6.0, y + 7.7, x + 8.0, y + 5.5, x + 8.0, y + 3.5);
    shape.bezierCurveTo(x + 8.0, y + 3.5, x + 8.0, y, x + 5.0, y);
    shape.bezierCurveTo(x + 3.5, y, x + 2.5, y + 2.5, x + 2.5, y + 2.5);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: 2.2,
        bevelEnabled: true,
        bevelThickness: 0.6,
        bevelSize: 0.5,
        bevelOffset: 0,
        bevelSegments: 6
    };

    const heartGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    heartGeo.computeBoundingBox();
    const bbox = heartGeo.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    heartGeo.translate(-center.x, -center.y, -center.z);
    heartGeo.rotateZ(Math.PI);

    const heartMat = new THREE.MeshToonMaterial({
        color: 0xf472b6,
        emissive: 0xfda4af,
        emissiveIntensity: 0.4,
        dithering: true
    });

    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.castShadow = true;
    heartMesh.receiveShadow = true;
    heartMesh.scale.set(1.4, 1.4, 1.4);
    heartMesh.position.y = 8.5;
    group.add(heartMesh);

    const innerHeartGeo = heartGeo.clone();
    innerHeartGeo.scale(0.72, 0.72, 0.72);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffe4e6,
        transparent: true,
        opacity: 0.85
    });
    const innerMesh = new THREE.Mesh(innerHeartGeo, innerMat);
    innerMesh.position.y = 8.5;
    group.add(innerMesh);

    const daisGeo1 = new THREE.CylinderGeometry(4.5, 5.2, 1.2, 32);
    const daisGeo2 = new THREE.CylinderGeometry(3.2, 3.8, 1.0, 32);
    daisGeo2.translate(0, 1.0, 0);
    const daisGeo3 = new THREE.CylinderGeometry(1.8, 2.2, 0.8, 32);
    daisGeo3.translate(0, 1.8, 0);

    const daisMat = new THREE.MeshToonMaterial({
        color: 0xfffbf5,
        emissive: 0xfce7f3,
        emissiveIntensity: 0.2,
        dithering: true
    });

    const daisMesh1 = new THREE.Mesh(daisGeo1, daisMat);
    daisMesh1.position.y = 0.6;
    daisMesh1.receiveShadow = true;
    group.add(daisMesh1);

    const daisMesh2 = new THREE.Mesh(daisGeo2, daisMat);
    daisMesh2.position.y = 0.6;
    daisMesh2.receiveShadow = true;
    group.add(daisMesh2);

    const daisMesh3 = new THREE.Mesh(daisGeo3, daisMat);
    daisMesh3.position.y = 0.6;
    daisMesh3.receiveShadow = true;
    group.add(daisMesh3);

    const sprinkleCount = 8;
    const sprinkleGeo = new THREE.CapsuleGeometry(0.2, 0.8, 4, 8);
    const sprinkleColors = [0x93c5fd, 0xfde047, 0xc084fc, 0x34d399, 0xf472b6, 0xffffff, 0xfbcfe8, 0x67e8f9];
    for (let i = 0; i < sprinkleCount; i++) {
        const angle = (i / sprinkleCount) * Math.PI * 2;
        const rad = 5.8 + Math.sin(i * 2.1) * 1.2;
        const sMat = new THREE.MeshToonMaterial({
            color: sprinkleColors[i % sprinkleColors.length],
            emissive: sprinkleColors[i % sprinkleColors.length],
            emissiveIntensity: 0.3
        });
        const sprinkle = new THREE.Mesh(sprinkleGeo, sMat);
        sprinkle.position.set(Math.cos(angle) * rad, 3.5 + (i % 3) * 2.0, Math.sin(angle) * rad);
        sprinkle.rotation.set(Math.sin(i), angle, Math.cos(i));
        sprinkle.castShadow = true;
        group.add(sprinkle);
    }

    return group;
}

function buildHardCandyPlanetModel(planetIndex: number = 0): THREE.Group {
    const group = new THREE.Group();
    group.name = `HardCandyPlanet_${planetIndex}`;

    // High quality saturated candy themes
    const colorThemes = [
        { body: 0xf472b6, emissive: 0xfda4af, ring: 0x38bdf8, dots: 0xfef08a, name: 'Strawberry Swirl Planet' },
        { body: 0x60a5fa, emissive: 0x93c5fd, ring: 0xfacc15, dots: 0xf472b6, name: 'Bubblegum Cyan Planet' },
        { body: 0x34d399, emissive: 0x6ee7b7, ring: 0xc084fc, dots: 0xffedd5, name: 'Mint Lime Sugar Planet' }
    ];
    const theme = colorThemes[planetIndex % colorThemes.length];

    // Main hard candy sphere with glossy finish
    const planetGeo = new THREE.SphereGeometry(3.5, 36, 30);
    const planetMat = new THREE.MeshToonMaterial({
        color: theme.body,
        emissive: theme.emissive,
        emissiveIntensity: 0.45,
        dithering: true
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    group.add(planetMesh);

    // Glowing equator swirl stripe
    const swirlGeo = new THREE.TorusGeometry(3.6, 0.35, 16, 48);
    swirlGeo.rotateX(Math.PI / 2);
    const swirlMat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        emissive: theme.emissive,
        emissiveIntensity: 0.6
    });
    const swirlMesh = new THREE.Mesh(swirlGeo, swirlMat);
    group.add(swirlMesh);

    // Tilted Crystalline Sugar Planet Ring (Saturn style)
    const ringGeo = new THREE.RingGeometry(4.8, 7.2, 48);
    ringGeo.rotateX(Math.PI / 2.5);
    ringGeo.rotateZ(0.2);
    const ringMat = new THREE.MeshToonMaterial({
        color: theme.ring,
        emissive: theme.ring,
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name = 'PlanetRing';
    group.add(ringMesh);

    // Orbiting mini sugar star / candy sprinkles around ring
    const sprinkleCount = 6;
    const sprinkleGeo = new THREE.OctahedronGeometry(0.5, 0);
    const sMat = new THREE.MeshToonMaterial({
        color: theme.dots,
        emissive: theme.dots,
        emissiveIntensity: 0.55
    });
    for (let i = 0; i < sprinkleCount; i++) {
        const angle = (i / sprinkleCount) * Math.PI * 2;
        const rad = 6.2;
        const sprinkle = new THREE.Mesh(sprinkleGeo, sMat);
        sprinkle.position.set(Math.cos(angle) * rad, Math.sin(angle) * 1.5, Math.sin(angle) * rad);
        group.add(sprinkle);
    }

    return group;
}

export interface PlacedPropInstance {
    data: PlacedWorldProp;
    group: THREE.Group;
}

export class WorldPropsSystem {
    private scene: THREE.Scene;
    private loader: GLTFLoader;
    private dracoLoader: DRACOLoader;

    private modelTemplateCache: Map<string, THREE.Object3D> = new Map();
    private placedInstances: Map<string, PlacedPropInstance> = new Map();

    // Placement / Move state
    public isPlacing: boolean = false;
    public placingModelId: string | null = null;
    public movingPropId: string | null = null;
    public selectedPropId: string | null = null;

    private ghostGroup: THREE.Group;
    private ghostMesh: THREE.Object3D | null = null;
    public currentGhostPos: THREE.Vector3 = new THREE.Vector3();
    public currentGhostYaw: number = 0;
    public currentGhostScale: number = 1.0;
    public currentGhostGroundOffset: number = 0.0;

    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouseNDC: THREE.Vector2 = new THREE.Vector2();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('/draco/gltf/');
        this.loader = new GLTFLoader();
        this.loader.setDRACOLoader(this.dracoLoader);

        this.ghostGroup = new THREE.Group();
        this.ghostGroup.visible = false;
        this.scene.add(this.ghostGroup);

        this.loadTemplates().then(() => {
            this.loadSavedProps();
        });
    }

    private async loadTemplates() {
        const promises = WORLD_PROP_CATALOG.map(async (item) => {
            try {
                if (item.path.startsWith('procedural:')) {
                    if (item.path === 'procedural:candy_heart') {
                        const root = buildCandyHeartModel();
                        this.modelTemplateCache.set(item.id, root);
                    } else if (item.path === 'procedural:candy_planet_1') {
                        const root = buildHardCandyPlanetModel(0);
                        this.modelTemplateCache.set(item.id, root);
                    } else if (item.path === 'procedural:candy_planet_2') {
                        const root = buildHardCandyPlanetModel(1);
                        this.modelTemplateCache.set(item.id, root);
                    } else if (item.path === 'procedural:candy_planet_3') {
                        const root = buildHardCandyPlanetModel(2);
                        this.modelTemplateCache.set(item.id, root);
                    }
                    return;
                }

                const gltf = await this.loader.loadAsync(item.path);
                const root = gltf.scene;

                // Center bounding box & prepare shadow properties
                const bbox = new THREE.Box3().setFromObject(root);
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                root.position.x -= center.x;
                root.position.z -= center.z;
                root.position.y -= bbox.min.y; // base sits at y = 0

                root.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        m.castShadow = true;
                        m.receiveShadow = true;
                    }
                });

                this.modelTemplateCache.set(item.id, root);
            } catch (err) {
                console.error(`Failed to load world prop model template: ${item.name}`, err);
            }
        });

        await Promise.all(promises);
    }

    public async loadCustomPropModel(fileName: string, buffer: ArrayBuffer, defaultScale: number = 1.0): Promise<WorldPropCatalogItem> {
        const id = 'custom_prop_' + Date.now();
        const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
        const name = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        const gltf = await this.loader.parseAsync(buffer, '');
        const root = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= bbox.min.y;

        root.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                m.castShadow = true;
                m.receiveShadow = true;
            }
        });

        this.modelTemplateCache.set(id, root);

        const item: WorldPropCatalogItem = {
            id,
            name,
            category: 'Custom Uploads',
            path: '',
            previewImage: '/Assets/Previews/other_castle_high.png',
            defaultScale,
            description: `Custom uploaded 3D model (${fileName})`
        };

        WORLD_PROP_CATALOG.push(item);
        return item;
    }

    public loadSavedProps() {
        const saved = globalConfigManager.config.placedProps || [];
        // Clear existing placed instances if any
        for (const inst of this.placedInstances.values()) {
            this.scene.remove(inst.group);
        }
        this.placedInstances.clear();

        const bCfg = globalConfigManager.getBiomeConfig('candyland');
        const planetsEnabled = bCfg?.vegetation?.floatingPlanetsEnabled !== false;
        const altitude = bCfg?.vegetation?.floatingPlanetAltitude ?? 24.0;
        const count = Math.min(3, Math.max(1, bCfg?.vegetation?.floatingPlanetCount ?? 3));

        if (planetsEnabled) {
            const planetDefs = [
                { id: 'candyland_planet_1', modelId: 'prop_candy_planet_1', name: 'Strawberry Swirl Planet', x: 0, z: 0, alt: altitude },
                { id: 'candyland_planet_2', modelId: 'prop_candy_planet_2', name: 'Bubblegum Cyan Planet', x: 75, z: -60, alt: altitude + 5.0 },
                { id: 'candyland_planet_3', modelId: 'prop_candy_planet_3', name: 'Mint Lime Sugar Planet', x: -80, z: 65, alt: altitude + 3.5 }
            ];

            for (let i = 0; i < count; i++) {
                const pDef = planetDefs[i];
                const existing = saved.find(p => p.id === pDef.id);
                if (!existing) {
                    const groundY = terrainHeightJS(pDef.x, pDef.z);
                    const prop: PlacedWorldProp = {
                        id: pDef.id,
                        modelId: pDef.modelId,
                        name: pDef.name,
                        position: [pDef.x, groundY + pDef.alt, pDef.z],
                        rotation: [0, 0, 0],
                        scale: 2.8,
                        groundOffset: pDef.alt,
                        biomeId: 'candyland',
                        locked: true
                    };
                    saved.push(prop);
                } else if (existing.groundOffset < 18.0) {
                    existing.groundOffset = pDef.alt;
                }
            }
            globalConfigManager.config.placedProps = saved;
        }

        // Heart of Candyland offset check
        const heartProp = saved.find(p => p.id === 'candyland_heart_center' || p.modelId === 'prop_candy_heart');
        if (heartProp && heartProp.groundOffset < 4.2) {
            heartProp.groundOffset = 4.5;
        }

        for (const prop of saved) {
            this.spawnPropInstance(prop);
        }
    }

    private heartAnimTime = 0;

    public update(dt: number) {
        this.heartAnimTime += dt;
        for (const [id, inst] of this.placedInstances.entries()) {
            if (id === 'candyland_heart_center') {
                const groundY = terrainHeightJS(inst.data.position[0], inst.data.position[2]);
                const baseAlt = Math.max(inst.data.groundOffset || 4.5, 4.2);
                const floatOffset = Math.sin(this.heartAnimTime * 1.5) * 0.45;
                inst.group.position.y = groundY + baseAlt + floatOffset;
                inst.group.rotation.y = this.heartAnimTime * 0.35;
            } else if (id.startsWith('candyland_planet_')) {
                const groundY = terrainHeightJS(inst.data.position[0], inst.data.position[2]);
                const baseAlt = Math.max(inst.data.groundOffset || 24.0, 18.0);
                const floatOffset = Math.sin(this.heartAnimTime * 1.2 + inst.data.position[0] * 0.1) * 1.5;
                inst.group.position.y = groundY + baseAlt + floatOffset;
                inst.group.rotation.y = this.heartAnimTime * 0.45;

                const ring = inst.group.getObjectByName('PlanetRing');
                if (ring) {
                    ring.rotation.z = this.heartAnimTime * 0.65;
                }
            }
        }
    }

    public setFloatingPlanetsEnabled(enabled: boolean): void {
        const bCfg = globalConfigManager.getBiomeConfig('candyland');
        if (bCfg && bCfg.vegetation) {
            bCfg.vegetation.floatingPlanetsEnabled = enabled;
            this.loadSavedProps();
        }
    }

    public setFloatingPlanetAltitude(altitude: number): void {
        const bCfg = globalConfigManager.getBiomeConfig('candyland');
        if (bCfg && bCfg.vegetation) {
            bCfg.vegetation.floatingPlanetAltitude = altitude;
            for (const [id, inst] of this.placedInstances.entries()) {
                if (id.startsWith('candyland_planet_')) {
                    inst.data.groundOffset = altitude;
                }
            }
        }
    }

    public setFloatingPlanetCount(count: number): void {
        const bCfg = globalConfigManager.getBiomeConfig('candyland');
        if (bCfg && bCfg.vegetation) {
            bCfg.vegetation.floatingPlanetCount = count;
            this.loadSavedProps();
        }
    }

    private spawnPropInstance(data: PlacedWorldProp): PlacedPropInstance | null {
        const template = this.modelTemplateCache.get(data.modelId);
        if (!template) {
            // If template not loaded yet, retry later
            setTimeout(() => {
                const t = this.modelTemplateCache.get(data.modelId);
                if (t && !this.placedInstances.has(data.id)) {
                    this.spawnPropInstance(data);
                }
            }, 500);
            return null;
        }

        const clone = template.clone(true);
        const group = new THREE.Group();
        group.name = data.name;

        group.position.set(data.position[0], data.position[1], data.position[2]);
        group.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
        group.scale.setScalar(data.scale);

        group.add(clone);
        this.scene.add(group);

        const instance: PlacedPropInstance = {
            data,
            group
        };

        this.placedInstances.set(data.id, instance);
        return instance;
    }

    public raycastTerrain(ray: THREE.Ray): THREE.Vector3 | null {
        const startDist = 5.0;
        const maxDist = 2200.0;
        const stepSize = 10.0;
        let prevT = startDist;
        let prevP = ray.origin.clone().addScaledVector(ray.direction, startDist);
        let prevDiff = prevP.y - terrainHeightJS(prevP.x, prevP.z);

        for (let t = startDist + stepSize; t <= maxDist; t += stepSize) {
            const p = ray.origin.clone().addScaledVector(ray.direction, t);
            const terrainY = terrainHeightJS(p.x, p.z);
            const diff = p.y - terrainY;

            if (diff <= 0 && prevDiff >= 0) {
                // Binary search refinement for millimeter accuracy
                let low = prevT;
                let high = t;
                for (let i = 0; i < 10; i++) {
                    const mid = (low + high) * 0.5;
                    const midP = ray.origin.clone().addScaledVector(ray.direction, mid);
                    const midTerrainY = terrainHeightJS(midP.x, midP.z);
                    if (midP.y <= midTerrainY) {
                        high = mid;
                    } else {
                        low = mid;
                    }
                }
                const finalT = (low + high) * 0.5;
                const hit = ray.origin.clone().addScaledVector(ray.direction, finalT);
                hit.y = terrainHeightJS(hit.x, hit.z);
                return hit;
            }
            prevT = t;
            prevP = p;
            prevDiff = diff;
        }

        // Check water surface plane (y = 0)
        if (ray.direction.y !== 0) {
            const tWater = -ray.origin.y / ray.direction.y;
            if (tWater > 0 && tWater < maxDist) {
                return ray.origin.clone().addScaledVector(ray.direction, tWater);
            }
        }
        return null;
    }

    public startPlacement(modelId: string) {
        this.cancelPlacement();
        const catalogItem = WORLD_PROP_CATALOG.find(i => i.id === modelId);
        if (!catalogItem) return;

        this.isPlacing = true;
        this.placingModelId = modelId;
        this.movingPropId = null;
        this.currentGhostScale = catalogItem.defaultScale;
        this.currentGhostYaw = 0;
        this.currentGhostGroundOffset = 0.0;

        const template = this.modelTemplateCache.get(modelId);
        if (template) {
            this.ghostMesh = template.clone(true);
            // Apply ghost transparency to preview
            this.ghostMesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const m = child as THREE.Mesh;
                    if (Array.isArray(m.material)) {
                        m.material = m.material.map(mat => {
                            const c = mat.clone();
                            c.transparent = true;
                            c.opacity = 0.78;
                            return c;
                        });
                    } else if (m.material) {
                        m.material = m.material.clone();
                        m.material.transparent = true;
                        m.material.opacity = 0.78;
                    }
                }
            });
            this.ghostGroup.clear();
            this.ghostGroup.add(this.ghostMesh);
            this.ghostGroup.visible = true;
            this.ghostGroup.scale.setScalar(this.currentGhostScale);
        }
    }

    public startMoving(propId: string) {
        const inst = this.placedInstances.get(propId);
        if (!inst) return;

        this.isPlacing = true;
        this.placingModelId = inst.data.modelId;
        this.movingPropId = propId;
        this.selectedPropId = propId;
        this.currentGhostScale = inst.data.scale;
        this.currentGhostYaw = inst.data.rotation[1] * (180 / Math.PI);
        this.currentGhostGroundOffset = inst.data.groundOffset;

        inst.group.visible = false; // hide placed instance while moving

        const template = this.modelTemplateCache.get(inst.data.modelId);
        if (template) {
            this.ghostMesh = template.clone(true);
            this.ghostMesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const m = child as THREE.Mesh;
                    if (m.material) {
                        m.material = (m.material as THREE.Material).clone();
                        m.material.transparent = true;
                        m.material.opacity = 0.78;
                    }
                }
            });
            this.ghostGroup.clear();
            this.ghostGroup.add(this.ghostMesh);
            this.ghostGroup.visible = true;
            this.ghostGroup.scale.setScalar(this.currentGhostScale);
            this.ghostGroup.rotation.y = inst.data.rotation[1];
        }
    }

    public updatePlacementFromMouse(clientX: number, clientY: number, camera: THREE.Camera) {
        if (!this.isPlacing || !this.ghostGroup.visible) return;

        this.mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouseNDC, camera);
        const hit = this.raycastTerrain(this.raycaster.ray);

        if (hit) {
            this.currentGhostPos.copy(hit);
            this.ghostGroup.position.set(
                hit.x,
                hit.y + this.currentGhostGroundOffset,
                hit.z
            );
            this.ghostGroup.rotation.y = this.currentGhostYaw * (Math.PI / 180);
            this.ghostGroup.scale.setScalar(this.currentGhostScale);
        }
    }

    public confirmPlacement(): PlacedWorldProp | null {
        if (!this.isPlacing || !this.placingModelId) return null;

        const modelId = this.placingModelId;
        const catalogItem = WORLD_PROP_CATALOG.find(i => i.id === modelId);
        const name = catalogItem ? catalogItem.name : 'World Object';

        const posX = this.currentGhostPos.x;
        const groundY = terrainHeightJS(posX, this.currentGhostPos.z);
        const posZ = this.currentGhostPos.z;
        const posY = groundY + this.currentGhostGroundOffset;
        const yawRad = this.currentGhostYaw * (Math.PI / 180);
        const dominantBiome = getDominantBiome(posX, posZ);

        let resultProp: PlacedWorldProp;

        if (this.movingPropId && this.placedInstances.has(this.movingPropId)) {
            // Update existing placed instance
            const inst = this.placedInstances.get(this.movingPropId)!;
            inst.data.position = [posX, posY, posZ];
            inst.data.rotation = [0, yawRad, 0];
            inst.data.scale = this.currentGhostScale;
            inst.data.groundOffset = this.currentGhostGroundOffset;
            inst.data.biomeId = dominantBiome;

            inst.group.position.set(posX, posY, posZ);
            inst.group.rotation.set(0, yawRad, 0);
            inst.group.scale.setScalar(this.currentGhostScale);
            inst.group.visible = true;

            resultProp = inst.data;
            this.selectedPropId = inst.data.id;
        } else {
            // Create new placed instance
            const count = this.placedInstances.size + 1;
            const newProp: PlacedWorldProp = {
                id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                modelId,
                name: `${name} #${count}`,
                position: [posX, posY, posZ],
                rotation: [0, yawRad, 0],
                scale: this.currentGhostScale,
                groundOffset: this.currentGhostGroundOffset,
                biomeId: dominantBiome
            };

            this.spawnPropInstance(newProp);
            resultProp = newProp;
            this.selectedPropId = newProp.id;
        }

        this.cancelPlacement();
        this.saveToConfig();
        return resultProp;
    }

    public cancelPlacement() {
        if (this.movingPropId && this.placedInstances.has(this.movingPropId)) {
            const inst = this.placedInstances.get(this.movingPropId)!;
            inst.group.visible = true;
        }

        this.isPlacing = false;
        this.placingModelId = null;
        this.movingPropId = null;
        this.ghostGroup.visible = false;
        this.ghostGroup.clear();
        this.ghostMesh = null;
    }

    public selectProp(id: string | null) {
        this.selectedPropId = id;
    }

    public getSelectedProp(): PlacedWorldProp | null {
        if (!this.selectedPropId) return null;
        const inst = this.placedInstances.get(this.selectedPropId);
        return inst ? inst.data : null;
    }

    public setPropScale(id: string, scale: number) {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        inst.data.scale = scale;
        inst.group.scale.setScalar(scale);
        this.saveToConfig();
    }

    public setPropGroundOffset(id: string, offset: number) {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        inst.data.groundOffset = offset;
        const groundY = terrainHeightJS(inst.data.position[0], inst.data.position[2]);
        inst.data.position[1] = groundY + offset;
        inst.group.position.y = inst.data.position[1];
        this.saveToConfig();
    }

    public setPropRotation(id: string, yawDegrees: number) {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        const yawRad = yawDegrees * (Math.PI / 180);
        inst.data.rotation[1] = yawRad;
        inst.group.rotation.y = yawRad;
        this.saveToConfig();
    }

    public snapToGround(id: string) {
        this.setPropGroundOffset(id, 0.0);
    }

    public snapToWater(id: string) {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        const groundY = terrainHeightJS(inst.data.position[0], inst.data.position[2]);
        const offset = 0.0 - groundY; // water level is y = 0
        this.setPropGroundOffset(id, offset);
    }

    public duplicateProp(id: string): PlacedWorldProp | null {
        const src = this.placedInstances.get(id);
        if (!src) return null;

        const count = this.placedInstances.size + 1;
        const offsetDist = 15.0;
        const newX = src.data.position[0] + offsetDist;
        const newZ = src.data.position[2] + offsetDist;
        const groundY = terrainHeightJS(newX, newZ);
        const newY = groundY + src.data.groundOffset;

        const newProp: PlacedWorldProp = {
            id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            modelId: src.data.modelId,
            name: `${src.data.name} (Copy ${count})`,
            position: [newX, newY, newZ],
            rotation: [...src.data.rotation],
            scale: src.data.scale,
            groundOffset: src.data.groundOffset,
            biomeId: getDominantBiome(newX, newZ)
        };

        this.spawnPropInstance(newProp);
        this.selectedPropId = newProp.id;
        this.saveToConfig();
        return newProp;
    }

    public deleteProp(id: string) {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        this.scene.remove(inst.group);
        this.placedInstances.delete(id);
        if (this.selectedPropId === id) {
            this.selectedPropId = null;
        }
        this.saveToConfig();
    }

    public clearAllProps() {
        for (const inst of this.placedInstances.values()) {
            this.scene.remove(inst.group);
        }
        this.placedInstances.clear();
        this.selectedPropId = null;
        this.saveToConfig();
    }

    public getPlacedProps(): PlacedWorldProp[] {
        return Array.from(this.placedInstances.values()).map(inst => inst.data);
    }

    public saveToConfig() {
        const props = this.getPlacedProps();
        globalConfigManager.config.placedProps = props;
        globalConfigManager.saveGlobalDefaults();
    }

    public nudgePropPosition(id: string, dx: number, dz: number): void {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        const newX = inst.data.position[0] + dx;
        const newZ = inst.data.position[2] + dz;
        const groundY = terrainHeightJS(newX, newZ);
        const newY = groundY + inst.data.groundOffset;
        inst.data.position = [newX, newY, newZ];
        inst.data.biomeId = getDominantBiome(newX, newZ);
        inst.group.position.set(newX, newY, newZ);
        this.saveToConfig();
    }

    public nudgePropElevation(id: string, deltaM: number): void {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        this.setPropGroundOffset(id, inst.data.groundOffset + deltaM);
    }

    public nudgePropScale(id: string, deltaScale: number): void {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        const newScale = Math.max(0.1, Math.min(50.0, Number((inst.data.scale + deltaScale).toFixed(2))));
        this.setPropScale(id, newScale);
    }

    public nudgePropRotation(id: string, deltaDeg: number): void {
        const inst = this.placedInstances.get(id);
        if (!inst) return;
        const curDeg = Math.round((inst.data.rotation[1] * (180 / Math.PI)) % 360);
        let newDeg = (curDeg + deltaDeg) % 360;
        if (newDeg < 0) newDeg += 360;
        this.setPropRotation(id, newDeg);
    }

    public nudgeGhostPosition(dx: number, dz: number): void {
        if (!this.isPlacing || !this.ghostGroup.visible) return;
        this.currentGhostPos.x += dx;
        this.currentGhostPos.z += dz;
        const groundY = terrainHeightJS(this.currentGhostPos.x, this.currentGhostPos.z);
        this.currentGhostPos.y = groundY;
        this.ghostGroup.position.set(
            this.currentGhostPos.x,
            groundY + this.currentGhostGroundOffset,
            this.currentGhostPos.z
        );
    }

    public nudgeGhostScale(deltaScale: number): void {
        if (!this.isPlacing || !this.ghostGroup.visible) return;
        this.currentGhostScale = Math.max(0.1, Math.min(50.0, Number((this.currentGhostScale + deltaScale).toFixed(2))));
        this.ghostGroup.scale.setScalar(this.currentGhostScale);
    }

    public nudgeGhostRotation(deltaDeg: number): void {
        if (!this.isPlacing || !this.ghostGroup.visible) return;
        this.currentGhostYaw = (this.currentGhostYaw + deltaDeg) % 360;
        if (this.currentGhostYaw < 0) this.currentGhostYaw += 360;
        this.ghostGroup.rotation.y = this.currentGhostYaw * (Math.PI / 180);
    }

    public nudgeGhostElevation(deltaM: number): void {
        if (!this.isPlacing || !this.ghostGroup.visible) return;
        this.currentGhostGroundOffset += deltaM;
        const groundY = terrainHeightJS(this.currentGhostPos.x, this.currentGhostPos.z);
        this.ghostGroup.position.y = groundY + this.currentGhostGroundOffset;
    }

    public raycastPlacedProps(clientX: number, clientY: number, camera: THREE.Camera): string | null {
        this.mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouseNDC, camera);

        const propGroups: THREE.Object3D[] = [];
        for (const inst of this.placedInstances.values()) {
            if (inst.group.visible) {
                propGroups.push(inst.group);
            }
        }

        const hits = this.raycaster.intersectObjects(propGroups, true);
        if (hits.length > 0) {
            let hitObj: THREE.Object3D | null = hits[0].object;
            while (hitObj && hitObj.parent) {
                for (const [id, inst] of this.placedInstances.entries()) {
                    if (inst.group === hitObj) {
                        return id;
                    }
                }
                hitObj = hitObj.parent;
            }
        }
        return null;
    }
}
