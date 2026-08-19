import * as THREE from 'three';

// ── Vortex Palettes ──────────────────────────────────────────────────────────
export interface VortexPaletteDef {
    id: number;
    name: string;
    description: string;
    accentColor: string;
}

export const VORTEX_PALETTES: VortexPaletteDef[] = [
    { id: 0, name: 'Cosmic Prismatic', description: 'Vibrant chromatic rainbow ribbons from reference shader', accentColor: '#38bdf8' },
    { id: 1, name: 'Electric Cyan', description: 'High-energy electric cyan and emerald filaments', accentColor: '#22d3ee' },
    { id: 2, name: 'Solar Flare', description: 'Blazing gold, ember orange, and solar corona streams', accentColor: '#f59e0b' },
    { id: 3, name: 'Neon Dream', description: 'Synthwave magenta, ultraviolet, and neon pink swirls', accentColor: '#ec4899' },
    { id: 4, name: 'Deep Void', description: 'Mystic void purple, indigo, and deep starlight hues', accentColor: '#a855f7' }
];

// ── 3D Mesh Vertex Shader ───────────────────────────────────────────────────
export const vortexVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// ── Fullscreen Post-Processing Vertex Shader ────────────────────────────────
export const fullscreenQuadVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── 3D Volumetric Cylinder Tunnel Fragment Shader ───────────────────────────
export const vortex3DTunnelFragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float uSwirlSpeed;
uniform float uDistortion;
uniform float uIntensity;
uniform int uPaletteId;
uniform float uMouseSensitivity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

#define PI 3.14159265359

mat2 rot(float x) { 
    return mat2(cos(x), -sin(x), sin(x), cos(x)); 
}

