import * as THREE from 'three';
import { gradientMap } from './terrain';
import { terrainHeightJS, getPathStrength } from './noise';

export class PropsSystem {
    public instCandyBushes: THREE.InstancedMesh;
    public instClouds: THREE.InstancedMesh;

    public candyBushCount = 450;
    public cloudCount = 50;

    public maxActiveCandyBushes = 450;
    public propSpawnDist = 550;

    private dummy = new THREE.Object3D();
    private dummyMatrix = new THREE.Matrix4();
    private tempColor = new THREE.Color();
    private currentFrame = 0;

    public candyPalette: number[] = [
        0xff2a6d, 0x05d9e8, 0xfff01f, 0x9b5de5, 0xf15bb5, 0x00f5d4
    ];

    constructor(scene: THREE.Scene) {
        // Material for candy bushes
        const matCandyBush = new THREE.MeshToonMaterial({
            color: 0xffffff,
            gradientMap,
            dithering: true
        });

        // Emissive cloud material
        const matCloud = new THREE.MeshToonMaterial({
            color: 0xffffff,
            emissive: new THREE.Color(0xfff6ea),
            emissiveIntensity: 0.45,
            gradientMap,
            fog: true,
            dithering: true
        });

        // Cute rounded cartoon candy canopy bush geometry
        const geoBush = new THREE.SphereGeometry(1.0, 14, 10);
        geoBush.scale(1.25, 0.85, 1.25);
        geoBush.translate(0, 0.65, 0);
        geoBush.computeVertexNormals();

        const geoCloud = new THREE.IcosahedronGeometry(25, 2);
        geoCloud.scale(2.0, 1.0, 1.5);
        const cpos = geoCloud.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < cpos.count; i++) {
            let x = cpos.getX(i);
            let y = cpos.getY(i);
            let z = cpos.getZ(i);
            if (y < 0) {
                y *= 0.3;
            } else {
                const billow = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 4.0;
                y += Math.max(0, billow);
            }
            cpos.setXYZ(i, x, y, z);
        }
        geoCloud.computeVertexNormals();

        this.instCandyBushes = new THREE.InstancedMesh(geoBush, matCandyBush, this.candyBushCount);
        this.instClouds = new THREE.InstancedMesh(geoCloud, matCloud, this.cloudCount);

        this.instCandyBushes.castShadow = true;
        this.instCandyBushes.receiveShadow = true;
        this.instCandyBushes.frustumCulled = false;
        scene.add(this.instCandyBushes);

        this.instClouds.castShadow = false;
        this.instClouds.receiveShadow = true;
        this.instClouds.frustumCulled = false;
        scene.add(this.instClouds);

        this.dummyMatrix.setPosition(0, -1000, 0);
        for (let i = 0; i < this.instCandyBushes.count; i++) {
            this.instCandyBushes.setMatrixAt(i, this.dummyMatrix);
        }
        this.instCandyBushes.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < this.instClouds.count; i++) {
            this.instClouds.setMatrixAt(i, this.dummyMatrix);
        }
        this.instClouds.instanceMatrix.needsUpdate = true;

        this.applyCandyColors();
    }

    public setCandyPalette(palette: number[]) {
        this.candyPalette = [...palette];
        this.applyCandyColors();
    }

    public applyCandyColors() {
        if (!this.instCandyBushes || this.candyPalette.length === 0) return;
        for (let i = 0; i < this.candyBushCount; i++) {
            const hex = this.candyPalette[i % this.candyPalette.length];
            this.tempColor.setHex(hex);
            this.instCandyBushes.setColorAt(i, this.tempColor);
        }
        if (this.instCandyBushes.instanceColor) {
            this.instCandyBushes.instanceColor.needsUpdate = true;
        }
    }

    public setOptimizedMode(optimized: boolean) {
        if (optimized) {
            this.maxActiveCandyBushes = 225;
            this.propSpawnDist = 350;
            for (let i = 225; i < this.candyBushCount; i++) {
                this.instCandyBushes.setMatrixAt(i, this.dummyMatrix);
            }
            this.instCandyBushes.instanceMatrix.needsUpdate = true;
        } else {
            this.maxActiveCandyBushes = 450;
            this.propSpawnDist = 550;
        }
    }

    public update(playerX: number, playerZ: number, dt: number) {
        this.currentFrame++;
        const dist = this.propSpawnDist;

        // Candy Bushes update (small cute canopy puffs on grass meadows)
        let bushUpdated = false;
        for (let i = this.currentFrame % 8; i < this.maxActiveCandyBushes; i += 8) {
            this.instCandyBushes.getMatrixAt(i, this.dummy.matrix);
            this.dummy.position.setFromMatrixPosition(this.dummy.matrix);

            const dx = this.dummy.position.x - playerX;
            const dz = this.dummy.position.z - playerZ;
            if (dx * dx + dz * dz > dist * dist || this.dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2;
                const radius = (0.05 + 0.95 * Math.sqrt(Math.random())) * dist;
                const nx = playerX + Math.cos(angle) * radius;
                const nz = playerZ + Math.sin(angle) * radius;
                const h = terrainHeightJS(nx, nz);

                // Place strictly on grass terrain (no brown mountains / dirt tops, no underwater)
                if (h >= 4.5 && h <= 32.0 && getPathStrength(nx, nz) < 0.08) {
                    this.dummy.position.set(nx, h, nz);
                    this.dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                    // Small candy canopy sizes (0.45x to 1.15x)
                    const s = 0.45 + Math.random() * 0.70;
                    this.dummy.scale.set(
                        s * (0.9 + Math.random() * 0.2),
                        s * (0.75 + Math.random() * 0.35),
                        s * (0.9 + Math.random() * 0.2)
                    );
                } else {
                    this.dummy.position.set(0, -1000, 0);
                }
                this.dummy.updateMatrix();
                this.instCandyBushes.setMatrixAt(i, this.dummy.matrix);
                bushUpdated = true;
            }
        }
        if (bushUpdated) {
            this.instCandyBushes.instanceMatrix.needsUpdate = true;
        }

        // Clouds (drifting puffy clouds in sky)
        let cloudsUpdated = false;
        for (let i = this.currentFrame % 5; i < this.cloudCount; i += 5) {
            this.instClouds.getMatrixAt(i, this.dummy.matrix);
            this.dummy.position.setFromMatrixPosition(this.dummy.matrix);

            const dx = this.dummy.position.x - playerX;
            const dz = this.dummy.position.z - playerZ;

            if (dx * dx + dz * dz > (dist * 1.5) * (dist * 1.5) || this.dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * dist * 1.4;
                const nx = playerX + Math.cos(angle) * radius;
                const nz = playerZ + Math.sin(angle) * radius;
                const ny = 140.0 + Math.random() * 110.0;

                this.dummy.position.set(nx, ny, nz);
                this.dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                const s = 0.8 + Math.random() * 1.6;
                this.dummy.scale.set(s, s * 0.7, s * 1.3);
                this.dummy.updateMatrix();
                this.instClouds.setMatrixAt(i, this.dummy.matrix);
                cloudsUpdated = true;
            }
        }
        if (cloudsUpdated) {
            this.instClouds.instanceMatrix.needsUpdate = true;
        }
    }
}
