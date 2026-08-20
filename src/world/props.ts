import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientMap } from './terrain';
import { globalConfigManager } from '../core/config';
import { getDominantBiome } from './noise';

const COTTON_CANDY_COLORS = [
    '#f472b6', '#ffb6c1', '#93c5fd', '#7dd3fc',
    '#fef08a', '#fde047', '#d8b4fe', '#c084fc',
    '#ffffff', '#fff0f5'
];

function buildCottonCandyCloudGeometry(): THREE.BufferGeometry {
    const puffCenter = new THREE.IcosahedronGeometry(24, 1).scale(1.8, 0.95, 1.3);
    const puffL = new THREE.IcosahedronGeometry(18, 1).scale(1.3, 0.85, 1.1).translate(-22, 3, 5);
    const puffR = new THREE.IcosahedronGeometry(19, 1).scale(1.4, 0.85, 1.2).translate(23, 2, -4);
    const puffTop = new THREE.IcosahedronGeometry(16, 1).scale(1.2, 0.9, 1.1).translate(4, 12, 2);
    const puffFront = new THREE.IcosahedronGeometry(15, 1).scale(1.1, 0.8, 1.2).translate(-6, -2, 16);
    const puffBack = new THREE.IcosahedronGeometry(16, 1).scale(1.2, 0.8, 1.1).translate(8, 2, -14);

    const merged = mergeGeometries([puffCenter, puffL, puffR, puffTop, puffFront, puffBack], false) || puffCenter;

    const cpos = merged.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cpos.count; i++) {
        const x = cpos.getX(i);
        let y = cpos.getY(i);
        const z = cpos.getZ(i);
        if (y < 0) {
            y *= 0.35;
        } else {
            const billow = Math.sin(x * 0.12) * Math.cos(z * 0.12) * 4.5;
            y += Math.max(0, billow);
        }
        cpos.setXYZ(i, x, y, z);
    }
    merged.computeVertexNormals();
    return merged;
}

export class PropsSystem {
    public instClouds: THREE.InstancedMesh;
    public cloudCount = 50;
    public propSpawnDist = 420;

    private matCloud: THREE.MeshToonMaterial;
    private cloudBloomUniform = { value: 0.0 };
    private cloudEmissiveUniform = { value: new THREE.Color(0xfff6ea) };

    private dummy = new THREE.Object3D();
    private dummyMatrix = new THREE.Matrix4();
    private tempColor = new THREE.Color();
    private currentFrame = 0;

