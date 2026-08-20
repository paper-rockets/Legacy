import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { globalConfigManager } from './config';

export class RenderPipeline {
    public renderer: THREE.WebGLRenderer;
    public composer: EffectComposer;
    public renderPass: RenderPass;
    public bloomPass: UnrealBloomPass;
    public camera: THREE.PerspectiveCamera;
    public scene: THREE.Scene;
    public container: HTMLElement;
    public basePixelRatio: number = 2.0;

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = new THREE.Scene();

        const initialWidth = this.container.clientWidth || window.innerWidth;
        const initialHeight = this.container.clientHeight || window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(60, initialWidth / initialHeight, 0.1, 1500);
        this.camera.position.set(0, 9, 26);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            precision: 'highp',
            depth: true,
            stencil: false
        });

        this.renderer.setSize(initialWidth, initialHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.basePixelRatio));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        this.container.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        const blm = globalConfigManager.config.globalBloom;
        const bloomRes = new THREE.Vector2(Math.floor(initialWidth * 0.5), Math.floor(initialHeight * 0.5));
        this.bloomPass = new UnrealBloomPass(
            bloomRes,
            blm.strength,
            blm.radius,
            blm.threshold
        );
        this.composer.addPass(this.bloomPass);

        this.setupResizeListener();
    }

    public async init() {
        // Synchronous & ready immediately
    }

    public handleResize(customWidth?: number, customHeight?: number) {
        const width = customWidth ?? (this.container.clientWidth || window.innerWidth);
        const height = customHeight ?? (this.container.clientHeight || window.innerHeight);
        if (width <= 0 || height <= 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.basePixelRatio));
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.bloomPass.setSize(Math.floor(width * 0.5), Math.floor(height * 0.5));
    }

    public applyBiomeBloom(bloom: { globalStrength?: number; globalRadius?: number; globalThreshold?: number }, lerpFactor?: number, timePhase?: number) {
        let phaseMultiplier = 1.0;
        if (timePhase !== undefined) {
            // Day = 0.0 (off), Dusk = 0.35 (subtle low glow), Twilight/Night = 1.0 (brightest neon glow)
            phaseMultiplier = timePhase === 0 ? 0.0 : (timePhase === 1 ? 0.35 : 1.0);
        }

        const baseStrength = bloom.globalStrength !== undefined ? Math.max(0, Math.min(3.0, bloom.globalStrength)) : this.bloomPass.strength;
        const targetStrength = baseStrength * phaseMultiplier;
        const targetRadius = bloom.globalRadius !== undefined ? Math.max(0, Math.min(2.0, bloom.globalRadius)) : this.bloomPass.radius;
        const targetThreshold = bloom.globalThreshold !== undefined ? Math.max(0, Math.min(1.0, bloom.globalThreshold)) : this.bloomPass.threshold;

        if (lerpFactor !== undefined && lerpFactor < 1.0) {
            this.bloomPass.strength = THREE.MathUtils.lerp(this.bloomPass.strength, targetStrength, lerpFactor);
            this.bloomPass.radius = THREE.MathUtils.lerp(this.bloomPass.radius, targetRadius, lerpFactor);
            this.bloomPass.threshold = THREE.MathUtils.lerp(this.bloomPass.threshold, targetThreshold, lerpFactor);
        } else {
            this.bloomPass.strength = targetStrength;
            this.bloomPass.radius = targetRadius;
            this.bloomPass.threshold = targetThreshold;
        }
    }

    public setBloomStrength(val: number, biomeId?: string) {
        this.bloomPass.strength = Math.max(0, Math.min(3.0, val));
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(activeB as any);
        if (bCfg) {
            bCfg.bloom.globalStrength = this.bloomPass.strength;
        }
        globalConfigManager.config.globalBloom.strength = this.bloomPass.strength;
    }

    public setBloomRadius(val: number, biomeId?: string) {
        this.bloomPass.radius = Math.max(0, Math.min(2.0, val));
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(activeB as any);
        if (bCfg) {
            bCfg.bloom.globalRadius = this.bloomPass.radius;
        }
        globalConfigManager.config.globalBloom.radius = this.bloomPass.radius;
    }

    public setBloomThreshold(val: number, biomeId?: string) {
        this.bloomPass.threshold = Math.max(0, Math.min(1.0, val));
        const activeB = biomeId || globalConfigManager.config.activeBiomeId;
        const bCfg = globalConfigManager.getBiomeConfig(activeB as any);
        if (bCfg) {
            bCfg.bloom.globalThreshold = this.bloomPass.threshold;
        }
        globalConfigManager.config.globalBloom.threshold = this.bloomPass.threshold;
    }

    public setPixelRatioCap(maxDpi: number) {
        this.basePixelRatio = maxDpi;
        this.handleResize();
    }

    public setGraphicsProfile(profile: 'high_performance' | 'regular') {
        if (profile === 'regular') {
            this.basePixelRatio = 1.0;
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
        } else {
            this.basePixelRatio = 2.0;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        this.renderer.shadowMap.needsUpdate = true;
        this.handleResize();
    }

    private setupResizeListener() {
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    public render() {
        if (this.bloomPass.strength > 0.001) {
            this.bloomPass.enabled = true;
            this.composer.render();
        } else {
            this.bloomPass.enabled = false;
            this.renderer.render(this.scene, this.camera);
        }
    }
}
