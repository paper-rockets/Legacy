import * as THREE from 'three';
import { gradientMap } from './terrain';

export class WaterSystem {
    public mesh: THREE.Mesh;
    public materialPhysical: THREE.MeshPhysicalMaterial;
    public materialToon: THREE.MeshToonMaterial;
    private isToonMode: boolean = false;

    constructor(scene: THREE.Scene) {
        const waterGeo = new THREE.PlaneGeometry(4000, 4000);
        waterGeo.rotateX(-Math.PI / 2);

        this.materialPhysical = new THREE.MeshPhysicalMaterial({
            color: 0x4da9e8,
            transparent: true,
            opacity: 0.82,
            roughness: 0.18,
            metalness: 0.05,
            reflectivity: 0.65,
            clearcoat: 0.8,
            clearcoatRoughness: 0.15,
            depthWrite: false
        });

        this.materialToon = new THREE.MeshToonMaterial({
            color: 0x4da9e8,
            transparent: true,
            opacity: 0.85,
            gradientMap,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(waterGeo, this.materialPhysical);
        this.mesh.position.y = 2.5;
        this.mesh.receiveShadow = false;
        scene.add(this.mesh);
    }

    public setToonMode(enabled: boolean) {
        this.isToonMode = enabled;
        this.mesh.material = enabled ? this.materialToon : this.materialPhysical;
    }

    public update(playerX: number, playerZ: number, dt: number = 0.016) {
        this.mesh.position.x = playerX;
        this.mesh.position.z = playerZ;
    }
}
