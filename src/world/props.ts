import * as THREE from 'three';
import { gradientMap } from './terrain';

export class PropsSystem {
    public instClouds: THREE.InstancedMesh;

    public cloudCount = 50;

    public propSpawnDist = 550;

    private dummy = new THREE.Object3D();
    private dummyMatrix = new THREE.Matrix4();
    private currentFrame = 0;

    constructor(scene: THREE.Scene) {
        // Cloud material with minimal bloom
        const matCloud = new THREE.MeshToonMaterial({
            color: 0xffffff,
            emissive: new THREE.Color(0xfff6ea),
            emissiveIntensity: 0.0001,
            gradientMap,
            fog: true,
            dithering: true
        });

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

        this.instClouds = new THREE.InstancedMesh(geoCloud, matCloud, this.cloudCount);

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

    public setOptimizedMode(optimized: boolean) {
        if (optimized) {
            this.propSpawnDist = 350;
        } else {
            this.propSpawnDist = 550;
        }
    }

    public update(playerX: number, playerZ: number, dt: number) {
        this.currentFrame++;

        // Clouds (drifting puffy clouds in forward/sky vista)
        let cloudsUpdated = false;
        for (let i = this.currentFrame % 5; i < this.cloudCount; i += 5) {
            this.instClouds.getMatrixAt(i, this.dummy.matrix);
            this.dummy.position.setFromMatrixPosition(this.dummy.matrix);

            const dx = this.dummy.position.x - playerX;
            const dz = this.dummy.position.z - playerZ;

            if (dx * dx + dz * dz > 750 * 750 || this.dummy.position.y < -500) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 250 + Math.random() * 450;
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
