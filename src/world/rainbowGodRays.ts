import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Spectral Rainbow Color Palettes (Cosine Gradient Coefficients)
// Form: color(t) = a + b * cos(2 * PI * (c * t + d))
export interface PaletteDef {
    name: string;
    a: THREE.Vector3;
    b: THREE.Vector3;
    c: THREE.Vector3;
    d: THREE.Vector3;
}

export const RAINBOW_PALETTES: Record<string, PaletteDef> = {
    'Spectral Prismatic': {
        name: 'Spectral Prismatic',
        a: new THREE.Vector3(0.5, 0.5, 0.5),
        b: new THREE.Vector3(0.5, 0.5, 0.5),
        c: new THREE.Vector3(1.0, 1.0, 1.0),
        d: new THREE.Vector3(0.0, 0.33, 0.67)
    },
    'Atmospheric Horizon Rainbow': {
        name: 'Atmospheric Horizon Rainbow',
        a: new THREE.Vector3(0.62, 0.58, 0.65),
        b: new THREE.Vector3(0.48, 0.45, 0.52),
        c: new THREE.Vector3(0.9, 0.95, 1.05),
        d: new THREE.Vector3(0.95, 0.25, 0.6)
    },
    'Auroral Pastel': {
        name: 'Auroral Pastel',
        a: new THREE.Vector3(0.8, 0.7, 0.9),
        b: new THREE.Vector3(0.3, 0.4, 0.3),
        c: new THREE.Vector3(1.0, 1.0, 0.8),
        d: new THREE.Vector3(0.2, 0.5, 0.7)
    },
    'Cosmic Opal': {
        name: 'Cosmic Opal',
        a: new THREE.Vector3(0.65, 0.8, 0.85),
        b: new THREE.Vector3(0.35, 0.25, 0.35),
        c: new THREE.Vector3(1.2, 1.0, 1.1),
        d: new THREE.Vector3(0.1, 0.45, 0.8)
    },
    'Solar Prism': {
        name: 'Solar Prism',
        a: new THREE.Vector3(0.9, 0.75, 0.6),
        b: new THREE.Vector3(0.3, 0.3, 0.4),
        c: new THREE.Vector3(0.8, 1.0, 1.2),
        d: new THREE.Vector3(0.05, 0.25, 0.6)
    },
    'Neon Aurora': {
        name: 'Neon Aurora',
        a: new THREE.Vector3(0.5, 0.5, 0.5),
        b: new THREE.Vector3(0.6, 0.6, 0.6),
        c: new THREE.Vector3(1.5, 1.5, 1.5),
        d: new THREE.Vector3(0.1, 0.4, 0.7)
    },
    'Fairy Mist': {
        name: 'Fairy Mist',
        a: new THREE.Vector3(0.85, 0.75, 0.88),
        b: new THREE.Vector3(0.2, 0.25, 0.2),
        c: new THREE.Vector3(1.0, 1.0, 1.0),
        d: new THREE.Vector3(0.3, 0.6, 0.9)
    }
};

