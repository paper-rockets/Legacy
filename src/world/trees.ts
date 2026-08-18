import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientMap } from './terrain';
import { terrainHeightJS, getPathStrength } from './noise';
import type { PropsSystem } from './props';

interface TreeInstanceData {
    clusterIdx: number;
    isStandalone: boolean;
    standaloneX: number;
    standaloneZ: number;
    angle: number;
    radiusRatio: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    scaleBase: number;
    scaleJitterX: number;
    scaleJitterY: number;
    scaleJitterZ: number;
    active: boolean;
}

interface InstancedTreeModel {
    trunkMesh?: THREE.InstancedMesh;
    canopyMesh?: THREE.InstancedMesh;
    singleMesh?: THREE.InstancedMesh;
    count: number;
    instanceData: TreeInstanceData[];
}

export interface CandyPreset {
    name: string;
    trunkColor: number;
    palette: number[];
}

export const CANDY_PRESETS: Record<string, CandyPreset> = {
    'cotton-candy': {
        name: 'Cotton Candy',
        trunkColor: 0xe5c29f,
        palette: [0xff77a9, 0x68d8d6, 0xb892ff, 0xffa6c9, 0xa0e7e5, 0xffc6ff]
    },
    'lollipop': {
        name: 'Lollipop Rainbow',
        trunkColor: 0xffffff,
        palette: [0xff2a6d, 0x05d9e8, 0xfff01f, 0x9b5de5, 0xf15bb5, 0x00f5d4]
    },
    'marshmallow': {
        name: 'Marshmallow Pastel',
        trunkColor: 0xd4a373,
        palette: [0xffd1dc, 0xc1e1c1, 0xc5a3ff, 0xffe4b5, 0xbfe6ff, 0xffdfd3]
    },
    'gummy': {
        name: 'Gummy Jelly',
        trunkColor: 0x4a154b,
        palette: [0xff0055, 0x00e5ff, 0x76ff03, 0xff9100, 0xd500f9, 0xffea00]
    },
    'choco-mint': {
        name: 'Chocolate Mint',
        trunkColor: 0x3d2314,
        palette: [0x3eb489, 0xa8e6cf, 0x5cd8a5, 0x79f2c0, 0x2e8b57]
    },
    'classic': {
        name: 'Classic Ghibli',
        trunkColor: 0x5a3d28,
        palette: [0x48a868, 0x56b872, 0x3d9456, 0x68c47e, 0x78d085, 0x429e5e]
    }
};

interface TreeCluster {
    x: number;
    z: number;
    initialized: boolean;
}

export class TreeSystem {
    private treeModels: InstancedTreeModel[] = [];
    private dummy = new THREE.Object3D();
    private dummyMatrix = new THREE.Matrix4();
    private tempColor = new THREE.Color();
    private currentFrame = 0;
    public treeCountPerType = 350; // Increased capacity for lush density
    public maxActiveCountPerType = 220; // Default 660 total active trees
    public scaleMultiplier = 6.0; // Default scale set to 6.0
    public clusterSpread = 26.0;
    public spawnRadius = 580; // Extended spawn radius to eliminate empty background gaps
    private scene: THREE.Scene;
    private propsSystem?: PropsSystem;

    // Organic clustering parameters
    private clusters: TreeCluster[] = [];
    private treesPerCluster = 5;

    // Default materials for toon rendering with separate trunk and canopy coloring
    public trunkMaterial: THREE.MeshToonMaterial;
    public canopyMaterial: THREE.MeshToonMaterial;

    // Foliage color variations for canopy instancing
    public canopyPalette: number[] = [
        0xff2a6d, 0x05d9e8, 0xfff01f, 0x9b5de5, 0xf15bb5, 0x00f5d4
    ];

    private treeModelFiles = [
        'Assets/Cartoon/Cartoon_Trees_Tree_1.glb',
        'Assets/Cartoon/Cartoon_Trees_Tree_2.glb',
        'Assets/Cartoon/Cartoon_Trees_Tree_3.glb'
    ];

