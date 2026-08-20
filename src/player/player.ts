import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { gradientMap } from '../world/terrain';
import { terrainHeightJS, getDominantBiome, getDominantBiomeName, BiomeId } from '../world/noise';
import { InputState } from './controls';
import { FLIGHT_MODELS, FlightModelDef } from './FlightModels';

export class PlayerSystem {
    public playerGrp: THREE.Group;
    public playerVisuals: THREE.Group;
    public cameraBase: THREE.Group;
    public cameraPivot: THREE.Group;
    public camera: THREE.PerspectiveCamera;

    public moveSpeed = 18;
    public turnAcceleration = 0.55;
    public maxTurnSpeed = 0.45;
    public maxBankAngle = Math.PI / 7;
    public maxPitchAngle = Math.PI / 8;

    public currentYaw = 0;
    public currentPitch = 0;
    public currentRoll = 0;
    public turnVelocity = 0;
    public velocity = 15.0;

    public currentBiome: BiomeId = 'archipelago';
    public currentBiomeName: string = 'Floating Archipelago';
    public isSkimmingWater: boolean = false;
    public isUpdraftLift: boolean = false;

    public targetCameraDistance = 12;
    public currentCameraDistance = 12;
    public minCameraDistance = 5.0;
    public maxCameraDistance = 42.0;

    private targetQuaternion = new THREE.Quaternion();
    private eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    private baseTargetQuat = new THREE.Quaternion();
    private proxyMesh: THREE.Mesh;

    private gltfLoader: GLTFLoader;
    public currentModelIndex = 0;
    public activeModel: THREE.Group | null = null;
    public activeMixer: THREE.AnimationMixer | null = null;
    public onModelChanged: ((def: FlightModelDef) => void) | null = null;
    private modelChangeListeners: ((def: FlightModelDef) => void)[] = [];

    public addModelChangeListener(listener: (def: FlightModelDef) => void) {
        this.modelChangeListeners.push(listener);
    }

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.camera = camera;

        this.playerGrp = new THREE.Group();
        this.playerGrp.position.set(0, 50, 0);
        scene.add(this.playerGrp);

        this.playerVisuals = new THREE.Group();
        this.playerGrp.add(this.playerVisuals);

        // Placeholder proxy box until GLTF loads
        const proxyGeo = new THREE.BoxGeometry(1.5, 0.5, 3);
        const proxyMat = new THREE.MeshToonMaterial({ color: 0xcc4444, gradientMap });
        this.proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
        this.proxyMesh.castShadow = true;
        this.playerVisuals.add(this.proxyMesh);

        // Camera rig
        this.cameraBase = new THREE.Group();
        this.cameraBase.rotation.order = 'YXZ';
        scene.add(this.cameraBase);

        this.cameraPivot = new THREE.Group();
        this.cameraPivot.rotation.order = 'YXZ';
        this.cameraBase.add(this.cameraPivot);

        this.camera.rotation.order = 'YXZ';
        const initialCamY = 3.2;
        const initialLookY = 0.5;
        this.camera.position.set(0, initialCamY, 12);
        this.camera.rotation.set(-Math.atan2(initialCamY - initialLookY, 12), 0, 0);
        this.cameraPivot.add(this.camera);

        // Setup loader with Draco support
        this.gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.gltfLoader.setDRACOLoader(dracoLoader);

