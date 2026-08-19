import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class ThumbnailGenerator {
    private static cache: Map<string, string> = new Map();
    private static dracoLoader: DRACOLoader | null = null;
    private static gltfLoader: GLTFLoader | null = null;

    private static getLoader(): GLTFLoader {
        if (!this.gltfLoader) {
            this.gltfLoader = new GLTFLoader();
            this.dracoLoader = new DRACOLoader();
            this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            this.gltfLoader.setDRACOLoader(this.dracoLoader);
        }
        return this.gltfLoader;
    }

    public static async getModelThumbnail(modelPath: string): Promise<string> {
        if (this.cache.has(modelPath)) {
            return this.cache.get(modelPath)!;
        }

        try {
            const width = 160;
            const height = 160;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(1);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.4;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);

            // Rich studio 3-point lighting
            const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 2.2);
            scene.add(hemi);

            const keyLight = new THREE.DirectionalLight(0xfff8eb, 2.8);
            keyLight.position.set(5, 8, 5);
            scene.add(keyLight);

            const fillLight = new THREE.DirectionalLight(0xa5b4fc, 1.6);
            fillLight.position.set(-5, 4, -4);
            scene.add(fillLight);

            const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
            rimLight.position.set(0, -4, -6);
            scene.add(rimLight);

            const loader = this.getLoader();
            return new Promise((resolve) => {
                loader.load(
                    modelPath,
                    (gltf) => {
                        const root = gltf.scene;

                        // Ensure all meshes have double-sided materials and pleasant studio shading
                        root.traverse((child) => {
                            if ((child as THREE.Mesh).isMesh) {
                                const m = child as THREE.Mesh;
                                if (m.material) {
                                    const mats = Array.isArray(m.material) ? m.material : [m.material];
                                    mats.forEach((mat) => {
                                        mat.side = THREE.DoubleSide;
                                        if ('roughness' in mat) (mat as THREE.MeshStandardMaterial).roughness = 0.5;
                                        if ('metalness' in mat) (mat as THREE.MeshStandardMaterial).metalness = 0.1;
                                    });
                                }
                            }
                        });

                        const box = new THREE.Box3().setFromObject(root);
                        const size = box.getSize(new THREE.Vector3());
                        const center = box.getCenter(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z, 0.001);

                        // Normalize scale to exactly 2.0 units so every castle is identically framed
                        const scale = 2.0 / maxDim;
                        root.scale.setScalar(scale);
                        root.position.x = -center.x * scale;
                        root.position.y = -center.y * scale;
                        root.position.z = -center.z * scale;

                        scene.add(root);

                        // Perfect isometric studio perspective
                        camera.position.set(2.8, 2.1, 3.1);
                        camera.lookAt(0, 0, 0);
                        camera.updateProjectionMatrix();

                        renderer.render(scene, camera);
                        const dataUrl = canvas.toDataURL('image/png');
                        ThumbnailGenerator.cache.set(modelPath, dataUrl);

                        // Clean up
                        renderer.dispose();
                        resolve(dataUrl);
                    },
                    undefined,
                    () => {
                        renderer.dispose();
                        resolve(ThumbnailGenerator.createFallbackSVG(modelPath));
                    }
                );
            });
        } catch (err) {
            return this.createFallbackSVG(modelPath);
        }
    }

    private static createFallbackSVG(name: string): string {
        const cleanName = name.split('/').pop()?.replace('.glb', '').replace(/_/g, ' ') || 'Castle';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <rect width="160" height="160" fill="#0f172a" rx="8"/>
            <rect x="40" y="55" width="80" height="75" fill="#334155" rx="4"/>
            <polygon points="40,55 55,20 70,55" fill="#e11d48"/>
            <polygon points="90,55 105,20 120,55" fill="#e11d48"/>
            <polygon points="65,45 80,10 95,45" fill="#f59e0b"/>
            <text x="80" y="145" fill="#94a3b8" font-size="9" font-family="sans-serif" text-anchor="middle">${cleanName.slice(0, 18)}</text>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
}