vec3 getPalette(int id, float k) {
    if (id == 0) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(5.0, 0.0, 2.0));
    } else if (id == 1) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(0.2, 1.8, 3.2));
    } else if (id == 2) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(0.5, 1.2, 2.4));
    } else if (id == 3) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(3.2, 0.4, 1.6));
    } else {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(1.2, 2.4, 4.6));
    }
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float tt = iTime * uSwirlSpeed * 0.7;
    
    // Cylindrical coordinates
    float u = vUv.x;
    float v = vUv.y;
    
    float angle = u * 2.0 * PI;
    float zDist = (v - 0.5) * 35.0;
    
    // Interactive mouse distortion
    vec2 mouseOffset = vec2(0.0);
    if (abs(iMouse.x) > 0.01 || abs(iMouse.y) > 0.01) {
        mouseOffset = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y * (1.8 * uMouseSensitivity);
    }
    
    vec2 p2d = vec2(cos(angle), sin(angle));
    p2d += mouseOffset * 0.35 * sin(zDist * 0.4 - tt);
    
    vec3 col = vec3(0.0);
    float t = 0.08 * hash(gl_FragCoord.xy);
    
    vec3 rd = normalize(vec3(p2d * mix(0.85, 1.15, sin(-tt + 3.5 * length(p2d))), 1.0));
    
    // Volumetric raymarching loop along the 3D tunnel shell
    for (float i = 0.0; i < 42.0; i++) {
        vec3 p = t * rd + rd;
        p.z += zDist + tt * 0.8;
        
        float z = p.z;
        p.xy *= rot(p.z * 0.8);
        
        for (float j = 0.0; j < 3.0; j++) {
            float a = exp(j) / exp2(j);
            p += cos(3.0 * p.yzx * a + 0.5 * tt - length(p.xy) * (8.5 * uDistortion)) / a;
        }
        
        float d = 0.008 + abs((exp2(1.3 * p) - vec3(0.0, 1.0 + 0.7 * sin(tt), 0.0)).y - 1.0) / 14.0;
        float k = t * 0.65 + length(p) * 0.1 - 0.2 * tt + z * 0.1;
        
        vec3 c = getPalette(uPaletteId, k);
        c = mix(c, c * vec3(0.922, 0.973, 0.725), sin(z * 0.5));
        col += c * (1e-3 * uIntensity) / d;
        t += d / 3.8;
    }
    
    // Core & rim glow
    float gl = exp(-3.5 * abs(length(p2d) - 1.0));
    col += 0.3 * uIntensity * mix(vec3(0.361, 0.957, 1.0), vec3(0.847, 1.0, 0.561), sin(gl * 2.0 - tt)) * pow(gl * 4.0, 1.0);
    
    // Tone mapping
    col *= tanh(col * 0.14);
    col = pow(col, vec3(0.55));
    
    // Smooth entry and exit fading at cylinder edges
    float endFade = smoothstep(0.0, 0.06, v) * smoothstep(1.0, 0.94, v);
    
    gl_FragColor = vec4(col * (1.3 + 0.25 * sin(tt * 2.5)), endFade * 0.96);
}
`;

// ── Fullscreen Volumetric Vortex Fragment Shader ────────────────────────────
export const vortexFragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float uSwirlSpeed;
uniform float uDistortion;
uniform float uIntensity;
uniform int uPaletteId;
uniform float uMouseSensitivity;
uniform float uTunnelDepth;
uniform float uCenterRadius;
uniform float uWarpFlash;

varying vec2 vUv;

#define SIN(x) sin(x)

mat2 rot(float x) { 
    return mat2(cos(x), -sin(x), sin(x), cos(x)); 
}

vec3 getPalette(int id, float k) {
    if (id == 0) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(5.0, 0.0, 2.0));
    } else if (id == 1) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(0.2, 1.8, 3.2));
    } else if (id == 2) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(0.5, 1.2, 2.4));
    } else if (id == 3) {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(3.2, 0.4, 1.6));
    } else {
        return 0.5 + 0.5 * cos(6.28318530718 * k - vec3(1.2, 2.4, 4.6));
    }
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 rotate3D(vec3 p, vec2 angle) {
    mat2 rx = rot(angle.y);
    p.yz = rx * p.yz;
    mat2 ry = rot(angle.x);
    p.xz = ry * p.xz;
    return p;
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float tt = iTime * uSwirlSpeed * 0.5;
    
    float ripple = SIN(-tt + 5.0 * length(uv.xy) * uDistortion);
    uv.xy *= mix(0.8, 1.2, ripple);
    
    vec3 col = vec3(0.0);

    vec2 camAngle = vec2(0.0);
    if (abs(iMouse.x) > 0.001 || abs(iMouse.y) > 0.001) {
        camAngle = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y * (2.2 * uMouseSensitivity);
    }

    vec3 rd = normalize(vec3(uv, 1.0));
    rd = rotate3D(rd, camAngle);

    float t = 0.1 * hash(fragCoord);

    for (float i = 0.0; i < 80.0; i++) {
        vec3 p = t * rd + rd;
        p.z += tt * uTunnelDepth;

        float z = p.z;
        p.xy *= rot(p.z * 0.9);

        for (float j = 0.0; j < 3.0; j++) {     
            float a = exp(j) / exp2(j);
            p += cos(3.0 * p.yzx * a + 0.5 * tt - length(p.xy) * (9.0 * uDistortion)) / a; 
        }

        float d = 0.007 + abs((exp2(1.3 * p) - vec3(0.0, 1.0 + 0.7 * SIN(tt), 0.0)).y - 1.0) / 14.0;
        float k = t * 0.7 + length(p) * 0.1 - 0.2 * tt + z * 0.1;
        
        vec3 c = getPalette(uPaletteId, k);
        c = mix(c, c * vec3(0.922, 0.973, 0.725), SIN(z * 0.5));
        col += c * (1e-3 * uIntensity) / d;       
        t += d / 4.0;
    }
    
    float gl = exp(-20.0 * length(uv.xy) / max(0.2, uCenterRadius));
    col += 0.45 * uIntensity * mix(vec3(0.361, 0.957, 1.000), vec3(0.847, 1.000, 0.561), SIN(gl * 2.0 - tt)) * pow(gl * 11.0, 1.0);
    
    col *= tanh(col * 0.1);
    col = pow(col, vec3(0.45));
    
    if (uWarpFlash > 0.0) {
        col = mix(col, vec3(1.2, 1.3, 1.5), clamp(uWarpFlash, 0.0, 1.0));
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

// ── 3D Volumetric Vortex Tunnel System ──────────────────────────────────────
export class Vortex3DTunnel {
    public group: THREE.Group;
    public tunnelMesh: THREE.Mesh;
    public tunnelMat: THREE.ShaderMaterial;
    public ribRings: THREE.Mesh[] = [];
    public particleStream: THREE.Points;
    public lights: THREE.PointLight[] = [];

    public startZ: number;
    public endZ: number;
    public length: number;
    public radius = 32.0;
    public centerY = 65.0;

    constructor(scene: THREE.Scene, startZ: number = 1550, endZ: number = -150) {
        this.startZ = startZ;
        this.endZ = endZ;
        this.length = Math.abs(startZ - endZ);

        this.group = new THREE.Group();
        this.group.position.set(0, this.centerY, (startZ + endZ) / 2);
        scene.add(this.group);

        // 1. Massive 3D Volumetric Cylinder Mesh
        const cylinderGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.length, 64, 128, true);
        // Rotate cylinder to align horizontally along Z axis
        cylinderGeo.rotateX(Math.PI / 2);

        this.tunnelMat = new THREE.ShaderMaterial({
            vertexShader: vortexVertexShader,
            fragmentShader: vortex3DTunnelFragmentShader,
            uniforms: {
                iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
                iTime: { value: 0 },
                iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
                uSwirlSpeed: { value: 1.1 },
                uDistortion: { value: 1.0 },
                uIntensity: { value: 1.4 },
                uPaletteId: { value: 0 },
                uMouseSensitivity: { value: 1.0 }
            },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.tunnelMesh = new THREE.Mesh(cylinderGeo, this.tunnelMat);
        this.group.add(this.tunnelMesh);

        // 2. Concentric Energy Rib Rings along the Tunnel
        const ringCount = 18;
        const ringGeo = new THREE.TorusGeometry(this.radius * 0.98, 0.6, 16, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < ringCount; i++) {
            const ring = new THREE.Mesh(ringGeo, ringMat);
            const zRel = (i / (ringCount - 1) - 0.5) * this.length * 0.94;
            ring.position.set(0, 0, zRel);
            this.ribRings.push(ring);
            this.group.add(ring);
        }

        // 3. High-Speed Hyperspace Particle Stream Inside Tunnel
        const partCount = 800;
        const partGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(partCount * 3);
        const colors = new Float32Array(partCount * 3);
        const speeds = new Float32Array(partCount);
        const angles = new Float32Array(partCount);
        const radii = new Float32Array(partCount);

        const baseCol = new THREE.Color(0x38bdf8);
        const secCol = new THREE.Color(0xf43f5e);

        for (let i = 0; i < partCount; i++) {
            const rad = Math.random() * (this.radius * 0.85);
            const ang = Math.random() * Math.PI * 2;
            const zRel = (Math.random() - 0.5) * this.length;

            positions[i * 3] = Math.cos(ang) * rad;
            positions[i * 3 + 1] = Math.sin(ang) * rad;
            positions[i * 3 + 2] = zRel;

            angles[i] = ang;
            speeds[i] = 120.0 + Math.random() * 200.0;
            radii[i] = rad;

            const c = baseCol.clone().lerp(secCol, Math.random());
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        partGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        (partGeo as any)._speeds = speeds;
        (partGeo as any)._angles = angles;
        (partGeo as any)._radii = radii;

        const partMat = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        this.particleStream = new THREE.Points(partGeo, partMat);
        this.group.add(this.particleStream);

        // 4. Interior Point Lights along the tunnel to illuminate parrot
        const lightCount = 6;
        for (let i = 0; i < lightCount; i++) {
            const pLight = new THREE.PointLight(0x38bdf8, 2.5, 90, 1.2);
            const zRel = (i / (lightCount - 1) - 0.5) * this.length * 0.85;
            pLight.position.set(0, 0, zRel);
            this.lights.push(pLight);
            this.group.add(pLight);
        }
    }

    public isPlayerInside(playerPos: THREE.Vector3): boolean {
        const minZ = Math.min(this.startZ, this.endZ) - 20;
        const maxZ = Math.max(this.startZ, this.endZ) + 20;
        if (playerPos.z < minZ || playerPos.z > maxZ) return false;

        const distCenter = Math.hypot(playerPos.x, playerPos.y - this.centerY);
        return distCenter < this.radius + 15.0;
    }

    public update(dt: number, totalTime: number, mouseCoords: THREE.Vector4) {
        // Update Shader Uniforms
        this.tunnelMat.uniforms.iTime.value = totalTime;
        this.tunnelMat.uniforms.iMouse.value.copy(mouseCoords);

        // Rotate rib rings
        for (let i = 0; i < this.ribRings.length; i++) {
            const dir = i % 2 === 0 ? 1 : -1;
            this.ribRings[i].rotation.z += dt * 0.6 * dir;
        }

        // Animate particles rushing through tunnel
        const posAttr = this.particleStream.geometry.getAttribute('position') as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const speeds = (this.particleStream.geometry as any)._speeds as Float32Array;
        const angles = (this.particleStream.geometry as any)._angles as Float32Array;
        const radii = (this.particleStream.geometry as any)._radii as Float32Array;
        const halfLen = this.length / 2;

        const count = speeds.length;
        for (let i = 0; i < count; i++) {
            angles[i] += dt * 1.5;
            positions[i * 3] = Math.cos(angles[i]) * radii[i];
            positions[i * 3 + 1] = Math.sin(angles[i]) * radii[i];
            positions[i * 3 + 2] -= speeds[i] * dt;

            // Wrap around
            if (positions[i * 3 + 2] < -halfLen) {
                positions[i * 3 + 2] += this.length;
            }
        }
        posAttr.needsUpdate = true;
    }

    public setPalette(paletteId: number) {
        this.tunnelMat.uniforms.uPaletteId.value = paletteId;
        const pal = VORTEX_PALETTES[paletteId] || VORTEX_PALETTES[0];
        const hex = new THREE.Color(pal.accentColor).getHex();
        for (const light of this.lights) {
            light.color.setHex(hex);
        }
    }
}

// ── In-World Portal Gate Gateway Ring ────────────────────────────────────────
export class PortalGateway {
    public group: THREE.Group;
    public outerRing: THREE.Mesh;
    public runeRing: THREE.Mesh;
    public particleSystem: THREE.Points;
    public light: THREE.PointLight;
    public beaconBeam: THREE.Mesh;

    public position: THREE.Vector3;
    public destinationBiome: string;
    public radius = 32.0;

    constructor(
        scene: THREE.Scene,
        position: THREE.Vector3,
        rotationY: number = 0,
        destinationBiome: string = 'candyland'
    ) {
        this.position = position.clone();
        this.destinationBiome = destinationBiome;

        this.group = new THREE.Group();
        this.group.position.copy(position);
        this.group.rotation.y = rotationY;
        scene.add(this.group);

        // 1. Heavy Celestial Ring Frame
        const ringGeo = new THREE.TorusGeometry(this.radius + 1.2, 1.8, 24, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.25,
            emissive: 0x0f172a,
            emissiveIntensity: 0.4
        });
        this.outerRing = new THREE.Mesh(ringGeo, ringMat);
        this.group.add(this.outerRing);

        // 2. Inner Concentric Runic Energy Ring
        const runeGeo = new THREE.TorusGeometry(this.radius - 0.6, 0.7, 16, 48);
        const runeMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });
        this.runeRing = new THREE.Mesh(runeGeo, runeMat);
        this.group.add(this.runeRing);

        // 3. Orbiting Accretion Particles
        const partCount = 350;
        const partGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(partCount * 3);
        const colors = new Float32Array(partCount * 3);
        const angles = new Float32Array(partCount);
        const speeds = new Float32Array(partCount);
        const radii = new Float32Array(partCount);

        const baseCol = new THREE.Color(0x38bdf8);
        const secCol = new THREE.Color(0xf43f5e);

        for (let i = 0; i < partCount; i++) {
            const rad = this.radius * (0.88 + Math.random() * 0.35);
            const ang = Math.random() * Math.PI * 2;
            const zOffset = (Math.random() - 0.5) * 6.0;

            positions[i * 3] = Math.cos(ang) * rad;
            positions[i * 3 + 1] = Math.sin(ang) * rad;
            positions[i * 3 + 2] = zOffset;

            angles[i] = ang;
            speeds[i] = 0.8 + Math.random() * 1.5;
            radii[i] = rad;

            const c = baseCol.clone().lerp(secCol, Math.random());
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        partGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        (partGeo as any)._angles = angles;
        (partGeo as any)._speeds = speeds;
        (partGeo as any)._radii = radii;

        const partMat = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        this.particleSystem = new THREE.Points(partGeo, partMat);
        this.group.add(this.particleSystem);

        // 4. Vertical Celestial Beacon Beam
        const beamGeo = new THREE.CylinderGeometry(2.5, 7.0, 400, 24, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);
        this.beaconBeam.position.set(0, 200, 0);
        this.group.add(this.beaconBeam);

        // 5. Dynamic Point Light
        this.light = new THREE.PointLight(0x38bdf8, 3.5, 120, 1.2);
        this.light.position.set(0, 0, 2);
        this.group.add(this.light);
    }

    public update(dt: number, totalTime: number, isNearPlayer: boolean) {
        this.runeRing.rotation.z -= dt * 0.85;
        this.outerRing.rotation.z += dt * 0.25;

        this.beaconBeam.rotation.y += dt * 0.15;
        (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.08 * Math.sin(totalTime * 3.5);

        const posAttr = this.particleSystem.geometry.getAttribute('position') as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const angles = (this.particleSystem.geometry as any)._angles as Float32Array;
        const speeds = (this.particleSystem.geometry as any)._speeds as Float32Array;
        const radii = (this.particleSystem.geometry as any)._radii as Float32Array;

        const count = angles.length;
        for (let i = 0; i < count; i++) {
            angles[i] += speeds[i] * dt * (isNearPlayer ? 2.5 : 1.0);
            const r = radii[i] + Math.sin(totalTime * 3.0 + i) * 0.4;
            positions[i * 3] = Math.cos(angles[i]) * r;
            positions[i * 3 + 1] = Math.sin(angles[i]) * r;
        }
        posAttr.needsUpdate = true;

        this.light.intensity = isNearPlayer ? (4.5 + 2.0 * Math.sin(totalTime * 12.0)) : 3.0;
    }

    public setPalette(paletteId: number) {
        const pal = VORTEX_PALETTES[paletteId] || VORTEX_PALETTES[0];
        const hex = new THREE.Color(pal.accentColor).getHex();
        this.light.color.setHex(hex);
        (this.runeRing.material as THREE.MeshBasicMaterial).color.setHex(hex);
        (this.beaconBeam.material as THREE.MeshBasicMaterial).color.setHex(hex);
    }
}
