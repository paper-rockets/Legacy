import * as THREE from 'three';
import { gradientMap } from './terrain';
import { globalConfigManager, WaterSettings } from '../core/config';
import { BiomeId } from './noise';

export class WaterSystem {
    public mesh: THREE.Mesh;
    public materialPhysical: THREE.MeshPhysicalMaterial;
    public materialToon: THREE.MeshToonMaterial;
    public isToonMode: boolean = false;
    public activeBiomeId: BiomeId = 'meadow';

    constructor(scene: THREE.Scene) {
        const waterGeo = new THREE.PlaneGeometry(4000, 4000);
        waterGeo.rotateX(-Math.PI / 2);

        this.activeBiomeId = globalConfigManager.config.activeBiomeId || 'meadow';
        const cfg = globalConfigManager.getBiomeConfig(this.activeBiomeId).water;

        this.materialPhysical = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(cfg.color),
            transparent: true,
            opacity: cfg.opacity,
            roughness: cfg.roughness,
            metalness: cfg.metalness,
            reflectivity: cfg.reflectivity,
            clearcoat: cfg.clearcoat,
            clearcoatRoughness: cfg.clearcoatRoughness,
            depthWrite: false,
            depthTest: true
        });

        this.materialToon = new THREE.MeshToonMaterial({
            color: new THREE.Color(cfg.color),
            transparent: true,
            opacity: cfg.opacity,
            gradientMap,
            depthWrite: false,
            depthTest: true
        });

        this.isToonMode = cfg.isToonMode;
        this.mesh = new THREE.Mesh(waterGeo, this.isToonMode ? this.materialToon : this.materialPhysical);
        this.mesh.position.y = 2.5;
        this.mesh.receiveShadow = false;
        scene.add(this.mesh);
    }

    public switchBiome(biomeId: BiomeId): void {
        this.activeBiomeId = biomeId;
        const cfg = globalConfigManager.getBiomeConfig(biomeId).water;
        this.applyConfig(cfg);
    }

    public applyConfig(cfg: WaterSettings): void {
        this.materialPhysical.color.set(cfg.color);
        this.materialPhysical.opacity = cfg.opacity;
        this.materialPhysical.reflectivity = cfg.reflectivity;
        this.materialPhysical.roughness = cfg.roughness;
        this.materialPhysical.metalness = cfg.metalness;
        this.materialPhysical.clearcoat = cfg.clearcoat;
        this.materialPhysical.clearcoatRoughness = cfg.clearcoatRoughness;

        this.materialToon.color.set(cfg.color);
        this.materialToon.opacity = cfg.opacity;

        this.isToonMode = cfg.isToonMode;
        this.mesh.material = this.isToonMode ? this.materialToon : this.materialPhysical;
    }

    public setBiomeWater(biomeId: BiomeId, partial: Partial<WaterSettings>): void {
        const cfg = globalConfigManager.getBiomeConfig(biomeId).water;
        Object.assign(cfg, partial);
        if (biomeId === this.activeBiomeId) {
            this.applyConfig(cfg);
        }
    }

    public setColor(hex: string, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { color: hex });
    }

    public setOpacity(opacity: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { opacity: Math.max(0, Math.min(1, opacity)) });
    }

    public setReflectivity(val: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { reflectivity: Math.max(0, Math.min(1, val)) });
    }

    public setRoughness(val: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { roughness: Math.max(0, Math.min(1, val)) });
    }

    public setMetalness(val: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { metalness: Math.max(0, Math.min(1, val)) });
    }

    public setClearcoat(val: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { clearcoat: Math.max(0, Math.min(1, val)) });
    }

    public setClearcoatRoughness(val: number, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { clearcoatRoughness: Math.max(0, Math.min(1, val)) });
    }

    public setToonMode(enabled: boolean, biomeId?: BiomeId) {
        this.setBiomeWater(biomeId || this.activeBiomeId, { isToonMode: enabled });
    }

    public update(playerX: number, playerZ: number, _dt: number = 0.016) {
        this.mesh.position.x = playerX;
        this.mesh.position.z = playerZ;
    }
}
