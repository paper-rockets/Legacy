import * as THREE from 'three';
import { terrainHeightJS, smoothstep, getPathStrength } from './noise';

const gradientColors = new Uint8Array([
    160, 160, 160, 255, // Shadows
    255, 255, 255, 255  // Light
]);
export const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

export const terrainMat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    vertexColors: true,
    gradientMap,
    dithering: true
});

const colorLow = new THREE.Color(0x76d149);
const colorHigh = new THREE.Color(0x89e05e);
const colorDirt = new THREE.Color(0xdcb58a);
const colorPath = new THREE.Color(0xbd9973);
const colorSand = new THREE.Color(0xf2e1b8);
const tempColor = new THREE.Color();

export class TerrainSystem {
    public mesh: THREE.Mesh;
    private geometry: THREE.PlaneGeometry;
    private lastGridX: number = -99999;
    private lastGridZ: number = -99999;
    public gridStride: number = 6.25;
    public currentRes: number = 256;

    constructor(scene: THREE.Scene, initialRes: number = 256, initialStride?: number) {
        this.currentRes = initialRes;
        this.gridStride = initialStride ?? (1600 / initialRes);
        this.geometry = new THREE.PlaneGeometry(1600, 1600, initialRes, initialRes);
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh = new THREE.Mesh(this.geometry, terrainMat);
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
    }

    public setResolution(res: number, stride: number, playerX: number, playerZ: number) {
        const computedStride = stride || (1600 / res);
        if (this.currentRes === res && this.gridStride === computedStride) return;
        this.currentRes = res;
        this.gridStride = computedStride;
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry(1600, 1600, res, res);
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.geometry = this.geometry;
        this.lastGridX = -99999;
        this.lastGridZ = -99999;
        this.update(playerX, playerZ);
    }

    public update(playerX: number, playerZ: number) {
        const gridX = Math.floor(playerX / this.gridStride) * this.gridStride;
        const gridZ = Math.floor(playerZ / this.gridStride) * this.gridStride;

        if (gridX === this.lastGridX && gridZ === this.lastGridZ) return;

        this.mesh.position.set(gridX, 0, gridZ);

        const pos = this.geometry.attributes.position as THREE.BufferAttribute;
        if (!this.geometry.attributes.color) {
            this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.geometry.attributes.color as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
            const worldX = pos.getX(i) + gridX;
            const worldZ = pos.getZ(i) + gridZ;
            const h = terrainHeightJS(worldX, worldZ);
            pos.setY(i, h);

            let blend = Math.min(Math.max(h / 35.0, 0), 1);
            const patchNoise = (Math.sin(worldX * 0.1) + Math.cos(worldZ * 0.1)) * 0.15;
            blend = Math.min(Math.max(blend + patchNoise, 0), 1);

            if (h > 35) {
                tempColor.lerpColors(colorHigh, colorDirt, smoothstep(35, 45, h));
            } else if (h < 2.8) {
                tempColor.copy(colorSand);
            } else if (h < 4.2) {
                tempColor.lerpColors(colorSand, colorLow, smoothstep(2.8, 4.2, h));
            } else {
                tempColor.lerpColors(colorLow, colorHigh, smoothstep(0, 1, blend));
                const pStrength = getPathStrength(worldX, worldZ);
                const pathMask = smoothstep(4.5, 7.0, h);
                if (pStrength > 0 && pathMask > 0) {
                    tempColor.lerp(colorPath, pStrength * pathMask);
                }
            }
            colors.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
        }

        this.geometry.computeVertexNormals();
        pos.needsUpdate = true;
        colors.needsUpdate = true;

        this.lastGridX = gridX;
        this.lastGridZ = gridZ;
    }
}
