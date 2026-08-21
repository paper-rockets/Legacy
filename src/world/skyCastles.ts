import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { gradientMap } from './terrain';
import { globalConfigManager, SkyCastleIslandDef, CastleColorSettings, SkyCitadelSettings } from '../core/config';

export interface CastleCatalogItem {
    id: string;
    name: string;
    path: string;
    defaultScale: number;
    description: string;
}

export const CASTLE_MODEL_CATALOG: CastleCatalogItem[] = [
    {
        id: 'fairytale_castle_high_0',
        name: 'Grand Celestial Palace',
        path: '/Assets/Sky/fairytale_castle_high_compressed.glb',
        defaultScale: 2.4,
        description: 'Grand fairytale palace with towering spires and battlements'
    },
    {
        id: 'fairytale_castle_high_1',
        name: 'Royal Citadel',
        path: '/Assets/Sky/fairytale_castle_high_compressed (1).glb',
        defaultScale: 2.2,
        description: 'Spacious walled citadel with high towers'
    },
    {
        id: 'fairytale_castle_med_0',
        name: 'Northern Watch Spire',
        path: '/Assets/Sky/fairytale_castle_med_compressed.glb',
        defaultScale: 2.0,
        description: 'Slender spired watch castle'
    },
    {
        id: 'fairytale_castle_med_2',
        name: 'Eastern Spire Gate',
        path: '/Assets/Sky/fairytale_castle_med_compressed (2).glb',
        defaultScale: 2.1,
        description: 'Twin-spired gateway fortress'
    },
    {
        id: 'fairytale_castle_med_3',
        name: 'South-East Bastion',
        path: '/Assets/Sky/fairytale_castle_med_compressed (3).glb',
        defaultScale: 2.1,
        description: 'Grand multi-tower castle'
    },
    {
        id: 'fairytale_castle_med_4',
        name: 'Southern High Crown',
        path: '/Assets/Sky/fairytale_castle_med_compressed (4).glb',
        defaultScale: 2.1,
        description: 'Fortress with golden crowned spires'
    },
    {
        id: 'fairytale_castle_med_5',
        name: 'South-West Sanctuary',
        path: '/Assets/Sky/fairytale_castle_med_compressed (5).glb',
        defaultScale: 2.2,
        description: 'Grand high palace complex'
    },
    {
        id: 'fairytale_castle_med_6',
        name: 'Western Citadel Gate',
        path: '/Assets/Sky/fairytale_castle_med_compressed (6).glb',
        defaultScale: 2.1,
        description: 'Royal citadel with courtyard spires'
    },
    {
        id: 'caste_compressed_instanced',
        name: 'Imperial Fortress Keep',
        path: '/Assets/Sky/Caste_compressed_instanced_l1.glb',
        defaultScale: 1.0,
        description: 'Colossal stone fortress and keep'
    }
];

export const CASTLE_COLOR_PRESETS: Record<string, CastleColorSettings> = {
    original: { preset: 'original' },
    ruby: {
        preset: 'ruby',
        roofColor: '#be123c',
        wallColor: '#f3e8e2',
        trimColor: '#f59e0b',
        crystalColor: '#ec4899',
        crystalBloom: 0.6
    },
    sapphire: {
        preset: 'sapphire',
        roofColor: '#1d4ed8',
        wallColor: '#cbd5e1',
        trimColor: '#93c5fd',
        crystalColor: '#06b6d4',
        crystalBloom: 0.7
    },
    amethyst: {
        preset: 'amethyst',
        roofColor: '#7e22ce',
        wallColor: '#e9d5ff',
        trimColor: '#facc15',
        crystalColor: '#d946ef',
        crystalBloom: 0.8
    },
    golden: {
        preset: 'golden',
        roofColor: '#d97706',
        wallColor: '#fed7aa',
        trimColor: '#b45309',
        crystalColor: '#fbbf24',
        crystalBloom: 0.9
    },
    emerald: {
        preset: 'emerald',
        roofColor: '#047857',
        wallColor: '#bbf7d0',
        trimColor: '#92400e',
        crystalColor: '#34d399',
        crystalBloom: 0.7
    },
    obsidian: {
        preset: 'obsidian',
        roofColor: '#312e81',
        wallColor: '#64748b',
        trimColor: '#38bdf8',
        crystalColor: '#818cf8',
        crystalBloom: 0.8
    },
    terracotta: {
        preset: 'terracotta',
        roofColor: '#c2410c',
        wallColor: '#ffedd5',
        trimColor: '#d97706',
        crystalColor: '#f97316',
        crystalBloom: 0.6
    },
    pastel: {
        preset: 'pastel',
        roofColor: '#f472b6',
        wallColor: '#fce7f3',
        trimColor: '#fed7aa',
        crystalColor: '#fb7185',
        crystalBloom: 0.5
    }
};

