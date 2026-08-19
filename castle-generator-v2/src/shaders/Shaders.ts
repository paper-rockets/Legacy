import * as THREE from 'three';

export function patchCelShader(material: THREE.Material, isFoliage: boolean) {
    material.userData.uniforms = {
        uTime: { value: 0 },
        uTouchPos: { value: new THREE.Vector3(999, 999, 999) }
    };

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uniforms.uTime;
        shader.uniforms.uTouchPos = material.userData.uniforms.uTouchPos;

        if (isFoliage) {
            shader.vertexShader = `
                uniform float uTime;
                uniform vec3 uTouchPos;
                ${shader.vertexShader}
            `;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                vec3 transformed = vec3(position);
                
                #ifdef USE_INSTANCING
                    vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    
                    // Wind Sway: stronger higher up
                    float sway = sin(uTime * 2.0 + instanceWorldPos.x * 0.5 + instanceWorldPos.z * 0.5) * 0.15;
                    transformed.x += sway * max(0.0, position.y);
                    
                    // Touch Reaction
                    vec4 currentWorldPos = instanceMatrix * vec4(transformed, 1.0);
                    float touchDist = distance(currentWorldPos.xyz, uTouchPos);
                    if (touchDist < 3.0) {
                        vec3 dir = normalize(currentWorldPos.xyz - uTouchPos);
                        dir.y = 0.0;
                        transformed += dir * (3.0 - touchDist) * 0.5;
                    }
                #endif
                `
            );
        }

        // Stepped lighting in fragment
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_physical_pars_fragment>',
            `
            #include <lights_physical_pars_fragment>
            
            void RE_Direct_Stylized( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
                float dotNL = dot(geometryNormal, directLight.direction);
                float irradiance = max(0.0, dotNL);
                
                // Cel step
                irradiance = smoothstep(0.0, 0.05, irradiance) * 0.6 + 0.4;
                
                #ifdef IS_FOLIAGE
                    // Subsurface Scattering Approximation
                    float backLight = max(0.0, dot(geometryViewDir, -directLight.direction));
                    float sss = pow(backLight, 3.0) * 0.6 * (1.0 - max(0.0, dotNL));
                    irradiance += sss;
                #endif
                
                irradiance *= PI;
                reflectedLight.directDiffuse += irradiance * directLight.color * material.diffuseColor;
            }
            #undef RE_Direct
            #define RE_Direct RE_Direct_Stylized
            `
        );

        if (isFoliage) shader.fragmentShader = `#define IS_FOLIAGE\n` + shader.fragmentShader;
    };
}

export function createOutlineMaterial(thickness: number) {
    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        side: THREE.BackSide
    });
    
    outlineMat.userData.uniforms = {
        uTime: { value: 0 },
        uTouchPos: { value: new THREE.Vector3(999, 999, 999) },
        uOutlineThickness: { value: thickness }
    };

    outlineMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = outlineMat.userData.uniforms.uTime;
        shader.uniforms.uTouchPos = outlineMat.userData.uniforms.uTouchPos;
        shader.uniforms.uOutlineThickness = outlineMat.userData.uniforms.uOutlineThickness;

        shader.vertexShader = `
            uniform float uTime;
            uniform vec3 uTouchPos;
            uniform float uOutlineThickness;
            ${shader.vertexShader}
        `;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            vec3 transformed = vec3(position);
            
            // Variable width based on noise for hand-drawn feel
            float noise = sin(position.y * 15.0) * sin(position.x * 15.0) * 0.3 + 0.7;
            transformed += normal * (uOutlineThickness * noise);

            #ifdef USE_INSTANCING
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                
                float sway = sin(uTime * 2.0 + instanceWorldPos.x * 0.5 + instanceWorldPos.z * 0.5) * 0.15;
                transformed.x += sway * max(0.0, position.y);
                
                vec4 currentWorldPos = instanceMatrix * vec4(transformed, 1.0);
                float touchDist = distance(currentWorldPos.xyz, uTouchPos);
                if (touchDist < 3.0) {
                    vec3 dir = normalize(currentWorldPos.xyz - uTouchPos);
                    dir.y = 0.0;
                    transformed += dir * (3.0 - touchDist) * 0.5;
                }
            #endif
            `
        );
    };
    return outlineMat;
}

export const KuwaharaShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "resolution": { value: new THREE.Vector2() }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        const int radius = 2; // Mild painterly watercolor blend
        
        void main() {
            vec2 d = 1.0 / resolution;
            int n = (radius + 1) * (radius + 1);
            vec3 m[4];
            vec3 s[4];
            for (int k = 0; k < 4; ++k) {
                m[k] = vec3(0.0);
                s[k] = vec3(0.0);
            }
            
            for (int j = -radius; j <= 0; ++j) {
                for (int i = -radius; i <= 0; ++i) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * d).rgb;
                    m[0] += c; s[0] += c * c;
                }
            }
            for (int j = -radius; j <= 0; ++j) {
                for (int i = 0; i <= radius; ++i) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * d).rgb;
                    m[1] += c; s[1] += c * c;
                }
            }
            for (int j = 0; j <= radius; ++j) {
                for (int i = 0; i <= radius; ++i) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * d).rgb;
                    m[2] += c; s[2] += c * c;
                }
            }
            for (int j = 0; j <= radius; ++j) {
                for (int i = -radius; i <= 0; ++i) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * d).rgb;
                    m[3] += c; s[3] += c * c;
                }
            }
            
            float min_sigma2 = 1e2;
            vec3 final_color = vec3(0.0);
            
            for (int k = 0; k < 4; ++k) {
                m[k] /= float(n);
                s[k] = abs(s[k] / float(n) - m[k] * m[k]);
                float sigma2 = s[k].r + s[k].g + s[k].b;
                if (sigma2 < min_sigma2) {
                    min_sigma2 = sigma2;
                    final_color = m[k];
                }
            }
            
            gl_FragColor = vec4(final_color, 1.0);
        }
    `
};
