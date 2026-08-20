import * as THREE from 'three';
import { terrainHeightJS } from './noise';

// ── Shared Barycentric Geometry Helper ──────────────────────────────────────
export function setupFacetedBarycentricGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone();
    nonIndexed.computeVertexNormals();
    return nonIndexed;
}

// ── Translucent Prismatic Glass Crystal Cloud Formation ─────────────────────
// Creates a floating glass crystal cloud cluster with true optical
// glass properties: high transmission, Fresnel reflections, internal chromatic
// dispersion, sharp specular glints, and dielectric edge glow.
export class FacetedCrystalCloud {
    public group: THREE.Group;
    public crystalMaterial: THREE.ShaderMaterial;
    public crystalMeshes: THREE.Mesh[] = [];
    public shardMeshes: THREE.Mesh[] = [];
    public billowMaterial!: THREE.ShaderMaterial;
    public billowMeshes: THREE.Mesh[] = [];

    public params = {
        glassTransmission: 0.90, // Physical high transmission
        ior: 1.62,               // Physical Index of Refraction (glass / quartz: 1.5 - 2.0)
        dispersion: 0.035,       // Spectral chromatic dispersion
        fresnelPower: 3.8,       // Dielectric Fresnel edge power
        fresnelIntensity: 1.45,   // Soft rim luminescence without wireframes
        fresnelColor: new THREE.Color(0xe0f2fe),
        iridescence: 1.35,       // Chromatic rainbow dispersion strength
        specularGlint: 2.2,      // Sharp diamond-like sun reflection
        facetContrast: 0.45,     // Distinct highlighted facets and shadowed faces
        facetBevelGleam: 0.45,   // Compatibility alias for sliders
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
            uGlassTransmission: { value: 0.90 },
            uIOR: { value: 1.62 },
            uDispersion: { value: 0.035 },
            uFresnelPower: { value: 3.8 },
            uFresnelIntensity: { value: 1.45 },
            uFresnelColor: { value: new THREE.Color(0xe0f2fe) },
            uIridescence: { value: 1.35 },
            uSpecularGlint: { value: 2.2 },
            uFacetContrast: { value: 0.45 }
        };

