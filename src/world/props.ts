import * as THREE from 'three';
import { gradientMap } from './terrain';
import { globalConfigManager } from '../core/config';

export class PropsSystem {
    public instClouds: THREE.InstancedMesh;
    public cloudCount = 50;
    public propSpawnDist = 550;

    private matCloud: THREE.MeshToonMaterial;
    private cloudBloomUniform = { value: 0.45 };
    private cloudEmissiveUniform = { value: new THREE.Color(0xfff6ea) };

    private dummy = new THREE.Object3D();
    private dummyMatrix = new THREE.Matrix4();
    private currentFrame = 0;

    constructor(scene: THREE.Scene) {
        const cld = globalConfigManager.config.cloud;
        this.cloudBloomUniform.value = cld.bloom;
        this.cloudEmissiveUniform.value.set(cld.emissive);

        // Cloud material with customizable bloom & emissive radiance
        this.matCloud = new THREE.MeshToonMaterial({
            color: new THREE.Color(cld.color),
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
                totalEmissiveRadiance += uCloudEmissive * (uCloudBloom * 2.0);
                `
            );
        };

        const geoCloud = new THREE.IcosahedronGeometry(25, 2);
        geoCloud.scale(2.0, 1.0, 1.5);
        const cpos = geoCloud.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < cpos.count; i++) {
            const x = cpos.getX(i);
            let y = cpos.getY(i);
            const z = cpos.getZ(i);
            if (y < 0) {
                y *= 0.3;
            } else {
                const billow = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 4.0;
                y += Math.max(0, billow);
            }
            cpos.setXYZ(i, x, y, z);
        }
        geoCloud.computeVertexNormals();

        this.instClouds = new THREE.InstancedMesh(geoCloud, this.matCloud, this.cloudCount);

        this.instClouds.castShadow = false;
        this.instClouds.receiveShadow = true;
        this.instClouds.frustumCulled = false;
        scene.add(this.instClouds);

        this.dummyMatrix.setPosition(0, -1000, 0);

        for (let i = 0; i < this.instClouds.count; i++) {
            this.instClouds.setMatrixAt(i, this.dummyMatrix);
        }
        this.instClouds.instanceMatrix.needsUpdate = true;
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
            this.propSpawnDist = 350;
        } else {
            this.propSpawnDist = 550;
        }
    }

    public update(playerX: number, playerZ: number, _dt: number) {
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
                    const distSq = (worldX - playerX) ** 2 + (worldZ - playerZ) ** 2;

                    if (distSq < radius * radius && distSq > 80 * 80) {
                        const worldY = 85 + (((rng * 37) % 1) * 35);
                        const scale = 0.8 + (((rng * 71) % 1) * 0.8);

                        this.dummy.position.set(worldX, worldY, worldZ);
                        this.dummy.rotation.set(0, rng * Math.PI * 2, 0);
                        this.dummy.scale.set(scale, scale * 0.7, scale * 1.2);
                        this.dummy.updateMatrix();

                        this.instClouds.setMatrixAt(cloudIdx, this.dummy.matrix);
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
    }
}
