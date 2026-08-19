import * as THREE from 'three';
import { terrainHeightJS } from './noise';

// ── Shared Barycentric Geometry Helper ──────────────────────────────────────
export function setupFacetedBarycentricGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const nonIndexed = geo.toNonIndexed();
    nonIndexed.computeVertexNormals();

    const count = nonIndexed.attributes.position.count;
    const barycentrics = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 3) {
        barycentrics[i * 3 + 0] = 1;
        barycentrics[i * 3 + 1] = 0;
        barycentrics[i * 3 + 2] = 0;

        barycentrics[i * 3 + 3] = 0;
        barycentrics[i * 3 + 4] = 1;
        barycentrics[i * 3 + 5] = 0;

        barycentrics[i * 3 + 6] = 0;
        barycentrics[i * 3 + 7] = 0;
        barycentrics[i * 3 + 8] = 1;
    }

    nonIndexed.setAttribute('aBarycentric', new THREE.BufferAttribute(barycentrics, 3));
    return nonIndexed;
}

// ── Translucent Prismatic Glass Crystal Cloud Formation ─────────────────────
// Creates a floating glass crystal cloud cluster with true optical
// glass properties: high transmission, Fresnel reflections, internal chromatic
// dispersion, sharp specular glints, and delicate cut-glass chamfer highlights.
export class FacetedCrystalCloud {
    public group: THREE.Group;
    public crystalMaterial: THREE.ShaderMaterial;
    public crystalMeshes: THREE.Mesh[] = [];
    public shardMeshes: THREE.Mesh[] = [];
    public billowMaterial!: THREE.ShaderMaterial;
    public billowMeshes: THREE.Mesh[] = [];

    public params = {
        glassTransmission: 0.65, // How see-through the glass is
        glassRefraction: 1.52,   // IOR of optical glass / quartz
        iridescence: 1.35,       // Chromatic rainbow dispersion strength
        specularGlint: 2.2,      // Sharp diamond-like sun reflection
        facetBevelGleam: 1.1,    // Subtle cut-glass facet edge reflections
        glassTint: 0.45,         // Soft pastel gemstone tint strength
        billowDensity: 1.0,      // Soft cumulus vapour wrapping the crystal cores
        silverLining: 1.15       // Backlit rim brightness on the billow edges
    };

    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'FacetedCrystalCloud';

        const uniforms = {
            uTime: { value: 0.0 },
            uSunPos: { value: new THREE.Vector3(0, 150, -260) },
            uSunColor: { value: new THREE.Color(0xfffdf7) },
            uSkyTopColor: { value: new THREE.Color(0x1e3a8a) },
            uSkyHorizonColor: { value: new THREE.Color(0x60a5fa) },
            uGlassBaseTint: { value: new THREE.Color(0xdbeafe) },  // Pale crystal ice
            uGlassMidTint: { value: new THREE.Color(0xfce7f3) },   // Soft rose quartz glass
            uGlassTopTint: { value: new THREE.Color(0xffffff) },   // Pure optical diamond glass
            uGlassTransmission: { value: 0.65 },
            uIridescence: { value: 1.35 },
            uSpecularGlint: { value: 2.2 },
            uFacetBevelGleam: { value: 1.1 }
        };

        const vertShader = /* glsl */ `
            attribute vec3 aBarycentric;
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vBarycentric;
            varying vec3 vWorldNormal;

            void main() {
                vBarycentric = aBarycentric;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                vViewDir = normalize(cameraPosition - worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const fragShader = /* glsl */ `
            uniform float uTime;
            uniform vec3 uSunPos;
            uniform vec3 uSunColor;
            uniform vec3 uSkyTopColor;
            uniform vec3 uSkyHorizonColor;
            uniform vec3 uGlassBaseTint;
            uniform vec3 uGlassMidTint;
            uniform vec3 uGlassTopTint;
            uniform float uGlassTransmission;
            uniform float uIridescence;
            uniform float uSpecularGlint;
            uniform float uFacetBevelGleam;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vBarycentric;
            varying vec3 vWorldNormal;