        const vertShader = /* glsl */ `
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec3 vWorldNormal;

            void main() {
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
            uniform float uIOR;
            uniform float uDispersion;
            uniform float uFresnelPower;
            uniform float uFresnelIntensity;
            uniform vec3 uFresnelColor;
            uniform float uIridescence;
            uniform float uSpecularGlint;
            uniform float uFacetContrast;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;
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
                if (!gl_FrontFacing) faceNormal = -faceNormal;

                vec3 V = normalize(vViewDir);
                vec3 sunDir = normalize(uSunPos - vWorldPos);
                vec3 H = normalize(sunDir + V);

                // 1. Vertical Glass Crystal Color Tint (Ethereal Ice -> Pale Rose -> Pure Diamond)
                float heightFactor = clamp((vWorldPos.y - 75.0) / 55.0, 0.0, 1.0);
                vec3 glassBodyTint = mix(uGlassBaseTint, uGlassMidTint, smoothstep(0.0, 0.5, heightFactor));
                glassBodyTint = mix(glassBodyTint, uGlassTopTint, smoothstep(0.5, 1.0, heightFactor));

                // 2. Optical Glass Refraction & Transmission with IOR and Chromatic Dispersion
                float ior = max(1.1, uIOR);
                float disp = uDispersion * 0.04;
                vec3 refractR = refract(-V, faceNormal, 1.0 / (ior - disp));
                vec3 refractG = refract(-V, faceNormal, 1.0 / ior);
                vec3 refractB = refract(-V, faceNormal, 1.0 / (ior + disp));

                float rSkyH = clamp(refractR.y * 0.5 + 0.5, 0.0, 1.0);
                float gSkyH = clamp(refractG.y * 0.5 + 0.5, 0.0, 1.0);
                float bSkyH = clamp(refractB.y * 0.5 + 0.5, 0.0, 1.0);

                vec3 rCol = mix(uSkyHorizonColor, uSkyTopColor, pow(rSkyH, 0.65));
                vec3 gCol = mix(uSkyHorizonColor, uSkyTopColor, pow(gSkyH, 0.65));
                vec3 bCol = mix(uSkyHorizonColor, uSkyTopColor, pow(bSkyH, 0.65));
                vec3 transmittedSky = vec3(rCol.r, gCol.g, bCol.b);

                // Backlit sunlight transmission through glass
                float backlight = max(0.0, dot(-faceNormal, sunDir));
                float forwardWash = max(0.0, dot(-sunDir, -V));
                vec3 transmittedSun = uSunColor * (pow(backlight, 4.0) * 1.85 + pow(forwardWash, 2.0) * 0.95);

                vec3 glassInterior = (transmittedSky * 0.85 + transmittedSun + vec3(0.14, 0.18, 0.24)) * glassBodyTint;

                // 3. Dielectric Fresnel Luminescence (Replaces hard wireframe lines)
                float NdotV = clamp(dot(faceNormal, V), 0.0, 1.0);
                float F0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
                float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, uFresnelPower);
                vec3 fresnelGlow = uFresnelColor * fresnel * uFresnelIntensity;

                // 4. Directional Facet Lighting (Highlight and Shadow Contrast)
                float NdotL = max(0.0, dot(faceNormal, sunDir));
                float facetShading = mix(1.0 - uFacetContrast, 1.0 + uFacetContrast * 0.5, NdotL);

                // Sharp Diamond Specular Reflection
                float NdotH = max(0.0, dot(faceNormal, H));
                float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.8;

                // 5. Chromatic Dispersion Glints
                float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
                float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
                vec3 spectralRainbow = evalSpectralPrism(prismT);
                float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 2.0;
                vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

                // 6. Surface Reflections
                vec3 reflectRay = reflect(-V, faceNormal);
                float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

                // Combine Glass Layers without wireframe lines
                vec3 glassColor = mix(glassInterior * facetShading, reflectedSky, fresnel * 0.82);
                glassColor += uSunColor * specular;
                glassColor += chromaticHighlights;
                glassColor += fresnelGlow;

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
        this.crystalMaterial.uniforms.uIOR.value = this.params.ior;
        this.crystalMaterial.uniforms.uDispersion.value = this.params.dispersion;
        this.crystalMaterial.uniforms.uFresnelPower.value = this.params.fresnelPower;
        this.crystalMaterial.uniforms.uFresnelIntensity.value = this.params.fresnelIntensity;
        this.crystalMaterial.uniforms.uIridescence.value = this.params.iridescence;
        this.crystalMaterial.uniforms.uSpecularGlint.value = this.params.specularGlint;
        this.crystalMaterial.uniforms.uFacetContrast.value = this.params.facetContrast ?? this.params.facetBevelGleam ?? 0.45;

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
        uGlassTransmission: { value: 0.90 },
        uIOR: { value: 1.62 },
        uDispersion: { value: 0.035 },
        uFresnelPower: { value: 3.8 },
        uFresnelIntensity: { value: 1.45 },
        uFresnelColor: { value: new THREE.Color(0xe0f2fe) },
        uIridescence: { value: 1.35 },
        uSpecularGlint: { value: 2.2 },
        uFacetContrast: { value: 0.45 },
        ...customUniforms
    };

    const vertShader = /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vWorldNormal;

        void main() {
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
        uniform float uIOR;
        uniform float uDispersion;
        uniform float uFresnelPower;
        uniform float uFresnelIntensity;
        uniform vec3 uFresnelColor;
        uniform float uIridescence;
        uniform float uSpecularGlint;
        uniform float uFacetContrast;

        varying vec3 vWorldPos;
        varying vec3 vViewDir;
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
            if (!gl_FrontFacing) faceNormal = -faceNormal;

            vec3 V = normalize(vViewDir);
            vec3 sunDir = normalize(uSunPos - vWorldPos);
            vec3 H = normalize(sunDir + V);

            float heightFactor = clamp((vWorldPos.y - 15.0) / 75.0, 0.0, 1.0);
            vec3 glassBodyTint = mix(uGlassBaseTint, uGlassMidTint, smoothstep(0.0, 0.5, heightFactor));
            glassBodyTint = mix(glassBodyTint, uGlassTopTint, smoothstep(0.5, 1.0, heightFactor));

            // Optical Glass Refraction with IOR and Chromatic Dispersion
            float ior = max(1.1, uIOR);
            float disp = uDispersion * 0.04;
            vec3 refractR = refract(-V, faceNormal, 1.0 / (ior - disp));
            vec3 refractG = refract(-V, faceNormal, 1.0 / ior);
            vec3 refractB = refract(-V, faceNormal, 1.0 / (ior + disp));

            float rSkyH = clamp(refractR.y * 0.5 + 0.5, 0.0, 1.0);
            float gSkyH = clamp(refractG.y * 0.5 + 0.5, 0.0, 1.0);
            float bSkyH = clamp(refractB.y * 0.5 + 0.5, 0.0, 1.0);

            vec3 rCol = mix(uSkyHorizonColor, uSkyTopColor, pow(rSkyH, 0.65));
            vec3 gCol = mix(uSkyHorizonColor, uSkyTopColor, pow(gSkyH, 0.65));
            vec3 bCol = mix(uSkyHorizonColor, uSkyTopColor, pow(bSkyH, 0.65));
            vec3 transmittedSky = vec3(rCol.r, gCol.g, bCol.b);

            float backlight = max(0.0, dot(-faceNormal, sunDir));
            float forwardWash = max(0.0, dot(-sunDir, -V));
            vec3 transmittedSun = uSunColor * (pow(backlight, 4.0) * 1.85 + pow(forwardWash, 2.0) * 0.95);

            vec3 glassInterior = (transmittedSky * 0.85 + transmittedSun + vec3(0.14, 0.18, 0.24)) * glassBodyTint;

            // Dielectric Fresnel edge luminescence
            float NdotV = clamp(dot(faceNormal, V), 0.0, 1.0);
            float F0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
            float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, uFresnelPower);
            vec3 fresnelGlow = uFresnelColor * fresnel * uFresnelIntensity;

            // Directional Facet Highlight & Shadow
            float NdotL = max(0.0, dot(faceNormal, sunDir));
            float facetShading = mix(1.0 - uFacetContrast, 1.0 + uFacetContrast * 0.5, NdotL);

            float NdotH = max(0.0, dot(faceNormal, H));
            float specular = pow(NdotH, 96.0) * uSpecularGlint * 2.8;

            float dispersionAngle = dot(faceNormal, V) * 0.65 + dot(faceNormal, sunDir) * 0.35;
            float prismT = clamp(dispersionAngle * 1.2, 0.0, 1.0);
            vec3 spectralRainbow = evalSpectralPrism(prismT);
            float chromaticFacetGlint = pow(NdotH, 24.0) * uIridescence * 2.0;
            vec3 chromaticHighlights = spectralRainbow * chromaticFacetGlint;

            vec3 reflectRay = reflect(-V, faceNormal);
            float reflectSkyH = clamp(reflectRay.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 reflectedSky = mix(uSkyHorizonColor, uSkyTopColor, pow(reflectSkyH, 0.6));

            vec3 glassColor = mix(glassInterior * facetShading, reflectedSky, fresnel * 0.82);
            glassColor += uSunColor * specular;
            glassColor += chromaticHighlights;
            glassColor += fresnelGlow;

            float glassAlpha = clamp(fresnel * 0.65 + (1.0 - uGlassTransmission) * 0.32 + 0.12, 0.12, 0.88);

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

// Helper: Evaluates distance to designated walking pathways in Prism Sanctum
export function getPrismWalkingPathDistance(lx: number, lz: number): number {
    const distCenter = Math.hypot(lx, lz);
    if (distCenter < 36.0) return 0.0; // Central open plaza

    // 1. Winding North-South Grand Promenade
    const dMainAxis = Math.abs(lx - Math.sin(lz * 0.007) * 42.0);
    // 2. Cross Terrace Promenade
    const dCrossAxis = Math.abs(lz - Math.cos(lx * 0.006) * 48.0);
    // 3. Inner Ring Promenade (radius 130m)
    const dRing1 = Math.abs(distCenter - 130.0);
    // 4. Outer Ridge Walkway (radius 270m)
    const dRing2 = Math.abs(distCenter - 270.0);
    // 5. Diagonal Arterial Trails
    const dDiag1 = Math.abs(lx - lz) * 0.7071;
    const dDiag2 = Math.abs(lx + lz) * 0.7071;

    return Math.min(dMainAxis, dCrossAxis, dRing1, dRing2, dDiag1, dDiag2);
}

// ── Ground-Level Crystal Formations & Monoliths ──────────────────────────────
// Populates the terrain with uneven, dense geode clusters and jagged formations
// with noise-carved walking paths for player navigation
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

        // 1. Geode Cluster Hub Anchors (16 Distinct Formations)
        const clusterHubs = [
            // Inner Sanctuary Geode Calderas (radius 60 - 110m)
            { hx: -75, hz: -65, count: 32, radiusSpread: 38, baseScale: 1.1, name: 'Northwest Caldera' },
            { hx: 80, hz: -70, count: 34, radiusSpread: 40, baseScale: 1.15, name: 'Northeast Caldera' },
            { hx: -80, hz: 75, count: 30, radiusSpread: 36, baseScale: 1.05, name: 'Southwest Caldera' },
            { hx: 75, hz: 80, count: 32, radiusSpread: 38, baseScale: 1.1, name: 'Southeast Caldera' },

            // Mid-Range Towering Monolith Formations (radius 140 - 240m)
            { hx: 0, hz: -180, count: 42, radiusSpread: 48, baseScale: 1.35, name: 'Northern Spire Colonnade' },
            { hx: 0, hz: 185, count: 40, radiusSpread: 46, baseScale: 1.3, name: 'Southern Spire Colonnade' },
            { hx: -190, hz: 0, count: 38, radiusSpread: 45, baseScale: 1.25, name: 'Western Quartz Monolith' },
            { hx: 195, hz: 0, count: 42, radiusSpread: 48, baseScale: 1.35, name: 'Eastern Quartz Monolith' },

            // Diagonal High Mountain Geode Clusters (radius 200 - 320m)
            { hx: -180, hz: -175, count: 45, radiusSpread: 52, baseScale: 1.4, name: 'NW Mountain Massif' },
            { hx: 185, hz: -180, count: 48, radiusSpread: 55, baseScale: 1.45, name: 'NE Mountain Massif' },
            { hx: -175, hz: 190, count: 44, radiusSpread: 50, baseScale: 1.38, name: 'SW Mountain Massif' },
            { hx: 180, hz: 185, count: 46, radiusSpread: 52, baseScale: 1.42, name: 'SE Mountain Massif' },

            // Distant Perimeter Peak Monoliths (radius 340 - 520m)
            { hx: -330, hz: -290, count: 38, radiusSpread: 60, baseScale: 1.5, name: 'Outer NW Peaks' },
            { hx: 350, hz: -310, count: 40, radiusSpread: 62, baseScale: 1.55, name: 'Outer NE Peaks' },
            { hx: -320, hz: 330, count: 36, radiusSpread: 58, baseScale: 1.48, name: 'Outer SW Peaks' },
            { hx: 340, hz: 340, count: 38, radiusSpread: 60, baseScale: 1.52, name: 'Outer SE Peaks' }
        ];

        // Spawn dense, jagged crystal clusters around each hub anchor
        clusterHubs.forEach((hub, hubIdx) => {
            // Central colossal monolith of this cluster
            const centralHeight = 65 * hub.baseScale;
            const centralRadius = 8.5 * hub.baseScale;
            const centerMesh = new THREE.Mesh(coneGeo, material);
            centerMesh.scale.set(centralRadius, centralHeight, centralRadius);

            const centerWorldX = hub.hx;
            const centerWorldZ = -2560 + hub.hz;
            const centerGroundY = terrainHeightJS(centerWorldX, centerWorldZ);
            centerMesh.position.set(hub.hx, centerGroundY + centralHeight * 0.42, hub.hz);
            centerMesh.rotation.set(0.05, hubIdx * 0.85, 0.04);
            this.spires.push(centerMesh);
            this.group.add(centerMesh);

            // Satellite jagged crystals tightly packed around the hub
            for (let i = 0; i < hub.count; i++) {
                const seed1 = Math.sin(hubIdx * 43.17 + i * 17.83) * 43758.5453;
                const rng1 = seed1 - Math.floor(seed1);
                const seed2 = Math.sin(hubIdx * 91.31 + i * 31.19) * 23421.6312;
                const rng2 = seed2 - Math.floor(seed2);
                const seed3 = Math.sin(hubIdx * 19.53 + i * 73.47) * 54321.9876;
                const rng3 = seed3 - Math.floor(seed3);

                const angle = rng1 * Math.PI * 2;
                // Clustered heavily toward center of the hub with power curve
                const rDist = 5.0 + Math.pow(rng2, 1.8) * hub.radiusSpread;
                const lx = hub.hx + Math.cos(angle) * rDist;
                const lz = hub.hz + Math.sin(angle) * rDist;

                // Path Clearance Check: Do not spawn inside walking paths
                const pathDist = getPrismWalkingPathDistance(lx, lz);
                if (pathDist < 12.0) {
                    continue; // Leave walking path clear
                }

                const worldX = lx;
                const worldZ = -2560 + lz;
                const groundY = terrainHeightJS(worldX, worldZ);

                // Jagged scale & geometry selection
                let baseGeo = coneGeo;
                let height = (18 + rng1 * 36) * hub.baseScale;
                let radius = (2.2 + rng2 * 3.4) * hub.baseScale;

                if (rng3 < 0.50) {
                    baseGeo = coneGeo; // Quartz needle
                } else if (rng3 < 0.76) {
                    baseGeo = octaGeo; // Diamond geode
                    height = (12 + rng1 * 18) * hub.baseScale;
                    radius = height * 0.55;
                } else if (rng3 < 0.90) {
                    baseGeo = dodecaGeo; // Gem octahedron
                    height = (10 + rng1 * 16) * hub.baseScale;
                    radius = height * 0.5;
                } else {
                    baseGeo = cylGeo; // Hex pillar
                    height = (24 + rng1 * 40) * hub.baseScale;
                    radius = (3.0 + rng2 * 3.0) * hub.baseScale;
                }

                const mesh = new THREE.Mesh(baseGeo, material);
                mesh.scale.set(radius, height, radius);

                // Point outward / radiate tilt from cluster center
                const outAngle = Math.atan2(lz - hub.hz, lx - hub.hx);
                const tiltMag = 0.12 + rng1 * 0.28;
                const tiltX = Math.cos(outAngle) * tiltMag;
                const tiltZ = Math.sin(outAngle) * tiltMag;

                mesh.position.set(lx, groundY + height * 0.40, lz);
                mesh.rotation.set(tiltX, rng2 * Math.PI * 2, tiltZ);

                this.spires.push(mesh);
                this.group.add(mesh);
            }
        });

        // 2. Path Colonnades & Flanking Formations (Framing walking paths without blocking them)
        const colonnadePoints = 96;
        for (let i = 0; i < colonnadePoints; i++) {
            const zStep = -240 + (i / colonnadePoints) * 480;
            const mainPathX = Math.sin(zStep * 0.007) * 42.0;
            const side = (i % 2 === 0) ? 1 : -1;
            const shoulderDist = 18.0 + ((i * 7) % 8) * 1.5;
            const lx = mainPathX + side * shoulderDist;
            const lz = zStep;

            const worldX = lx;
            const worldZ = -2560 + lz;
            const groundY = terrainHeightJS(worldX, worldZ);

            const height = 30 + ((i * 13) % 24);
            const radius = 3.2 + ((i * 5) % 4) * 0.6;
            const geo = (i % 3 === 0) ? octaGeo : coneGeo;

            const mesh = new THREE.Mesh(geo, material);
            mesh.scale.set(radius, height, radius);

            // Tilt away from the walking path to create canyon framing
            const tiltX = side * 0.18;
            mesh.position.set(lx, groundY + height * 0.42, lz);
            mesh.rotation.set(tiltX, i * 0.4, 0.05);

            this.spires.push(mesh);
            this.group.add(mesh);
        }

        // 3. Floating Resonant Shards Orbiting over Cluster Nodes and Path Flanks
        for (let i = 0; i < 220; i++) {
            const seed = i * 7.31 + 13.9;
            const rSeed = Math.sin(seed) * 0.5 + 0.5;
            const shardGeo = (i % 3 === 0) ? dodecaGeo : octaGeo;
            const shard = new THREE.Mesh(shardGeo, material);

            const baseAngle = (i / 220) * Math.PI * 2;
            const radius = 25 + (i % 14) * 32 + rSeed * 20;
            const scale = 2.0 + (i % 5) * 1.5;
            const baseHeight = 10 + (i % 8) * 6.5;
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
            item.mesh.position.y = groundY + item.baseHeight + Math.sin(t * 1.2 + item.seed) * 2.2;

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