    constructor(scene: THREE.Scene) {
        const cld = globalConfigManager.config.cloud;
        this.cloudBloomUniform.value = cld.bloom;
        this.cloudEmissiveUniform.value.set(cld.emissive);

        // Cloud material with customizable bloom & emissive radiance
        this.matCloud = new THREE.MeshToonMaterial({
            color: new THREE.Color(0xffffff),
            emissive: new THREE.Color(cld.emissive),
            emissiveIntensity: 0.05,
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
                #ifdef USE_INSTANCING_COLOR
                    vec3 emiCol = vInstanceColor.rgb;
                #else
                    vec3 emiCol = uCloudEmissive;
                #endif
                totalEmissiveRadiance += emiCol * (uCloudBloom * 2.0);
                `
            );
        };

        const geoCloud = buildCottonCandyCloudGeometry();

        this.instClouds = new THREE.InstancedMesh(geoCloud, this.matCloud, this.cloudCount);
        this.instClouds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cloudCount * 3), 3);

        this.instClouds.castShadow = false;
        this.instClouds.receiveShadow = true;
        this.instClouds.frustumCulled = false;
        scene.add(this.instClouds);

        this.dummyMatrix.setPosition(0, -1000, 0);

        for (let i = 0; i < this.instClouds.count; i++) {
            this.instClouds.setMatrixAt(i, this.dummyMatrix);
            this.instClouds.setColorAt(i, new THREE.Color(0xffffff));
        }
        this.instClouds.instanceMatrix.needsUpdate = true;
        if (this.instClouds.instanceColor) this.instClouds.instanceColor.needsUpdate = true;
    }

    public applyBiomeCloud(cloudProps: { bloom?: number; color?: string; emissive?: string; cloudBloom?: number; cloudColor?: string; cloudEmissive?: string }) {
        const blm = cloudProps.cloudBloom !== undefined ? cloudProps.cloudBloom : cloudProps.bloom;
        const col = cloudProps.cloudColor !== undefined ? cloudProps.cloudColor : cloudProps.color;
        const emi = cloudProps.cloudEmissive !== undefined ? cloudProps.cloudEmissive : cloudProps.emissive;

        if (blm !== undefined) {
            this.cloudBloomUniform.value = Math.max(0, Math.min(3.0, blm));
        }
        if (col !== undefined) {
            this.matCloud.color.set(col);
        }
        if (emi !== undefined) {
            this.cloudEmissiveUniform.value.set(emi);
            this.matCloud.emissive.set(emi);
        }
    }

    public setBiomeCloud(biomeId: string, cloudProps: Partial<{ bloom: number; color: string; emissive: string; cloudBloom: number; cloudColor: string; cloudEmissive: string }>) {
        const bCfg = globalConfigManager.getBiomeConfig(biomeId as any);
        const blm = cloudProps.cloudBloom !== undefined ? cloudProps.cloudBloom : cloudProps.bloom;
        const col = cloudProps.cloudColor !== undefined ? cloudProps.cloudColor : cloudProps.color;
        const emi = cloudProps.cloudEmissive !== undefined ? cloudProps.cloudEmissive : cloudProps.emissive;

        if (bCfg) {
            if (blm !== undefined) bCfg.bloom.cloudBloom = blm;
            if (col !== undefined) bCfg.bloom.cloudColor = col;
            if (emi !== undefined) bCfg.bloom.cloudEmissive = emi;
        }
        if (biomeId === globalConfigManager.config.activeBiomeId) {
            this.applyBiomeCloud({ cloudBloom: blm, cloudColor: col, cloudEmissive: emi });
        }
    }

    public setCloudBloom(intensity: number, biomeId?: string) {
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        this.setBiomeCloud(activeB, { bloom: intensity });
        globalConfigManager.config.cloud.bloom = this.cloudBloomUniform.value;
    }

    public setCloudColor(hex: string, biomeId?: string) {
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        this.setBiomeCloud(activeB, { color: hex });
        globalConfigManager.config.cloud.color = hex;
    }

    public setCloudEmissive(hex: string, biomeId?: string) {
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        this.setBiomeCloud(activeB, { emissive: hex });
        globalConfigManager.config.cloud.emissive = hex;
    }

    public setOptimizedMode(optimized: boolean) {
        if (optimized) {
            this.propSpawnDist = 280;
        } else {
            this.propSpawnDist = 420;
        }
    }

    public update(playerX: number, playerZ: number, dt: number = 0.016) {
        this.currentFrame++;
        if (this.currentFrame % 3 !== 0) return;

        const stride = 180;
        const radius = this.propSpawnDist;
        const minX = Math.floor((playerX - radius) / stride);
        const maxX = Math.ceil((playerX + radius) / stride);
        const minZ = Math.floor((playerZ - radius) / stride);
        const maxZ = Math.ceil((playerZ + radius) / stride);

        let cloudIdx = 0;

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cz = minZ; cz <= maxZ; cz++) {
                const seed = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
                const rng = seed - Math.floor(seed);

                if (rng > 0.65 && cloudIdx < this.cloudCount) {
                    const worldX = cx * stride + (rng * 60 - 30);
                    const worldZ = cz * stride + (((rng * 13) % 1) * 60 - 30);
                    const cloudBiome = getDominantBiome(worldX, worldZ, 85);

                    const distSq = (worldX - playerX) ** 2 + (worldZ - playerZ) ** 2;

                    if (distSq < radius * radius && distSq > 80 * 80) {
                        const worldY = 85 + (((rng * 37) % 1) * 35);
                        const scale = 0.8 + (((rng * 71) % 1) * 0.8);

                        this.dummy.position.set(worldX, worldY, worldZ);
                        this.dummy.rotation.set(0, rng * Math.PI * 2, 0);
                        const isCandyland = (cloudBiome === 'candyland');
                        const scaleMult = isCandyland ? 1.45 : 1.0;
                        this.dummy.scale.set(scale * scaleMult, scale * (isCandyland ? 0.95 : 0.7), scale * scaleMult * 1.15);
                        this.dummy.updateMatrix();

                        this.instClouds.setMatrixAt(cloudIdx, this.dummy.matrix);

                        if (isCandyland) {
                            const cHex = COTTON_CANDY_COLORS[Math.floor(rng * COTTON_CANDY_COLORS.length) % COTTON_CANDY_COLORS.length];
                            this.tempColor.set(cHex);
                        } else {
                            this.tempColor.set(this.matCloud.color);
                        }
                        this.instClouds.setColorAt(cloudIdx, this.tempColor);

                        cloudIdx++;
                    }
                }
            }
        }

        this.dummyMatrix.setPosition(0, -1000, 0);
        for (let i = cloudIdx; i < this.cloudCount; i++) {
            this.instClouds.setMatrixAt(i, this.dummyMatrix);
        }
        this.instClouds.instanceMatrix.needsUpdate = true;
        if (this.instClouds.instanceColor) this.instClouds.instanceColor.needsUpdate = true;
    }
}
