import * as THREE from 'three';

const WATER_VERT = /* glsl */ `
varying vec2 vWorldPos;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

// Ghibli Stylized Anime Water (Voronoi caustics, wave foam, subtle glistening)
const GHIBLI_WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uFoamColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uOpacity;
uniform vec2 uCamXZ;

varying vec2 vWorldPos;

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 p, float speed) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 pt = hash2(i + neighbor);
            pt = 0.5 + 0.5 * sin(uTime * speed + 6.2831 * pt);
            vec2 diff = neighbor + pt - f;
            minDist = min(minDist, length(diff));
        }
    }
    return minDist;
}

void main() {
    vec2 uv = vWorldPos * 0.016;
    
    vec2 flow1 = vec2(uTime * 0.022, uTime * 0.014);
    vec2 flow2 = vec2(-uTime * 0.016, uTime * 0.025);
    
    float v1 = voronoi(uv + flow1, 0.75);
    float v2 = voronoi(uv * 1.45 + flow2, 0.95);
    
    // Smooth caustics network
    float caustics = smoothstep(0.06, 0.26, abs(v1 - v2));
    
    // Multi-tone water depth gradient
    vec3 col = mix(uDeepColor, uMidColor, caustics);
    
    // Foam highlights along wave crests
    float foamPattern = v1 * v2 + (1.0 - caustics) * 0.38;
    float foam = smoothstep(0.64, 0.80, foamPattern);
    col = mix(col, uFoamColor, foam * 0.55);
    
    // Distance fog blending matching sky atmosphere
    float dist = length(vWorldPos - uCamXZ);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, uFogColor, fogFactor);
    
    float alpha = uOpacity * (1.0 - smoothstep(uFogFar * 0.85, uFogFar, dist) * 0.35);
    gl_FragColor = vec4(col, alpha);
}
`;

// Wind Waker Stylized Ocean Shader
const WIND_WAKER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uFoamColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uOpacity;
uniform vec2 uCamXZ;

varying vec2 vWorldPos;

#define M_2PI 6.2831853071795864769252867665590
#define M_6PI 18.849555921538759430775860299677

float circ(vec2 p, vec2 c, float r) {
    vec2 d = fract((p - c) + 0.5) - 0.5;
    return smoothstep(r + 0.02, r - 0.02, length(d));
}

float waterlayer(vec2 p) {
    vec2 uv = p;
    float ret = 0.0;
    ret += circ(uv, vec2(0.125, 0.125), 0.025);
    ret += circ(uv, vec2(0.625, 0.625), 0.025);
    ret += circ(uv, vec2(0.875, 0.375), 0.022);
    ret += circ(uv, vec2(0.375, 0.875), 0.022);
    ret += circ(uv, vec2(0.445, 0.125), 0.028);
    ret += circ(uv, vec2(0.909, 0.878), 0.028);
    ret += circ(uv, vec2(0.310, 0.686), 0.015);
    ret += circ(uv, vec2(0.928, 0.195), 0.015);
    ret += circ(uv, vec2(0.563, 0.245), 0.029);
    ret += circ(uv, vec2(0.714, 0.576), 0.021);
    ret += circ(uv, vec2(0.502, 0.472), 0.023);
    return max(ret, 0.0);
}

void main() {
    float t = uTime * 0.75;
    vec2 uv = vWorldPos * 0.022;
    float d1 = mod(uv.x + uv.y, M_2PI) + t * 0.1;
    float d2 = mod((uv.x + uv.y + 0.25) * 1.3, M_6PI) + t * 0.6;
    vec2 dist = vec2(sin(d1) * 0.05 + sin(d2) * 0.05, cos(d1) * 0.05 + cos(d2) * 0.05);

    vec3 wwCol = mix(uDeepColor, uMidColor, waterlayer(uv + dist));
    wwCol = mix(wwCol, uFoamColor, waterlayer(vec2(0.1 * t, 1.0) - uv - dist.yx) * 0.75);

    float distCam = length(vWorldPos - uCamXZ);
    float fogFactor = smoothstep(uFogNear, uFogFar, distCam);
    wwCol = mix(wwCol, uFogColor, fogFactor);

    gl_FragColor = vec4(wwCol, uOpacity);
}
`;

// Toon FBM Stepped Water Shader
const TOON_FBM_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uFoamColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uOpacity;
uniform vec2 uCamXZ;

varying vec2 vWorldPos;

float hash_t(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise_t(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    float a = hash_t(i);
    float b = hash_t(i + vec2(1.0, 0.0));
    float c = hash_t(i + vec2(0.0, 1.0));
    float d = hash_t(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm_t(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 3; i++) {
        v += a * noise_t(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    float t = uTime * 0.35;
    vec2 coord = vWorldPos * 0.015 - vec2(t * 0.12, t * 0.08);
    float c1 = fbm_t(coord - t * 0.2);
    float c2 = fbm_t(coord * 1.3 + t * 0.15);
    float c = c1 * c2;
    
    vec3 col;
    if (c > 0.15) {
        col = uFoamColor;
    } else if (c > 0.075) {
        col = uMidColor;
    } else {
        col = uDeepColor;
    }

    float distCam = length(vWorldPos - uCamXZ);
    float fogFactor = smoothstep(uFogNear, uFogFar, distCam);
    col = mix(col, uFogColor, fogFactor);

    gl_FragColor = vec4(col, uOpacity);
}
`;