export const DEFAULT_SKY_CASTLE_ISLANDS: SkyCastleIslandDef[] = [
    {
        id: 'sky_castle_high_0',
        name: 'Grand Celestial Palace',
        modelPath: '/Assets/Sky/fairytale_castle_high_compressed.glb',
        x: 0,
        y: 490,
        z: -550,
        rotationY: 0.2,
        scale: 2.4,
        cloudRadius: 36,
        cloudPuffCount: 16,
        colors: { preset: 'ruby', roofColor: '#be123c', wallColor: '#f3e8e2', trimColor: '#f59e0b', crystalColor: '#ec4899', crystalBloom: 0.6 }
    },
    {
        id: 'sky_castle_high_1',
        name: 'Royal Citadel',
        modelPath: '/Assets/Sky/fairytale_castle_high_compressed (1).glb',
        x: -750,
        y: 520,
        z: -400,
        rotationY: 1.1,
        scale: 2.2,
        cloudRadius: 32,
        cloudPuffCount: 14,
        colors: { preset: 'sapphire', roofColor: '#1d4ed8', wallColor: '#cbd5e1', trimColor: '#93c5fd', crystalColor: '#06b6d4', crystalBloom: 0.7 }
    },
    {
        id: 'sky_castle_med_2_top',
        name: 'Eastern Spire Gate',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (2).glb',
        x: 720,
        y: 510,
        z: -380,
        rotationY: 0.8,
        scale: 2.1,
        cloudRadius: 30,
        cloudPuffCount: 12,
        colors: { preset: 'amethyst', roofColor: '#7e22ce', wallColor: '#e9d5ff', trimColor: '#facc15', crystalColor: '#d946ef', crystalBloom: 0.8 }
    },
    {
        id: 'sky_castle_med_0',
        name: 'Northern Watch Spire',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed.glb',
        x: -300,
        y: 505,
        z: -1150,
        rotationY: 2.3,
        scale: 2.0,
        cloudRadius: 28,
        cloudPuffCount: 12,
        colors: { preset: 'emerald', roofColor: '#047857', wallColor: '#bbf7d0', trimColor: '#92400e', crystalColor: '#34d399', crystalBloom: 0.7 }
    },
    {
        id: 'sky_castle_med_2',
        name: 'Sunstone Bastion',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (2).glb',
        x: 1050,
        y: 480,
        z: 320,
        rotationY: 3.0,
        scale: 2.1,
        cloudRadius: 30,
        cloudPuffCount: 12,
        colors: { preset: 'golden', roofColor: '#d97706', wallColor: '#fed7aa', trimColor: '#b45309', crystalColor: '#fbbf24', crystalBloom: 0.9 }
    },
    {
        id: 'sky_castle_med_3',
        name: 'South-East Bastion',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (3).glb',
        x: 650,
        y: 470,
        z: 980,
        rotationY: 1.8,
        scale: 2.1,
        cloudRadius: 30,
        cloudPuffCount: 12,
        colors: { preset: 'terracotta', roofColor: '#c2410c', wallColor: '#ffedd5', trimColor: '#d97706', crystalColor: '#f97316', crystalBloom: 0.6 }
    },
    {
        id: 'sky_castle_med_4',
        name: 'Southern High Crown',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (4).glb',
        x: -120,
        y: 485,
        z: 1120,
        rotationY: 0.5,
        scale: 2.1,
        cloudRadius: 30,
        cloudPuffCount: 12,
        colors: { preset: 'obsidian', roofColor: '#312e81', wallColor: '#64748b', trimColor: '#38bdf8', crystalColor: '#818cf8', crystalBloom: 0.8 }
    },
    {
        id: 'sky_castle_med_5',
        name: 'South-West Sanctuary',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (5).glb',
        x: -820,
        y: 510,
        z: 750,
        rotationY: 2.7,
        scale: 2.2,
        cloudRadius: 32,
        cloudPuffCount: 14,
        colors: { preset: 'pastel', roofColor: '#f472b6', wallColor: '#fce7f3', trimColor: '#fed7aa', crystalColor: '#fb7185', crystalBloom: 0.5 }
    },
    {
        id: 'sky_castle_med_6',
        name: 'Western Citadel Gate',
        modelPath: '/Assets/Sky/fairytale_castle_med_compressed (6).glb',
        x: -1100,
        y: 475,
        z: 120,
        rotationY: 1.4,
        scale: 2.1,
        cloudRadius: 30,
        cloudPuffCount: 12,
        colors: { preset: 'amethyst', roofColor: '#7e22ce', wallColor: '#e9d5ff', trimColor: '#facc15', crystalColor: '#d946ef', crystalBloom: 0.8 }
    }
];

export const SKY_CASTLE_ISLANDS = DEFAULT_SKY_CASTLE_ISLANDS;

interface LoadedCastleIsland {
    def: SkyCastleIslandDef;
    group: THREE.Group;
    castleModel: THREE.Group | null;
    cloudSkirtGroup: THREE.Group;
    farSilhouetteProxy: THREE.Group;
    wispPuffs: { mesh: THREE.Mesh; orbitRadius: number; speed: number; angle: number; baseHeight: number }[];
    isLODNear: boolean;
    groundLight?: THREE.PointLight;
    materialRegistry: {
        mesh: THREE.Mesh;
        mat: THREE.Material;
        category: 'roof' | 'wall' | 'trim' | 'crystal' | 'other';
        originalColor?: THREE.Color;
        originalEmissive?: THREE.Color;
        originalEmissiveIntensity?: number;
    }[];
}

export class SkyCastleSystem {
    private scene: THREE.Scene;
    private rootGroup: THREE.Group;
    private loader: GLTFLoader;
    private dracoLoader: DRACOLoader;

    private matCloud: THREE.MeshToonMaterial;
    private matSilhouette: THREE.MeshBasicMaterial;
    private cloudBloomUniform = { value: 0.0 };
    private cloudEmissiveUniform = { value: new THREE.Color(0xfff6ea) };
    private castleNightGlowUniform = { value: 0.0 };

    private islands: LoadedCastleIsland[] = [];
    private sharedCloudGeo: THREE.BufferGeometry;

    // Dense Layer Fog Deck (Sea of Clouds beneath archipelago)
    private layerFogGroup: THREE.Group;
    private layerFogMesh: THREE.Mesh | null = null;
    private matLayerFog: THREE.MeshToonMaterial;
    public layerFogEnabled: boolean = true;
    public layerFogAltitude: number = 260;
    public layerFogDensity: number = 1.0;

    public readonly LOD_FAR_DIST = 3200;
    public readonly LOD_NEAR_DIST = 2800;
    public readonly MAX_VISIBILITY_DIST = 5500;

    private raycaster = new THREE.Raycaster();
    private mouseNDC = new THREE.Vector2();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.rootGroup = new THREE.Group();
        this.rootGroup.name = 'SkyCastleArchipelago';
        this.scene.add(this.rootGroup);

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('/draco/gltf/');
        this.loader = new GLTFLoader();
        this.loader.setDRACOLoader(this.dracoLoader);
        this.loader.setMeshoptDecoder(MeshoptDecoder);

        const cld = globalConfigManager.config.cloud || { bloom: 0, color: '#ffffff', emissive: '#fff6ea' };
        this.cloudBloomUniform.value = cld.bloom !== undefined ? cld.bloom : 0.0;
        this.cloudEmissiveUniform.value.set(cld.emissive || '#fff6ea');