            // Pure Optical Spectral Dispersion (Cauchy Glass Dispersion)
            vec3 evalSpectralPrism(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.0);
            }

            void main() {
                // Compute true geometric flat facet face normal
                vec3 fdx = dFdx(vWorldPos);
                vec3 fdy = dFdy(vWorldPos);
                vec3 faceNormal = normalize(cross(fdx, fdy));

                vec3 V = normalize(vViewDir);
                vec3 sunDir = normalize(uSunPos - vWorldPos);
                vec3 H = normalize(sunDir + V);

                // 1. Vertical Glass Crystal Color Tint (Ethereal Ice -> Pale Rose -> Pure Diamond)
                float heightFactor = clamp((vWorldPos.y - 75.0) / 55.0, 0.0, 1.0);
                vec3 glassBodyTint = mix(uGlassBaseTint, uGlassMidTint, smoothstep(0.0, 0.5, heightFactor));
                glassBodyTint = mix(glassBodyTint, uGlassTopTint, smoothstep(0.5, 1.0, heightFactor));

                // 2. Optical Glass Refraction & Transmission
                // Refracted ray samples the sky background through the glass
                vec3 refractRay = refract(-V, faceNormal, 1.0 / 1.52);
                float refractSkyH = clamp(refractRay.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 transmittedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(refractSkyH, 0.7));

                // Backlit sunlight transmission through glass — a tight core plus a
                // broad forward-scattered wash so the prisms glow instead of going dark
                float backlight = max(0.0, dot(-faceNormal, sunDir));
                float forwardWash = max(0.0, dot(-sunDir, -V));
                vec3 transmittedSun = uSunColor * pow(backlight, 4.0) * 1.5
                                    + uSunColor * pow(forwardWash, 2.0) * 0.85;

                vec3 glassInterior = (transmittedSky * 0.75 + transmittedSun + vec3(0.16, 0.19, 0.24)) * glassBodyTint;

                // 3. Glass Fresnel Reflection (Schlick approximation with R0 = 0.04 for glass)
                float NdotV = max(0.0, dot(faceNormal, V));
                float R0 = 0.04;
                float fresnel = R0 + (1.0 - R0) * pow(1.0 - NdotV, 4.2);

                // 4. Sharp Diamond Specular Reflection
                float NdotH = max(0.0, dot(faceNormal, H));
                float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.5;

                // 5. Chromatic Dispersion Glints (Prismatic Rainbow Refraction)
                float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
                float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
                vec3 spectralRainbow = evalSpectralPrism(prismT);
                float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 1.8;
                vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

                // 6. Delicate Cut-Glass Bevel Chamfer Gleam (Fine diamond edge reflections)
                vec3 d = fwidth(vBarycentric);
                vec3 a3 = smoothstep(vec3(0.0), d * 1.2, vBarycentric);
                float edgeFactor = 1.0 - min(min(a3.x, a3.y), a3.z);
                vec3 edgeBevel = (vec3(1.0, 1.0, 1.0) + spectralRainbow * 0.5) * edgeFactor * uFacetBevelGleam * 0.55;

                // 7. Glass Surface Reflections (Sky & Sun)
                vec3 reflectRay = reflect(-V, faceNormal);
                float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

                // Combine Glass Layers
                vec3 glassColor = mix(glassInterior, reflectedSky, fresnel * 0.85);
                glassColor += uSunColor * specular;
                glassColor += chromaticHighlights;
                glassColor += edgeBevel;

                // Optical Glass Transparency: Clear in center, more reflective/opaque on glancing Fresnel edges.
                // Kept light so the prisms sit inside the vapour rather than punching dark holes in it.
                float glassAlpha = clamp(fresnel * 0.55 + (1.0 - uGlassTransmission) * 0.30 + edgeFactor * 0.28, 0.10, 0.72);

                gl_FragColor = vec4(glassColor, glassAlpha);
            }
        `;

        this.crystalMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(uniforms),
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide
        });

        this.buildBillowMaterial();
        this.buildCrystalCloudFormation();
        this.buildSoftBillows();
    }

    // Soft backlit cumulus vapour that wraps the crystal cores, giving the
    // towering storm-cloud silhouette with a bright silver lining where the
    // sun burns through the thin edges.
    private buildBillowMaterial() {
        this.billowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uSunPos: { value: new THREE.Vector3(0, 150, -260) },
                uSunColor: { value: new THREE.Color(0xfff6e2) },
                uSkyTopColor: { value: new THREE.Color(0x1e3a8a) },
                uSkyHorizonColor: { value: new THREE.Color(0x60a5fa) },
                uCloudLit: { value: new THREE.Color(0xe8eef8) },
                uCloudShadow: { value: new THREE.Color(0x3a5080) },
                uDensity: { value: 1.0 },
                uSilverLining: { value: 1.15 },
                uIridescence: { value: 1.35 }
            },
            vertexShader: /* glsl */ `
                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
                varying vec3 vViewDir;

                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    vViewDir = normalize(cameraPosition - worldPos.xyz);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uTime;
                uniform vec3 uSunPos;
                uniform vec3 uSunColor;
                uniform vec3 uSkyTopColor;
                uniform vec3 uSkyHorizonColor;
                uniform vec3 uCloudLit;
                uniform vec3 uCloudShadow;
                uniform float uDensity;
                uniform float uSilverLining;
                uniform float uIridescence;

                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
                varying vec3 vViewDir;

                float hash13(vec3 p) {
                    p = fract(p * 0.1031);
                    p += dot(p, p.yzx + 33.33);
                    return fract((p.x + p.y) * p.z);
                }

                float vnoise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
                            mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                            mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
                        f.z);
                }

                float fbm(vec3 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 4; i++) {
                        v += a * vnoise(p);
                        p *= 2.03;
                        a *= 0.5;
                    }
                    return v;
                }

                // Henyey-Greenstein phase function for forward-scattered sunlight
                float hg(float mu, float g) {
                    float g2 = g * g;
                    return (1.0 - g2) / (12.5663706 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
                }

                vec3 spectrum(float t) {
                    t = clamp(t, 0.0, 1.0);
                    return clamp(0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))), 0.0, 1.0);
                }

                void main() {
                    vec3 N = normalize(vWorldNormal);
                    vec3 V = normalize(vViewDir);
                    vec3 L = normalize(uSunPos - vWorldPos);

                    // Optical thickness: full through the middle of a puff, thin at its silhouette
                    float facing = max(dot(N, V), 0.0);
                    float drift = uTime * 0.012;
                    float turbulence = fbm(vWorldPos * 0.021 + vec3(drift, drift * 0.35, -drift * 0.6));
                    float density = pow(facing, 0.7) * (0.42 + 1.05 * turbulence);
                    float alpha = smoothstep(0.06, 0.46, density) * uDensity;
                    if (alpha < 0.004) discard;

                    // Sunlight punching through the thin vapour towards the camera
                    // Forward scatter: in horizon-vista mode the camera looks almost directly
                    // at the sun, so HG peaks. Keep it from blowing out by using a gentle
                    // anisotropy and a hard luminance cap.
                    float mu = clamp(dot(-L, V), -1.0, 1.0);
                    float transmit = exp(-density * 3.2);
                    float forward = min(hg(mu, 0.60) * 0.55 + hg(mu, 0.20) * 0.18, 0.52);

                    // Cloud body: bright crowns, cool blue-grey underbellies
                    float upFacing = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
                    float crown = clamp((vWorldPos.y - 82.0) / 60.0, 0.0, 1.0);
                    vec3 body = mix(uCloudShadow, uCloudLit, clamp(upFacing * 0.65 + crown * 0.5, 0.0, 1.0));

                    // Desaturated sky bounce so the deep blue dome does not tint the vapour cyan
                    vec3 skyAmbient = mix(uSkyHorizonColor, uSkyTopColor, upFacing);
                    vec3 ambient = mix(vec3(dot(skyAmbient, vec3(0.299, 0.587, 0.114))), skyAmbient, 0.55);

                    // Multiple scattering: thick cores stay dim, thin vapour glows through
                    float scatterDepth = 0.45 + 0.85 * transmit;
                    vec3 color = body * (0.26 + ambient * 0.34) * scatterDepth;

                    // Silver lining — hot rim at the backlit edge.
                    // Limit to HDR≤1.0 so it stays luminous but never white-outs the whole puff.
                    vec3 silverRim = uSunColor * transmit * forward * uSilverLining;
                    color += min(silverRim, vec3(0.95));

                    // Cloud iridescence: pastel spectral sheen along the thin scalloped edges
                    float edge = 1.0 - smoothstep(0.0, 0.5, density);
                    float iridT = fract(mu * 0.42 + turbulence * 0.85 + vWorldPos.y * 0.0035);
                    vec3 irid = mix(vec3(1.0), spectrum(iridT), 0.72);
                    color += irid * edge * transmit * uIridescence * 0.35;

                    // Rim opacity boost so the lit edges stay legible against the sky
                    alpha = clamp(alpha + edge * transmit * forward * 0.04, 0.0, 0.94);

                    // Hard cap: single fragments must never exceed HDR≈1.4 before tonemapping
                    color = min(color, vec3(1.35));

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide
        });
    }

    private buildSoftBillows() {
        // Towering anvil-topped cumulus mass: dense core, flanking ridges that
        // taper toward the horizon, and a broad flat underbelly the rays fall from.
        const billowConfigs = [
            { x: 0, y: 122, z: -178, r: 62, fy: 0.78 },
            { x: -46, y: 116, z: -172, r: 54, fy: 0.74 },
            { x: 46, y: 114, z: -172, r: 56, fy: 0.74 },
            { x: 0, y: 148, z: -186, r: 48, fy: 0.62 },
            { x: -30, y: 140, z: -180, r: 40, fy: 0.66 },
            { x: 30, y: 138, z: -180, r: 42, fy: 0.66 },

            { x: -96, y: 108, z: -162, r: 50, fy: 0.66 },
            { x: -148, y: 100, z: -150, r: 46, fy: 0.60 },
            { x: -200, y: 92, z: -140, r: 42, fy: 0.54 },
            { x: -252, y: 86, z: -132, r: 38, fy: 0.48 },
            { x: 96, y: 106, z: -162, r: 50, fy: 0.66 },
            { x: 148, y: 98, z: -150, r: 46, fy: 0.60 },
            { x: 200, y: 90, z: -140, r: 42, fy: 0.54 },
            { x: 252, y: 84, z: -132, r: 38, fy: 0.48 },

            // Flat prismatic underbelly the rainbow shafts pour out of
            { x: 0, y: 92, z: -148, r: 66, fy: 0.30 },
            { x: -74, y: 89, z: -142, r: 58, fy: 0.28 },
            { x: 74, y: 88, z: -142, r: 58, fy: 0.28 },
            { x: -150, y: 86, z: -134, r: 50, fy: 0.26 },
            { x: 150, y: 85, z: -134, r: 50, fy: 0.26 },
            { x: -224, y: 84, z: -128, r: 42, fy: 0.24 },
            { x: 224, y: 83, z: -128, r: 42, fy: 0.24 },

            // Anvil shelf spreading out over the top of the storm
            { x: -84, y: 152, z: -192, r: 46, fy: 0.34 },
            { x: 84, y: 150, z: -192, r: 46, fy: 0.34 },
            { x: -164, y: 144, z: -184, r: 40, fy: 0.30 },
            { x: 164, y: 143, z: -184, r: 40, fy: 0.30 }
        ];

        const puffGeo = new THREE.IcosahedronGeometry(1.0, 4);

        billowConfigs.forEach((cfg, idx) => {
            const mesh = new THREE.Mesh(puffGeo, this.billowMaterial);
            mesh.position.set(cfg.x, cfg.y, cfg.z);
            mesh.scale.set(cfg.r, cfg.r * cfg.fy, cfg.r * 0.82);
            mesh.rotation.set(idx * 0.31, idx * 0.77, idx * 0.19);
            mesh.renderOrder = -1;

            this.billowMeshes.push(mesh);
            this.group.add(mesh);
        });
    }

    private buildCrystalCloudFormation() {
        // Build crisp faceted geometric quartz cluster
        const clusterConfigs = [
            // ── Central Dominant Crystal Mass ──
            { x: 0, y: 116, z: -175, sx: 46, sy: 38, sz: 44, type: 'octa' },
            { x: -35, y: 110, z: -170, sx: 38, sy: 32, sz: 36, type: 'dodeca' },
            { x: 35, y: 108, z: -170, sx: 40, sy: 34, sz: 38, type: 'dodeca' },
            { x: 0, y: 130, z: -180, sx: 32, sy: 42, sz: 30, type: 'cone' }, // High crystal obelisk spire
            { x: -18, y: 122, z: -172, sx: 26, sy: 34, sz: 26, type: 'cone' },
            { x: 18, y: 120, z: -172, sx: 28, sy: 36, sz: 26, type: 'cone' },

            // ── Left Crystal Cloud Ridge ──
            { x: -75, y: 104, z: -160, sx: 36, sy: 28, sz: 34, type: 'octa' },
            { x: -115, y: 98, z: -152, sx: 38, sy: 26, sz: 34, type: 'dodeca' },
            { x: -155, y: 92, z: -145, sx: 34, sy: 24, sz: 30, type: 'octa' },
            { x: -195, y: 86, z: -138, sx: 30, sy: 20, sz: 26, type: 'octa' },
            { x: -90, y: 114, z: -162, sx: 24, sy: 32, sz: 24, type: 'cone' },
            { x: -135, y: 106, z: -150, sx: 22, sy: 28, sz: 22, type: 'cone' },

            // ── Right Crystal Cloud Ridge ──
            { x: 75, y: 102, z: -160, sx: 36, sy: 28, sz: 34, type: 'octa' },
            { x: 115, y: 96, z: -152, sx: 38, sy: 26, sz: 34, type: 'dodeca' },
            { x: 155, y: 90, z: -145, sx: 34, sy: 24, sz: 30, type: 'octa' },
            { x: 195, y: 84, z: -138, sx: 30, sy: 20, sz: 26, type: 'octa' },
            { x: 90, y: 112, z: -162, sx: 24, sy: 32, sz: 24, type: 'cone' },
            { x: 135, y: 104, z: -150, sx: 22, sy: 28, sz: 22, type: 'cone' },

            // ── Underbelly Prismatic Base (Where Rainbow Rays Emerge) ──
            { x: 0, y: 88, z: -140, sx: 52, sy: 18, sz: 42, type: 'dodeca' },
            { x: -55, y: 85, z: -135, sx: 46, sy: 16, sz: 38, type: 'octa' },
            { x: 55, y: 85, z: -135, sx: 46, sy: 16, sz: 38, type: 'octa' },
            { x: -110, y: 82, z: -130, sx: 40, sy: 15, sz: 34, type: 'dodeca' },
            { x: 110, y: 82, z: -130, sx: 40, sy: 15, sz: 34, type: 'dodeca' },
            { x: -165, y: 80, z: -125, sx: 34, sy: 14, sz: 30, type: 'octa' },
            { x: 165, y: 80, z: -125, sx: 34, sy: 14, sz: 30, type: 'octa' },

            // ── Mid-Depth Interlocking Facets ──
            { x: -28, y: 98, z: -145, sx: 32, sy: 24, sz: 30, type: 'octa' },
            { x: 28, y: 98, z: -145, sx: 32, sy: 24, sz: 30, type: 'octa' },
            { x: -65, y: 94, z: -140, sx: 28, sy: 22, sz: 26, type: 'dodeca' },
            { x: 65, y: 94, z: -140, sx: 28, sy: 22, sz: 26, type: 'dodeca' }
        ];

        clusterConfigs.forEach((cfg, idx) => {
            let baseGeo: THREE.BufferGeometry;
            if (cfg.type === 'octa') {
                baseGeo = new THREE.OctahedronGeometry(1.0, 1);
            } else if (cfg.type === 'dodeca') {
                baseGeo = new THREE.DodecahedronGeometry(1.0, 0);
            } else {
                // Hexagonal quartz crystal prism
                baseGeo = new THREE.ConeGeometry(1.0, 2.2, 6);
            }

            const geo = setupFacetedBarycentricGeometry(baseGeo);
            const mesh = new THREE.Mesh(geo, this.crystalMaterial);
            mesh.position.set(cfg.x, cfg.y, cfg.z);
            mesh.scale.set(cfg.sx, cfg.sy, cfg.sz);
            mesh.rotation.set(
                (idx * 0.42) % 0.6 - 0.3,
                (idx * 1.35) % (Math.PI * 2),
                (idx * 0.28) % 0.4 - 0.2
            );

            this.crystalMeshes.push(mesh);
            this.group.add(mesh);
        });

        // Add 24 floating satellite glass crystal shards
        for (let i = 0; i < 24; i++) {
            const shardGeo = setupFacetedBarycentricGeometry(new THREE.OctahedronGeometry(1.0, 0));
            const shard = new THREE.Mesh(shardGeo, this.crystalMaterial);

            const angle = (i / 24) * Math.PI * 2;
            const radius = 90 + (i % 5) * 25;
            const sx = Math.cos(angle) * radius;
            const sz = -160 + Math.sin(angle) * 50;
            const sy = 80 + (i % 6) * 9;
            const scale = 3.5 + (i % 4) * 2.5;

            shard.position.set(sx, sy, sz);
            shard.scale.set(scale, scale * 1.8, scale);
            shard.rotation.set(i * 0.5, i * 0.8, i * 0.3);

            this.shardMeshes.push(shard);
            this.group.add(shard);
        }
    }

    public update(dt: number, sunPos: THREE.Vector3) {
        this.crystalMaterial.uniforms.uTime.value += dt;
        this.crystalMaterial.uniforms.uSunPos.value.copy(sunPos);
        this.crystalMaterial.uniforms.uGlassTransmission.value = this.params.glassTransmission;
        this.crystalMaterial.uniforms.uIridescence.value = this.params.iridescence;
        this.crystalMaterial.uniforms.uSpecularGlint.value = this.params.specularGlint;
        this.crystalMaterial.uniforms.uFacetBevelGleam.value = this.params.facetBevelGleam;

        this.billowMaterial.uniforms.uTime.value += dt;
        this.billowMaterial.uniforms.uSunPos.value.copy(sunPos);
        this.billowMaterial.uniforms.uDensity.value = this.params.billowDensity;
        this.billowMaterial.uniforms.uSilverLining.value = this.params.silverLining;
        this.billowMaterial.uniforms.uIridescence.value = this.params.iridescence;

        const t = this.crystalMaterial.uniforms.uTime.value;

        // Gentle, majestic crystalline floating breath
        this.crystalMeshes.forEach((mesh, i) => {
            mesh.position.y += Math.sin(t * 0.25 + i * 0.5) * 0.005;
        });

        // Orbiting floating crystal shards with gentle drift
        this.shardMeshes.forEach((shard, i) => {
            shard.rotation.x += dt * 0.05;
            shard.rotation.y += dt * 0.08;
            shard.position.y += Math.sin(t * 0.4 + i) * 0.008;
        });

        // Slow convective churn of the vapour mass
        this.billowMeshes.forEach((puff, i) => {
            puff.rotation.y += dt * 0.006;
            puff.position.y += Math.sin(t * 0.18 + i * 0.7) * 0.006;
        });
    }

    public setSkyColors(topColor: THREE.Color, horizonColor: THREE.Color) {
        this.crystalMaterial.uniforms.uSkyTopColor.value.copy(topColor);
        this.crystalMaterial.uniforms.uSkyHorizonColor.value.copy(horizonColor);
        this.billowMaterial.uniforms.uSkyTopColor.value.copy(topColor);
        this.billowMaterial.uniforms.uSkyHorizonColor.value.copy(horizonColor);
    }

    public dispose() {
        this.crystalMeshes.forEach(m => m.geometry.dispose());
        this.shardMeshes.forEach(m => m.geometry.dispose());
        this.billowMeshes.forEach(m => m.geometry.dispose());
        this.crystalMaterial.dispose();
        this.billowMaterial.dispose();
    }
}

