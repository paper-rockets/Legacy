import * as THREE from 'three';
import { RenderPipeline } from '../core/renderer';
import { PlayerSystem } from '../player/player';
import { SkyCastleSystem, CASTLE_MODEL_CATALOG, CASTLE_COLOR_PRESETS } from '../world/skyCastles';
import { WorldPropsSystem } from '../world/worldProps';
import { LightingSystem } from '../world/lighting';
import { globalConfigManager } from '../core/config';
import { ThumbnailGenerator } from './thumbnailGenerator';

export class TopViewController {
    public isActive: boolean = false;
    public cameraAltitude: number = 1400;
    public targetCenter = new THREE.Vector3(0, 500, -100);
    public currentCenter = new THREE.Vector3(0, 500, -100);
    public selectedIslandId: string | null = null;
    public placementMode: boolean = false;
    public pendingPlacementModel: string = CASTLE_MODEL_CATALOG[0].path;
    public currentMoveStep: number = 25;
    public isDrawerOpen: boolean = false;
    public isMinimized: boolean = false;

    private savedCameraPos = new THREE.Vector3();
    private savedCameraRot = new THREE.Euler();
    private savedCameraFar: number = 1500;
    private isDraggingCastle: boolean = false;
    private draggedIslandId: string | null = null;
    private dragPlaneY: number = 490;
    private dragStartOffset = new THREE.Vector3();
    private isPanning: boolean = false;
    private panStartMouse = new THREE.Vector2();
    private panStartCenter = new THREE.Vector3();

    private gridHelper: THREE.GridHelper | null = null;
    private placementIndicatorMesh: THREE.Mesh | null = null;
    private selectionIndicatorGroup: THREE.Group | null = null;
    private selectionIndicatorMesh: THREE.Mesh | null = null;
    private selectionOuterRingMesh: THREE.Mesh | null = null;
    private lineGroup: THREE.Group;
    private toastTimer: number | null = null;
    private onIslandMovedCallback?: (id: string, x: number, z: number) => void;
    private onIslandSelectedCallback?: (id: string) => void;

    constructor(
        private pipeline: RenderPipeline,
        private player: PlayerSystem,
        private skyCastles?: SkyCastleSystem,
        private worldProps?: WorldPropsSystem,
        private lighting?: LightingSystem
    ) {
        this.lineGroup = new THREE.Group();
        this.lineGroup.name = 'TopViewHelpers';
        this.lineGroup.visible = false;
        this.pipeline.scene.add(this.lineGroup);

        this.initGridHelper();
        this.initPlacementIndicator();
        this.initSelectionIndicator();
        this.bindEvents();
    }

    private initGridHelper() {
        // Overhead spacing blueprint grid (expanded for deep zoom-out view)
        this.gridHelper = new THREE.GridHelper(20000, 200, 0x6366f1, 0x334155);
        this.gridHelper.position.set(0, 485, 0);
        this.gridHelper.visible = false;
        this.pipeline.scene.add(this.gridHelper);
    }

    private initPlacementIndicator() {
        // Luminous holographic ring showing where the castle will be placed
        const geom = new THREE.RingGeometry(25, 32, 36);
        geom.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.placementIndicatorMesh = new THREE.Mesh(geom, mat);
        this.placementIndicatorMesh.position.set(0, 488, 0);
        this.placementIndicatorMesh.visible = false;
        this.pipeline.scene.add(this.placementIndicatorMesh);
    }