        // Shared Toon Cloud material
        this.matCloud = new THREE.MeshToonMaterial({
            color: new THREE.Color(cld.color || '#ffffff'),
            emissive: new THREE.Color(cld.emissive || '#fff6ea'),
            emissiveIntensity: 0.12,
            gradientMap,
            fog: true,
            dithering: true
        });

        this.matCloud.onBeforeCompile = (shader) => {
            shader.uniforms.uCloudBloom = this.cloudBloomUniform;
            shader.uniforms.uCloudEmissive = this.cloudEmissiveUniform;
            shader.fragmentShader = `uniform float uCloudBloom;\nuniform vec3 uCloudEmissive;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                totalEmissiveRadiance += uCloudEmissive * (uCloudBloom * 2.0);
                `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <fog_fragment>',
                `
                #ifdef USE_FOG
                    #ifdef FOG_EXP2
                        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * 0.25 );
                    #else
                        float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
                    #endif
                    fogFactor = clamp(fogFactor * 0.45, 0.0, 1.0);
                    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
                #endif
                `
            );
        };

        // Dense Layer Fog Material (Sea of clouds deck)
        this.matLayerFog = new THREE.MeshToonMaterial({
            color: new THREE.Color('#ffffff'),
            emissive: new THREE.Color('#f5f3ff'),
            emissiveIntensity: 0.18,
            gradientMap,
            fog: true,
            dithering: true,
            transparent: true,
            opacity: 0.96,
            depthWrite: true,
            side: THREE.DoubleSide
        });

        // Silhouette material for distant sky hint
        this.matSilhouette = new THREE.MeshBasicMaterial({
            color: 0xe0e7ff,
            fog: true,
            transparent: true,
            opacity: 0.35
        });

        // Procedural Billow Geometry
        this.sharedCloudGeo = new THREE.IcosahedronGeometry(14, 2);
        this.sharedCloudGeo.scale(1.8, 1.0, 1.4);
        const cpos = this.sharedCloudGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < cpos.count; i++) {
            const x = cpos.getX(i);
            let y = cpos.getY(i);
            const z = cpos.getZ(i);
            if (y < 0) {
                y *= 0.4;
            } else {
                const billow = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 2.5;
                y += Math.max(0, billow);
            }
            cpos.setXYZ(i, x, y, z);
        }
        this.sharedCloudGeo.computeVertexNormals();

        // Initialize Layer Fog Deck
        this.layerFogGroup = new THREE.Group();
        this.layerFogGroup.name = 'DenseLayerFogDeck';
        this.scene.add(this.layerFogGroup);
        this.initDenseLayerFog();

        // Load configuration or defaults
        this.initIslands();
    }

    private static readonly helperDummy = new THREE.Object3D();
    private static modelCache = new Map<string, Promise<THREE.Group>>();

    private initDenseLayerFog() {
        const citadelCfg = globalConfigManager.config.skyCitadel;
        if (citadelCfg) {
            this.layerFogEnabled = citadelCfg.layerFogEnabled !== undefined ? citadelCfg.layerFogEnabled : true;
            this.layerFogAltitude = citadelCfg.layerFogAltitude !== undefined ? citadelCfg.layerFogAltitude : 260;
            this.layerFogDensity = citadelCfg.layerFogDensity !== undefined ? citadelCfg.layerFogDensity : 1.0;
            if (citadelCfg.layerFogColor) this.matLayerFog.color.set(citadelCfg.layerFogColor);
            if (citadelCfg.layerFogEmissive) this.matLayerFog.emissive.set(citadelCfg.layerFogEmissive);
        }

        // Multi-tiered dense cloud sea geometry extending 5500m x 5500m
        const deckGeo = new THREE.PlaneGeometry(5500, 5500, 48, 48);
        deckGeo.rotateX(-Math.PI / 2);
        const dpos = deckGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < dpos.count; i++) {
            const x = dpos.getX(i);
            const z = dpos.getZ(i);
            const billowY = Math.sin(x * 0.006) * Math.cos(z * 0.006) * 18.0 +
                            Math.sin(x * 0.015 + 1.2) * Math.sin(z * 0.015) * 8.0;
            dpos.setY(i, billowY);
        }
        deckGeo.computeVertexNormals();

        this.layerFogMesh = new THREE.Mesh(deckGeo, this.matLayerFog);
        this.layerFogMesh.position.set(0, this.layerFogAltitude, 0);
        this.layerFogMesh.receiveShadow = true;
        this.layerFogGroup.add(this.layerFogMesh);
        this.layerFogGroup.visible = this.layerFogEnabled;

        // GPU Instanced layered puffy billow clusters across horizon (1 draw call instead of 18)
        const clusterGeo = new THREE.IcosahedronGeometry(120, 2);
        clusterGeo.scale(2.5, 0.45, 2.5);
        const clusterCount = 18;
        const clusterInstanced = new THREE.InstancedMesh(clusterGeo, this.matLayerFog, clusterCount);
        clusterInstanced.receiveShadow = true;
        clusterInstanced.frustumCulled = false;
        const dummy = SkyCastleSystem.helperDummy;

        for (let i = 0; i < clusterCount; i++) {
            const angle = (i / clusterCount) * Math.PI * 2 + Math.sin(i * 3.1) * 0.3;
            const dist = 900 + (i % 3) * 550 + Math.sin(i * 1.7) * 200;
            dummy.position.set(Math.cos(angle) * dist, this.layerFogAltitude - 8 + (i % 4) * 6, Math.sin(angle) * dist);
            dummy.rotation.set(0, angle, 0);
            dummy.scale.set(1.2 + (i % 3) * 0.4, 0.8 + (i % 2) * 0.3, 1.2 + (i % 3) * 0.4);
            dummy.updateMatrix();
            clusterInstanced.setMatrixAt(i, dummy.matrix);
        }
        clusterInstanced.instanceMatrix.needsUpdate = true;
        this.layerFogGroup.add(clusterInstanced);
    }

    private initIslands() {
        const savedIslands = globalConfigManager.config.skyCastles;
        const initialDefs: SkyCastleIslandDef[] = (savedIslands && savedIslands.length > 0)
            ? JSON.parse(JSON.stringify(savedIslands))
            : JSON.parse(JSON.stringify(DEFAULT_SKY_CASTLE_ISLANDS));

        initialDefs.forEach((def) => {
            this.spawnIsland(def);
        });
    }

    private spawnIsland(def: SkyCastleIslandDef): LoadedCastleIsland {
        const islandGroup = new THREE.Group();
        islandGroup.name = `Island_${def.id}`;
        islandGroup.position.set(def.x, def.y, def.z);
        islandGroup.rotation.y = def.rotationY;
        islandGroup.userData = { islandId: def.id };
        this.rootGroup.add(islandGroup);

        // 1. Procedural Cloud Skirt (Under-cushion supporting the island)
        const cloudSkirtGroup = new THREE.Group();
        const wispPuffs: { mesh: THREE.Mesh; orbitRadius: number; speed: number; angle: number; baseHeight: number }[] = [];

        const groundLight = this.buildCloudSkirt(cloudSkirtGroup, wispPuffs, def);
        islandGroup.add(cloudSkirtGroup);

        // 2. Far Silhouette Proxy
        const farSilhouetteProxy = new THREE.Group();
        this.buildFarSilhouette(farSilhouetteProxy, def);
        farSilhouetteProxy.visible = false;
        islandGroup.add(farSilhouetteProxy);

        const item: LoadedCastleIsland = {
            def,
            group: islandGroup,
            castleModel: null,
            cloudSkirtGroup,
            farSilhouetteProxy,
            wispPuffs,
            isLODNear: true,
            groundLight,
            materialRegistry: []
        };
        this.islands.push(item);

        // Asynchronously load GLTF model
        this.loadCastleModel(item);
        return item;
    }

    private buildCloudSkirt(
        skirtGroup: THREE.Group,
        wispPuffs: { mesh: THREE.Mesh; orbitRadius: number; speed: number; angle: number; baseHeight: number }[],
        def: SkyCastleIslandDef
    ): THREE.PointLight {
        skirtGroup.clear();
        wispPuffs.length = 0;

        const puffCount = def.cloudPuffCount || 12;
        // Batch static cloud skirt puffs + underbase into a single InstancedMesh (1 draw call per island instead of 17)
        const instancedSkirt = new THREE.InstancedMesh(this.sharedCloudGeo, this.matCloud, puffCount + 1);
        instancedSkirt.castShadow = false;
        instancedSkirt.receiveShadow = true;
        instancedSkirt.frustumCulled = false;
        const dummy = SkyCastleSystem.helperDummy;

        for (let i = 0; i < puffCount; i++) {
            const angle = (i / puffCount) * Math.PI * 2 + (Math.sin(i * 3.7) * 0.2);
            const rad = def.cloudRadius * (0.8 + ((Math.sin(i * 5.1) + 1) * 0.15));
            const px = Math.cos(angle) * rad;
            const pz = Math.sin(angle) * rad;
            const py = -8 + Math.sin(i * 2.3) * 2;
            const scale = (def.scale * 0.22) * (0.8 + ((Math.cos(i * 4.3) + 1) * 0.2));

            dummy.position.set(px, py, pz);
            dummy.rotation.set(0, angle + Math.PI / 4, 0);
            dummy.scale.set(scale * 1.1, scale * 0.6, scale * 1.1);
            dummy.updateMatrix();
            instancedSkirt.setMatrixAt(i, dummy.matrix);
        }

        // Cloud base under-cushion at last instance slot
        dummy.position.set(0, -10, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(def.scale * 0.4, def.scale * 0.18, def.scale * 0.4);
        dummy.updateMatrix();
        instancedSkirt.setMatrixAt(puffCount, dummy.matrix);

        instancedSkirt.instanceMatrix.needsUpdate = true;
        skirtGroup.add(instancedSkirt);

        // Ground under-island illumination PointLight for night/dusk visibility
        const groundLight = new THREE.PointLight(0xffdf99, 0, 360, 1.2);
        groundLight.position.set(0, -14, 0);
        skirtGroup.add(groundLight);

        // Orbiting ambient wisps
        for (let w = 0; w < 3; w++) {
            const wispMesh = new THREE.Mesh(this.sharedCloudGeo, this.matCloud);
            const orbitRadius = def.cloudRadius * (1.2 + w * 0.15);
            const wScale = (def.scale * 0.10) * (0.8 + w * 0.15);
            wispMesh.scale.set(wScale, wScale * 0.5, wScale);
            skirtGroup.add(wispMesh);
            wispPuffs.push({
                mesh: wispMesh,
                orbitRadius,
                speed: (0.12 + w * 0.06) * (w % 2 === 0 ? 1 : -1),
                angle: (w / 3) * Math.PI * 2,
                baseHeight: -6 + w * 2.0
            });
        }

        return groundLight;
    }

    private buildFarSilhouette(proxyGroup: THREE.Group, def: SkyCastleIslandDef) {
        proxyGroup.clear();
        const sc = def.scale;

        // Central main keep
        const towerGeo = new THREE.CylinderGeometry(4 * sc, 5.5 * sc, 38 * sc, 6);
        const towerMesh = new THREE.Mesh(towerGeo, this.matSilhouette);
        towerMesh.position.y = 19 * sc;
        proxyGroup.add(towerMesh);

        // Central grand spire cone
        const spireGeo = new THREE.ConeGeometry(4.5 * sc, 22 * sc, 6);
        const spireMesh = new THREE.Mesh(spireGeo, this.matSilhouette);
        spireMesh.position.y = (38 + 11) * sc;
        proxyGroup.add(spireMesh);

        // Side bastion towers
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const rad = 10 * sc;
            const sideGeo = new THREE.CylinderGeometry(2.5 * sc, 3 * sc, 26 * sc, 5);
            const sideMesh = new THREE.Mesh(sideGeo, this.matSilhouette);
            sideMesh.position.set(Math.cos(angle) * rad, 13 * sc, Math.sin(angle) * rad);
            proxyGroup.add(sideMesh);

            const sideSpire = new THREE.ConeGeometry(2.8 * sc, 14 * sc, 5);
            const sideSpireMesh = new THREE.Mesh(sideSpire, this.matSilhouette);
            sideSpireMesh.position.set(Math.cos(angle) * rad, (26 + 7) * sc, Math.sin(angle) * rad);
            proxyGroup.add(sideSpireMesh);
        }
    }

    private async loadCastleModel(item: LoadedCastleIsland) {
        try {
            // Share GLTF parsing & geometry buffers across multiple island instances
            if (!SkyCastleSystem.modelCache.has(item.def.modelPath)) {
                const loadPromise = this.loader.loadAsync(item.def.modelPath).then(gltf => gltf.scene);
                SkyCastleSystem.modelCache.set(item.def.modelPath, loadPromise);
            }
            const cachedTemplate = await SkyCastleSystem.modelCache.get(item.def.modelPath)!;
            const root = cachedTemplate.clone(true);

            root.scale.setScalar(item.def.scale);

            // Center bounding box & position on island group
            const bbox = new THREE.Box3().setFromObject(root);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            root.position.x = -center.x;
            root.position.z = -center.z;
            root.position.y = -bbox.min.y; // Base sits at island local y = 0

            item.materialRegistry = [];

            // Clone materials and classify meshes for customized styling (sharing underlying geometry)
            root.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const m = child as THREE.Mesh;
                    m.castShadow = true;
                    m.receiveShadow = true;
                    m.userData = { islandId: item.def.id };

                    if (Array.isArray(m.material)) {
                        m.material = m.material.map(mat => this.registerClonedMaterial(m, mat, item));
                    } else if (m.material) {
                        m.material = this.registerClonedMaterial(m, m.material, item);
                    }
                }
            });

            // Apply custom color styling
            this.applyCustomColorsToIsland(item);

            root.visible = item.isLODNear;
            if (item.castleModel) {
                item.group.remove(item.castleModel);
            }
            item.castleModel = root;
            item.group.add(root);
        } catch (err) {
            console.error(`Failed to load sky castle model: ${item.def.name} (${item.def.modelPath})`, err);
        }
    }

    private registerClonedMaterial(mesh: THREE.Mesh, srcMat: THREE.Material, item: LoadedCastleIsland): THREE.Material {
        const mat = srcMat.clone() as THREE.MeshStandardMaterial;
        mat.dithering = true;

        let category: 'roof' | 'wall' | 'trim' | 'crystal' | 'other' = 'wall';
        const matName = (mat.name || '').toLowerCase();
        const meshName = (mesh.name || '').toLowerCase();

        const color = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
        const emissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
        const emissiveIntensity = mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1.0;

        // Classify based on material names, colors, and emissive properties
        if (matName.includes('crystal') || matName.includes('002') || (emissive.r > 0.6 && emissive.b > 0.6)) {
            category = 'crystal';
        } else if (matName.includes('gold') || matName.includes('crown') || matName.includes('004') || (color.r > 0.8 && color.g > 0.7 && color.b < 0.2)) {
            category = 'trim';
        } else if (matName.includes('roof') || matName.includes('spire') || color.r > 0.7 && color.g < 0.4) {
            category = 'roof';
        } else if (matName.includes('wall') || matName.includes('base') || color.r > 0.8 && color.g > 0.8 && color.b > 0.8) {
            category = 'wall';
        } else {
            // Check vertex height or bounding box for spire roofs
            if (mesh.position.y > 15 || meshName.includes('spire') || meshName.includes('cone')) {
                category = 'roof';
            } else {
                category = 'wall';
            }
        }

        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uCastleNightGlow = this.castleNightGlowUniform;
            shader.fragmentShader = `uniform float uCastleNightGlow;\n` + shader.fragmentShader;

            // Reduce fog factor by 65% so high-altitude castles and spires remain clear and colorful
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <fog_fragment>',
                `
                #ifdef USE_FOG
                    #ifdef FOG_EXP2
                        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * 0.16 );
                    #else
                        float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
                    #endif
                    fogFactor = clamp(fogFactor * 0.35, 0.0, 1.0);
                    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
                #endif
                `
            );

            // Natural ambient architectural illumination and brightness at dusk and night
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                if (uCastleNightGlow > 0.001) {
                    totalEmissiveRadiance += diffuseColor.rgb * (uCastleNightGlow * 0.40);
                }
                `
            );
        };

        item.materialRegistry.push({
            mesh,
            mat,
            category,
            originalColor: color,
            originalEmissive: emissive,
            originalEmissiveIntensity: emissiveIntensity
        });

        return mat;
    }

    public applyCustomColorsToIsland(item: LoadedCastleIsland) {
        const colors = item.def.colors;
        if (!colors || colors.preset === 'original') {
            // Restore original colors
            item.materialRegistry.forEach(entry => {
                const std = entry.mat as THREE.MeshStandardMaterial;
                if (entry.originalColor && std.color) std.color.copy(entry.originalColor);
                if (entry.originalEmissive && std.emissive) std.emissive.copy(entry.originalEmissive);
                if (entry.originalEmissiveIntensity !== undefined) std.emissiveIntensity = entry.originalEmissiveIntensity;
            });
            return;
        }

        const roofHex = colors.roofColor || '#e11d48';
        const wallHex = colors.wallColor || '#fdf2f8';
        const trimHex = colors.trimColor || '#f59e0b';
        const crystalHex = colors.crystalColor || '#ec4899';
        const crystalBloom = colors.crystalBloom !== undefined ? colors.crystalBloom : 0.7;

        item.materialRegistry.forEach(entry => {
            const std = entry.mat as THREE.MeshStandardMaterial;
            if (!std) return;

            if (entry.category === 'roof' && std.color) {
                std.color.set(roofHex);
            } else if (entry.category === 'wall' && std.color) {
                std.color.set(wallHex);
            } else if (entry.category === 'trim') {
                if (std.color) std.color.set(trimHex);
                if (std.emissive) std.emissive.set(trimHex).multiplyScalar(0.4);
            } else if (entry.category === 'crystal') {
                if (std.color) std.color.set(crystalHex);
                if (std.emissive) {
                    std.emissive.set(crystalHex);
                    std.emissiveIntensity = 1.0 + crystalBloom * 2.0;
                }
            }
        });
    }

    // ── Public API & Editor Management ───────────────────────────────────────

    public getIslands(): SkyCastleIslandDef[] {
        return this.islands.map(i => i.def);
    }

    public getIsland(id: string): SkyCastleIslandDef | undefined {
        const item = this.islands.find(i => i.def.id === id);
        return item ? item.def : undefined;
    }

    public updateIsland(id: string, updates: Partial<SkyCastleIslandDef>) {
        const item = this.islands.find(i => i.def.id === id);
        if (!item) return;

        Object.assign(item.def, updates);

        if (updates.x !== undefined || updates.y !== undefined || updates.z !== undefined) {
            item.group.position.set(item.def.x, item.def.y, item.def.z);
        }
        if (updates.rotationY !== undefined) {
            item.group.rotation.y = item.def.rotationY;
        }
        if (updates.scale !== undefined && item.castleModel) {
            item.castleModel.scale.setScalar(item.def.scale);
        }
        if (updates.cloudRadius !== undefined || updates.cloudPuffCount !== undefined || updates.scale !== undefined) {
            this.buildCloudSkirt(item.cloudSkirtGroup, item.wispPuffs, item.def);
            this.buildFarSilhouette(item.farSilhouetteProxy, item.def);
        }
        if (updates.colors !== undefined) {
            this.applyCustomColorsToIsland(item);
        }
    }

    public async setIslandModel(id: string, modelPath: string) {
        const item = this.islands.find(i => i.def.id === id);
        if (!item) return;

        item.def.modelPath = modelPath;
        const cat = CASTLE_MODEL_CATALOG.find(c => c.path === modelPath);
        if (cat) {
            item.def.name = cat.name.split(' (')[0];
        }
        await this.loadCastleModel(item);
    }

    public setIslandColors(id: string, colors: CastleColorSettings) {
        const item = this.islands.find(i => i.def.id === id);
        if (!item) return;

        item.def.colors = { ...(item.def.colors || {}), ...colors };
        this.applyCustomColorsToIsland(item);
    }

    public applyGlobalPresetToAll(presetKey: string) {
        const preset = CASTLE_COLOR_PRESETS[presetKey];
        if (!preset) return;

        this.islands.forEach(item => {
            item.def.colors = { ...preset };
            this.applyCustomColorsToIsland(item);
        });
    }

    public addIsland(partial?: Partial<SkyCastleIslandDef>): SkyCastleIslandDef {
        const newId = `sky_castle_custom_${Date.now()}`;
        const defaultCat = CASTLE_MODEL_CATALOG[this.islands.length % CASTLE_MODEL_CATALOG.length];
        const newDef: SkyCastleIslandDef = {
            id: newId,
            name: `Castle Island ${this.islands.length + 1}`,
            modelPath: defaultCat.path,
            x: 0,
            y: 500,
            z: 0,
            rotationY: 0,
            scale: defaultCat.defaultScale,
            cloudRadius: 30,
            cloudPuffCount: 12,
            colors: { preset: 'ruby', roofColor: '#e11d48', wallColor: '#fdf2f8', trimColor: '#f59e0b', crystalColor: '#ec4899', crystalBloom: 0.6 },
            ...partial
        };

        this.spawnIsland(newDef);
        this.saveToConfig();
        return newDef;
    }

    public removeIsland(id: string): boolean {
        const idx = this.islands.findIndex(i => i.def.id === id);
        if (idx === -1) return false;

        const item = this.islands[idx];
        this.rootGroup.remove(item.group);
        this.islands.splice(idx, 1);
        this.saveToConfig();
        return true;
    }

    public resetToDefaults() {
        // Clear all current islands
        this.islands.forEach(item => {
            this.rootGroup.remove(item.group);
        });
        this.islands = [];

        // Spawn factory islands
        DEFAULT_SKY_CASTLE_ISLANDS.forEach(def => {
            this.spawnIsland(JSON.parse(JSON.stringify(def)));
        });

        this.saveToConfig();
    }

    public applyLayoutPreset(preset: 'spacious' | 'ring' | 'compact') {
        const count = this.islands.length;
        if (count === 0) return;

        let baseRadius = 950;
        if (preset === 'compact') baseRadius = 550;
        if (preset === 'ring') baseRadius = 1200;

        this.islands.forEach((item, idx) => {
            if (idx === 0 && preset !== 'ring') {
                // Central grand palace
                this.updateIsland(item.def.id, { x: 0, y: 490, z: -550 });
            } else {
                const angle = ((idx - (preset === 'ring' ? 0 : 1)) / (count - (preset === 'ring' ? 0 : 1))) * Math.PI * 2;
                const r = baseRadius * (0.85 + (idx % 3) * 0.15);
                const x = Math.round(Math.cos(angle) * r);
                const z = Math.round(Math.sin(angle) * r);
                const y = 475 + (idx % 4) * 15;
                this.updateIsland(item.def.id, { x, y, z, rotationY: angle + Math.PI / 2 });
            }
        });
        this.saveToConfig();
    }

    public saveToConfig() {
        globalConfigManager.config.skyCastles = this.getIslands();
        globalConfigManager.config.skyCitadel = {
            layerFogEnabled: this.layerFogEnabled,
            layerFogAltitude: this.layerFogAltitude,
            layerFogDensity: this.layerFogDensity,
            layerFogColor: `#${this.matLayerFog.color.getHexString()}`,
            layerFogEmissive: `#${this.matLayerFog.emissive.getHexString()}`,
            layerFogBloom: this.cloudBloomUniform.value
        };
        globalConfigManager.saveGlobalDefaults();
    }

    public raycastCastles(clientX: number, clientY: number, camera: THREE.Camera): string | null {
        this.mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouseNDC, camera);

        const intersects = this.raycaster.intersectObjects(this.rootGroup.children, true);
        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i];
            let cur: THREE.Object3D | null = hit.object;
            while (cur && cur !== this.rootGroup) {
                if (cur.userData && cur.userData.islandId) {
                    return cur.userData.islandId;
                }
                cur = cur.parent;
            }
        }
        return null;
    }

    public raycastHorizontalPlane(clientX: number, clientY: number, camera: THREE.Camera, planeY: number = 490): THREE.Vector3 | null {
        this.mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouseNDC, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        const target = new THREE.Vector3();
        return this.raycaster.ray.intersectPlane(plane, target);
    }

    public isIslandLocked(id: string): boolean {
        const item = this.islands.find(i => i.def.id === id);
        return item?.def.locked ?? false;
    }

    public setIslandLocked(id: string, locked: boolean): void {
        const item = this.islands.find(i => i.def.id === id);
        if (item) {
            item.def.locked = locked;
        }
    }

    public areAllIslandsLocked(): boolean {
        return this.islands.length > 0 && this.islands.every(i => i.def.locked);
    }

    public lockAllIslands(locked: boolean): void {
        this.islands.forEach(i => i.def.locked = locked);
    }

    public getDistanceToNearestCastle(islandId: string): { island: SkyCastleIslandDef; distance: number } | null {
        const current = this.getIsland(islandId);
        if (!current) return null;
        let closest: SkyCastleIslandDef | null = null;
        let minDist = Infinity;
        for (const isl of this.islands) {
            if (isl.def.id === islandId) continue;
            const dist = Math.hypot(isl.def.x - current.x, isl.def.z - current.z);
            if (dist < minDist) {
                minDist = dist;
                closest = isl.def;
            }
        }
        return closest ? { island: closest, distance: minDist } : null;
    }

    // ── Layer Fog Deck API ───────────────────────────────────────────────────

    public fogDeckDisabledInEditor: boolean = false;

    public setFogDeckDisabled(disabled: boolean) {
        this.fogDeckDisabledInEditor = disabled;
        this.layerFogGroup.visible = !disabled && this.layerFogEnabled;
    }

    public setLayerFogEnabled(enabled: boolean) {
        this.layerFogEnabled = enabled;
        this.layerFogGroup.visible = enabled && !this.fogDeckDisabledInEditor;
    }

    public setLayerFogAltitude(alt: number) {
        this.layerFogAltitude = alt;
        if (this.layerFogMesh) {
            this.layerFogMesh.position.y = alt;
        }
        this.layerFogGroup.position.y = alt - 260;
    }

    public setLayerFogDensity(density: number) {
        this.layerFogDensity = Math.max(0, Math.min(1.0, density));
        this.matLayerFog.opacity = 0.5 + this.layerFogDensity * 0.48;
    }

    public setLayerFogColor(hex: string) {
        this.matLayerFog.color.set(hex);
    }

    public setLayerFogEmissive(hex: string) {
        this.matLayerFog.emissive.set(hex);
    }

    public setLayerFogBloom(intensity: number) {
        this.cloudBloomUniform.value = Math.max(0, Math.min(3.0, intensity));
    }

    // ── Collision Resolution Engine ──────────────────────────────────────────

    public resolveCollisions(playerPos: THREE.Vector3, playerRadius: number = 3.5, velocity?: THREE.Vector3): boolean {
        let collided = false;
        const px = playerPos.x;
        const py = playerPos.y;
        const pz = playerPos.z;

        for (let i = 0; i < this.islands.length; i++) {
            const isl = this.islands[i].def;
            const dx = px - isl.x;
            const dz = pz - isl.z;
            const horizDistSq = dx * dx + dz * dz;
            const horizDist = Math.sqrt(horizDistSq);

            const maxIslandRadius = Math.max(isl.cloudRadius, 40.0) * (isl.scale / 2.0) + 60.0;
            if (horizDist > maxIslandRadius) continue;

            const islandScaleFactor = Math.max(0.8, isl.scale / 2.0);

            // 1. Cloud Skirt & Rock Foundation Base
            const skirtBottom = isl.y - 32.0 * islandScaleFactor;
            const skirtTop = isl.y + 4.0;
            if (py >= skirtBottom && py <= skirtTop) {
                const skirtRad = Math.max(isl.cloudRadius * 0.96, 36.0 * islandScaleFactor);
                if (horizDist < skirtRad + playerRadius) {
                    collided = true;
                    const pushDist = (skirtRad + playerRadius) - horizDist;
                    const nx = horizDist > 0.001 ? dx / horizDist : 1;
                    const nz = horizDist > 0.001 ? dz / horizDist : 0;
                    playerPos.x += nx * pushDist;
                    playerPos.z += nz * pushDist;
                    if (py < isl.y) {
                        playerPos.y = THREE.MathUtils.lerp(playerPos.y, skirtBottom - playerRadius, 0.25);
                    }
                }
            }

            // 2. Castle Main Body, Courtyards, & Outer Bastion Walls
            const wallBottom = isl.y - 3.0;
            const wallTop = isl.y + 65.0 * islandScaleFactor;
            if (py >= wallBottom && py <= wallTop) {
                const wallRad = 36.0 * islandScaleFactor;
                if (horizDist < wallRad + playerRadius) {
                    collided = true;
                    const pushDist = (wallRad + playerRadius) - horizDist;
                    const nx = horizDist > 0.001 ? dx / horizDist : 1;
                    const nz = horizDist > 0.001 ? dz / horizDist : 0;
                    playerPos.x += nx * pushDist;
                    playerPos.z += nz * pushDist;

                    if (velocity) {
                        const dot = velocity.x * nx + velocity.z * nz;
                        if (dot < 0) {
                            velocity.x -= dot * nx * 1.25;
                            velocity.z -= dot * nz * 1.25;
                        }
                    }
                }
            }

            // 3. Castle Upper Keep, Central Spire & Spires
            const spireBottom = wallTop;
            const spireTop = isl.y + 145.0 * islandScaleFactor;
            if (py >= spireBottom && py <= spireTop) {
                const spireProgress = Math.min(1.0, Math.max(0.0, (py - spireBottom) / (spireTop - spireBottom)));
                const spireRad = THREE.MathUtils.lerp(26.0, 7.5, spireProgress) * islandScaleFactor;
                if (horizDist < spireRad + playerRadius) {
                    collided = true;
                    const pushDist = (spireRad + playerRadius) - horizDist;
                    const nx = horizDist > 0.001 ? dx / horizDist : 1;
                    const nz = horizDist > 0.001 ? dz / horizDist : 0;
                    playerPos.x += nx * pushDist;
                    playerPos.z += nz * pushDist;

                    if (velocity) {
                        const dot = velocity.x * nx + velocity.z * nz;
                        if (dot < 0) {
                            velocity.x -= dot * nx * 1.25;
                            velocity.z -= dot * nz * 1.25;
                        }
                    }
                }
            }
        }

        return collided;
    }

    // ── Biome & Environment Integration ──────────────────────────────────────

    public applyBiomeCloud(cloudProps: { bloom?: number; color?: string; emissive?: string; cloudBloom?: number; cloudColor?: string; cloudEmissive?: string }) {
        const blm = cloudProps.cloudBloom !== undefined ? cloudProps.cloudBloom : cloudProps.bloom;
        const col = cloudProps.cloudColor !== undefined ? cloudProps.cloudColor : cloudProps.color;
        const emi = cloudProps.cloudEmissive !== undefined ? cloudProps.cloudEmissive : cloudProps.emissive;

        if (blm !== undefined) {
            this.cloudBloomUniform.value = Math.max(0, Math.min(3.0, blm));
        }
        if (col !== undefined) {
            this.matCloud.color.set(col);
            this.matLayerFog.color.set(col);
        }
        if (emi !== undefined) {
            this.cloudEmissiveUniform.value.set(emi);
            this.matCloud.emissive.set(emi);
            this.matLayerFog.emissive.set(emi);
        }
    }

    public setCloudBloom(intensity: number) {
        this.cloudBloomUniform.value = Math.max(0, Math.min(3.0, intensity));
    }

    public setCloudColor(hex: string) {
        this.matCloud.color.set(hex);
        this.matLayerFog.color.set(hex);
    }

    public setCloudEmissive(hex: string) {
        this.cloudEmissiveUniform.value.set(hex);
        this.matCloud.emissive.set(hex);
        this.matLayerFog.emissive.set(hex);
    }

    public getUpdraftLift(px: number, py: number, pz: number): number {
        for (let i = 0; i < this.islands.length; i++) {
            const isl = this.islands[i].def;
            const horizDist = Math.hypot(px - isl.x, pz - isl.z);
            if (horizDist < isl.cloudRadius * 1.6) {
                const heightDiff = isl.y - py;
                if (heightDiff > -20 && heightDiff < 260) {
                    const factor = 1.0 - (horizDist / (isl.cloudRadius * 1.6));
                    return factor * 9.0;
                }
            }
        }
        return 0;
    }

    public isTopViewActive: boolean = false;

    public update(playerPos: THREE.Vector3, dt: number, timePhase: number = 0) {
        const px = playerPos.x;
        const py = playerPos.y;
        const pz = playerPos.z;

        // Dynamic night illumination interpolation: Day = 0.0, Dusk = 0.45, Twilight/Night = 1.0
        const targetGlow = timePhase === 0 ? 0.0 : (timePhase === 1 ? 0.45 : 1.0);
        this.castleNightGlowUniform.value += (targetGlow - this.castleNightGlowUniform.value) * Math.min(1.0, dt * 4.0);

        // Keep layer fog mesh centered under player on XZ and only display when at high altitude or in top view
        if (this.layerFogMesh && this.layerFogGroup) {
            this.layerFogMesh.position.x = px;
            this.layerFogMesh.position.z = pz;
            const isHighAltitude = py > 160;
            this.layerFogGroup.visible = this.layerFogEnabled && !this.fogDeckDisabledInEditor && (isHighAltitude || this.isTopViewActive);
        }

        for (let i = 0; i < this.islands.length; i++) {
            const isl = this.islands[i];

            // Update ground light intensity
            if (isl.groundLight) {
                isl.groundLight.intensity = this.castleNightGlowUniform.value * (isl.def.scale * 2.8);
            }

            if (this.isTopViewActive) {
                isl.group.visible = true;
                isl.isLODNear = true;
                if (isl.castleModel) isl.castleModel.visible = true;
                if (isl.farSilhouetteProxy) isl.farSilhouetteProxy.visible = false;
                continue;
            }

            const dist = Math.hypot(px - isl.def.x, py - isl.def.y, pz - isl.def.z);

            if (dist > this.MAX_VISIBILITY_DIST) {
                isl.group.visible = false;
                continue;
            }

            isl.group.visible = true;

            // Distance-based LOD with hysteresis buffer
            if (isl.isLODNear) {
                if (dist > this.LOD_FAR_DIST) {
                    isl.isLODNear = false;
                    if (isl.castleModel) isl.castleModel.visible = false;
                    isl.farSilhouetteProxy.visible = true;
                }
            } else {
                if (dist < this.LOD_NEAR_DIST) {
                    isl.isLODNear = true;
                    if (isl.castleModel) isl.castleModel.visible = true;
                    isl.farSilhouetteProxy.visible = false;
                }
            }

            // Animate orbiting cloud wisps
            for (let w = 0; w < isl.wispPuffs.length; w++) {
                const wisp = isl.wispPuffs[w];
                wisp.angle += wisp.speed * dt;
                const wx = Math.cos(wisp.angle) * wisp.orbitRadius;
                const wz = Math.sin(wisp.angle) * wisp.orbitRadius;
                const wy = wisp.baseHeight + Math.sin(wisp.angle * 2.0) * 2.0;
                wisp.mesh.position.set(wx, wy, wz);
                wisp.mesh.rotation.y = wisp.angle + Math.PI / 2;
            }
        }
    }
}
