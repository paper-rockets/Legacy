import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { EnvPhaseConfig, globalConfigManager } from '../core/config';
import { BiomeId } from './noise';

export interface EnvConfig {
    bg: number;
    fog: number;
    fogNear: number;
    fogFar: number;
    amb: number;
    ambI: number;
    dir: number;
    dirI: number;
    dirPos: { x: number; y: number; z: number };
    hemi: number;
    sunI: number;
    sunC: number;
    sunPos: { x: number; y: number; z: number };
    sunScale: number;
    starOp: number;
}

export function hexStringToNumber(hex: string): number {
    if (typeof hex === 'number') return hex;
    const clean = hex.replace('#', '');
    return parseInt(clean, 16) || 0;
}

export function numberToHexString(num: number): string {
    const hex = num.toString(16).padStart(6, '0');
    return `#${hex}`;
}

export function phaseConfigToEnvConfig(cfg: EnvPhaseConfig): EnvConfig {
    return {
        bg: hexStringToNumber(cfg.bg),
        fog: hexStringToNumber(cfg.fog),
        fogNear: cfg.fogNear,
        fogFar: cfg.fogFar,
        amb: hexStringToNumber(cfg.amb),
        ambI: cfg.ambI,
        dir: hexStringToNumber(cfg.dir),
        dirI: cfg.dirI,
        dirPos: { ...cfg.dirPos },
        hemi: cfg.hemi,
        sunI: cfg.sunI,
        sunC: hexStringToNumber(cfg.sunC),
        sunPos: { ...cfg.sunPos },
        sunScale: cfg.sunScale,
        starOp: cfg.starOp
    };
}

export class LightingSystem {
    public hemiLight: THREE.HemisphereLight;
    public ambientLight: THREE.AmbientLight;
    public dirLight: THREE.DirectionalLight;
    public sunMesh: THREE.Mesh;
    public sunLight: THREE.DirectionalLight;
    public starField: THREE.Points;
    public starMaterial: THREE.PointsMaterial;
    public timePhase: number = 0;
    public activeBiomeId: BiomeId = 'meadow';

    public envConfigs: EnvConfig[] = [];

    private targetSunPos = new THREE.Vector3();
    private targetDirPos = new THREE.Vector3();
    private lastShadowSize: number = -1;
    public shadowTuned: boolean = false;