// ── Standalone Crystal Shader Material Factory ──────────────────────────────
export function createCrystalShaderMaterial(customUniforms?: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
    const uniforms = {
        uTime: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(0, 150, -260) },
        uSunColor: { value: new THREE.Color(0xfffdf7) },
        uSkyTopColor: { value: new THREE.Color(0x38bdf8) },
        uSkyHorizonColor: { value: new THREE.Color(0xbae6fd) },
        uGlassBaseTint: { value: new THREE.Color(0xdbeafe) },
        uGlassMidTint: { value: new THREE.Color(0xfce7f3) },
        uGlassTopTint: { value: new THREE.Color(0xffffff) },
        uGlassTransmission: { value: 0.65 },
        uIridescence: { value: 1.35 },
        uSpecularGlint: { value: 2.2 },
        uFacetBevelGleam: { value: 1.1 },
        ...customUniforms
    };

    const vertShader = /* glsl */ `
        attribute vec3 aBarycentric;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vBarycentric;
        varying vec3 vWorldNormal;

        void main() {
            vBarycentric = aBarycentric;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `;

    const fragShader = /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunPos;
        uniform vec3 uSunColor;
        uniform vec3 uSkyTopColor;
        uniform vec3 uSkyHorizonColor;
        uniform vec3 uGlassBaseTint;
        uniform vec3 uGlassMidTint;
        uniform vec3 uGlassTopTint;
        uniform float uGlassTransmission;
        uniform float uIridescence;
        uniform float uSpecularGlint;
        uniform float uFacetBevelGleam;

        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vBarycentric;
        varying vec3 vWorldNormal;

        vec3 evalSpectralPrism(float t) {
            t = clamp(t, 0.0, 1.0);
            vec3 a = vec3(0.5, 0.5, 0.5);
            vec3 b = vec3(0.5, 0.5, 0.5);
            vec3 c = vec3(1.0, 1.0, 1.0);
            vec3 d = vec3(0.0, 0.33, 0.67);
            return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.0);
        }

        void main() {
            vec3 fdx = dFdx(vWorldPos);
            vec3 fdy = dFdy(vWorldPos);
            vec3 faceNormal = normalize(cross(fdx, fdy));

            vec3 V = normalize(vViewDir);
            vec3 sunDir = normalize(uSunPos - vWorldPos);
            vec3 H = normalize(sunDir + V);

            float heightFactor = clamp((vWorldPos.y - 15.0) / 75.0, 0.0, 1.0);
            vec3 glassBodyTint = mix(uGlassBaseTint, uGlassMidTint, smoothstep(0.0, 0.5, heightFactor));
            glassBodyTint = mix(glassBodyTint, uGlassTopTint, smoothstep(0.5, 1.0, heightFactor));

            vec3 refractRay = refract(-V, faceNormal, 1.0 / 1.52);
            float refractSkyH = clamp(refractRay.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 transmittedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(refractSkyH, 0.7));

            float backlight = max(0.0, dot(-faceNormal, sunDir));
            float forwardWash = max(0.0, dot(-sunDir, -V));
            vec3 transmittedSun = uSunColor * pow(backlight, 4.0) * 1.5
                                + uSunColor * pow(forwardWash, 2.0) * 0.85;

            vec3 glassInterior = (transmittedSky * 0.75 + transmittedSun + vec3(0.16, 0.19, 0.24)) * glassBodyTint;

            float NdotV = max(0.0, dot(faceNormal, V));
            float R0 = 0.04;
            float fresnel = R0 + (1.0 - R0) * pow(1.0 - NdotV, 4.2);

            float NdotH = max(0.0, dot(faceNormal, H));
            float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.5;

            float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
            float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
            vec3 spectralRainbow = evalSpectralPrism(prismT);
            float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 1.8;
            vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

            vec3 d = fwidth(vBarycentric);
            vec3 a3 = smoothstep(vec3(0.0), d * 1.2, vBarycentric);
            float edgeFactor = 1.0 - min(min(a3.x, a3.y), a3.z);
            vec3 edgeBevel = (vec3(1.0, 1.0, 1.0) + spectralRainbow * 0.5) * edgeFactor * uFacetBevelGleam * 0.55;

            vec3 reflectRay = reflect(-V, faceNormal);
            float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

            vec3 glassColor = mix(glassInterior, reflectedSky, fresnel * 0.85);
            glassColor += uSunColor * specular;
            glassColor += chromaticHighlights;
            glassColor += edgeBevel;

            float glassAlpha = clamp(fresnel * 0.55 + (1.0 - uGlassTransmission) * 0.30 + edgeFactor * 0.28, 0.10, 0.72);

            gl_FragColor = vec4(glassColor, glassAlpha);
        }
    `;

    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(uniforms),
        vertexShader: vertShader,
        fragmentShader: fragShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
}

// ── Ground-Level Crystal Formations & Monoliths ──────────────────────────────
// Populates the terrain with hundreds of cut-glass crystal spires, geode clusters, monoliths, and floating shards
export class GroundCrystalFormations {
    public group: THREE.Group;
    public crystalMaterial: THREE.ShaderMaterial;
    public spires: THREE.Mesh[] = [];
    public floatingShards: { mesh: THREE.Mesh; baseAngle: number; radius: number; speed: number; baseHeight: number; seed: number }[] = [];

    constructor(material?: THREE.ShaderMaterial) {
        this.group = new THREE.Group();
        this.group.name = 'GroundCrystalFormations';
        this.crystalMaterial = material || createCrystalShaderMaterial();

        this.buildGroundSpires(this.crystalMaterial);
    }

    private buildGroundSpires(material: THREE.ShaderMaterial) {
        const coneGeo = setupFacetedBarycentricGeometry(new THREE.ConeGeometry(1.0, 1.0, 6));
        const octaGeo = setupFacetedBarycentricGeometry(new THREE.OctahedronGeometry(1.0, 0));
        const dodecaGeo = setupFacetedBarycentricGeometry(new THREE.DodecahedronGeometry(1.0, 0));
        const cylGeo = setupFacetedBarycentricGeometry(new THREE.CylinderGeometry(0.7, 1.0, 1.0, 6));

        // 1. Handcrafted Landmark Obelisks and Spires
        const landmarkConfigs: { x: number; z: number; height: number; radius: number; rotY: number; tilt: number; type: 'cone' | 'octa' | 'dodeca' | 'cyl' }[] = [
            // Center Grand Sanctuary Obelisk Grove
            { x: 0, z: 0, height: 78, radius: 8.5, rotY: 0.2, tilt: 0.04, type: 'cone' },
            { x: -16, z: -14, height: 62, radius: 6.8, rotY: 1.1, tilt: 0.10, type: 'cone' },
            { x: 18, z: -16, height: 66, radius: 7.2, rotY: 2.3, tilt: -0.09, type: 'cone' },
            { x: -14, z: 18, height: 58, radius: 6.4, rotY: 0.8, tilt: 0.12, type: 'cone' },
            { x: 16, z: 16, height: 60, radius: 6.5, rotY: 1.7, tilt: -0.11, type: 'cone' },
            { x: 0, z: -28, height: 52, radius: 5.8, rotY: 0.5, tilt: -0.07, type: 'dodeca' },
            { x: 0, z: 28, height: 52, radius: 5.8, rotY: 2.1, tilt: 0.07, type: 'dodeca' },
            { x: -28, z: 0, height: 48, radius: 5.5, rotY: 1.4, tilt: 0.09, type: 'octa' },
            { x: 28, z: 0, height: 48, radius: 5.5, rotY: 2.8, tilt: -0.09, type: 'octa' },

            // Inner Ring Quartz Clusters (radius 30 - 70m)
            { x: -42, z: -34, height: 48, radius: 5.5, rotY: 0.6, tilt: 0.14, type: 'cone' },
            { x: 44, z: -36, height: 50, radius: 5.6, rotY: 1.8, tilt: -0.13, type: 'cone' },
            { x: -38, z: 42, height: 46, radius: 5.2, rotY: 2.7, tilt: 0.11, type: 'cone' },
            { x: 40, z: 44, height: 48, radius: 5.4, rotY: 0.9, tilt: -0.13, type: 'cone' },
            { x: -60, z: -10, height: 42, radius: 6.0, rotY: 1.2, tilt: 0.08, type: 'octa' },
            { x: 60, z: -10, height: 42, radius: 6.0, rotY: 2.4, tilt: -0.08, type: 'octa' },
            { x: -15, z: -60, height: 44, radius: 5.8, rotY: 0.3, tilt: 0.10, type: 'dodeca' },
            { x: 15, z: 60, height: 44, radius: 5.8, rotY: 1.9, tilt: -0.10, type: 'dodeca' },

            // Mid-Range Spire Monoliths (radius 70 - 160m)
            { x: -85, z: -75, height: 58, radius: 6.8, rotY: 0.4, tilt: 0.15, type: 'cone' },
            { x: -110, z: -50, height: 64, radius: 7.2, rotY: 1.5, tilt: -0.11, type: 'cone' },
            { x: -65, z: -105, height: 52, radius: 6.0, rotY: 2.9, tilt: 0.09, type: 'cone' },
            { x: 88, z: -78, height: 60, radius: 7.0, rotY: 0.8, tilt: -0.14, type: 'cone' },
            { x: 115, z: -55, height: 68, radius: 7.5, rotY: 2.0, tilt: 0.10, type: 'cone' },
            { x: 75, z: -110, height: 54, radius: 6.2, rotY: 3.2, tilt: -0.12, type: 'cone' },
            { x: -80, z: 85, height: 56, radius: 6.5, rotY: 0.5, tilt: 0.13, type: 'cone' },
            { x: -105, z: 70, height: 62, radius: 7.0, rotY: 1.7, tilt: -0.12, type: 'cone' },
            { x: 82, z: 88, height: 58, radius: 6.6, rotY: 2.2, tilt: 0.11, type: 'cone' },
            { x: 110, z: 75, height: 65, radius: 7.2, rotY: 0.6, tilt: -0.13, type: 'cone' },

            // Outer Mountain Crest Monoliths (radius 180 - 450m)
            { x: -180, z: -160, height: 85, radius: 9.5, rotY: 1.3, tilt: 0.08, type: 'cone' },
            { x: 190, z: -170, height: 90, radius: 10.0, rotY: 2.5, tilt: -0.09, type: 'cone' },
            { x: -175, z: 180, height: 80, radius: 9.0, rotY: 0.4, tilt: 0.10, type: 'cone' },
            { x: 185, z: 185, height: 82, radius: 9.2, rotY: 1.9, tilt: -0.09, type: 'cone' },
            { x: 0, z: -220, height: 75, radius: 8.5, rotY: 0.7, tilt: 0.06, type: 'cone' },
            { x: 0, z: 220, height: 75, radius: 8.5, rotY: 2.3, tilt: -0.06, type: 'cone' },
            { x: -230, z: 0, height: 72, radius: 8.2, rotY: 1.1, tilt: 0.11, type: 'cone' },
            { x: 230, z: 0, height: 72, radius: 8.2, rotY: 2.7, tilt: -0.11, type: 'cone' },

            // Distant Perimeter Peak Monoliths (radius 300 - 580m)
            { x: -320, z: -280, height: 95, radius: 11.0, rotY: 0.9, tilt: 0.07, type: 'cone' },
            { x: 340, z: -300, height: 100, radius: 11.5, rotY: 2.1, tilt: -0.08, type: 'cone' },
            { x: -310, z: 320, height: 90, radius: 10.5, rotY: 1.6, tilt: 0.09, type: 'cone' },
            { x: 330, z: 330, height: 92, radius: 10.8, rotY: 0.3, tilt: -0.08, type: 'cone' },
            { x: 0, z: -420, height: 88, radius: 10.2, rotY: 1.4, tilt: 0.05, type: 'cone' },
            { x: 0, z: 420, height: 88, radius: 10.2, rotY: 2.8, tilt: -0.05, type: 'cone' },
            { x: -440, z: 0, height: 85, radius: 9.8, rotY: 0.8, tilt: 0.08, type: 'cone' },
            { x: 440, z: 0, height: 85, radius: 9.8, rotY: 2.2, tilt: -0.08, type: 'cone' }
        ];

        landmarkConfigs.forEach((cfg) => {
            let baseGeo = coneGeo;
            if (cfg.type === 'octa') baseGeo = octaGeo;
            else if (cfg.type === 'dodeca') baseGeo = dodecaGeo;
            else if (cfg.type === 'cyl') baseGeo = cylGeo;

            const mesh = new THREE.Mesh(baseGeo, material);
            mesh.scale.set(cfg.radius, cfg.height, cfg.radius);

            const worldX = cfg.x;
            const worldZ = -2560 + cfg.z;
            const groundY = terrainHeightJS(worldX, worldZ);

            mesh.position.set(cfg.x, groundY + cfg.height * 0.42, cfg.z);
            mesh.rotation.set(cfg.tilt, cfg.rotY, cfg.tilt * 0.5);

            this.spires.push(mesh);
            this.group.add(mesh);
        });

        // 2. Procedural Dense Crystal Fields (320+ Crystals scattered across 900m radius)
        const totalProcedural = 340;
        for (let i = 0; i < totalProcedural; i++) {
            const seed1 = Math.sin(i * 12.9898 + 43.12) * 43758.5453;
            const rng1 = seed1 - Math.floor(seed1);
            const seed2 = Math.sin(i * 78.233 + 91.73) * 23421.6312;
            const rng2 = seed2 - Math.floor(seed2);
            const seed3 = Math.sin(i * 37.719 + 17.84) * 54321.9876;
            const rng3 = seed3 - Math.floor(seed3);

            const angle = rng1 * Math.PI * 2;
            const dist = 15 + Math.pow(rng2, 0.75) * 896; // Concentrated toward center but spreads to 900m
            const lx = Math.cos(angle) * dist;
            const lz = Math.sin(angle) * dist;

            const worldX = lx;
            const worldZ = -2560 + lz;
            const groundY = terrainHeightJS(worldX, worldZ);

            const typeChoice = rng3;
            let baseGeo = coneGeo;
            let height = 22 + (rng1 * 38);
            let radius = 2.4 + (rng2 * 3.6);

            if (typeChoice < 0.55) {
                // Hexagonal quartz needle spire
                baseGeo = coneGeo;
            } else if (typeChoice < 0.80) {
                // Diamond geode octahedron
                baseGeo = octaGeo;
                height = 10 + (rng1 * 18);
                radius = height * 0.55;
            } else if (typeChoice < 0.92) {
                // Dodecahedral crystal gem
                baseGeo = dodecaGeo;
                height = 8 + (rng1 * 16);
                radius = height * 0.5;
            } else {
                // Hexagonal quartz pillar
                baseGeo = cylGeo;
                height = 25 + (rng1 * 40);
                radius = 3.2 + (rng2 * 3.0);
            }

            const mesh = new THREE.Mesh(baseGeo, material);
            mesh.scale.set(radius, height, radius);

            const tilt = (rng1 - 0.5) * 0.28;
            const rotY = rng2 * Math.PI * 2;
            const tiltZ = (rng3 - 0.5) * 0.24;

            mesh.position.set(lx, groundY + height * 0.40, lz);
            mesh.rotation.set(tilt, rotY, tiltZ);

            this.spires.push(mesh);
            this.group.add(mesh);
        }

        // 3. 120 Floating Resonant Shards Orbiting and Hovering over the land
        for (let i = 0; i < 120; i++) {
            const seed = i * 7.31 + 13.9;
            const rSeed = Math.sin(seed) * 0.5 + 0.5;
            const shardGeo = (i % 3 === 0) ? dodecaGeo : octaGeo;
            const shard = new THREE.Mesh(shardGeo, material);

            const baseAngle = (i / 120) * Math.PI * 2;
            const radius = 20 + (i % 12) * 38 + rSeed * 18;
            const scale = 2.2 + (i % 5) * 1.6;
            const baseHeight = 12 + (i % 8) * 7.5;
            const speed = 0.08 + (i % 4) * 0.06;

            const lx = Math.cos(baseAngle) * radius;
            const lz = Math.sin(baseAngle) * radius;
            const groundY = terrainHeightJS(lx, -2560 + lz);

            shard.position.set(lx, groundY + baseHeight, lz);
            shard.scale.set(scale, scale * 1.8, scale);
            shard.rotation.set(i * 0.4, i * 0.7, i * 0.2);

            this.floatingShards.push({
                mesh: shard,
                baseAngle,
                radius,
                speed,
                baseHeight,
                seed: i
            });
            this.group.add(shard);
        }
    }

    public update(dt: number, sunPos?: THREE.Vector3) {
        if (this.crystalMaterial && this.crystalMaterial.uniforms) {
            this.crystalMaterial.uniforms.uTime.value += dt;
            if (sunPos && this.crystalMaterial.uniforms.uSunPos) {
                this.crystalMaterial.uniforms.uSunPos.value.copy(sunPos);
            }
        }

        const t = performance.now() * 0.001;
        this.floatingShards.forEach((item) => {
            item.baseAngle += dt * item.speed * 0.25;
            const lx = Math.cos(item.baseAngle) * item.radius;
            const lz = Math.sin(item.baseAngle) * item.radius;
            const groundY = terrainHeightJS(lx, -2560 + lz);

            item.mesh.position.x = lx;
            item.mesh.position.z = lz;
            item.mesh.position.y = groundY + item.baseHeight + Math.sin(t * 1.2 + item.seed) * 2.5;

            item.mesh.rotation.y += dt * (0.15 + item.speed * 0.5);
            item.mesh.rotation.x += dt * 0.08;
            item.mesh.rotation.z += dt * 0.05;
        });
    }

    public dispose() {
        this.spires.forEach(s => s.geometry.dispose());
        this.floatingShards.forEach(s => s.mesh.geometry.dispose());
        if (this.crystalMaterial) this.crystalMaterial.dispose();
    }
}

// ── Physical 3D Rainbow Crepuscular Ray Shafts ───────────────────────────────
// Light beams that originate DIRECTLY from the underbelly of the glass crystal cloud
// and fan down to illuminate the landscape in brilliant spectral colors.
export class CloudRainbowRays {
    public group: THREE.Group;
    public rayMaterial: THREE.ShaderMaterial;
    public rayMeshes: THREE.Mesh[] = [];

    public params = {
        intensity: 1.5,
        dispersion: 1.0,
        shimmerSpeed: 0.35,
        rainbowSat: 1.0
    };

    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'CloudRainbowRays';

        const uniforms = {
            uTime: { value: 0.0 },
            uIntensity: { value: 1.5 },
            uDispersion: { value: 1.0 },
            uShimmerSpeed: { value: 0.35 },
            uRainbowSat: { value: 1.0 }
        };

        const vertShader = /* glsl */ `
            attribute float aSpectrumOffset;
            attribute float aRayId;
            uniform float uTime;

            varying vec3 vWorldPos;
            varying vec2 vUv;
            varying float vSpectrumOffset;
            varying float vRayId;

            void main() {
                vUv = uv;
                vSpectrumOffset = aSpectrumOffset;
                vRayId = aRayId;

                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const fragShader = /* glsl */ `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uDispersion;
            uniform float uShimmerSpeed;
            uniform float uRainbowSat;

            varying vec3 vWorldPos;
            varying vec2 vUv;
            varying float vSpectrumOffset;
            varying float vRayId;

            // Pure Spectral Cosine Gradient
            // Red (0.0) -> Yellow (0.2) -> Green (0.4) -> Cyan (0.6) -> Blue (0.8) -> Violet (1.0)
            vec3 evalRainbow(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return clamp(a + b * cos(6.2831853 * (c * t + d)), 0.0, 1.0);
            }

            float hash11(float p) {
                p = fract(p * 0.1031);
                p *= p + 33.33;
                p *= p + p;
                return fract(p);
            }

            void main() {
                float h = vUv.y;                  // 1.0 at the cloud underbelly, 0.0 at the horizon
                float x = vUv.x * 2.0 - 1.0;      // -1..1 across the shaft
                float seed = hash11(vRayId * 7.31);

                // Vertical profile: emerges softly out of the vapour, thins as it
                // descends, then pools into the bright haze along the horizon
                float emerge = smoothstep(1.0, 0.84, h);
                float descend = mix(1.0, 0.20, pow(1.0 - h, 1.35));
                float horizonPool = smoothstep(0.24, 0.0, h) * 0.35;
                float vertical = emerge * (descend + horizonPool);

                // Horizontal cross-section: gaussian core that broadens as it falls
                float widen = mix(1.6, 1.0, h);
                float gauss = exp(-(x * x) / (0.42 * widen * widen));

                // Prismatic dispersion — the shaft splits into spectral fringes at its edges.
                // Remapped to 0.03..0.88 and reversed so the fan reads red -> yellow -> green
                // -> cyan -> blue -> violet across the sky instead of wrapping back to red.
                float spectrumT = 0.03 + (vSpectrumOffset * 0.5 + 0.5) * 0.85
                                + x * 0.06 * uDispersion
                                + (1.0 - h) * 0.04;
                vec3 rainbowColor = evalRainbow(1.0 - spectrumT);

                // Real crepuscular rainbows are washed toward white by the haze they travel through
                float heroBeam = step(0.72, seed);
                float sat = uRainbowSat * mix(0.38, 0.18, heroBeam);
                vec3 beamColor = mix(vec3(1.0, 0.99, 0.97), rainbowColor, sat);

                // Fine internal striation and slow atmospheric shimmer
                float striate = 0.86 + 0.14 * sin(x * 9.0 + seed * 6.2831853);
                float shimmer = 0.88 + 0.12 * sin(uTime * uShimmerSpeed * 3.0 + vRayId * 2.1 + h * 6.0);
                float brightness = 0.68 + 0.85 * seed;

                float alpha = vertical * gauss * striate * shimmer * brightness * uIntensity * 0.17;

                gl_FragColor = vec4(beamColor, alpha);
            }
        `;

        this.rayMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(uniforms),
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.buildRaysFromCloud();
    }

    private buildRaysFromCloud() {
        const rayCount = 34;
        const beamHeight = 96;

        for (let i = 0; i < rayCount; i++) {
            const t = (i / (rayCount - 1)) * 2.0 - 1.0;
            const jitter = Math.sin(i * 12.9898) * 0.5 + 0.5;

            // Narrow where it leaves the cloud, splaying wider and leaning outward as it falls
            const topHalf = 7.0 + jitter * 7.0;
            const bottomHalf = topHalf * (2.1 + jitter * 0.9);
            const lean = t * 16.0;
            const halfH = beamHeight * 0.5;

            const geo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -topHalf, halfH, 0,
                 topHalf, halfH, 0,
                -bottomHalf + lean, -halfH, 0,

                 topHalf, halfH, 0,
                 bottomHalf + lean, -halfH, 0,
                -bottomHalf + lean, -halfH, 0
            ]);

            const uvs = new Float32Array([
                0, 1,
                1, 1,
                0, 0,

                1, 1,
                1, 0,
                0, 0
            ]);

            const spectrumOffsets = new Float32Array(6).fill(t);
            const rayIds = new Float32Array(6).fill(i);

            geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geo.setAttribute('aSpectrumOffset', new THREE.BufferAttribute(spectrumOffsets, 1));
            geo.setAttribute('aRayId', new THREE.BufferAttribute(rayIds, 1));
            geo.computeVertexNormals();

            const mesh = new THREE.Mesh(geo, this.rayMaterial);

            // Spans the crystal cloud underbelly (y~92) down through the horizon line (y~-4)
            const originX = t * 210.0;
            const originY = 44.0;
            const originZ = -138.0 - Math.cos(t * 1.2) * 24.0;

            mesh.position.set(originX, originY, originZ);
            mesh.renderOrder = 2;

            this.rayMeshes.push(mesh);
            this.group.add(mesh);
        }
    }

    public update(dt: number, cameraPos?: THREE.Vector3) {
        this.rayMaterial.uniforms.uTime.value += dt;
        this.rayMaterial.uniforms.uIntensity.value = this.params.intensity;
        this.rayMaterial.uniforms.uDispersion.value = this.params.dispersion;
        this.rayMaterial.uniforms.uShimmerSpeed.value = this.params.shimmerSpeed;
        this.rayMaterial.uniforms.uRainbowSat.value = this.params.rainbowSat;

        // Billboard each shaft around its vertical axis so the volume reads
        // correctly from any orbit angle instead of turning edge-on.
        if (cameraPos) {
            this.rayMeshes.forEach((mesh) => {
                mesh.rotation.y = Math.atan2(
                    cameraPos.x - mesh.position.x,
                    cameraPos.z - mesh.position.z
                );
            });
        }
    }

    public dispose() {
        this.rayMeshes.forEach(m => m.geometry.dispose());
        this.rayMaterial.dispose();
    }
}