    private initSelectionIndicator() {
        // Glowing selection marker that highlights the selected castle on the grid
        this.selectionIndicatorGroup = new THREE.Group();
        this.selectionIndicatorGroup.name = 'TopViewSelectionIndicator';
        this.selectionIndicatorGroup.visible = false;

        // Inner glowing ring
        const innerGeom = new THREE.RingGeometry(28, 34, 48);
        innerGeom.rotateX(-Math.PI / 2);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        this.selectionIndicatorMesh = new THREE.Mesh(innerGeom, innerMat);
        this.selectionIndicatorGroup.add(this.selectionIndicatorMesh);

        // Outer accent ring
        const outerGeom = new THREE.RingGeometry(38, 41, 48);
        outerGeom.rotateX(-Math.PI / 2);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x818cf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
        });
        this.selectionOuterRingMesh = new THREE.Mesh(outerGeom, outerMat);
        this.selectionIndicatorGroup.add(this.selectionOuterRingMesh);

        this.pipeline.scene.add(this.selectionIndicatorGroup);
    }

    public setOnIslandMoved(cb: (id: string, x: number, z: number) => void) {
        this.onIslandMovedCallback = cb;
    }

    public setOnIslandSelected(cb: (id: string) => void) {
        this.onIslandSelectedCallback = cb;
    }

    public setPlacementMode(active: boolean, modelPath?: string) {
        this.placementMode = active;
        if (modelPath) {
            this.pendingPlacementModel = modelPath;
        }

        const hudPlaceBtn = document.getElementById('top-view-place-mode-btn');
        if (hudPlaceBtn) {
            hudPlaceBtn.textContent = active ? 'Cancel Placing' : '+ Place on Grid';
            hudPlaceBtn.style.background = active ? '#ef4444' : '#0284c7';
        }

        const inspPlaceBtn = document.getElementById('top-insp-place-btn');
        if (inspPlaceBtn) {
            inspPlaceBtn.textContent = active ? 'Cancel' : '+ Place on Grid';
            inspPlaceBtn.style.background = active ? '#ef4444' : '#0284c7';
        }

        if (this.placementIndicatorMesh) {
            this.placementIndicatorMesh.visible = active;
        }

        if (active) {
            const cat = CASTLE_MODEL_CATALOG.find(c => c.path === this.pendingPlacementModel) || CASTLE_MODEL_CATALOG[0];
            this.showHudToast(`Click anywhere on the grid to place ${cat.name.split(' (')[0]} (ESC to cancel)`, 8000);
        } else {
            const toast = document.getElementById('top-view-toast');
            if (toast) toast.style.display = 'none';
        }
    }

    public showHudToast(msg: string, durationMs: number = 3000) {
        const toast = document.getElementById('top-view-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.display = 'block';

        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => {
            toast.style.display = 'none';
            this.toastTimer = null;
        }, durationMs);
    }

    public enterTopView(centerTarget?: THREE.Vector3) {
        if (this.isActive) return;
        this.isActive = true;

        // Disable all fog in top-down blueprint view
        if (this.lighting) this.lighting.setFogDisabled(true, this.pipeline.scene);
        if (this.skyCastles) {
            this.skyCastles.setFogDeckDisabled(true);
            this.skyCastles.isTopViewActive = true;
        }

        // Hide overwhelming dev sidebar by default to provide a clean full-screen map experience
        const devPanel = document.getElementById('dev-editor-panel');
        if (devPanel) devPanel.style.display = 'none';

        // Save original camera pose & far plane
        this.savedCameraPos.copy(this.pipeline.camera.position);
        this.savedCameraRot.copy(this.pipeline.camera.rotation);
        this.savedCameraFar = this.pipeline.camera.far;

        // Expand far clipping plane so deep zoom-out never clips the landscape
        this.pipeline.camera.far = 35000;
        this.pipeline.camera.updateProjectionMatrix();

        if (centerTarget) {
            this.targetCenter.set(centerTarget.x, centerTarget.y || 490, centerTarget.z);
        } else if (this.skyCastles) {
            const islands = this.skyCastles.getIslands();
            if (islands.length > 0) {
                const first = islands[0];
                this.targetCenter.set(first.x, first.y, first.z);
                this.selectedIslandId = first.id;
            } else {
                this.targetCenter.set(this.player.playerGrp.position.x, 490, this.player.playerGrp.position.z);
            }
        } else {
            this.targetCenter.copy(this.player.playerGrp.position);
        }
        this.currentCenter.copy(this.targetCenter);

        if (this.gridHelper) {
            this.gridHelper.position.y = this.targetCenter.y - 5;
            this.gridHelper.visible = true;
        }
        this.lineGroup.visible = true;

        const hud = document.getElementById('top-view-hud');
        if (hud) hud.style.display = 'flex';

        this.updateCameraTransform();
        this.updateSelectionIndicator();
        this.refreshInspector();
        this.showHudToast('TOP-DOWN BLUEPRINT: Click castle to select | Arrow keys (Up, Down, Left, Right) to move | WASD to pan', 4500);
    }

    public exitTopView() {
        if (!this.isActive) return;
        this.isActive = false;
        this.isDraggingCastle = false;
        this.isPanning = false;
        this.setPlacementMode(false);

        if (this.skyCastles) {
            this.skyCastles.isTopViewActive = false;
        }

        if (this.gridHelper) this.gridHelper.visible = false;
        if (this.placementIndicatorMesh) this.placementIndicatorMesh.visible = false;
        if (this.selectionIndicatorGroup) this.selectionIndicatorGroup.visible = false;
        this.lineGroup.visible = false;

        const hud = document.getElementById('top-view-hud');
        if (hud) hud.style.display = 'none';

        const toast = document.getElementById('top-view-toast');
        if (toast) toast.style.display = 'none';

        // Check if dev editor panel is still open before restoring fog
        const devPanel = document.getElementById('dev-editor-panel');
        const isEditorOpen = devPanel && devPanel.style.display !== 'none';
        if (!isEditorOpen) {
            if (this.lighting) this.lighting.setFogDisabled(false, this.pipeline.scene);
            if (this.skyCastles) this.skyCastles.setFogDeckDisabled(false);
        }

        // Restore camera orientation and far plane
        this.pipeline.camera.far = this.savedCameraFar || 1500;
        this.pipeline.camera.updateProjectionMatrix();
        this.pipeline.camera.rotation.copy(this.savedCameraRot);
        this.pipeline.camera.position.copy(this.savedCameraPos);
    }

    public setAltitude(alt: number) {
        this.cameraAltitude = Math.max(50, Math.min(10000, alt));
        this.updateCameraTransform();
        this.refreshInspector();
    }

    public zoomByFactor(factor: number) {
        this.setAltitude(this.cameraAltitude * factor);
    }

    public toggleTopView(centerTarget?: THREE.Vector3) {
        if (this.isActive) {
            this.exitTopView();
        } else {
            this.enterTopView(centerTarget);
        }
    }

    public focusOnCoordinates(x: number, z: number, y: number = 490) {
        this.targetCenter.set(x, y, z);
        this.currentCenter.set(x, y, z);
        if (this.isActive) {
            this.updateCameraTransform();
            this.refreshInspector();
        }
    }

    public moveSelectedCastle(dx: number, dz: number) {
        if (!this.isActive || !this.selectedIslandId || !this.skyCastles) return;
        const isl = this.skyCastles.getIsland(this.selectedIslandId);
        if (!isl) return;

        if (isl.locked) {
            this.showHudToast(`Cannot move "${isl.name}": Castle is LOCKED. Click Unlock to move.`, 2500);
            return;
        }

        const newX = Math.round(isl.x + dx);
        const newZ = Math.round(isl.z + dz);
        this.skyCastles.updateIsland(this.selectedIslandId, { x: newX, z: newZ });
        this.updateSelectionIndicator();

        if (this.onIslandMovedCallback) {
            this.onIslandMovedCallback(this.selectedIslandId, newX, newZ);
        }

        this.refreshInspector(this.selectedIslandId);
        this.showHudToast(`Moved ${isl.name} -> X: ${newX}m | Z: ${newZ}m`, 1500);
    }

    public rotateSelectedCastle(deltaRad: number) {
        if (!this.isActive || !this.selectedIslandId || !this.skyCastles) return;
        const isl = this.skyCastles.getIsland(this.selectedIslandId);
        if (!isl) return;

        if (isl.locked) {
            this.showHudToast(`Cannot rotate "${isl.name}": Castle is LOCKED.`, 2500);
            return;
        }

        const newRot = Number((isl.rotationY + deltaRad).toFixed(2));
        this.skyCastles.updateIsland(this.selectedIslandId, { rotationY: newRot });
        this.refreshInspector(this.selectedIslandId);
        this.showHudToast(`Rotated ${isl.name} -> ${(newRot * (180 / Math.PI)).toFixed(0)} deg`, 1500);
    }

    public updateSelectionIndicator() {
        if (!this.isActive || !this.selectedIslandId || !this.skyCastles || !this.selectionIndicatorGroup) {
            if (this.selectionIndicatorGroup) this.selectionIndicatorGroup.visible = false;
            return;
        }
        const isl = this.skyCastles.getIsland(this.selectedIslandId);
        if (!isl) {
            this.selectionIndicatorGroup.visible = false;
            return;
        }
        this.selectionIndicatorGroup.position.set(isl.x, isl.y - 2, isl.z);
        const radScale = Math.max(0.6, (isl.scale || 2.0) / 2.0);
        this.selectionIndicatorGroup.scale.set(radScale, 1, radScale);
        this.selectionIndicatorGroup.visible = true;
    }

    private updateCameraTransform() {
        if (!this.isActive) return;
        this.pipeline.camera.position.set(this.currentCenter.x, this.currentCenter.y + this.cameraAltitude, this.currentCenter.z);
        this.pipeline.camera.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
    }

    public update(dt: number) {
        if (!this.isActive) return;
        this.currentCenter.lerp(this.targetCenter, Math.min(1.0, dt * 10.0));
        this.updateCameraTransform();

        // Animate selection indicator
        if (this.selectionIndicatorGroup && this.selectionIndicatorGroup.visible) {
            if (this.selectionIndicatorMesh) {
                this.selectionIndicatorMesh.rotation.y += dt * 0.4;
            }
            if (this.selectionOuterRingMesh) {
                this.selectionOuterRingMesh.rotation.y -= dt * 0.25;
                const pulse = Math.sin(Date.now() * 0.005) * 0.06 + 1.0;
                this.selectionOuterRingMesh.scale.set(pulse, 1, pulse);
            }
        }
    }

    private bindEvents() {
        // Pan on Right-Click or Middle-Click
        window.addEventListener('pointerdown', (e) => {
            if (!this.isActive) return;
            const panel = document.getElementById('dev-editor-panel');
            const topBar = document.getElementById('top-bar');
            const hud = document.getElementById('top-view-hud');
            if (panel && panel.contains(e.target as Node)) return;
            if (topBar && topBar.contains(e.target as Node)) return;
            if (hud && hud.contains(e.target as Node)) return;

            if (e.button === 2 || e.button === 1) {
                // Right click or middle click pan
                this.isPanning = true;
                this.panStartMouse.set(e.clientX, e.clientY);
                this.panStartCenter.copy(this.targetCenter);
                e.preventDefault();
                return;
            }

            if (e.button === 0 && this.skyCastles) {
                // Check if in Placement Mode (Click on grid to place!)
                if (this.placementMode) {
                    const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                    if (planeHit) {
                        const newIsl = this.skyCastles.addIsland({
                            modelPath: this.pendingPlacementModel,
                            x: Math.round(planeHit.x),
                            z: Math.round(planeHit.z),
                            y: 490
                        });
                        this.selectedIslandId = newIsl.id;
                        this.setPlacementMode(false);
                        this.updateSelectionIndicator();
                        this.refreshInspector();
                        this.showHudToast(`Castle Placed at X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m! Use Arrow Keys or drag to adjust.`);
                        return;
                    }
                }

                // Left click selection / drag
                const hitIslandId = this.skyCastles.raycastCastles(e.clientX, e.clientY, this.pipeline.camera);
                if (hitIslandId) {
                    this.selectedIslandId = hitIslandId;
                    const isl = this.skyCastles.getIsland(hitIslandId);
                    if (isl) {
                        if (this.onIslandSelectedCallback) {
                            this.onIslandSelectedCallback(hitIslandId);
                        }
                        this.updateSelectionIndicator();
                        if (!isl.locked) {
                            this.isDraggingCastle = true;
                            this.draggedIslandId = hitIslandId;
                            this.dragPlaneY = isl.y;
                            const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, this.dragPlaneY);
                            if (planeHit) {
                                this.dragStartOffset.set(isl.x - planeHit.x, 0, isl.z - planeHit.z);
                            }
                        }
                        this.refreshInspector(hitIslandId);
                    }
                }
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isActive) return;

            // Placement indicator follow mouse
            if (this.placementMode && this.placementIndicatorMesh && this.skyCastles) {
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    this.placementIndicatorMesh.position.set(planeHit.x, 488, planeHit.z);
                    this.placementIndicatorMesh.visible = true;
                }
            }

            // Pan handler
            if (this.isPanning) {
                const dx = e.clientX - this.panStartMouse.x;
                const dy = e.clientY - this.panStartMouse.y;
                const factor = (this.cameraAltitude / window.innerHeight) * 1.6;
                this.targetCenter.x = this.panStartCenter.x - dx * factor;
                this.targetCenter.z = this.panStartCenter.z - dy * factor;
                this.currentCenter.copy(this.targetCenter);
                this.updateCameraTransform();
                this.updateCursorCoords(e.clientX, e.clientY);
                return;
            }

            // Drag castle island handler
            if (this.isDraggingCastle && this.draggedIslandId && this.skyCastles) {
                const isl = this.skyCastles.getIsland(this.draggedIslandId);
                if (isl && !isl.locked) {
                    const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, this.dragPlaneY);
                    if (planeHit) {
                        const newX = Math.round(planeHit.x + this.dragStartOffset.x);
                        const newZ = Math.round(planeHit.z + this.dragStartOffset.z);
                        this.skyCastles.updateIsland(this.draggedIslandId, { x: newX, z: newZ });
                        this.updateSelectionIndicator();
                        if (this.onIslandMovedCallback) {
                            this.onIslandMovedCallback(this.draggedIslandId, newX, newZ);
                        }
                        this.refreshInspector(this.draggedIslandId);
                    }
                }
            }

            this.updateCursorCoords(e.clientX, e.clientY);
        });

        window.addEventListener('pointerup', (e) => {
            if (!this.isActive) return;
            if (e.button === 2 || e.button === 1) {
                this.isPanning = false;
            }
            if (e.button === 0) {
                this.isDraggingCastle = false;
                this.draggedIslandId = null;
            }
        });

        // Prevent context menu in Top View so right click pan feels native
        window.addEventListener('contextmenu', (e) => {
            if (this.isActive) {
                const panel = document.getElementById('dev-editor-panel');
                const hud = document.getElementById('top-view-hud');
                if ((!panel || !panel.contains(e.target as Node)) && (!hud || !hud.contains(e.target as Node))) {
                    e.preventDefault();
                }
            }
        });

        // HTML5 Drag and Drop for Castles
        window.addEventListener('dragover', (e) => {
            if (!this.isActive) return;
            const modelPath = (window as any).__draggedCastleModel;
            if (modelPath && this.skyCastles) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit && this.placementIndicatorMesh) {
                    this.placementIndicatorMesh.position.set(planeHit.x, 488, planeHit.z);
                    this.placementIndicatorMesh.visible = true;
                }
            }
        });

        window.addEventListener('drop', (e) => {
            if (!this.isActive) return;
            const modelPath = (window as any).__draggedCastleModel || e.dataTransfer?.getData('text/plain');
            if (modelPath && this.skyCastles) {
                const target = e.target as HTMLElement;
                const panel = document.getElementById('dev-editor-panel');
                const hud = document.getElementById('top-view-hud');
                if (panel && panel.contains(target)) return;
                if (hud && hud.contains(target)) return;

                e.preventDefault();
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    const newIsl = this.skyCastles.addIsland({
                        modelPath: modelPath,
                        x: Math.round(planeHit.x),
                        z: Math.round(planeHit.z),
                        y: 490
                    });
                    this.selectedIslandId = newIsl.id;
                    this.updateSelectionIndicator();
                    this.refreshInspector();
                    this.showHudToast(`Castle placed at X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m! Use Arrow Keys or drag to adjust.`);
                }
                (window as any).__draggedCastleModel = null;
                if (this.placementIndicatorMesh) this.placementIndicatorMesh.visible = false;
            }
        });

        // Mouse Wheel Zoom
        window.addEventListener('wheel', (e) => {
            if (!this.isActive) return;
            const panel = document.getElementById('dev-editor-panel');
            const hud = document.getElementById('top-view-hud');
            if (panel && panel.contains(e.target as Node)) return;
            if (hud && hud.contains(e.target as Node)) return;

            const zoomDelta = e.deltaY * (this.cameraAltitude * 0.0020);
            this.cameraAltitude = Math.max(50, Math.min(10000, this.cameraAltitude + zoomDelta));
            this.updateCameraTransform();
            this.updateCursorCoords(e.clientX, e.clientY);
        }, { passive: true });

        // Keyboard: Arrow keys (Up, Down, Left, Right) to move castle on grid
        // WASD to pan camera across blueprint grid
        window.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
                return;
            }

            // Step size computation
            let step = this.currentMoveStep || 25;
            if (e.shiftKey) {
                step *= 5; // Fast nudge
            } else if (e.altKey || e.ctrlKey) {
                step = Math.max(1, Math.round(step * 0.2)); // Precision nudge
            }

            // Arrow keys: move selected castle on grid (X/Z plane, preserving altitude)
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.selectedIslandId && this.skyCastles) {
                    this.moveSelectedCastle(0, -step);
                } else {
                    this.targetCenter.z -= this.cameraAltitude * 0.05;
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.selectedIslandId && this.skyCastles) {
                    this.moveSelectedCastle(0, step);
                } else {
                    this.targetCenter.z += this.cameraAltitude * 0.05;
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (this.selectedIslandId && this.skyCastles) {
                    this.moveSelectedCastle(-step, 0);
                } else {
                    this.targetCenter.x -= this.cameraAltitude * 0.05;
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (this.selectedIslandId && this.skyCastles) {
                    this.moveSelectedCastle(step, 0);
                } else {
                    this.targetCenter.x += this.cameraAltitude * 0.05;
                }
            } else if (e.key === 'w' || e.key === 'W') {
                // WASD pan camera
                this.targetCenter.z -= this.cameraAltitude * 0.05;
            } else if (e.key === 's' || e.key === 'S') {
                this.targetCenter.z += this.cameraAltitude * 0.05;
            } else if (e.key === 'a' || e.key === 'A') {
                this.targetCenter.x -= this.cameraAltitude * 0.05;
            } else if (e.key === 'd' || e.key === 'D') {
                this.targetCenter.x += this.cameraAltitude * 0.05;
            } else if (e.key === 'q' || e.key === 'Q') {
                if (this.selectedIslandId && this.skyCastles) {
                    this.rotateSelectedCastle(-Math.PI / 12);
                }
            } else if (e.key === 'e' || e.key === 'E') {
                if (this.selectedIslandId && this.skyCastles) {
                    this.rotateSelectedCastle(Math.PI / 12);
                }
            } else if (e.key === 'Escape') {
                if (this.placementMode) {
                    this.setPlacementMode(false);
                    this.showHudToast('Placement mode cancelled');
                } else {
                    this.exitTopView();
                }
            }
        });

        // Directional Nudge Pad Buttons
        const bindBtn = (id: string, fn: () => void) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        bindBtn('top-view-nudge-up', () => this.moveSelectedCastle(0, -this.currentMoveStep));
        bindBtn('top-view-nudge-down', () => this.moveSelectedCastle(0, this.currentMoveStep));
        bindBtn('top-view-nudge-left', () => this.moveSelectedCastle(-this.currentMoveStep, 0));
        bindBtn('top-view-nudge-right', () => this.moveSelectedCastle(this.currentMoveStep, 0));

        // Step Size Selector Buttons
        const stepBtns = document.querySelectorAll('.top-view-step-btn');
        stepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const s = parseInt(btn.getAttribute('data-step') || '25', 10);
                this.currentMoveStep = s;
                stepBtns.forEach(b => b.classList.toggle('active', b === btn));
                this.showHudToast(`Move step set to ${s}m`, 1500);
            });
        });

        // Rotation Buttons
        bindBtn('top-view-rot-ccw', () => this.rotateSelectedCastle(-Math.PI / 12));
        bindBtn('top-view-rot-cw', () => this.rotateSelectedCastle(Math.PI / 12));

        // Quick Zoom Level Buttons
        bindBtn('top-view-zoom-in', () => this.zoomByFactor(0.70));
        bindBtn('top-view-zoom-out', () => this.zoomByFactor(1.40));
        bindBtn('top-view-zoom-500', () => this.setAltitude(500));
        bindBtn('top-view-zoom-1500', () => this.setAltitude(1500));
        bindBtn('top-view-zoom-3500', () => this.setAltitude(3500));
        bindBtn('top-view-zoom-7500', () => this.setAltitude(7500));

        // Place Mode Toggle Button in HUD
        bindBtn('top-view-place-mode-btn', () => this.setPlacementMode(!this.placementMode));
        bindBtn('top-insp-place-btn', () => this.setPlacementMode(!this.placementMode));

        // Toggle Drawer (Models, Colors & Layout Presets)
        const toggleDrawerBtn = document.getElementById('top-view-toggle-drawer-btn');
        if (toggleDrawerBtn) {
            toggleDrawerBtn.addEventListener('click', () => {
                const drawer = document.getElementById('top-view-drawer');
                if (drawer) {
                    this.isDrawerOpen = !this.isDrawerOpen;
                    drawer.style.display = this.isDrawerOpen ? 'flex' : 'none';
                    toggleDrawerBtn.style.background = this.isDrawerOpen ? '#4f46e5' : '#334155';
                }
            });
        }

        // Toggle Min View (Zen Mode)
        const minBtn = document.getElementById('top-view-min-btn');
        if (minBtn) {
            minBtn.addEventListener('click', () => {
                this.isMinimized = !this.isMinimized;
                const hud = document.getElementById('top-view-hud');
                const drawer = document.getElementById('top-view-drawer');
                if (hud) {
                    if (this.isMinimized) {
                        if (drawer) drawer.style.display = 'none';
                        this.isDrawerOpen = false;
                        minBtn.textContent = 'Max View';
                        this.showHudToast('Zen View Active: Use Arrow keys to move selected castle | Press Max View to restore tools', 3000);
                    } else {
                        minBtn.textContent = 'Min View';
                    }
                }
            });
        }

        // Layout Preset Buttons
        bindBtn('top-view-preset-spacious', () => {
            if (this.skyCastles) {
                this.skyCastles.applyLayoutPreset('spacious');
                this.refreshInspector();
                this.updateSelectionIndicator();
                this.showHudToast('Applied Spacious Layout Preset');
            }
        });

        bindBtn('top-view-preset-ring', () => {
            if (this.skyCastles) {
                this.skyCastles.applyLayoutPreset('ring');
                this.refreshInspector();
                this.updateSelectionIndicator();
                this.showHudToast('Applied Wide Ring Layout Preset');
            }
        });

        bindBtn('top-view-preset-reset', () => {
            if (this.skyCastles && confirm('Reset all floating castle positions to factory defaults?')) {
                this.skyCastles.resetToDefaults();
                this.selectedIslandId = this.skyCastles.getIslands()[0]?.id || null;
                this.refreshInspector();
                this.updateSelectionIndicator();
                this.showHudToast('Reset castle archipelago to defaults');
            }
        });

        // Toggle Sidebar Panel Button
        const togglePanelBtn = document.getElementById('top-view-toggle-panel-btn');
        if (togglePanelBtn) {
            togglePanelBtn.addEventListener('click', () => {
                const devPanel = document.getElementById('dev-editor-panel');
                if (devPanel) {
                    const isHidden = devPanel.style.display === 'none' || !devPanel.style.display;
                    devPanel.style.display = isHidden ? 'flex' : 'none';
                    togglePanelBtn.textContent = isHidden ? 'Hide Sidebar' : 'Sidebar';
                }
            });
        }

        // Save Disk Button in HUD
        const saveDiskHudBtn = document.getElementById('top-view-save-disk-btn');
        if (saveDiskHudBtn) {
            saveDiskHudBtn.addEventListener('click', async () => {
                if (this.skyCastles) this.skyCastles.saveToConfig();
                saveDiskHudBtn.textContent = 'Saving...';
                const res = await globalConfigManager.saveConfigToDisk();
                saveDiskHudBtn.textContent = res.success ? 'Saved to Disk' : 'Error Saving';
                this.showHudToast('Saved all castle layouts permanently to disk!');
                setTimeout(() => {
                    saveDiskHudBtn.textContent = 'Save to Disk';
                }, 2000);
            });
        }

        // Exit button in HUD
        bindBtn('top-view-exit-btn', () => this.exitTopView());

        // Inspector Island Select
        const inspIslandSelect = document.getElementById('top-insp-island-select') as HTMLSelectElement | null;
        if (inspIslandSelect) {
            inspIslandSelect.addEventListener('change', () => {
                this.selectedIslandId = inspIslandSelect.value;
                if (this.skyCastles) {
                    const isl = this.skyCastles.getIsland(this.selectedIslandId);
                    if (isl) {
                        this.focusOnCoordinates(isl.x, isl.z, isl.y);
                    }
                }
                this.updateSelectionIndicator();
                this.refreshInspector();
            });
        }

        // Inspector Add Island
        bindBtn('top-insp-add-btn', () => this.setPlacementMode(true));

        // Inspector Delete Island
        bindBtn('top-insp-del-btn', () => {
            if (this.selectedIslandId && this.skyCastles) {
                const isl = this.skyCastles.getIsland(this.selectedIslandId);
                if (isl && confirm(`Delete castle island "${isl.name}"?`)) {
                    this.skyCastles.removeIsland(this.selectedIslandId);
                    this.selectedIslandId = this.skyCastles.getIslands()[0]?.id || null;
                    this.updateSelectionIndicator();
                    this.refreshInspector();
                    this.showHudToast(`Deleted ${isl.name}`);
                }
            }
        });

        // Inspector Lock Button
        bindBtn('top-insp-lock-btn', () => {
            if (this.selectedIslandId && this.skyCastles) {
                const next = !this.skyCastles.isIslandLocked(this.selectedIslandId);
                this.skyCastles.setIslandLocked(this.selectedIslandId, next);
                this.refreshInspector();
                this.showHudToast(next ? 'Castle Locked' : 'Castle Unlocked');
            }
        });

        // Inspector Color Preset Buttons
        const colorBtns = document.querySelectorAll('.top-insp-color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                if (preset && this.selectedIslandId && this.skyCastles) {
                    const colors = CASTLE_COLOR_PRESETS[preset];
                    if (colors) {
                        this.skyCastles.setIslandColors(this.selectedIslandId, { ...colors });
                        this.refreshInspector();
                    }
                }
            });
        });
    }

    private updateCursorCoords(clientX: number, clientY: number) {
        if (!this.isActive || !this.skyCastles) return;
        const planeHit = this.skyCastles.raycastHorizontalPlane(clientX, clientY, this.pipeline.camera, 490);
        const coordEl = document.getElementById('top-view-cursor-coords');
        if (coordEl && planeHit) {
            const isl = this.selectedIslandId ? this.skyCastles.getIsland(this.selectedIslandId) : null;
            if (isl) {
                coordEl.textContent = `SEL: X: ${isl.x}m | Z: ${isl.z}m | ALT: ${isl.y}m  (MAP: X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m)`;
            } else {
                coordEl.textContent = `X: ${Math.round(planeHit.x)}m | Z: ${Math.round(planeHit.z)}m | ALT: ${Math.round(this.cameraAltitude)}m`;
            }
        }
    }

    public refreshInspector(selectedIslandId?: string) {
        if (!this.isActive || !this.skyCastles) return;

        const islands = this.skyCastles.getIslands();
        if (islands.length === 0) return;

        if (selectedIslandId) {
            this.selectedIslandId = selectedIslandId;
        } else if (!this.selectedIslandId || !islands.some(i => i.id === this.selectedIslandId)) {
            this.selectedIslandId = islands[0].id;
        }

        const isl = this.skyCastles.getIsland(this.selectedIslandId);
        if (!isl) return;

        // 1. Populate island dropdown
        const islandSelect = document.getElementById('top-insp-island-select') as HTMLSelectElement | null;
        if (islandSelect) {
            islandSelect.innerHTML = '';
            islands.forEach((item, idx) => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = `${idx + 1}. ${item.name}`;
                if (item.id === this.selectedIslandId) opt.selected = true;
                islandSelect.appendChild(opt);
            });
        }

        // 2. Populate visual 3D model thumbnail grid
        const modelGrid = document.getElementById('top-insp-model-grid');
        if (modelGrid) {
            modelGrid.innerHTML = '';
            CASTLE_MODEL_CATALOG.forEach((cat) => {
                const isCurrent = cat.path === isl.modelPath;
                const card = document.createElement('div');
                card.className = `castle-model-card ${isCurrent ? 'active' : ''}`;
                card.style.cssText = 'padding: 2px; cursor: grab; min-width: 58px;';
                card.draggable = true;

                const thumbWrap = document.createElement('div');
                thumbWrap.className = 'castle-model-thumb-wrap';
                thumbWrap.style.cssText = 'height: 40px;';

                const img = document.createElement('img');
                img.className = 'castle-model-thumb';
                img.alt = cat.name;
                img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%231e293b"/></svg>';

                ThumbnailGenerator.getModelThumbnail(cat.path).then(dataUrl => {
                    img.src = dataUrl;
                });

                thumbWrap.appendChild(img);

                const info = document.createElement('div');
                info.className = 'castle-model-card-info';
                info.style.cssText = 'padding: 2px 3px;';
                info.innerHTML = `
                    <div class="castle-model-card-name" style="font-size: 7.5px;">${cat.name.split(' (')[0]}</div>
                `;

                card.appendChild(thumbWrap);
                card.appendChild(info);

                card.addEventListener('dragstart', (e) => {
                    (window as any).__draggedCastleModel = cat.path;
                    if (e.dataTransfer) {
                        e.dataTransfer.setData('text/plain', cat.path);
                        e.dataTransfer.effectAllowed = 'copy';
                    }
                    card.classList.add('dragging');
                    this.showHudToast(`Drag onto map to place ${cat.name.split(' (')[0]}`);
                });

                card.addEventListener('dragend', () => {
                    (window as any).__draggedCastleModel = null;
                    card.classList.remove('dragging');
                });

                card.addEventListener('click', async () => {
                    this.pendingPlacementModel = cat.path;
                    if (this.selectedIslandId && this.skyCastles) {
                        await this.skyCastles.setIslandModel(this.selectedIslandId, cat.path);
                        this.refreshInspector();
                    }
                });

                modelGrid.appendChild(card);
            });
        }

        // 3. Lock State
        const isLocked = isl.locked ?? false;
        const lockBadge = document.getElementById('top-insp-lock-badge');
        if (lockBadge) {
            lockBadge.textContent = isLocked ? 'LOCKED' : 'UNLOCKED';
            lockBadge.style.background = isLocked ? '#ef4444' : '#22c55e';
            lockBadge.style.color = isLocked ? '#ffffff' : '#000000';
        }

        const lockBtn = document.getElementById('top-insp-lock-btn');
        if (lockBtn) {
            lockBtn.textContent = isLocked ? 'Unlock' : 'Lock';
            lockBtn.style.background = isLocked ? '#ef4444' : '#eab308';
            lockBtn.style.color = isLocked ? '#ffffff' : '#000000';
        }

        // 4. Coordinates
        const coordEl = document.getElementById('top-view-cursor-coords');
        if (coordEl) {
            coordEl.textContent = `X: ${isl.x}m | Z: ${isl.z}m | ALT: ${isl.y}m`;
        }

        // 5. Nearest neighbor
        const nearestEl = document.getElementById('top-insp-nearest-val');
        if (nearestEl) {
            const nearest = this.skyCastles.getDistanceToNearestCastle(this.selectedIslandId);
            if (nearest) {
                nearestEl.textContent = `Nearest: ${nearest.island.name} (${Math.round(nearest.distance)}m)`;
            } else {
                nearestEl.textContent = 'Nearest: None';
            }
        }

        // 6. Highlight active color preset
        const activePreset = isl.colors?.preset || 'custom';
        const colorBtns = document.querySelectorAll('.top-insp-color-btn');
        colorBtns.forEach(btn => {
            const pKey = btn.getAttribute('data-preset');
            if (pKey === activePreset) {
                btn.classList.add('active');
                (btn as HTMLElement).style.outline = '2px solid #ffffff';
            } else {
                btn.classList.remove('active');
                (btn as HTMLElement).style.outline = 'none';
            }
        });

        // 7. Update visual selection ring position
        this.updateSelectionIndicator();
    }

    public updateHUDMetrics(selectedIslandId?: string) {
        this.refreshInspector(selectedIslandId);
    }
}