export type WaterStyleKey = 'ghibli' | 'windWaker' | 'toonFBM' | 'physical';

export class WaterSystem {
    public mesh: THREE.Mesh;
    public currentStyle: WaterStyleKey = 'ghibli';

    private matGhibli: THREE.ShaderMaterial;
    private matWindWaker: THREE.ShaderMaterial;
    private matToonFBM: THREE.ShaderMaterial;
    private matPhysical: THREE.MeshPhysicalMaterial;

    constructor(scene: THREE.Scene) {
        const waterGeo = new THREE.PlaneGeometry(4000, 4000);
        waterGeo.rotateX(-Math.PI / 2);

        const defaultUniforms = {
            uTime: { value: 0 },
            uDeepColor: { value: new THREE.Color(0x195d8f) },
            uMidColor: { value: new THREE.Color(0x4cbfe6) },
            uFoamColor: { value: new THREE.Color(0xf2fbff) },
            uFogColor: { value: new THREE.Color(0x8cbce6) },
            uFogNear: { value: 220.0 },
            uFogFar: { value: 900.0 },
            uOpacity: { value: 0.88 },
            uCamXZ: { value: new THREE.Vector2(0, 0) }
        };

        this.matGhibli = new THREE.ShaderMaterial({
            vertexShader: WATER_VERT,
            fragmentShader: GHIBLI_WATER_FRAG,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            uniforms: THREE.UniformsUtils.clone(defaultUniforms)
        });

        this.matWindWaker = new THREE.ShaderMaterial({
            vertexShader: WATER_VERT,
            fragmentShader: WIND_WAKER_FRAG,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            uniforms: THREE.UniformsUtils.clone(defaultUniforms)
        });

        this.matToonFBM = new THREE.ShaderMaterial({
            vertexShader: WATER_VERT,
            fragmentShader: TOON_FBM_FRAG,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            uniforms: THREE.UniformsUtils.clone(defaultUniforms)
        });

        this.matPhysical = new THREE.MeshPhysicalMaterial({
            color: 0x4da9e8,
            transparent: true,
            opacity: 0.82,
            roughness: 0.2,
            metalness: 0.05,
            reflectivity: 0.6,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2,
            depthWrite: false,
            depthTest: true
        });

        this.mesh = new THREE.Mesh(waterGeo, this.matGhibli);
        this.mesh.position.y = 2.5;
        this.mesh.receiveShadow = false;
        scene.add(this.mesh);
    }

    public setWaterStyle(style: WaterStyleKey) {
        this.currentStyle = style;
        switch (style) {
            case 'ghibli':
                this.mesh.material = this.matGhibli;
                break;
            case 'windWaker':
                this.mesh.material = this.matWindWaker;
                break;
            case 'toonFBM':
                this.mesh.material = this.matToonFBM;
                break;
            case 'physical':
                this.mesh.material = this.matPhysical;
                break;
        }
    }

    public cycleWaterStyle(): string {
        const styles: WaterStyleKey[] = ['ghibli', 'windWaker', 'toonFBM', 'physical'];
        const nextIdx = (styles.indexOf(this.currentStyle) + 1) % styles.length;
        const nextStyle = styles[nextIdx];
        this.setWaterStyle(nextStyle);
        return this.getStyleDisplayName(nextStyle);
    }

    public getStyleDisplayName(style?: WaterStyleKey): string {
        const target = style ?? this.currentStyle;
        switch (target) {
            case 'ghibli': return 'Ghibli Anime (Caustics)';
            case 'windWaker': return 'Wind Waker (Cel Ribbons)';
            case 'toonFBM': return 'Toon FBM (Stepped)';
            case 'physical': return 'MeshPhysical (PBR)';
        }
    }

    public setToonMode(enabled: boolean) {
        if (enabled) {
            this.setWaterStyle('toonFBM');
        } else {
            this.setWaterStyle('ghibli');
        }
    }

    public update(playerX: number, playerZ: number, dt: number = 0.016, scene?: THREE.Scene) {
        this.mesh.position.x = playerX;
        this.mesh.position.z = playerZ;

        const activeMat = this.mesh.material as THREE.ShaderMaterial;
        if (activeMat && activeMat.uniforms) {
            if (activeMat.uniforms.uTime) activeMat.uniforms.uTime.value += dt;
            if (activeMat.uniforms.uCamXZ) activeMat.uniforms.uCamXZ.value.set(playerX, playerZ);

            if (scene && scene.fog && 'color' in scene.fog) {
                const fog = scene.fog as THREE.Fog;
                if (activeMat.uniforms.uFogColor) activeMat.uniforms.uFogColor.value.copy(fog.color);
                if (activeMat.uniforms.uFogNear) activeMat.uniforms.uFogNear.value = fog.near;
                if (activeMat.uniforms.uFogFar) activeMat.uniforms.uFogFar.value = fog.far;
            }
        }
    }
}