// Screen-Space Spectral Radial Raymarching Shader
export const RainbowGodRaysShader = {
    uniforms: {
        tDiffuse: { value: null },
        tOcclusion: { value: null },
        uSunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
        uSunVisible: { value: 1.0 },
        uExposure: { value: 0.95 },
        uDecay: { value: 0.95 },
        uDensity: { value: 0.92 },
        uWeight: { value: 0.42 },
        uSamples: { value: 64 },
        uRainbowSaturation: { value: 1.0 },
        uAngularDispersion: { value: 2.2 },
        uRadialDispersion: { value: 0.02 },
        uHorizontalSpectrum: { value: 1.0 }, // 1.0 = Panoramic horizon rainbow (photos), 0.0 = Radial
        uShimmerSpeed: { value: 0.2 },
        uTime: { value: 0.0 },
        uPaletteA: { value: RAINBOW_PALETTES['Spectral Prismatic'].a },
        uPaletteB: { value: RAINBOW_PALETTES['Spectral Prismatic'].b },
        uPaletteC: { value: RAINBOW_PALETTES['Spectral Prismatic'].c },
        uPaletteD: { value: RAINBOW_PALETTES['Spectral Prismatic'].d },
        uBiomeIntensity: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tOcclusion;
        uniform vec2 uSunScreenPos;
        uniform float uSunVisible;
        uniform float uExposure;
        uniform float uDecay;
        uniform float uDensity;
        uniform float uWeight;
        uniform int uSamples;
        uniform float uRainbowSaturation;
        uniform float uAngularDispersion;
        uniform float uRadialDispersion;
        uniform float uHorizontalSpectrum;
        uniform float uShimmerSpeed;
        uniform float uTime;
        uniform vec3 uPaletteA;
        uniform vec3 uPaletteB;
        uniform vec3 uPaletteC;
        uniform vec3 uPaletteD;
        uniform float uBiomeIntensity;

        varying vec2 vUv;

        // Cosine-based spectral gradient generator
        vec3 evalSpectralPalette(float t) {
            return clamp(uPaletteA + uPaletteB * cos(6.2831853 * (uPaletteC * t + uPaletteD)), 0.0, 1.0);
        }

        void main() {
            vec4 sceneColor = texture2D(tDiffuse, vUv);

            // If sun is behind the camera or biome inactive, pass through scene color
            if (uSunVisible < 0.5 || uBiomeIntensity <= 0.001) {
                gl_FragColor = sceneColor;
                return;
            }

            vec2 deltaTextCoord = (vUv - uSunScreenPos);
            deltaTextCoord *= (1.0 / float(uSamples)) * uDensity;

            vec2 coord = vUv;
            float illuminationDecay = 1.0;
            vec3 accumulatedRays = vec3(0.0);

            // Compute angle and position of current ray
            vec2 rayVector = vUv - uSunScreenPos;
            float rayAngle = atan(rayVector.y, rayVector.x);
            float rayLength = length(rayVector);

            // Horizontal screen spectrum coordinate (Left = Red/Orange -> Center = Green/Cyan -> Right = Blue/Violet)
            float horizonPhase = vUv.x * 0.95 + 0.05;

            // Raymarching accumulation loop
            for (int i = 0; i < 64; i++) {
                if (i >= uSamples) break;

                coord -= deltaTextCoord;
                
                // Clamp coordinates to screen space
                if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
                    illuminationDecay *= uDecay;
                    continue;
                }

                // Sample occlusion buffer (white = sun emitter / cloud rift, black = dense cloud/terrain)
                vec4 occSample = texture2D(tOcclusion, coord);
                float lightStrength = occSample.r;

                // Spectral phase computation:
                // Option A: Panoramic Horizontal Spectrum (matches photo: red on left to violet on right)
                // Option B: Angular / Radial dispersion
                float sampleIndexF = float(i);
                float radialPhase = (rayAngle * uAngularDispersion / 6.2831853)
                                  + (sampleIndexF * uRadialDispersion)
                                  + (rayLength * 0.3)
                                  + (uTime * uShimmerSpeed * 0.05);

                float finalPhase = mix(radialPhase, horizonPhase + (sampleIndexF * 0.005), uHorizontalSpectrum);

                // Sample vibrant rainbow color from cosine spectral palette
                vec3 rainbowColor = evalSpectralPalette(finalPhase);

                // Core highlight (pure sun energy near rift center, decomposing into chromatic spectrum)
                float coreFactor = smoothstep(0.8, 0.0, rayLength * (1.0 + sampleIndexF * 0.02));
                vec3 rayColor = mix(rainbowColor, vec3(1.0, 0.98, 0.92), coreFactor * 0.55);
                rayColor = mix(vec3(1.0), rayColor, uRainbowSaturation);

                // Accumulate spectral radiance
                accumulatedRays += rayColor * lightStrength * illuminationDecay * uWeight;

                illuminationDecay *= uDecay;
            }

            // Scale by exposure and biome intensity
            accumulatedRays *= uExposure * uBiomeIntensity;

            // Soft atmospheric blend
            vec3 finalColor = sceneColor.rgb + accumulatedRays;

            gl_FragColor = vec4(finalColor, sceneColor.a);
        }
    `
};

// Pass Implementation
export class RainbowSpectralPass extends Pass {
    public scene: THREE.Scene;
    public camera: THREE.Camera;
    public sunMesh: THREE.Object3D;
    public occlusionRenderTarget: THREE.WebGLRenderTarget;
    public occlusionMaterial: THREE.MeshBasicMaterial;
    public blackMaterial: THREE.MeshBasicMaterial;
    public rayMaterial: THREE.ShaderMaterial;
    public fsQuad: FullScreenQuad;
    public renderToScreen: boolean = false;
    public clear: boolean = false;
    public needsSwap: boolean = true;

    public params = {
        enabled: true,
        exposure: 1.0,
        decay: 0.95,
        density: 0.92,
        weight: 0.45,
        samples: 64,
        rainbowSaturation: 1.0,
        angularDispersion: 2.2,
        radialDispersion: 0.02,
        horizontalSpectrum: 1.0, // Default to panoramic horizontal rainbow matching photos
        shimmerSpeed: 0.25,
        palette: 'Spectral Prismatic',
        biomeIntensity: 1.0
    };

    private sunScreenPos = new THREE.Vector2();
    private tempVec3 = new THREE.Vector3();

    constructor(scene: THREE.Scene, camera: THREE.Camera, sunMesh: THREE.Object3D, width: number, height: number) {
        super();
        this.scene = scene;
        this.camera = camera;
        this.sunMesh = sunMesh;

        // Downsampled occlusion buffer for high performance and smooth ray diffusion
        const occWidth = Math.floor(width / 2);
        const occHeight = Math.floor(height / 2);

        this.occlusionRenderTarget = new THREE.WebGLRenderTarget(occWidth, occHeight, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });

        this.occlusionMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        this.rayMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(RainbowGodRaysShader.uniforms),
            vertexShader: RainbowGodRaysShader.vertexShader,
            fragmentShader: RainbowGodRaysShader.fragmentShader,
            depthTest: false,
            depthWrite: false
        });

        this.fsQuad = new FullScreenQuad(this.rayMaterial);
    }

    public setPalette(paletteName: string) {
        const pal = RAINBOW_PALETTES[paletteName] || RAINBOW_PALETTES['Spectral Prismatic'];
        this.params.palette = paletteName;
        this.rayMaterial.uniforms.uPaletteA.value.copy(pal.a);
        this.rayMaterial.uniforms.uPaletteB.value.copy(pal.b);
        this.rayMaterial.uniforms.uPaletteC.value.copy(pal.c);
        this.rayMaterial.uniforms.uPaletteD.value.copy(pal.d);
    }

    public setSize(width: number, height: number) {
        const occWidth = Math.floor(width / 2);
        const occHeight = Math.floor(height / 2);
        this.occlusionRenderTarget.setSize(occWidth, occHeight);
    }

    public update(dt: number) {
        this.rayMaterial.uniforms.uTime.value += dt;
        this.rayMaterial.uniforms.uExposure.value = this.params.exposure;
        this.rayMaterial.uniforms.uDecay.value = this.params.decay;
        this.rayMaterial.uniforms.uDensity.value = this.params.density;
        this.rayMaterial.uniforms.uWeight.value = this.params.weight;
        this.rayMaterial.uniforms.uSamples.value = this.params.samples;
        this.rayMaterial.uniforms.uRainbowSaturation.value = this.params.rainbowSaturation;
        this.rayMaterial.uniforms.uAngularDispersion.value = this.params.angularDispersion;
        this.rayMaterial.uniforms.uRadialDispersion.value = this.params.radialDispersion;
        this.rayMaterial.uniforms.uHorizontalSpectrum.value = this.params.horizontalSpectrum;
        this.rayMaterial.uniforms.uShimmerSpeed.value = this.params.shimmerSpeed;
        this.rayMaterial.uniforms.uBiomeIntensity.value = this.params.biomeIntensity;

        // Project Sun position to Screen Space (NDC -> UV [0, 1])
        this.sunMesh.getWorldPosition(this.tempVec3);
        this.tempVec3.project(this.camera);

        const isBehindCamera = this.tempVec3.z > 1.0;
        this.rayMaterial.uniforms.uSunVisible.value = isBehindCamera ? 0.0 : 1.0;

        this.sunScreenPos.x = (this.tempVec3.x + 1.0) * 0.5;
        this.sunScreenPos.y = (this.tempVec3.y + 1.0) * 0.5;
        this.rayMaterial.uniforms.uSunScreenPos.value.copy(this.sunScreenPos);
    }

    public render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
        if (!this.params.enabled) {
            if (this.renderToScreen) {
                renderer.setRenderTarget(null);
                this.fsQuad.material = new THREE.MeshBasicMaterial({ map: readBuffer.texture });
                this.fsQuad.render(renderer);
            }
            return;
        }

        // Pass 1: Render Occlusion Buffer (Black scene geometry, white sun emitter)
        const initialClearColor = renderer.getClearColor(new THREE.Color());
        const initialClearAlpha = renderer.getClearAlpha();

        renderer.setRenderTarget(this.occlusionRenderTarget);
        renderer.setClearColor(0x000000, 1.0);
        renderer.clear();

        // Render black silhouettes of terrain and clouds, glowing sun
        const previousOverride = this.scene.overrideMaterial;
        this.scene.overrideMaterial = this.blackMaterial;
        
        // Sun visible as pure white
        const sunMat = (this.sunMesh as THREE.Mesh).material;
        (this.sunMesh as THREE.Mesh).material = this.occlusionMaterial;

        renderer.render(this.scene, this.camera);

        // Restore original materials
        (this.sunMesh as THREE.Mesh).material = sunMat;
        this.scene.overrideMaterial = previousOverride;
        renderer.setClearColor(initialClearColor, initialClearAlpha);

        // Pass 2: Spectral Radial Raymarching Composite
        this.rayMaterial.uniforms.tDiffuse.value = readBuffer.texture;
        this.rayMaterial.uniforms.tOcclusion.value = this.occlusionRenderTarget.texture;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
        }

        this.fsQuad.material = this.rayMaterial;
        this.fsQuad.render(renderer);
    }

    public dispose() {
        this.occlusionRenderTarget.dispose();
        this.occlusionMaterial.dispose();
        this.blackMaterial.dispose();
        this.rayMaterial.dispose();
        this.fsQuad.dispose();
    }
}

// 3D Volumetric Biome Light Pillar & Shaft Cones (Celestial Beacon Mode)
export class BiomeVolumetricRayPillar {
    public group: THREE.Group;
    public mainPillar: THREE.Mesh;
    public outerBeams: THREE.Mesh;
    public groundRing: THREE.Mesh;
    public material: THREE.ShaderMaterial;
    public outerMaterial: THREE.ShaderMaterial;
    public ringMaterial: THREE.ShaderMaterial;

    public params = {
        height: 600,
        topRadius: 180,
        bottomRadius: 70,
        intensity: 1.0,
        dispersion: 1.8,
        shimmerSpeed: 0.8,
        rainbowSat: 1.0,
        palette: 'Spectral Prismatic'
    };

    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'BiomeVolumetricRayPillar';

        const pal = RAINBOW_PALETTES['Spectral Prismatic'];

        const uniforms = {
            uTime: { value: 0.0 },
            uIntensity: { value: 1.0 },
            uDispersion: { value: 1.8 },
            uShimmerSpeed: { value: 0.8 },
            uRainbowSat: { value: 1.0 },
            uHeight: { value: this.params.height },
            uPaletteA: { value: pal.a.clone() },
            uPaletteB: { value: pal.b.clone() },
            uPaletteC: { value: pal.c.clone() },
            uPaletteD: { value: pal.d.clone() }
        };

        // Main dense central cone
        const vertShader = /* glsl */ `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vec4 worldP = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldP.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldP;
            }
        `;

        const fragShader = /* glsl */ `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uDispersion;
            uniform float uShimmerSpeed;
            uniform float uRainbowSat;
            uniform float uHeight;
            uniform vec3 uPaletteA;
            uniform vec3 uPaletteB;
            uniform vec3 uPaletteC;
            uniform vec3 uPaletteD;

            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;

            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ;
                m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            vec3 evalSpectralPalette(float t) {
                return clamp(uPaletteA + uPaletteB * cos(6.2831853 * (uPaletteC * t + uPaletteD)), 0.0, 1.0);
            }

            void main() {
                float heightFactor = vUv.y;
                float verticalFalloff = smoothstep(0.0, 0.15, heightFactor) * smoothstep(1.0, 0.85, heightFactor);

                vec2 noiseCoord = vec2(vUv.x * 12.0 + uTime * 0.08, vUv.y * 6.0 - uTime * uShimmerSpeed * 0.3);
                float shaftNoise1 = snoise(noiseCoord) * 0.5 + 0.5;
                float shaftNoise2 = snoise(noiseCoord * 2.5 + vec2(100.0, 50.0)) * 0.5 + 0.5;
                float beamShafts = pow(shaftNoise1 * 0.7 + shaftNoise2 * 0.3, 1.6) * 1.8;

                float spectralPhase = (vUv.x * uDispersion) + (heightFactor * 0.6) + (uTime * uShimmerSpeed * 0.05);

                vec3 rainbowCol = evalSpectralPalette(spectralPhase);
                vec3 finalColor = mix(vec3(1.0, 0.98, 0.95), rainbowCol, uRainbowSat);

                float viewDot = abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
                float fresnel = pow(1.0 - viewDot, 1.8) * 0.6 + 0.4;

                float alpha = beamShafts * verticalFalloff * fresnel * uIntensity * 0.55;

                gl_FragColor = vec4(finalColor * (1.0 + beamShafts * 0.4), alpha);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(uniforms),
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // Main cone geometry
        const coneGeo = new THREE.CylinderGeometry(
            this.params.topRadius,
            this.params.bottomRadius,
            this.params.height,
            48,
            32,
            true
        );
        coneGeo.translate(0, this.params.height / 2, 0);

        this.mainPillar = new THREE.Mesh(coneGeo, this.material);
        this.group.add(this.mainPillar);

        // Outer secondary wider cone
        this.outerMaterial = this.material.clone();
        this.outerMaterial.uniforms.uIntensity.value = 0.4;

        const outerConeGeo = new THREE.CylinderGeometry(
            this.params.topRadius * 1.6,
            this.params.bottomRadius * 1.8,
            this.params.height * 1.05,
            32,
            16,
            true
        );
        outerConeGeo.translate(0, this.params.height / 2, 0);

        this.outerBeams = new THREE.Mesh(outerConeGeo, this.outerMaterial);
        this.group.add(this.outerBeams);

        // Ground Caustic Impact Ring
        const ringFragShader = /* glsl */ `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uRainbowSat;
            uniform vec3 uPaletteA;
            uniform vec3 uPaletteB;
            uniform vec3 uPaletteC;
            uniform vec3 uPaletteD;

            varying vec2 vUv;

            vec3 evalSpectralPalette(float t) {
                return clamp(uPaletteA + uPaletteB * cos(6.2831853 * (uPaletteC * t + uPaletteD)), 0.0, 1.0);
            }

            void main() {
                vec2 center = vUv - vec2(0.5);
                float dist = length(center) * 2.0;
                if (dist > 1.0) discard;

                float angle = atan(center.y, center.x);
                float ringPulse = sin(dist * 20.0 - uTime * 2.0) * 0.5 + 0.5;
                float ringFalloff = smoothstep(1.0, 0.4, dist) * smoothstep(0.0, 0.2, dist);

                float spectralPhase = (angle / 6.2831853) + (dist * 1.5) + (uTime * 0.1);
                vec3 col = evalSpectralPalette(spectralPhase);
                col = mix(vec3(1.0), col, uRainbowSat);

                float alpha = (ringFalloff + ringPulse * 0.3) * uIntensity * 0.7;
                gl_FragColor = vec4(col * 1.4, alpha);
            }
        `;

        this.ringMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(uniforms),
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 worldP = modelMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * viewMatrix * worldP;
                }
            `,
            fragmentShader: ringFragShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const ringGeo = new THREE.PlaneGeometry(this.params.bottomRadius * 3.2, this.params.bottomRadius * 3.2);
        ringGeo.rotateX(-Math.PI / 2);
        this.groundRing = new THREE.Mesh(ringGeo, this.ringMaterial);
        this.groundRing.position.y = 1.0;
        this.group.add(this.groundRing);
    }

    public setPalette(paletteName: string) {
        const pal = RAINBOW_PALETTES[paletteName] || RAINBOW_PALETTES['Spectral Prismatic'];
        this.params.palette = paletteName;

        const updateUniforms = (mat: THREE.ShaderMaterial) => {
            mat.uniforms.uPaletteA.value.copy(pal.a);
            mat.uniforms.uPaletteB.value.copy(pal.b);
            mat.uniforms.uPaletteC.value.copy(pal.c);
            mat.uniforms.uPaletteD.value.copy(pal.d);
        };

        updateUniforms(this.material);
        updateUniforms(this.outerMaterial);
        updateUniforms(this.ringMaterial);
    }

    public setPosition(x: number, y: number, z: number) {
        this.group.position.set(x, y, z);
    }

    public update(dt: number) {
        const time = this.material.uniforms.uTime.value + dt;
        this.material.uniforms.uTime.value = time;
        this.outerMaterial.uniforms.uTime.value = time;
        this.ringMaterial.uniforms.uTime.value = time;

        this.material.uniforms.uIntensity.value = this.params.intensity;
        this.outerMaterial.uniforms.uIntensity.value = this.params.intensity * 0.45;
        this.ringMaterial.uniforms.uIntensity.value = this.params.intensity;

        this.material.uniforms.uDispersion.value = this.params.dispersion;
        this.outerMaterial.uniforms.uDispersion.value = this.params.dispersion;

        this.material.uniforms.uRainbowSat.value = this.params.rainbowSat;
        this.outerMaterial.uniforms.uRainbowSat.value = this.params.rainbowSat;
        this.ringMaterial.uniforms.uRainbowSat.value = this.params.rainbowSat;

        this.mainPillar.rotation.y += dt * 0.04;
        this.outerBeams.rotation.y -= dt * 0.025;
        this.groundRing.rotation.y += dt * 0.06;
    }

    public dispose() {
        this.mainPillar.geometry.dispose();
        this.material.dispose();
        this.outerBeams.geometry.dispose();
        this.outerMaterial.dispose();
        this.groundRing.geometry.dispose();
        this.ringMaterial.dispose();
    }
}

// Spectral Sparkling Dust Particle System
export class SpectralParticleSystem {
    public points: THREE.Points;
    public geometry: THREE.BufferGeometry;
    public material: THREE.ShaderMaterial;
    public particleCount = 1200;

    private posArray: Float32Array;
    private velArray: Float32Array;
    private phaseArray: Float32Array;
    private sizeArray: Float32Array;

    constructor(radius: number = 90, height: number = 550) {
        this.geometry = new THREE.BufferGeometry();
        this.posArray = new Float32Array(this.particleCount * 3);
        this.velArray = new Float32Array(this.particleCount * 3);
        this.phaseArray = new Float32Array(this.particleCount);
        this.sizeArray = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            const r = Math.random() * radius * Math.sqrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const y = Math.random() * height;

            this.posArray[i * 3 + 0] = Math.cos(theta) * r;
            this.posArray[i * 3 + 1] = y;
            this.posArray[i * 3 + 2] = Math.sin(theta) * r;

            this.velArray[i * 3 + 0] = (Math.random() - 0.5) * 2.0;
            this.velArray[i * 3 + 1] = 4.0 + Math.random() * 8.0;
            this.velArray[i * 3 + 2] = (Math.random() - 0.5) * 2.0;

            this.phaseArray[i] = Math.random() * Math.PI * 2;
            this.sizeArray[i] = 12.0 + Math.random() * 24.0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
        this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phaseArray, 1));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArray, 1));

        const pal = RAINBOW_PALETTES['Spectral Prismatic'];

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uIntensity: { value: 1.0 },
                uPaletteA: { value: pal.a.clone() },
                uPaletteB: { value: pal.b.clone() },
                uPaletteC: { value: pal.c.clone() },
                uPaletteD: { value: pal.d.clone() }
            },
            vertexShader: /* glsl */ `
                attribute float aPhase;
                attribute float aSize;
                uniform float uTime;
                varying float vPhase;
                varying vec3 vWorldPos;

                void main() {
                    vPhase = aPhase;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    vec4 mvPosition = viewMatrix * worldPos;
                    gl_PointSize = aSize * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uTime;
                uniform float uIntensity;
                uniform vec3 uPaletteA;
                uniform vec3 uPaletteB;
                uniform vec3 uPaletteC;
                uniform vec3 uPaletteD;

                varying float vPhase;
                varying vec3 vWorldPos;

                vec3 evalSpectralPalette(float t) {
                    return clamp(uPaletteA + uPaletteB * cos(6.2831853 * (uPaletteC * t + uPaletteD)), 0.0, 1.0);
                }

                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    float dist = length(coord) * 2.0;
                    if (dist > 1.0) discard;

                    float sparkle = sin(uTime * 4.0 + vPhase * 3.0) * 0.5 + 0.5;
                    float alpha = smoothstep(1.0, 0.0, dist) * sparkle * uIntensity * 0.85;

                    float spectralPhase = vPhase + uTime * 0.2 + (vWorldPos.y * 0.01);
                    vec3 col = evalSpectralPalette(spectralPhase);

                    gl_FragColor = vec4(col * 2.0, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
    }

    public setPalette(paletteName: string) {
        const pal = RAINBOW_PALETTES[paletteName] || RAINBOW_PALETTES['Spectral Prismatic'];
        this.material.uniforms.uPaletteA.value.copy(pal.a);
        this.material.uniforms.uPaletteB.value.copy(pal.b);
        this.material.uniforms.uPaletteC.value.copy(pal.c);
        this.material.uniforms.uPaletteD.value.copy(pal.d);
    }

    public update(dt: number, heightLimit: number = 550) {
        this.material.uniforms.uTime.value += dt;
        const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        for (let i = 0; i < this.particleCount; i++) {
            array[i * 3 + 1] += this.velArray[i * 3 + 1] * dt;
            array[i * 3 + 0] += Math.sin(this.material.uniforms.uTime.value + this.phaseArray[i]) * 0.4;
            array[i * 3 + 2] += Math.cos(this.material.uniforms.uTime.value + this.phaseArray[i]) * 0.4;

            if (array[i * 3 + 1] > heightLimit) {
                array[i * 3 + 1] = 0;
            }
        }
        posAttr.needsUpdate = true;
    }

    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
