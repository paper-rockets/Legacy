import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── Fullscreen Vertex Shader ────────────────────────────────────────────────
const quadVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── Volumetric Vortex Fragment Shader (Dead-Centered on Flight Model) ───────
const trippyFragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uVortexCenter;
uniform vec2 uSteerAngle;
uniform float uSteps;
uniform float uBrightness;

varying vec2 vUv;

#define SIN(x) sin(x)

mat2 rot(float x) { 
    return mat2(cos(x), -sin(x), sin(x), cos(x)); 
}

vec3 pal(float x) { 
    return 0.5 + 0.5 * cos(6.28318530718 * x - vec3(5.0, 0.0, 2.0)); 
}

vec3 getPal(int id, float k) {
    return pal(k);
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
    // Exactly center the vortex coordinate system onto the parrot's position
    vec2 centerPx = 0.5 * iResolution.xy + uVortexCenter * iResolution.y;
    vec2 uv = (fragCoord - centerPx) / iResolution.y;
    float tt = iTime * 0.5;
    
    uv.xy *= mix(0.8, 1.2, SIN(-tt + 5.0 * length(uv.xy)));
    
    vec3 col = vec3(0.0);

    // Locked smoothly to the flight model steering
    vec3 rd = normalize(vec3(uv, 1.0));
    rd = rotate3D(rd, uSteerAngle);

    float t = 0.1 * hash(fragCoord);

    for (float i = 0.0; i < 120.0; i++) {
        if (i >= uSteps) break;

        vec3 p = t * rd + rd;
        p.z += tt;

        float z = p.z;
        p.xy *= rot(p.z);

        for (float j = 0.0; j < 3.0; j++) {     
            float a = exp(j) / exp2(j);
            p += cos(3.0 * p.yzx * a + 0.5 * tt - length(p.xy) * 9.0) / a; 
        }

        float d = 0.007 + abs((exp2(1.3 * p) - vec3(0.0, 1.0 + 0.7 * SIN(tt), 0.0)).y - 1.0) / 14.0;
        float k = t * 0.7 + length(p) * 0.1 - 0.2 * tt + z * 0.1;
        
        vec3 c = getPal(7, k);
        c = mix(c, c * vec3(0.922, 0.973, 0.725), SIN(z * 0.5));
        col += c * 1e-3 / d;       
        t += d / 4.0;
    }
    
    // Scale intensity based on step count for consistent brightness
    col *= (90.0 / max(30.0, uSteps));
    
    // Singularity glow centered exactly on the parrot
    float gl = exp(-20.0 * length(uv.xy));
    col += 0.4 * mix(vec3(0.361, 0.957, 1.000), vec3(0.847, 1.000, 0.561), SIN(gl * 2.0 - tt)) * pow(gl * 11.0, 1.0);
    
    col *= tanh(col * 0.1);
    col = pow(col, vec3(0.45));
    col *= uBrightness;
    
    gl_FragColor = vec4(col, 1.0);
}
`;

// ── Main Demo Class ─────────────────────────────────────────────────────────
export class VortexDemoApp {
    private renderer: THREE.WebGLRenderer;
    private scene3D: THREE.Scene;
    public camera3D: THREE.PerspectiveCamera;

    // Shader Background Pass
    private shaderScene: THREE.Scene;
    private shaderCamera: THREE.OrthographicCamera;
    private shaderQuad: THREE.Mesh;
    private shaderMat: THREE.ShaderMaterial;

    // 3D Parrot Rig
    public playerGrp: THREE.Group;
    public playerVisuals: THREE.Group;
    public activeModel: THREE.Group | null = null;
    public activeMixer: THREE.AnimationMixer | null = null;
    private gltfLoader: GLTFLoader;

    // ── Exact Movement Parameters Cloned from player.ts ───────────────────────
    public moveSpeed = 18.0;
    public turnAcceleration = 0.55;
    public maxTurnSpeed = 0.45;
    public maxBankAngle = Math.PI / 7;   // ~25.7 deg
    public maxPitchAngle = Math.PI / 8;  // ~22.5 deg

    public currentYaw = 0;
    public currentPitch = 0;
    public currentRoll = 0;
    public turnVelocity = 0;
    public velocity = 18.0;

    // Calibration Offsets for Dead-Center Alignment
    public birdOffsetY = 0.0;
    public birdScale = 0.85;

    // Per-model vortex center offsets — tuned via debug panel, keyed by filename
    public readonly modelOffsets: Record<string, { x: number; y: number }> = {
        'animated_parrot.glb':               { x: 0.230, y: 0.280 },
        'parrot.glb':                        { x: 0.000, y: 0.000 },
        'parrot_ai.glb':                     { x: 0.220, y: 0.065 },
        'american_robin_-_in_flight.glb':    { x: 0.255, y: 0.140 },
        'eastern_wood-pewee_-_in_flight.glb':{ x: 0.220, y: 0.150 },
        'birds.glb':                         { x: 0.245, y: 0.115 },
        'borboleta_azul_-_butterfly.glb':    { x: 0.220, y: 0.115 },
        'idl_flight_on_spot.glb':            { x: 0.230, y: 0.100 },
        'kiki-lowpoly.glb':                  { x: 0.245, y: 0.060 },
        'Princess.glb':                      { x: 0.000, y: 0.000 },
        'porco_rosso_-_seaplane.glb':        { x: 0.245, y: 0.175 },
        'mitsubishi_b2m2_-_game_art_1_stylized_plane.glb': { x: 0.000, y: 0.000 },
        'charizard_flying_animation.glb':    { x: 0.230, y: 0.150 },
    };

    // Per-model default visual scaling and rotation adjustments
    public readonly modelSettings: Record<string, { scale: number; rotY?: number }> = {
        'animated_parrot.glb':                            { scale: 0.85 },
        'parrot.glb':                                     { scale: 0.85 },
        'parrot_ai.glb':                                  { scale: 0.85 },
        'american_robin_-_in_flight.glb':                 { scale: 0.85 },
        'eastern_wood-pewee_-_in_flight.glb':             { scale: 0.85 },
        'birds.glb':                                      { scale: 0.85 },
        'borboleta_azul_-_butterfly.glb':                 { scale: 0.85 },
        'idl_flight_on_spot.glb':                         { scale: 0.85 },
        'kiki-lowpoly.glb':                               { scale: 0.85, rotY: Math.PI },
        'Princess.glb':                                   { scale: 0.85, rotY: Math.PI },
        'porco_rosso_-_seaplane.glb':                     { scale: 0.18 },
        'mitsubishi_b2m2_-_game_art_1_stylized_plane.glb':{ scale: 0.22, rotY: Math.PI },
        'charizard_flying_animation.glb':                 { scale: 0.65, rotY: Math.PI },
    };
    public currentModelKey = 'animated_parrot.glb';

    private eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    private targetQuaternion = new THREE.Quaternion();

    public isPaused = false;

    // Quality & Performance
    public stepCount = 55.0; // Fast default (60fps)
    public brightness = 1.25;

    // Controls
    public input = {
        left: false,
        right: false,
        up: false,
        down: false,
        boost: false,
        brake: false
    };

    // Mouse / Touch Drag Steering
    private isPointerDown = false;
    private pointerStartX = 0;
    private pointerStartY = 0;
    private pointerDeltaX = 0;
    private pointerDeltaY = 0;

    // Active vortex center offset — loaded per-model from modelOffsets map
    public vortexManualOffsetX = 0.230;
    public vortexManualOffsetY = 0.280;

    // Shader Time
    private shaderTime = 0.0;

    constructor(container: HTMLElement) {
        // 1. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        this.renderer.autoClear = false;
        container.appendChild(this.renderer.domElement);

        // 2. Fullscreen Volumetric Vortex Shader Pass
        this.shaderScene = new THREE.Scene();
        this.shaderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.shaderMat = new THREE.ShaderMaterial({
            vertexShader: quadVertexShader,
            fragmentShader: trippyFragmentShader,
            uniforms: {
                iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
                iTime: { value: 0 },
                uVortexCenter: { value: new THREE.Vector2(0, 0) },
                uSteerAngle: { value: new THREE.Vector2(0, 0) },
                uSteps: { value: this.stepCount },
                uBrightness: { value: this.brightness }
            },
            depthTest: false,
            depthWrite: false
        });

        this.shaderQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.shaderMat);
        this.shaderScene.add(this.shaderQuad);

        // 3. 3D Scene for the Animated Parrot (Aligned directly along center line of sight)
        this.scene3D = new THREE.Scene();
        this.camera3D = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera3D.position.set(0, 0.0, 8.5);
        this.camera3D.lookAt(0, 0.0, 0);

        // 4. Vibrant Lighting on the 3D Parrot
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        this.scene3D.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 3.2);
        dirLight.position.set(5, 12, 10);
        this.scene3D.add(dirLight);

        const rimLight1 = new THREE.PointLight(0x38bdf8, 5.5, 30);
        rimLight1.position.set(-6, 3, -4);
        this.scene3D.add(rimLight1);

        const rimLight2 = new THREE.PointLight(0xf472b6, 5.5, 30);
        rimLight2.position.set(6, 3, -4);
        this.scene3D.add(rimLight2);

        // 5. Player Group (Dead-Center in Tunnel)
        this.playerGrp = new THREE.Group();
        this.playerGrp.position.set(0, 0, 0);
        this.scene3D.add(this.playerGrp);

        this.playerVisuals = new THREE.Group();
        this.playerGrp.add(this.playerVisuals);

        // 6. Load Animated Parrot GLTF
        this.gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.gltfLoader.setDRACOLoader(dracoLoader);

        this.loadParrotModel();

        // 7. Event Listeners
        this.setupControls();
        window.addEventListener('resize', this.onResize.bind(this));

        // Start Animation Loop
        const clock = new THREE.Clock();
        const loop = () => {
            requestAnimationFrame(loop);
            const dt = Math.min(clock.getDelta(), 0.05);
            this.update(dt);
            this.render();
        };
        requestAnimationFrame(loop);
    }

    public loadModel(filename: string) {
        this.currentModelKey = filename;
        const saved = this.modelOffsets[filename] ?? { x: 0, y: 0 };
        this.vortexManualOffsetX = saved.x;
        this.vortexManualOffsetY = saved.y;
        this.loadParrotModel(filename);
    }

    private loadParrotModel(filename = 'animated_parrot.glb') {
        const candidatePaths = [
            `./dRAGON/${filename}`,
            `dRAGON/${filename}`,
            `/dRAGON/${filename}`,
            `./Assets/Flight/${filename}`,
            `Assets/Flight/${filename}`,
            `./assets/Flight/${filename}`,
            `assets/Flight/${filename}`
        ];

        // Clear previous model
        if (this.activeModel) {
            this.playerVisuals.remove(this.activeModel);
            this.activeModel = null;
        }
        if (this.activeMixer) {
            this.activeMixer.stopAllAction();
            this.activeMixer = null;
        }

        let pathIdx = 0;
        const tryNext = () => {
            if (pathIdx >= candidatePaths.length) {
                console.error('Model could not be loaded:', filename);
                return;
            }
            const path = candidatePaths[pathIdx++];
            this.gltfLoader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    this.activeModel = model;

                    model.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                            if (mat) {
                                mat.roughness = 0.3;
                                mat.metalness = 0.1;
                            }
                        }
                    });

                    // Dead-center placement in the middle of the glowing vortex circle
                    const settings = this.modelSettings[filename] ?? { scale: 0.85 };
                    this.birdScale = settings.scale;
                    model.scale.set(this.birdScale, this.birdScale, this.birdScale);
                    if (settings.rotY) {
                        model.rotation.y = settings.rotY;
                    }
                    model.position.set(0, this.birdOffsetY, 0);

                    if (gltf.animations && gltf.animations.length > 0) {
                        this.activeMixer = new THREE.AnimationMixer(model);
                        const clip = gltf.animations.find(a => a.name.toLowerCase().includes('flying')) || gltf.animations[0];
                        const action = this.activeMixer.clipAction(clip);
                        action.play();
                    }

                    this.playerVisuals.add(model);
                },
                undefined,
                tryNext
            );
        };
        tryNext();
    }

    public setBirdOffset(yOffset: number) {
        this.birdOffsetY = yOffset;
        if (this.activeModel) {
            this.activeModel.position.set(0, yOffset, 0);
        }
    }

    public setVortexManualOffset(x: number, y: number) {
        this.vortexManualOffsetX = x;
        this.vortexManualOffsetY = y;
        // Persist into the in-session map so switching away and back restores the value
        if (this.modelOffsets[this.currentModelKey]) {
            this.modelOffsets[this.currentModelKey].x = x;
            this.modelOffsets[this.currentModelKey].y = y;
        }
    }

    public setBirdScale(scale: number) {
        this.birdScale = scale;
        if (this.activeModel) {
            this.activeModel.scale.set(scale, scale, scale);
        }
    }

    private setupControls() {
        // Keyboard Steering
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                this.togglePause();
                return;
            }

            const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
            if (!isTyping && document.activeElement && document.activeElement !== document.body) {
                (document.activeElement as HTMLElement).blur();
            }

            const k = e.key.toLowerCase();
            if (k === 'w' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'ArrowUp') this.input.up = true;
            if (k === 's' || e.code === 'KeyS' || e.code === 'ArrowDown' || e.key === 'ArrowDown') this.input.down = true;
            if (k === 'a' || e.code === 'KeyA' || e.code === 'ArrowLeft' || e.key === 'ArrowLeft') this.input.left = true;
            if (k === 'd' || e.code === 'KeyD' || e.code === 'ArrowRight' || e.key === 'ArrowRight') this.input.right = true;
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.boost = true;
            if (e.key === ' ' || e.code === 'Space') this.input.brake = true;
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'ArrowUp') this.input.up = false;
            if (k === 's' || e.code === 'KeyS' || e.code === 'ArrowDown' || e.key === 'ArrowDown') this.input.down = false;
            if (k === 'a' || e.code === 'KeyA' || e.code === 'ArrowLeft' || e.key === 'ArrowLeft') this.input.left = false;
            if (k === 'd' || e.code === 'KeyD' || e.code === 'ArrowRight' || e.key === 'ArrowRight') this.input.right = false;
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.boost = false;
            if (e.key === ' ' || e.code === 'Space') this.input.brake = false;
        });

        // Mouse / Touch Drag Steering
        window.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('#top-bar, button, input, select')) return;
            this.isPointerDown = true;
            this.pointerStartX = e.clientX;
            this.pointerStartY = e.clientY;
            this.pointerDeltaX = 0;
            this.pointerDeltaY = 0;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPointerDown) {
                this.pointerDeltaX = (e.clientX - this.pointerStartX) / (window.innerWidth * 0.35);
                this.pointerDeltaY = -(e.clientY - this.pointerStartY) / (window.innerHeight * 0.35);
                this.pointerDeltaX = THREE.MathUtils.clamp(this.pointerDeltaX, -1.0, 1.0);
                this.pointerDeltaY = THREE.MathUtils.clamp(this.pointerDeltaY, -1.0, 1.0);
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPointerDown = false;
            this.pointerDeltaX = 0;
            this.pointerDeltaY = 0;
        });

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const target = e.target as HTMLElement;
                if (target.closest('#top-bar, button, input, select')) return;
                this.isPointerDown = true;
                this.pointerStartX = e.touches[0].clientX;
                this.pointerStartY = e.touches[0].clientY;
                this.pointerDeltaX = 0;
                this.pointerDeltaY = 0;
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.isPointerDown && e.touches.length > 0) {
                this.pointerDeltaX = (e.touches[0].clientX - this.pointerStartX) / (window.innerWidth * 0.35);
                this.pointerDeltaY = -(e.touches[0].clientY - this.pointerStartY) / (window.innerHeight * 0.35);
                this.pointerDeltaX = THREE.MathUtils.clamp(this.pointerDeltaX, -1.0, 1.0);
                this.pointerDeltaY = THREE.MathUtils.clamp(this.pointerDeltaY, -1.0, 1.0);
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            this.isPointerDown = false;
            this.pointerDeltaX = 0;
            this.pointerDeltaY = 0;
        });
    }

    public togglePause(): boolean {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    public setQuality(steps: number) {
        this.stepCount = steps;
        this.shaderMat.uniforms.uSteps.value = steps;
    }

    public setBrightness(val: number) {
        this.brightness = val;
        this.shaderMat.uniforms.uBrightness.value = val;
    }

    private onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera3D.aspect = width / height;
        this.camera3D.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.shaderMat.uniforms.iResolution.value.set(width, height, 1.0);
    }

    public update(dt: number) {
        if (this.isPaused) return;

        // Advance animation mixer with flight speed
        const speedMultiplier = this.velocity / this.moveSpeed;
        if (this.activeMixer) {
            this.activeMixer.update(dt * speedMultiplier);
        }

        // Advance shader time with velocity
        this.shaderTime += dt * speedMultiplier * 0.85;

        // ── Exact Flight Physics from player.ts ───────────────────────────────

        // 1. Yaw Controls & Friction
        const isLeft = this.input.left || (this.isPointerDown && this.pointerDeltaX < -0.15);
        const isRight = this.input.right || (this.isPointerDown && this.pointerDeltaX > 0.15);

        if (isLeft) {
            this.turnVelocity += this.turnAcceleration * dt;
        } else if (isRight) {
            this.turnVelocity -= this.turnAcceleration * dt;
        } else {
            this.turnVelocity *= Math.pow(0.05, dt);
        }

        this.turnVelocity = Math.max(-this.maxTurnSpeed, Math.min(this.maxTurnSpeed, this.turnVelocity));
        this.currentYaw += this.turnVelocity * dt;

        // 2. Banking Roll (Cloned from player.ts line 347-348)
        const targetRoll = (this.turnVelocity / this.maxTurnSpeed) * this.maxBankAngle;
        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, 2.5 * dt);

        // 3. Altitude & Pitch (Cloned from player.ts line 370-378)
        const isUp = this.input.up || (this.isPointerDown && this.pointerDeltaY > 0.15);
        const isDown = this.input.down || (this.isPointerDown && this.pointerDeltaY < -0.15);

        let targetPitch = 0.0;
        if (isUp) {
            targetPitch = this.maxPitchAngle;
        } else if (isDown) {
            targetPitch = -this.maxPitchAngle;
        }
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, 2.5 * dt);

        // 4. Rotations (Cloned from player.ts line 381-383)
        this.eulerRotation.set(this.currentPitch, 0, this.currentRoll, 'YXZ');
        this.targetQuaternion.setFromEuler(this.eulerRotation);
        this.playerGrp.quaternion.slerp(this.targetQuaternion, 5 * dt);

        // 5. Forward Speed & Velocity (Cloned from player.ts line 390-391)
        const targetSpeed = this.input.brake ? 2.0 : (this.input.boost ? 75.0 : this.moveSpeed);
        this.velocity += (targetSpeed - this.velocity) * dt * (this.input.brake ? 4.0 : (this.input.boost ? 3.0 : 2.0));

        // 6. Dynamic Camera FOV (Cloned from player.ts line 416-422)
        if (this.input.boost) {
            this.camera3D.fov = THREE.MathUtils.lerp(this.camera3D.fov, 65, dt * 3.5);
            this.camera3D.updateProjectionMatrix();
        } else if (this.camera3D.fov > 50.5) {
            this.camera3D.fov = THREE.MathUtils.lerp(this.camera3D.fov, 50, dt * 3.5);
            this.camera3D.updateProjectionMatrix();
        }

        // 7. Lateral drift so the bird visibly shifts on screen when steering
        const targetLateralX = -(this.turnVelocity / this.maxTurnSpeed) * 1.8;
        const targetLateralY = (this.currentPitch / this.maxPitchAngle) * 1.2;
        this.playerVisuals.position.x = THREE.MathUtils.lerp(this.playerVisuals.position.x, targetLateralX, 3.0 * dt);
        this.playerVisuals.position.y = THREE.MathUtils.lerp(this.playerVisuals.position.y, targetLateralY, 3.0 * dt);

        // 8. Project exact 3D parrot position to 2D screen coordinate
        const parrotPos = new THREE.Vector3();
        this.playerVisuals.getWorldPosition(parrotPos);
        const projected = parrotPos.clone().project(this.camera3D);

        // Feed exact screen position + manual debug offset to shader
        this.shaderMat.uniforms.uVortexCenter.value.set(
            projected.x * (window.innerWidth / window.innerHeight) * 0.5 + this.vortexManualOffsetX,
            projected.y * 0.5 + this.vortexManualOffsetY
        );

        // 9. Synchronize Vortex Tunnel Curvature smoothly to flight kinematics
        const steerNormX = -(this.turnVelocity / this.maxTurnSpeed);
        const steerNormY = (this.currentPitch / this.maxPitchAngle);

        this.shaderMat.uniforms.uSteerAngle.value.set(
            steerNormX * 0.35,
            steerNormY * 0.25
        );

        this.shaderMat.uniforms.iTime.value = this.shaderTime;
    }

    public render() {
        this.renderer.clear();
        // 1. Render Fullscreen Volumetric Vortex Shader Pass
        this.renderer.render(this.shaderScene, this.shaderCamera);
        // 2. Overlay 3D Animated Flying Parrot
        this.renderer.clearDepth();
        this.renderer.render(this.scene3D, this.camera3D);
    }
}