    constructor(scene: THREE.Scene, propsSystem?: PropsSystem) {
        this.scene = scene;
        this.propsSystem = propsSystem;
        this.dummyMatrix.setPosition(0, -1000, 0);

        // Dedicated Trunk and Canopy toon materials
        this.trunkMaterial = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true
        });

        this.canopyMaterial = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true
        });

        this.initClusters();
        this.loadTreeModels();
    }

    public setPropsSystem(props: PropsSystem) {
        this.propsSystem = props;
        this.propsSystem.setCandyPalette(this.canopyPalette);
    }

    private initClusters() {
        this.clusters = [];
        const numClusters = 70; // 70 clusters distributed broadly across island
        for (let c = 0; c < numClusters; c++) {
            this.clusters.push({
                x: 0,
                z: 0,
                initialized: false
            });
        }

        // Pre-populate initial cluster positions on grass around origin
        for (let c = 0; c < this.clusters.length; c++) {
            const pos = this.findValidGrassPosition(0, 0, this.spawnRadius * 0.95);
            if (pos) {
                this.clusters[c].x = pos.x;
                this.clusters[c].z = pos.z;
                this.clusters[c].initialized = true;
            }
        }
    }

    private createDefaultInstanceData(count: number): TreeInstanceData[] {
        const list: TreeInstanceData[] = [];
        for (let i = 0; i < count; i++) {
            // 25% standalone satellite trees to fill any wide gaps between clusters
            const isStandalone = (i % 4 === 0);
            const clusterIdx = Math.floor(i / this.treesPerCluster) % Math.max(1, this.clusters.length);
            const treeInClusterIdx = i % this.treesPerCluster;
            const angle = (treeInClusterIdx * (Math.PI * 2 / this.treesPerCluster)) + (Math.random() - 0.5) * 0.9;
            const radiusRatio = 0.25 + Math.random() * 0.75;
            const rotY = Math.random() * Math.PI * 2;
            const rotX = (Math.random() - 0.5) * 0.08;
            const rotZ = (Math.random() - 0.5) * 0.08;
            const scaleBase = 0.75 + Math.random() * 0.55;
            const scaleJitterX = 0.92 + Math.random() * 0.16;
            const scaleJitterY = 0.88 + Math.random() * 0.24;
            const scaleJitterZ = 0.92 + Math.random() * 0.16;

            list.push({
                clusterIdx,
                isStandalone,
                standaloneX: 0,
                standaloneZ: 0,
                angle,
                radiusRatio,
                rotX,
                rotY,
                rotZ,
                scaleBase,
                scaleJitterX,
                scaleJitterY,
                scaleJitterZ,
                active: true
            });
        }
        return list;
    }

    public rebuildAllMatrices() {
        for (const model of this.treeModels) {
            this.rebuildModelMatrices(model);
        }
    }

    private rebuildModelMatrices(model: InstancedTreeModel) {
        for (let i = 0; i < model.count; i++) {
            if (i < this.maxActiveCountPerType) {
                const data = model.instanceData[i];
                if (!data) continue;

                let nx = 0;
                let nz = 0;

                if (data.isStandalone) {
                    nx = data.standaloneX;
                    nz = data.standaloneZ;
                } else {
                    const cluster = this.clusters[data.clusterIdx];
                    if (cluster && cluster.initialized) {
                        const dist = data.radiusRatio * this.clusterSpread;
                        nx = cluster.x + Math.cos(data.angle) * dist;
                        nz = cluster.z + Math.sin(data.angle) * dist;
                    }
                }

                const h = terrainHeightJS(nx, nz);
                if (h >= 4.5 && h <= 32.0 && getPathStrength(nx, nz) < 0.08) {
                    this.dummy.position.set(nx, h, nz);
                    this.dummy.rotation.set(data.rotX, data.rotY, data.rotZ);
                    const s = data.scaleBase * this.scaleMultiplier;
                    this.dummy.scale.set(
                        s * data.scaleJitterX,
                        s * data.scaleJitterY,
                        s * data.scaleJitterZ
                    );
                    this.dummy.updateMatrix();

                    if (model.trunkMesh) model.trunkMesh.setMatrixAt(i, this.dummy.matrix);
                    if (model.canopyMesh) model.canopyMesh.setMatrixAt(i, this.dummy.matrix);
                    if (model.singleMesh) model.singleMesh.setMatrixAt(i, this.dummy.matrix);
                    continue;
                }
            }

            // Hide unused instances below ground
            if (model.trunkMesh) model.trunkMesh.setMatrixAt(i, this.dummyMatrix);
            if (model.canopyMesh) model.canopyMesh.setMatrixAt(i, this.dummyMatrix);
            if (model.singleMesh) model.singleMesh.setMatrixAt(i, this.dummyMatrix);
        }

        if (model.trunkMesh) model.trunkMesh.instanceMatrix.needsUpdate = true;
        if (model.canopyMesh) model.canopyMesh.instanceMatrix.needsUpdate = true;
        if (model.singleMesh) model.singleMesh.instanceMatrix.needsUpdate = true;
    }

    public setClusterSpread(spread: number) {
        this.clusterSpread = Math.max(5.0, Math.min(spread, 100.0));
        this.rebuildAllMatrices();
    }

    public setScaleMultiplier(mult: number) {
        this.scaleMultiplier = Math.max(0.15, Math.min(mult, 12.0));
        this.rebuildAllMatrices();
    }

    public setDensity(count: number) {
        this.maxActiveCountPerType = Math.max(10, Math.min(count, this.treeCountPerType));
        this.rebuildAllMatrices();
    }

    public setTrunkColor(hex: number) {
        this.trunkMaterial.color.setHex(hex);
    }

    public setCanopyColor(hex: number) {
        this.canopyMaterial.color.setHex(hex);
    }

    public setCanopyPalette(palette: number[]) {
        this.canopyPalette = [...palette];
        this.randomizeColors();
        if (this.propsSystem) {
            this.propsSystem.setCandyPalette(this.canopyPalette);
        }
    }

    public applyPreset(presetKey: string) {
        const preset = CANDY_PRESETS[presetKey];
        if (!preset) return;
        this.setTrunkColor(preset.trunkColor);
        this.setCanopyPalette(preset.palette);
    }

    public randomizeColors() {
        for (const model of this.treeModels) {
            const mesh = model.canopyMesh || model.singleMesh;
            if (!mesh) continue;

            for (let i = 0; i < model.count; i++) {
                const palColor = this.canopyPalette[Math.floor(Math.random() * this.canopyPalette.length)];
                this.tempColor.setHex(palColor);
                mesh.setColorAt(i, this.tempColor);
            }
            if (mesh.instanceColor) {
                mesh.instanceColor.needsUpdate = true;
            }
        }
        if (this.propsSystem) {
            this.propsSystem.setCandyPalette(this.canopyPalette);
        }
    }

    private findValidGrassPosition(playerX: number, playerZ: number, maxDist: number): { x: number; z: number; h: number } | null {
        for (let attempt = 0; attempt < 35; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = (0.10 + 0.90 * Math.sqrt(Math.random())) * maxDist;
            const x = playerX + Math.cos(angle) * dist;
            const z = playerZ + Math.sin(angle) * dist;
            const h = terrainHeightJS(x, z);

            // Strict grass meadow check: no beach (h < 4.8), no dirt road, no brown mountains (h > 31.0)
            if (h >= 4.8 && h <= 31.0 && getPathStrength(x, z) < 0.08) {
                const slopeX = Math.abs(terrainHeightJS(x + 2, z) - terrainHeightJS(x - 2, z));
                const slopeZ = Math.abs(terrainHeightJS(x, z + 2) - terrainHeightJS(x - 2, z));
                if (slopeX < 1.8 && slopeZ < 1.8) {
                    return { x, z, h };
                }
            }
        }
        return null;
    }

    private loadTreeModels() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
        loader.setDRACOLoader(dracoLoader);

        this.treeModelFiles.forEach((file) => {
            loader.load(
                file,
                (gltf) => {
                    gltf.scene.updateMatrixWorld(true);

                    const trunkGeometries: THREE.BufferGeometry[] = [];
                    const canopyGeometries: THREE.BufferGeometry[] = [];
                    const allGeometries: THREE.BufferGeometry[] = [];

                    // Identify the main primary tree hierarchy root to exclude stray orphan meshes
                    let mainTreeRoot: THREE.Object3D | null = null;
                    for (const child of gltf.scene.children) {
                        if (child.name.startsWith('Tree') || child.children.length >= 2) {
                            mainTreeRoot = child;
                            break;
                        }
                    }
                    const searchRoot = mainTreeRoot || gltf.scene;

                    searchRoot.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            const mesh = child as THREE.Mesh;
                            const matName = (mesh.material && (mesh.material as THREE.Material).name)
                                ? (mesh.material as THREE.Material).name.toLowerCase()
                                : '';
                            const nodeName = mesh.name.toLowerCase();

                            const isTrunk =
                                matName.includes('wood') ||
                                matName.includes('bark') ||
                                matName.includes('trunk') ||
                                nodeName.includes('wood') ||
                                nodeName.includes('stick') ||
                                nodeName.includes('trunk');

                            const clonedGeom = mesh.geometry.clone();
                            clonedGeom.applyMatrix4(mesh.matrixWorld);

                            // Clean geometry attributes so mergeGeometries succeeds without mismatch
                            if (clonedGeom.attributes.uv2) clonedGeom.deleteAttribute('uv2');
                            if (clonedGeom.attributes.color) clonedGeom.deleteAttribute('color');

                            if (isTrunk) {
                                trunkGeometries.push(clonedGeom);
                            } else {
                                canopyGeometries.push(clonedGeom);
                            }
                            allGeometries.push(clonedGeom);
                        }
                    });

                    if (trunkGeometries.length > 0 && canopyGeometries.length > 0) {
                        const mergedTrunk = mergeGeometries(trunkGeometries, false);
                        const mergedCanopy = mergeGeometries(canopyGeometries, false);

                        if (mergedTrunk && mergedCanopy) {
                            // Compute combined bounding box to normalize scale and ground alignment
                            const combinedBox = new THREE.Box3();
                            mergedTrunk.computeBoundingBox();
                            mergedCanopy.computeBoundingBox();
                            if (mergedTrunk.boundingBox) combinedBox.union(mergedTrunk.boundingBox);
                            if (mergedCanopy.boundingBox) combinedBox.union(mergedCanopy.boundingBox);

                            const size = new THREE.Vector3();
                            combinedBox.getSize(size);
                            const center = new THREE.Vector3();
                            combinedBox.getCenter(center);

                            // Target height in world units (5.5 units tall)
                            const targetHeight = 5.5;
                            const rawHeight = size.y > 0.001 ? size.y : 1.0;
                            const scaleFactor = targetHeight / rawHeight;

                            // Center X/Z and align root base at Y = 0
                            const offsetX = -center.x;
                            const offsetY = -combinedBox.min.y;
                            const offsetZ = -center.z;

                            mergedTrunk.translate(offsetX, offsetY, offsetZ);
                            mergedTrunk.scale(scaleFactor, scaleFactor, scaleFactor);
                            mergedTrunk.computeVertexNormals();

                            mergedCanopy.translate(offsetX, offsetY, offsetZ);
                            mergedCanopy.scale(scaleFactor, scaleFactor, scaleFactor);
                            mergedCanopy.computeVertexNormals();

                            const trunkInstMesh = new THREE.InstancedMesh(
                                mergedTrunk,
                                this.trunkMaterial,
                                this.treeCountPerType
                            );
                            const canopyInstMesh = new THREE.InstancedMesh(
                                mergedCanopy,
                                this.canopyMaterial,
                                this.treeCountPerType
                            );

                            [trunkInstMesh, canopyInstMesh].forEach((instMesh) => {
                                instMesh.castShadow = true;
                                instMesh.receiveShadow = true;
                                // CRITICAL: frustumCulled MUST be false so camera angles do not cull instanced trees
                                instMesh.frustumCulled = false;
                                for (let i = 0; i < this.treeCountPerType; i++) {
                                    instMesh.setMatrixAt(i, this.dummyMatrix);
                                }
                                instMesh.instanceMatrix.needsUpdate = true;
                                this.scene.add(instMesh);
                            });

                            // Apply candy palette variations per instance
                            for (let i = 0; i < this.treeCountPerType; i++) {
                                const palColor = this.canopyPalette[i % this.canopyPalette.length];
                                this.tempColor.setHex(palColor);
                                canopyInstMesh.setColorAt(i, this.tempColor);
                            }
                            if (canopyInstMesh.instanceColor) {
                                canopyInstMesh.instanceColor.needsUpdate = true;
                            }

                            const instanceData = this.createDefaultInstanceData(this.treeCountPerType);
                            // Initialize standalone positions
                            for (const d of instanceData) {
                                if (d.isStandalone) {
                                    const p = this.findValidGrassPosition(0, 0, this.spawnRadius * 0.95);
                                    if (p) {
                                        d.standaloneX = p.x;
                                        d.standaloneZ = p.z;
                                    }
                                }
                            }

                            const modelObj: InstancedTreeModel = {
                                trunkMesh: trunkInstMesh,
                                canopyMesh: canopyInstMesh,
                                count: this.treeCountPerType,
                                instanceData
                            };
                            this.treeModels.push(modelObj);
                            this.rebuildModelMatrices(modelObj);
                            return;
                        }
                    }

                    // Fallback for single-mesh tree models
                    if (allGeometries.length > 0) {
                        const merged = mergeGeometries(allGeometries, false) || allGeometries[0];
                        
                        const singleBox = new THREE.Box3();
                        merged.computeBoundingBox();
                        if (merged.boundingBox) singleBox.copy(merged.boundingBox);

                        const size = new THREE.Vector3();
                        singleBox.getSize(size);
                        const center = new THREE.Vector3();
                        singleBox.getCenter(center);

                        const targetHeight = 5.5;
                        const rawHeight = size.y > 0.001 ? size.y : 1.0;
                        const scaleFactor = targetHeight / rawHeight;

                        const offsetX = -center.x;
                        const offsetY = -singleBox.min.y;
                        const offsetZ = -center.z;

                        merged.translate(offsetX, offsetY, offsetZ);
                        merged.scale(scaleFactor, scaleFactor, scaleFactor);
                        merged.computeVertexNormals();

                        const singleInstMesh = new THREE.InstancedMesh(
                            merged,
                            this.canopyMaterial,
                            this.treeCountPerType
                        );
                        singleInstMesh.castShadow = true;
                        singleInstMesh.receiveShadow = true;
                        // CRITICAL: frustumCulled MUST be false so camera angles do not cull instanced trees
                        singleInstMesh.frustumCulled = false;

                        for (let i = 0; i < this.treeCountPerType; i++) {
                            singleInstMesh.setMatrixAt(i, this.dummyMatrix);
                        }
                        singleInstMesh.instanceMatrix.needsUpdate = true;

                        for (let i = 0; i < this.treeCountPerType; i++) {
                            const palColor = this.canopyPalette[i % this.canopyPalette.length];
                            this.tempColor.setHex(palColor);
                            singleInstMesh.setColorAt(i, this.tempColor);
                        }
                        if (singleInstMesh.instanceColor) {
                            singleInstMesh.instanceColor.needsUpdate = true;
                        }

                        this.scene.add(singleInstMesh);
                        const instanceData = this.createDefaultInstanceData(this.treeCountPerType);
                        for (const d of instanceData) {
                            if (d.isStandalone) {
                                const p = this.findValidGrassPosition(0, 0, this.spawnRadius * 0.95);
                                if (p) {
                                    d.standaloneX = p.x;
                                    d.standaloneZ = p.z;
                                }
                            }
                        }
                        const modelObj: InstancedTreeModel = {
                            singleMesh: singleInstMesh,
                            count: this.treeCountPerType,
                            instanceData
                        };
                        this.treeModels.push(modelObj);
                        this.rebuildModelMatrices(modelObj);
                    }
                },
                undefined,
                (err) => {
                    console.warn('Could not load tree model:', file, err);
                }
            );
        });
    }

    public update(playerX: number, playerZ: number) {
        this.currentFrame++;
        const dist = this.spawnRadius;

        // Recycle distant cluster anchors as player flies
        let clustersChanged = false;
        for (let c = 0; c < this.clusters.length; c++) {
            const cluster = this.clusters[c];
            const dx = cluster.x - playerX;
            const dz = cluster.z - playerZ;
            if (!cluster.initialized || (dx * dx + dz * dz > dist * dist)) {
                const pos = this.findValidGrassPosition(playerX, playerZ, dist * 0.95);
                if (pos) {
                    cluster.x = pos.x;
                    cluster.z = pos.z;
                    cluster.initialized = true;
                    clustersChanged = true;
                }
            }
        }

        // Recycle distant standalone satellite trees
        for (const model of this.treeModels) {
            for (let i = this.currentFrame % 10; i < this.maxActiveCountPerType; i += 10) {
                const d = model.instanceData[i];
                if (d && d.isStandalone) {
                    const dx = d.standaloneX - playerX;
                    const dz = d.standaloneZ - playerZ;
                    if (dx * dx + dz * dz > dist * dist || d.standaloneX === 0) {
                        const pos = this.findValidGrassPosition(playerX, playerZ, dist * 0.95);
                        if (pos) {
                            d.standaloneX = pos.x;
                            d.standaloneZ = pos.z;
                            clustersChanged = true;
                        }
                    }
                }
            }
        }

        if (clustersChanged) {
            this.rebuildAllMatrices();
        }
    }
}
