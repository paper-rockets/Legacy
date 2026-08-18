import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

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

export const envConfigs: EnvConfig[] = [
    {
        // 0: Day - High distant sun, natural golden daylight with soft atmospheric horizon fog
        bg: 0x8cbce6, fog: 0x8cbce6, fogNear: 200, fogFar: 720,
        amb: 0xdcf2ff, ambI: 0.75,
        dir: 0xfffaeb, dirI: 1.4,
        dirPos: { x: 250, y: 350, z: -200 },
        hemi: 0.6,
        sunI: 1.8, sunC: 0xfffae0,
        sunPos: { x: 350, y: 400, z: -850 },
        sunScale: 1.3,
        starOp: 0.0
    },
    {
        // 1: Dusk - Sun directly on the distant horizon, casting water reflections
        bg: 0xdd5e42, fog: 0xdd5e42, fogNear: 180, fogFar: 680,
        amb: 0x6a4055, ambI: 0.65,
        dir: 0xff7722, dirI: 1.3,
        dirPos: { x: 0, y: 45, z: -600 },
        hemi: 0.45,
        sunI: 2.6, sunC: 0xff5511,
        sunPos: { x: 0, y: 15, z: -700 },
        sunScale: 2.4,
        starOp: 0.1
    },
    {
        // 2: Twilight - Strong global illumination, rich Ghibli night, high cosmic starfield
        bg: 0x18182c, fog: 0x18182c, fogNear: 180, fogFar: 700,
        amb: 0x444470, ambI: 0.95,
        dir: 0x6677aa, dirI: 0.85,
        dirPos: { x: 100, y: 250, z: -100 },
        hemi: 0.55,
        sunI: 0.0, sunC: 0x000000,
        sunPos: { x: 0, y: -300, z: -800 },
        sunScale: 0.1,
        starOp: 0.95
    }
];

export class LightingSystem {
    public hemiLight: THREE.HemisphereLight;
    public ambientLight: THREE.AmbientLight;
    public dirLight: THREE.DirectionalLight;
    public sunMesh: THREE.Mesh;
    public sunLight: THREE.DirectionalLight;
    public starField: THREE.Points;
    public starMaterial: THREE.PointsMaterial;
    public timePhase: number = 0;

    private targetSunPos = new THREE.Vector3();
    private targetDirPos = new THREE.Vector3();
    private lastShadowSize: number = -1;
    public shadowTuned: boolean = false;

    constructor(scene: THREE.Scene) {
        scene.background = new THREE.Color(0x8cbce6);
        scene.fog = new THREE.Fog(0x8cbce6, 200, 720);

        this.hemiLight = new THREE.HemisphereLight(0xff7d45, 0x24113a, 0.6);
        scene.add(this.hemiLight);

        this.ambientLight = new THREE.AmbientLight(0xdcf2ff, 0.7);
        scene.add(this.ambientLight);

        // Visible Sun
        const sunGeometry = new THREE.IcosahedronGeometry(15, 1);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27f });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sunMesh.position.set(0, 40, -300);
        scene.add(this.sunMesh);

        // Direct Sunburst Light with Lensflare
        this.sunLight = new THREE.DirectionalLight(0xff5500, 2.5);
        this.sunLight.position.copy(this.sunMesh.position);
        this.sunLight.castShadow = false;
        scene.add(this.sunLight);

        const textureLoader = new THREE.TextureLoader();
        const textureFlare0 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');
        const textureFlare3 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare3.png');

        const lensflare = new Lensflare();
        lensflare.addElement(new LensflareElement(textureFlare0, 400, 0, this.sunLight.color));
        lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
        lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
        this.sunLight.add(lensflare);

        // Sunlight casting shadows
        this.dirLight = new THREE.DirectionalLight(0xfffaeb, 1.4);
        this.dirLight.position.set(150, 200, 50);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -120;
        this.dirLight.shadow.camera.right = 120;
        this.dirLight.shadow.camera.top = 120;
        this.dirLight.shadow.camera.bottom = -120;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.002;
        scene.add(this.dirLight);

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
            opacity: 0.0
        });
        this.starField = new THREE.Points(starGeometry, this.starMaterial);
        scene.add(this.starField);
    }

    public cycleTimePhase(): number {
        this.timePhase = (this.timePhase + 1) % 3;
        return this.timePhase;
    }

    public setTimePhase(phase: number): number {
        this.timePhase = Math.max(0, Math.min(2, Math.floor(phase)));
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

    public update(dt: number, scene: THREE.Scene, playerPos: THREE.Vector3, groundY: number) {
        const target = envConfigs[this.timePhase];

        if (scene.background instanceof THREE.Color) {
            scene.background.lerp(new THREE.Color(target.bg), dt * 2);
        }
        if (scene.fog) {
            scene.fog.color.lerp(new THREE.Color(target.fog), dt * 2);
            scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, target.fogNear, dt * 2);
            scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, target.fogFar, dt * 2);
        }

        this.ambientLight.color.lerp(new THREE.Color(target.amb), dt * 2);
        this.ambientLight.intensity += (target.ambI - this.ambientLight.intensity) * dt * 2;
        this.dirLight.color.lerp(new THREE.Color(target.dir), dt * 2);
        this.dirLight.intensity += (target.dirI - this.dirLight.intensity) * dt * 2;
        this.hemiLight.intensity += (target.hemi - this.hemiLight.intensity) * dt * 2;

        this.sunLight.intensity += (target.sunI - this.sunLight.intensity) * dt * 2;
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.lerp(new THREE.Color(target.sunC), dt * 2);
        this.sunMesh.visible = target.sunI > 0.05;

        const targetScale = target.sunScale;
        this.sunMesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), dt * 2);
        this.starMaterial.opacity += (target.starOp - this.starMaterial.opacity) * dt * 2;

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

        // Shadow bounds
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