    constructor(scene: THREE.Scene) {
        this.activeBiomeId = globalConfigManager.config.activeBiomeId || 'meadow';
        this.reloadConfigFromManager();

        const initialTarget = this.envConfigs[0];

        scene.background = new THREE.Color(initialTarget.bg);
        scene.fog = new THREE.Fog(initialTarget.fog, initialTarget.fogNear, initialTarget.fogFar);

        this.hemiLight = new THREE.HemisphereLight(0xff7d45, 0x24113a, initialTarget.hemi);
        scene.add(this.hemiLight);

        this.ambientLight = new THREE.AmbientLight(initialTarget.amb, initialTarget.ambI);
        scene.add(this.ambientLight);

        // Visible Sun
        const sunGeometry = new THREE.IcosahedronGeometry(15, 1);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: initialTarget.sunC });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sunMesh.position.set(0, 40, -300);
        scene.add(this.sunMesh);

        // Direct Sunburst Light with Lensflare
        this.sunLight = new THREE.DirectionalLight(initialTarget.sunC, initialTarget.sunI);
        this.sunLight.position.copy(this.sunMesh.position);
        this.sunLight.castShadow = false;
        scene.add(this.sunLight);

        try {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.setCrossOrigin('anonymous');
            const textureFlare0 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');
            const textureFlare3 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare3.png');

            const lensflare = new Lensflare();
            lensflare.addElement(new LensflareElement(textureFlare0, 400, 0, this.sunLight.color));
            lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
            lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
            this.sunLight.add(lensflare);
        } catch (err) {
            console.warn('[LightingSystem] Lensflare init warning:', err);
        }

        // Sunlight casting shadows
        this.dirLight = new THREE.DirectionalLight(initialTarget.dir, initialTarget.dirI);
        this.dirLight.position.set(initialTarget.dirPos.x, initialTarget.dirPos.y, initialTarget.dirPos.z);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -120;
        this.dirLight.shadow.camera.right = 120;
        this.dirLight.shadow.camera.top = 120;
        this.dirLight.shadow.camera.bottom = -120;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0001;
        this.dirLight.shadow.normalBias = 0.05;
        scene.add(this.dirLight);
        scene.add(this.dirLight.target);

        // Celestial Dome Starfield
        const starCount = 1200;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const radius = 800 + Math.random() * 600;
            const theta = Math.random() * 2.0 * Math.PI;
            const cosPhi = 1.0 - Math.random() * 1.15;
            const sinPhi = Math.sqrt(Math.max(0, 1.0 - cosPhi * cosPhi));

            starPositions[i] = radius * sinPhi * Math.cos(theta);
            starPositions[i + 1] = radius * cosPhi;
            starPositions[i + 2] = radius * sinPhi * Math.sin(theta);
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        this.starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.2,
            sizeAttenuation: false,
            fog: false,
            transparent: true,
            opacity: initialTarget.starOp
        });
        this.starField = new THREE.Points(starGeometry, this.starMaterial);
        scene.add(this.starField);
    }

    public reloadConfigFromManager(): void {
        const biomeCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
        this.envConfigs = biomeCfg.phases.map(p => phaseConfigToEnvConfig(p));
    }

    public switchBiome(biomeId: BiomeId, scene?: THREE.Scene): void {
        this.activeBiomeId = biomeId;
        this.reloadConfigFromManager();
        if (scene) {
            this.setTimePhase(this.timePhase, scene);
        }
    }

    public updateBiomePhaseConfig(biomeId: BiomeId, phase: number, partial: Partial<EnvPhaseConfig>, scene?: THREE.Scene): void {
        const biome = globalConfigManager.getBiomeConfig(biomeId);
        const current = biome.phases[phase];
        biome.phases[phase] = { ...current, ...partial };

        if (biomeId === this.activeBiomeId) {
            this.envConfigs[phase] = phaseConfigToEnvConfig(biome.phases[phase]);
            if (phase === this.timePhase && scene) {
                const target = this.envConfigs[phase];
                if (scene.background instanceof THREE.Color) scene.background.set(target.bg);
                if (scene.fog) {
                    scene.fog.color.set(target.fog);
                    scene.fog.near = target.fogNear;
                    scene.fog.far = target.fogFar;
                }
                this.ambientLight.color.set(target.amb);
                this.ambientLight.intensity = target.ambI;
                this.dirLight.color.set(target.dir);
                this.dirLight.intensity = target.dirI;
                this.hemiLight.intensity = target.hemi;
                this.sunLight.intensity = target.sunI;
                this.sunLight.color.set(target.sunC);
                (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(target.sunC);
                this.sunMesh.visible = target.sunI > 0.05;
                this.sunMesh.scale.set(target.sunScale, target.sunScale, target.sunScale);
                this.starMaterial.opacity = target.starOp;
            }
        }
    }

    public updatePhaseConfig(phase: number, partial: Partial<EnvPhaseConfig>, scene?: THREE.Scene): void {
        this.updateBiomePhaseConfig(this.activeBiomeId, phase, partial, scene);
    }

    public getPhaseConfig(phase: number): EnvPhaseConfig {
        return globalConfigManager.getBiomeConfig(this.activeBiomeId).phases[phase];
    }

    public cycleTimePhase(): number {
        this.timePhase = (this.timePhase + 1) % 3;
        return this.timePhase;
    }

    public setTimePhase(phase: number, scene?: THREE.Scene): number {
        this.timePhase = Math.max(0, Math.min(2, Math.floor(phase)));
        this.reloadConfigFromManager();
        if (scene && this.envConfigs[this.timePhase]) {
            const target = this.envConfigs[this.timePhase];
            if (scene.background instanceof THREE.Color) scene.background.set(target.bg);
            if (scene.fog) {
                scene.fog.color.set(target.fog);
                scene.fog.near = target.fogNear;
                scene.fog.far = target.fogFar;
            }
            this.ambientLight.color.set(target.amb);
            this.ambientLight.intensity = target.ambI;
            this.dirLight.color.set(target.dir);
            this.dirLight.intensity = target.dirI;
            this.hemiLight.intensity = target.hemi;
            this.sunLight.intensity = target.sunI;
            this.sunLight.color.set(target.sunC);
            (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(target.sunC);
            this.sunMesh.visible = target.sunI > 0.05;
            this.sunMesh.scale.set(target.sunScale, target.sunScale, target.sunScale);
            this.starMaterial.opacity = target.starOp;
        }
        return this.timePhase;
    }

    public setShadowResolution(size: number) {
        this.dirLight.shadow.mapSize.width = size;
        this.dirLight.shadow.mapSize.height = size;
        if (this.dirLight.shadow.map) {
            this.dirLight.shadow.map.dispose();
            this.dirLight.shadow.map = null as any;
        }
    }

    public fogDisabledInEditor: boolean = false;

    public setFogDisabled(disabled: boolean, scene?: THREE.Scene) {
        this.fogDisabledInEditor = disabled;
        if (scene && scene.fog) {
            if (disabled) {
                scene.fog.near = 99999;
                scene.fog.far = 999999;
            } else {
                const target = this.envConfigs[this.timePhase];
                if (target) {
                    scene.fog.color.set(target.fog);
                    scene.fog.near = target.fogNear;
                    scene.fog.far = target.fogFar;
                }
            }
        }
    }

    public update(dt: number, scene: THREE.Scene, playerPos: THREE.Vector3, groundY: number) {
        const target = this.envConfigs[this.timePhase];
        if (!target) return;

        const lerpFactor = Math.min(1.0, dt * 4.0);

        if (scene.background instanceof THREE.Color) {
            scene.background.lerp(new THREE.Color(target.bg), lerpFactor);
        }
        if (scene.fog) {
            if (this.fogDisabledInEditor) {
                scene.fog.near = 99999;
                scene.fog.far = 999999;
            } else {
                scene.fog.color.lerp(new THREE.Color(target.fog), lerpFactor);
                scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, target.fogNear, lerpFactor);
                scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, target.fogFar, lerpFactor);
            }
        }

        this.ambientLight.color.lerp(new THREE.Color(target.amb), lerpFactor);
        this.ambientLight.intensity += (target.ambI - this.ambientLight.intensity) * lerpFactor;
        this.dirLight.color.lerp(new THREE.Color(target.dir), lerpFactor);
        this.dirLight.intensity += (target.dirI - this.dirLight.intensity) * lerpFactor;
        this.hemiLight.intensity += (target.hemi - this.hemiLight.intensity) * lerpFactor;

        this.sunLight.intensity += (target.sunI - this.sunLight.intensity) * lerpFactor;
        this.sunLight.color.lerp(new THREE.Color(target.sunC), lerpFactor);
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.lerp(new THREE.Color(target.sunC), lerpFactor);
        this.sunMesh.visible = target.sunI > 0.05;

        const targetScale = target.sunScale;
        this.sunMesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
        this.starMaterial.opacity += (target.starOp - this.starMaterial.opacity) * lerpFactor;

        // Follow player position
        this.targetSunPos.set(
            playerPos.x + target.sunPos.x,
            playerPos.y + target.sunPos.y,
            playerPos.z + target.sunPos.z
        );
        this.sunMesh.position.lerp(this.targetSunPos, dt * 4.0);
        this.sunLight.position.copy(this.sunMesh.position);

        this.targetDirPos.set(
            playerPos.x + target.dirPos.x,
            playerPos.y + target.dirPos.y,
            playerPos.z + target.dirPos.z
        );
        this.dirLight.position.lerp(this.targetDirPos, dt * 4.0);
        this.dirLight.target.position.copy(playerPos);
        this.dirLight.target.updateMatrixWorld();

        this.starField.position.set(playerPos.x, playerPos.y, playerPos.z);

        // Dynamic shadow bounding box
        const altitude = Math.max(0, playerPos.y - groundY);
        const shadowMin = this.shadowTuned ? 60 : 120;
        const shadowMax = this.shadowTuned ? 90 : 250;
        const shadowSize = THREE.MathUtils.lerp(shadowMin, shadowMax, Math.min(1, altitude / 150.0));

        if (Math.abs(shadowSize - this.lastShadowSize) > 0.5) {
            this.dirLight.shadow.camera.left = -shadowSize;
            this.dirLight.shadow.camera.right = shadowSize;
            this.dirLight.shadow.camera.top = shadowSize;
            this.dirLight.shadow.camera.bottom = -shadowSize;
            this.dirLight.shadow.camera.updateProjectionMatrix();
            this.lastShadowSize = shadowSize;
        }
    }
}