        this.setModel(0);
        this.setupOrbitPointerEvents();
        this.setupZoomEvents();
    }

    public getModelList(): FlightModelDef[] {
        return FLIGHT_MODELS;
    }

    public teleportTo(x: number, z: number, yOffset: number = 50, fixedY?: number) {
        const groundY = terrainHeightJS(x, z);
        const targetY = fixedY !== undefined ? fixedY : Math.max(groundY + yOffset, 25);
        this.playerGrp.position.set(x, targetY, z);
        this.cameraBase.position.copy(this.playerGrp.position);
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.currentRoll = 0;
        this.turnVelocity = 0;
        this.velocity = 18.0;
        this.currentBiome = getDominantBiome(x, z, targetY);
        this.currentBiomeName = getDominantBiomeName(x, z, targetY);
    }

    public getCurrentModelDef(): FlightModelDef {
        return FLIGHT_MODELS[this.currentModelIndex] || FLIGHT_MODELS[0];
    }

    public cycleModel(): FlightModelDef {
        const nextIndex = (this.currentModelIndex + 1) % FLIGHT_MODELS.length;
        this.setModel(nextIndex);
        return this.getCurrentModelDef();
    }

    public setModel(indexOrId: number | string, onComplete?: () => void) {
        let targetIndex = 0;
        if (typeof indexOrId === 'number') {
            targetIndex = Math.max(0, Math.min(FLIGHT_MODELS.length - 1, indexOrId));
        } else {
            const found = FLIGHT_MODELS.findIndex(m => m.id === indexOrId);
            if (found !== -1) targetIndex = found;
        }

        this.currentModelIndex = targetIndex;
        const modelDef = FLIGHT_MODELS[targetIndex];

        const filename = modelDef.file.split('/').pop() || modelDef.file;
        const cleanFile = modelDef.file.replace(/^\.?\//, '');
        const candidatePaths = [
            `/${cleanFile}`,
            `/Assets/Flight/${filename}`,
            `./${cleanFile}`,
            cleanFile,
            `./Assets/Flight/${filename}`,
            `./assets/Flight/${filename}`,
            `Assets/Flight/${filename}`,
            `assets/Flight/${filename}`
        ];

        let pathIdx = 0;
        const tryLoadNext = () => {
            if (pathIdx >= candidatePaths.length) {
                console.error(`Failed to load flight model "${modelDef.name}" from all candidate paths.`);
                return;
            }
            const currentPath = candidatePaths[pathIdx++];
            this.gltfLoader.load(
                currentPath,
                (gltf) => {
                    if (this.activeModel) {
                        this.playerVisuals.remove(this.activeModel);
                        this.activeModel = null;
                    }
                    if (this.activeMixer) {
                        this.activeMixer.stopAllAction();
                        this.activeMixer = null;
                    }

                    const model = gltf.scene;
                    this.activeModel = model;

                    model.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Model orientation and scale
                    model.rotation.set(modelDef.rotX || 0, modelDef.rotY || 0, modelDef.rotZ || 0);

                    const baseScale = modelDef.scale || 1.0;
                    model.scale.set(baseScale, baseScale, baseScale);

                    model.position.set(0, 0, 0);
                    model.updateMatrixWorld(true);
                    const modelBox = new THREE.Box3().setFromObject(model);
                    const modelCenter = new THREE.Vector3();
                    modelBox.getCenter(modelCenter);
                    model.position.set(
                        -modelCenter.x,
                        -modelCenter.y + (modelDef.offsetY || 0),
                        -modelCenter.z
                    );

                    // Setup animation mixer
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.activeMixer = new THREE.AnimationMixer(model);
                        let targetClip: THREE.AnimationClip | null = null;

                        if (modelDef.preferredAnim) {
                            targetClip = gltf.animations.find(a => 
                                a.name.toLowerCase().includes(modelDef.preferredAnim!.toLowerCase())
                            ) || null;
                        }

                        if (!targetClip) {
                            targetClip = gltf.animations[0];
                        }

                        if (targetClip) {
                            const action = this.activeMixer.clipAction(targetClip);
                            action.play();
                        }
                    }

                    this.proxyMesh.visible = false;
                    this.playerVisuals.add(model);

                    if (this.onModelChanged) {
                        this.onModelChanged(modelDef);
                    }
                    for (const listener of this.modelChangeListeners) {
                        try {
                            listener(modelDef);
                        } catch (err) {
                            console.error('Error in modelChangeListener:', err);
                        }
                    }

                    if (onComplete) onComplete();
                },
                undefined,
                () => {
                    tryLoadNext();
                }
            );
        };

        tryLoadNext();
    }

    private setupOrbitPointerEvents() {
        let isDragging = false;
        let prevX = 0, prevY = 0;

        window.addEventListener('pointerdown', (e) => {
            // Do not start drag if clicking interactive UI buttons, inputs, or menus
            const targetEl = e.target as HTMLElement;
            if (
                !targetEl ||
                targetEl.tagName === 'BUTTON' ||
                targetEl.tagName === 'INPUT' ||
                targetEl.tagName === 'TEXTAREA' ||
                targetEl.tagName === 'SELECT' ||
                Boolean(targetEl.closest('#top-bar, #top-right-bar, #settings-menu, #model-dropdown, #biome-dropdown, #debug-panel, #dev-editor-panel, #photo-mode-ui, #boost-btn, #touch-controls, #simulator-toolbar, #simulator-info-bar'))
            ) {
                return;
            }
            // For touch pointers only: reserve the left half for joystick control
            if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.65) {
                return;
            }
            isDragging = true;
            prevX = e.clientX;
            prevY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;

            this.cameraPivot.rotation.y -= dx * 0.004;
            this.cameraPivot.rotation.x -= dy * 0.004;
            this.cameraPivot.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 6, this.cameraPivot.rotation.x));
            this.cameraPivot.rotation.z = 0;

            prevX = e.clientX;
            prevY = e.clientY;
        });

        const stopDrag = () => { isDragging = false; };
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointerleave', stopDrag);
    }

    private setupZoomEvents() {
        // Mouse scroll wheel zoom
        window.addEventListener('wheel', (e) => {
            const targetEl = e.target as HTMLElement;
            if (targetEl.closest('#model-dropdown, #debug-panel, #dev-editor-panel')) {
                return;
            }
            const zoomDelta = e.deltaY * 0.02;
            this.targetCameraDistance = THREE.MathUtils.clamp(
                this.targetCameraDistance + zoomDelta,
                this.minCameraDistance,
                this.maxCameraDistance
            );
        }, { passive: true });

        // Touchscreen pinch-to-zoom (2 touches)
        let initialPinchDist: number | null = null;
        let pinchStartCameraDist = 12;

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                pinchStartCameraDist = this.targetCameraDistance;
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && initialPinchDist !== null && initialPinchDist > 0) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const pinchFactor = initialPinchDist / Math.max(10, currentPinchDist);
                this.targetCameraDistance = THREE.MathUtils.clamp(
                    pinchStartCameraDist * pinchFactor,
                    this.minCameraDistance,
                    this.maxCameraDistance
                );
            }
        }, { passive: true });

        const endPinch = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                initialPinchDist = null;
            }
        };
        window.addEventListener('touchend', endPinch, { passive: true });
        window.addEventListener('touchcancel', endPinch, { passive: true });
    }

    public update(dt: number, inputState: InputState, skyCastles?: any) {
        if (dt <= 0) return;

        // Update active flight model animation mixer
        if (this.activeMixer) {
            this.activeMixer.update(dt);
        }

        // Yaw controls
        if (inputState.left) {
            this.turnVelocity += this.turnAcceleration * dt;
        } else if (inputState.right) {
            this.turnVelocity -= this.turnAcceleration * dt;
        } else {
            this.turnVelocity *= Math.pow(0.05, dt);
        }

        this.turnVelocity = Math.max(-this.maxTurnSpeed, Math.min(this.maxTurnSpeed, this.turnVelocity));
        this.currentYaw += this.turnVelocity * dt;

        // Banking
        const targetRoll = (this.turnVelocity / this.maxTurnSpeed) * this.maxBankAngle;
        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, 2.5 * dt);

        // Biome tracking & dynamic flight aerodynamics
        this.currentBiome = getDominantBiome(this.playerGrp.position.x, this.playerGrp.position.z, this.playerGrp.position.y);
        this.currentBiomeName = getDominantBiomeName(this.playerGrp.position.x, this.playerGrp.position.z, this.playerGrp.position.y);

        // Terrain lean sampling
        const lookAheadDist = 30.0;
        const aheadX = this.playerGrp.position.x - Math.sin(this.currentYaw) * lookAheadDist;
        const aheadZ = this.playerGrp.position.z - Math.cos(this.currentYaw) * lookAheadDist;
        const currentGroundY = terrainHeightJS(this.playerGrp.position.x, this.playerGrp.position.z);
        const aheadGroundY = terrainHeightJS(aheadX, aheadZ);
        const terrainSlope = (aheadGroundY - currentGroundY) / lookAheadDist;
        const altAboveGround = this.playerGrp.position.y - currentGroundY;

        // Estuary ground-effect water skimming
        this.isSkimmingWater = this.currentBiome === 'estuary' && altAboveGround < 18.0 && this.playerGrp.position.y < 28.0;

        // Archipelago / Geothermal thermal updraft lift
        this.isUpdraftLift = (this.currentBiome === 'archipelago' || this.currentBiome === 'geothermal') && currentGroundY > 52.0 && altAboveGround < 45.0;

        // Altitude & Pitch
        let targetPitch = 0.0;
        if (inputState.up) {
            targetPitch = this.maxPitchAngle;
        } else if (inputState.down) {
            targetPitch = -this.maxPitchAngle;
        } else if (terrainSlope > 0.02 && this.playerGrp.position.y < currentGroundY + 70) {
            targetPitch = Math.min(this.maxPitchAngle * 0.75, Math.atan(terrainSlope) * 0.6);
        }
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, 2.5 * dt);

        // Apply rotations
        this.eulerRotation.set(this.currentPitch, this.currentYaw, this.currentRoll, 'YXZ');
        this.targetQuaternion.setFromEuler(this.eulerRotation);
        this.playerGrp.quaternion.slerp(this.targetQuaternion, 5 * dt);

        // Forward flight
        const moveDir = new THREE.Vector3(0, 0, -1);
        moveDir.applyQuaternion(this.playerGrp.quaternion);

        const speedBonus = this.isSkimmingWater ? 6.0 : 0.0;
        const targetSpeed = inputState.brake ? 2.0 : (inputState.boost ? 75.0 : (this.moveSpeed + speedBonus));
        this.velocity += (targetSpeed - this.velocity) * dt * (inputState.brake ? 4.0 : (inputState.boost ? 3.0 : 2.0));
        this.playerGrp.position.add(moveDir.multiplyScalar(this.velocity * dt));

        // 3D Model & Castle Collision Resolution (prevents clipping)
        if (skyCastles && typeof skyCastles.resolveCollisions === 'function') {
            const flightVel = moveDir.clone().multiplyScalar(this.velocity);
            skyCastles.resolveCollisions(this.playerGrp.position, 2.8, flightVel);
        }

        if (this.isUpdraftLift) {
            this.playerGrp.position.y += 3.5 * dt;
        }

        // Smooth camera distance zoom interpolation
        this.currentCameraDistance = THREE.MathUtils.lerp(
            this.currentCameraDistance,
            this.targetCameraDistance,
            dt * 8.0
        );
        const heightScale = Math.sqrt(this.currentCameraDistance / 12.0);
        const cameraY = 3.2 * heightScale;
        const targetLookY = 0.5 * heightScale;
        this.camera.position.set(0, cameraY, this.currentCameraDistance);
        this.camera.rotation.set(-Math.atan2(cameraY - targetLookY, this.currentCameraDistance), 0, 0);

        if (inputState.boost) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 74, dt * 3.5);
            this.camera.updateProjectionMatrix();
        } else if (this.camera.fov > 60.5) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 60, dt * 3.5);
            this.camera.updateProjectionMatrix();
        }

        // Smooth elevation clearance
        const targetMinY = currentGroundY + 45;
        if (this.playerGrp.position.y < targetMinY) {
            this.playerGrp.position.y = THREE.MathUtils.lerp(this.playerGrp.position.y, targetMinY, dt * 3.5);
            if (this.playerGrp.position.y < currentGroundY + 12) {
                this.playerGrp.position.y = currentGroundY + 12;
            }
        }
        this.playerGrp.position.y = Math.min(Math.max(this.playerGrp.position.y, 18), 800);

        // Sync camera base
        this.cameraBase.position.copy(this.playerGrp.position);
        this.eulerRotation.set(0, this.currentYaw, 0, 'YXZ');
        this.baseTargetQuat.setFromEuler(this.eulerRotation);
        this.cameraBase.quaternion.slerp(this.baseTargetQuat, 2.8 * dt);

        this.cameraBase.rotation.x = 0;
        this.cameraBase.rotation.z = 0;
        this.cameraPivot.rotation.z = 0;
        this.camera.rotation.z = 0;
        this.playerVisuals.rotation.set(0, 0, 0);
    }
}
