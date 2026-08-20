import * as THREE from 'three';
import { RenderPipeline } from '../core/renderer';
import { SkyCastleSystem } from '../world/skyCastles';
import { PlayerSystem } from '../player/player';
import { LightingSystem } from '../world/lighting';
import { castleEditorState } from './castleEditorState';
import { buildCastleControls } from './tabs/castlesTab';
import { renderPanel } from './panel/render';
import { PanelHandle } from './panel/types';
import './blueprint.css';

export interface BlueprintViewOptions {
    pipeline: RenderPipeline;
    skyCastles: SkyCastleSystem;
    player: PlayerSystem;
    lighting: LightingSystem;
    onPlaceCastle?: (modelPath: string, x: number, z: number) => void;
    onExit?: () => void;
}

export class BlueprintViewController {
    public isActive: boolean = false;
    public isExpanded: boolean = false;
    public currentCenter: THREE.Vector3 = new THREE.Vector3(0, 490, 0);
    public targetCenter: THREE.Vector3 = new THREE.Vector3(0, 490, 0);
    public cameraAltitude: number = 1500;

    private pipeline: RenderPipeline;
    private skyCastles: SkyCastleSystem;
    private player: PlayerSystem;
    private lighting: LightingSystem;
    private onPlaceCastleCallback?: (modelPath: string, x: number, z: number) => void;
    private onExitCallback?: () => void;

    // Saved camera state
    private savedCameraPos: THREE.Vector3 = new THREE.Vector3();
    private savedCameraRot: THREE.Euler = new THREE.Euler();
    private savedCameraFar: number = 2000;

    // 3D Scene Helpers
    private gridHelper: THREE.GridHelper;
    private selectionIndicatorGroup: THREE.Group;
    private selectionRingMesh: THREE.Mesh;
    private placementIndicatorMesh: THREE.Mesh;

    // DOM Elements
    private rootEl: HTMLElement;
    private coordsEl: HTMLElement;
    private selectedPillEl: HTMLElement;
    private deleteBtnEl: HTMLElement;
    private placeToggleBtn: HTMLElement;
    private expandToggleBtn: HTMLElement;
    private toastEl: HTMLElement;
    private drawerWrapEl: HTMLElement;
    private drawerBodyEl: HTMLElement;
    private drawerBadgeEl: HTMLElement;
    private drawerHandle: PanelHandle | null = null;
    private unsubscribeState: (() => void) | null = null;

    // Interaction State
    private nudgeStep: number = 25;
    private isDraggingCastle: boolean = false;
    private isPanning: boolean = false;
    private lastPointerX: number = 0;
    private lastPointerY: number = 0;
    private toastTimer: number | null = null;

    constructor(options: BlueprintViewOptions) {
        this.pipeline = options.pipeline;
        this.skyCastles = options.skyCastles;
        this.player = options.player;
        this.lighting = options.lighting;
        this.onPlaceCastleCallback = options.onPlaceCastle;
        this.onExitCallback = options.onExit;

        // 1. Scene Helpers
        this.gridHelper = new THREE.GridHelper(6000, 120, 0x38bdf8, 0x1e293b);
        this.gridHelper.position.y = 485;
        this.gridHelper.visible = false;
        this.pipeline.scene.add(this.gridHelper);

        // Selection ring
        this.selectionIndicatorGroup = new THREE.Group();
        const ringGeo = new THREE.RingGeometry(35, 42, 36);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        this.selectionRingMesh = new THREE.Mesh(ringGeo, ringMat);
        this.selectionIndicatorGroup.add(this.selectionRingMesh);
        this.selectionIndicatorGroup.visible = false;
        this.pipeline.scene.add(this.selectionIndicatorGroup);

        // Placement cursor preview disk
        const placeGeo = new THREE.RingGeometry(25, 32, 32);
        placeGeo.rotateX(-Math.PI / 2);
        const placeMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.placementIndicatorMesh = new THREE.Mesh(placeGeo, placeMat);
        this.placementIndicatorMesh.position.y = 488;
        this.placementIndicatorMesh.visible = false;
        this.pipeline.scene.add(this.placementIndicatorMesh);

        // 2. DOM Setup
        this.rootEl = document.getElementById('blueprint-root') || document.createElement('div');
        this.rootEl.id = 'blueprint-root';
        this.rootEl.innerHTML = '';

        // ── Top Bar ────────────────────────────────────────────────────────────
        const topBar = document.createElement('div');
        topBar.className = 'blueprint-top-bar';

        const titleBadge = document.createElement('span');
        titleBadge.className = 'blueprint-title-badge';
        titleBadge.textContent = 'BLUEPRINT';
        topBar.appendChild(titleBadge);

        this.coordsEl = document.createElement('div');
        this.coordsEl.className = 'blueprint-coords';
        this.coordsEl.textContent = 'X: 0m | Z: 0m | ALT: 1500m';
        topBar.appendChild(this.coordsEl);

        this.selectedPillEl = document.createElement('button');
        this.selectedPillEl.className = 'blueprint-selected-pill';
        this.selectedPillEl.textContent = 'SELECTED: NONE';
        this.selectedPillEl.addEventListener('click', () => {
            const id = castleEditorState.selectedIslandId;
            if (id) {
                const isl = this.skyCastles.getIsland(id);
                if (isl) {
                    this.targetCenter.set(isl.x, isl.y, isl.z);
                    this.showToast(`Centered on "${isl.name}"`);
                }
            }
        });
        topBar.appendChild(this.selectedPillEl);

        // Delete Island button in top bar
        this.deleteBtnEl = document.createElement('button');
        this.deleteBtnEl.className = 'blueprint-btn danger';
        this.deleteBtnEl.textContent = 'DELETE';
        this.deleteBtnEl.title = 'Delete selected castle island';
        this.deleteBtnEl.addEventListener('click', () => {
            const id = castleEditorState.selectedIslandId;
            if (id) {
                const isl = this.skyCastles.getIsland(id);
                const name = isl?.name || id;
                this.skyCastles.removeIsland(id);
                const remaining = this.skyCastles.getIslands();
                castleEditorState.select(remaining.length > 0 ? remaining[0].id : null);
                this.showToast(`Deleted "${name}"`);
            }
        });
        topBar.appendChild(this.deleteBtnEl);

        // Place toggle button
        this.placeToggleBtn = document.createElement('button');
        this.placeToggleBtn.className = 'blueprint-btn primary';
        this.placeToggleBtn.textContent = '+ PLACE CASTLE';
        this.placeToggleBtn.addEventListener('click', () => {
            const nextMode = !castleEditorState.placementMode;
            castleEditorState.setPlacementMode(nextMode);
            this.updatePlacementModeUI();
            if (nextMode) {
                this.showToast('PLACEMENT MODE: Click anywhere on the grid to drop a castle');
            }
        });
        topBar.appendChild(this.placeToggleBtn);

        // Expand menu button
        this.expandToggleBtn = document.createElement('button');
        this.expandToggleBtn.className = 'blueprint-btn';
        this.expandToggleBtn.textContent = 'EXPAND MENU';
        this.expandToggleBtn.addEventListener('click', () => {
            this.setExpanded(!this.isExpanded);
        });
        topBar.appendChild(this.expandToggleBtn);

        // Step selector group
        const stepGroup = document.createElement('div');
        stepGroup.className = 'blueprint-btn-group';
        const steps = [10, 25, 50, 100];
        steps.forEach((s) => {
            const btn = document.createElement('button');
            btn.className = `blueprint-btn${s === this.nudgeStep ? ' active' : ''}`;
            btn.textContent = `${s}M`;
            btn.addEventListener('click', () => {
                this.nudgeStep = s;
                stepGroup.querySelectorAll('.blueprint-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
            });
            stepGroup.appendChild(btn);
        });
        topBar.appendChild(stepGroup);

        // Zoom presets group
        const zoomGroup = document.createElement('div');
        zoomGroup.className = 'blueprint-btn-group';
        const zoomLevels = [500, 1500, 3500, 7500];
        zoomLevels.forEach((z) => {
            const btn = document.createElement('button');
            btn.className = 'blueprint-btn';
            btn.textContent = `${z}M`;
            btn.addEventListener('click', () => {
                this.cameraAltitude = z;
                this.updateCameraTransform();
            });
            zoomGroup.appendChild(btn);
        });
        topBar.appendChild(zoomGroup);

        // Exit button
        const exitBtn = document.createElement('button');
        exitBtn.className = 'blueprint-btn danger';
        exitBtn.textContent = 'EXIT';
        exitBtn.addEventListener('click', () => this.exit());
        topBar.appendChild(exitBtn);

        this.rootEl.appendChild(topBar);

        // Toast element
        this.toastEl = document.createElement('div');
        this.toastEl.className = 'blueprint-toast';
        this.rootEl.appendChild(this.toastEl);

        // ── Expandable Modal Drawer ────────────────────────────────────────────
        this.drawerWrapEl = document.createElement('div');
        this.drawerWrapEl.className = 'blueprint-drawer-wrap is-expanded';
        this.isExpanded = true;

        // Drawer Header
        const drawerHeader = document.createElement('div');
        drawerHeader.className = 'blueprint-drawer-header';

        const titleRow = document.createElement('div');
        titleRow.className = 'blueprint-drawer-title-row';

        const titleText = document.createElement('span');
        titleText.className = 'blueprint-drawer-title';
        titleText.textContent = 'CASTLE ARCHIPELAGO DESIGNER';

        this.drawerBadgeEl = document.createElement('span');
        this.drawerBadgeEl.className = 'blueprint-drawer-badge';
        this.drawerBadgeEl.textContent = 'ISLANDS';

        titleRow.appendChild(titleText);
        titleRow.appendChild(this.drawerBadgeEl);

        const drawerActions = document.createElement('div');
        drawerActions.className = 'blueprint-drawer-actions';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'blueprint-btn';
        collapseBtn.textContent = 'COLLAPSE';
        collapseBtn.addEventListener('click', () => {
            this.setExpanded(!this.isExpanded);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'blueprint-btn danger';
        closeBtn.textContent = 'EXIT VIEW';
        closeBtn.addEventListener('click', () => this.exit());

        drawerActions.appendChild(collapseBtn);
        drawerActions.appendChild(closeBtn);

        drawerHeader.appendChild(titleRow);
        drawerHeader.appendChild(drawerActions);
        this.drawerWrapEl.appendChild(drawerHeader);

        // Drawer Body Mount
        this.drawerBodyEl = document.createElement('div');
        this.drawerBodyEl.className = 'blueprint-drawer-body';
        this.drawerWrapEl.appendChild(this.drawerBodyEl);

        this.rootEl.appendChild(this.drawerWrapEl);

        if (!document.getElementById('blueprint-root')) {
            document.body.appendChild(this.rootEl);
        }

        // 3. Event Listeners
        window.addEventListener('pointerdown', this.onPointerDown.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('pointerup', this.onPointerUp.bind(this));
        window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        // HTML5 Drag & Drop from Model CardGrid
        window.addEventListener('dragover', (e: DragEvent) => {
            if (!this.isActive) return;
            const modelPath = castleEditorState.pendingModelPath;
            if (modelPath) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    this.placementIndicatorMesh.position.set(planeHit.x, 488, planeHit.z);
                    this.placementIndicatorMesh.visible = true;
                }
            }
        });

        window.addEventListener('drop', (e: DragEvent) => {
            if (!this.isActive) return;
            const modelPath = castleEditorState.pendingModelPath || e.dataTransfer?.getData('text/plain');
            if (modelPath) {
                const target = e.target as HTMLElement;
                if (target.closest('.blueprint-top-bar') || target.closest('.blueprint-drawer-wrap') || target.closest('#dev-editor-panel')) {
                    return;
                }

                e.preventDefault();
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    this.onPlaceCastleCallback?.(modelPath, Math.round(planeHit.x), Math.round(planeHit.z));
                    this.showToast(`Castle placed at X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m`);
                }
                this.placementIndicatorMesh.visible = false;
            }
        });
    }

    public setExpanded(expanded: boolean): void {
        this.isExpanded = expanded;
        if (expanded) {
            this.drawerWrapEl.classList.remove('is-collapsed');
            this.drawerWrapEl.classList.add('is-expanded');
            this.expandToggleBtn.textContent = 'COLLAPSE MENU';
        } else {
            this.drawerWrapEl.classList.remove('is-expanded');
            this.drawerWrapEl.classList.add('is-collapsed');
            this.expandToggleBtn.textContent = 'EXPAND MENU';
        }
    }

    private updatePlacementModeUI(): void {
        const isPlacing = castleEditorState.placementMode;
        if (isPlacing) {
            this.placeToggleBtn.classList.add('active');
            this.placeToggleBtn.textContent = 'PLACING (CLICK GRID)';
            this.placementIndicatorMesh.visible = true;
        } else {
            this.placeToggleBtn.classList.remove('active');
            this.placeToggleBtn.textContent = '+ PLACE CASTLE';
            this.placementIndicatorMesh.visible = false;
        }
    }

    public enter(centerTarget?: THREE.Vector3): void {
        if (this.isActive) return;
        this.isActive = true;

        // Force full LOD and visibility on all sky castles
        this.skyCastles.isTopViewActive = true;

        this.lighting.setFogDisabled(true, this.pipeline.scene);
        this.skyCastles.setFogDeckDisabled(true);

        this.savedCameraPos.copy(this.pipeline.camera.position);
        this.savedCameraRot.copy(this.pipeline.camera.rotation);
        this.savedCameraFar = this.pipeline.camera.far;

        this.pipeline.camera.far = 35000;
        this.pipeline.camera.updateProjectionMatrix();

        // Position camera target directly above active island
        const islands = this.skyCastles.getIslands();
        if (centerTarget) {
            this.targetCenter.set(centerTarget.x, centerTarget.y || 490, centerTarget.z);
        } else if (islands.length > 0) {
            const selId = castleEditorState.selectedIslandId;
            const target = (selId ? islands.find((i) => i.id === selId) : null) || islands[0];
            this.targetCenter.set(target.x, target.y || 490, target.z);
            if (!castleEditorState.selectedIslandId) {
                castleEditorState.select(target.id);
            }
        } else {
            this.targetCenter.set(this.player.playerGrp.position.x, 490, this.player.playerGrp.position.z);
        }
        this.currentCenter.copy(this.targetCenter);

        this.gridHelper.position.y = 485;
        this.gridHelper.visible = true;

        this.rootEl.classList.add('active');

        // Mount drawer panel
        this.drawerBodyEl.innerHTML = '';
        const controls = buildCastleControls({
            skyCastles: this.skyCastles,
            variant: 'drawer',
            onExitBlueprint: () => this.exit(),
            status: (msg, isErr) => this.showToast(msg, isErr)
        });
        this.drawerHandle = renderPanel(this.drawerBodyEl, controls);

        this.unsubscribeState = castleEditorState.subscribe(() => {
            if (this.isActive) {
                this.drawerHandle?.refresh();
                this.updateSelectionIndicator();
                this.updatePlacementModeUI();
                this.syncHeaderBadge();
            }
        });

        this.setExpanded(true);
        this.updateCameraTransform();
        this.updateSelectionIndicator();
        this.syncHeaderBadge();
        this.showToast('BLUEPRINT ACTIVE: Click castle to select | Drag to move | Arrow keys to nudge');
    }

    public exit(): void {
        if (!this.isActive) return;
        this.isActive = false;
        this.isDraggingCastle = false;
        this.isPanning = false;

        this.skyCastles.isTopViewActive = false;
        castleEditorState.setPlacementMode(false);

        this.gridHelper.visible = false;
        this.selectionIndicatorGroup.visible = false;
        this.placementIndicatorMesh.visible = false;
        this.rootEl.classList.remove('active');

        if (this.unsubscribeState) {
            this.unsubscribeState();
            this.unsubscribeState = null;
        }

        if (this.drawerHandle) {
            this.drawerHandle.destroy();
            this.drawerHandle = null;
        }
        this.drawerBodyEl.innerHTML = '';

        this.lighting.setFogDisabled(false, this.pipeline.scene);
        this.skyCastles.setFogDeckDisabled(false);

        this.pipeline.camera.far = this.savedCameraFar || 2000;
        this.pipeline.camera.updateProjectionMatrix();
        this.pipeline.camera.rotation.copy(this.savedCameraRot);
        this.pipeline.camera.position.copy(this.savedCameraPos);

        this.onExitCallback?.();
    }

    public update(dt: number): void {
        if (!this.isActive) return;

        this.currentCenter.lerp(this.targetCenter, Math.min(1.0, dt * 10.0));
        this.updateCameraTransform();

        if (this.selectionIndicatorGroup.visible) {
            this.selectionRingMesh.rotation.z += dt * 0.5;
        }

        this.coordsEl.textContent = `X: ${Math.round(this.currentCenter.x)}m | Z: ${Math.round(this.currentCenter.z)}m | ALT: ${Math.round(this.cameraAltitude)}m`;
    }

    private updateCameraTransform(): void {
        this.pipeline.camera.position.set(
            this.currentCenter.x,
            this.currentCenter.y + this.cameraAltitude,
            this.currentCenter.z
        );
        this.pipeline.camera.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
    }

    private updateSelectionIndicator(): void {
        const id = castleEditorState.selectedIslandId;
        if (!this.isActive || !id) {
            this.selectionIndicatorGroup.visible = false;
            return;
        }

        const isl = this.skyCastles.getIsland(id);
        if (!isl) {
            this.selectionIndicatorGroup.visible = false;
            return;
        }

        this.selectionIndicatorGroup.position.set(isl.x, isl.y - 2, isl.z);
        const scale = Math.max(0.6, (isl.scale || 2.0) / 2.0);
        this.selectionIndicatorGroup.scale.set(scale, 1, scale);
        this.selectionIndicatorGroup.visible = true;
    }

    private syncHeaderBadge(): void {
        const id = castleEditorState.selectedIslandId;
        const isl = id ? this.skyCastles.getIsland(id) : null;
        const name = isl?.name || 'NONE';
        this.selectedPillEl.textContent = `ISLAND: ${name}`;
        this.drawerBadgeEl.textContent = `${this.skyCastles.getIslands().length} ISLANDS | ${name}`;
        if (this.deleteBtnEl) {
            (this.deleteBtnEl as HTMLButtonElement).disabled = !id;
        }
    }

    private showToast(msg: string, isError: boolean = false): void {
        if (this.toastTimer) {
            window.clearTimeout(this.toastTimer);
        }
        this.toastEl.textContent = msg;
        this.toastEl.style.borderColor = isError ? '#f43f5e' : '#38bdf8';
        this.toastEl.style.display = 'block';
        this.toastTimer = window.setTimeout(() => {
            this.toastEl.style.display = 'none';
        }, 3000);
    }

    // ── Interaction Handlers ───────────────────────────────────────────────────

    private onPointerDown(e: MouseEvent): void {
        if (!this.isActive) return;

        const target = e.target as HTMLElement;
        if (target.closest('.blueprint-top-bar') || target.closest('.blueprint-drawer-wrap') || target.closest('#dev-editor-panel')) {
            return;
        }

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        if (e.button === 2 || e.button === 1 || e.shiftKey) {
            this.isPanning = true;
            return;
        }

        if (e.button === 0) {
            // Click-to-place active
            if (castleEditorState.placementMode) {
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    const modelPath = castleEditorState.pendingModelPath;
                    this.onPlaceCastleCallback?.(modelPath, Math.round(planeHit.x), Math.round(planeHit.z));
                    castleEditorState.setPlacementMode(false);
                    this.updatePlacementModeUI();
                    this.showToast(`Placed castle at X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m`);
                    return;
                }
            }

            const hitIslandId = this.skyCastles.raycastCastles(e.clientX, e.clientY, this.pipeline.camera);
            if (hitIslandId) {
                castleEditorState.select(hitIslandId);
                const isl = this.skyCastles.getIsland(hitIslandId);
                if (isl && !isl.locked) {
                    this.isDraggingCastle = true;
                }
            } else {
                this.isPanning = true;
            }
        }
    }

    private onPointerMove(e: MouseEvent): void {
        if (!this.isActive) return;

        // Update placement indicator cursor
        if (castleEditorState.placementMode) {
            const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
            if (planeHit) {
                this.placementIndicatorMesh.position.set(planeHit.x, 488, planeHit.z);
                this.placementIndicatorMesh.visible = true;
            }
        }

        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        if (this.isPanning) {
            const panFactor = (this.cameraAltitude / window.innerHeight) * 1.5;
            this.targetCenter.x -= dx * panFactor;
            this.targetCenter.z -= dy * panFactor;
            return;
        }

        if (this.isDraggingCastle && castleEditorState.selectedIslandId) {
            const id = castleEditorState.selectedIslandId;
            const isl = this.skyCastles.getIsland(id);
            if (isl && !isl.locked) {
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, isl.y);
                if (planeHit) {
                    this.skyCastles.updateIsland(id, {
                        x: Math.round(planeHit.x),
                        z: Math.round(planeHit.z)
                    });
                    castleEditorState.notify();
                }
            }
        }
    }

    private onPointerUp(): void {
        if (!this.isActive) return;
        this.isDraggingCastle = false;
        this.isPanning = false;
    }

    private onWheel(e: WheelEvent): void {
        if (!this.isActive) return;
        const target = e.target as HTMLElement;
        if (target.closest('.blueprint-drawer-wrap')) return;

        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 0.85;
        this.cameraAltitude = Math.max(50, Math.min(10000, Math.round(this.cameraAltitude * factor)));
        this.updateCameraTransform();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (!this.isActive) return;

        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
            return;
        }

        if (e.key === 'Escape') {
            if (castleEditorState.placementMode) {
                castleEditorState.setPlacementMode(false);
                this.updatePlacementModeUI();
                this.showToast('Cancelled placement mode');
            } else {
                this.exit();
            }
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            const id = castleEditorState.selectedIslandId;
            if (id) {
                const isl = this.skyCastles.getIsland(id);
                const name = isl?.name || id;
                this.skyCastles.removeIsland(id);
                const remaining = this.skyCastles.getIslands();
                castleEditorState.select(remaining.length > 0 ? remaining[0].id : null);
                this.showToast(`Deleted "${name}"`);
            }
            return;
        }

        const id = castleEditorState.selectedIslandId;
        const isl = id ? this.skyCastles.getIsland(id) : null;

        if (e.key === 'ArrowLeft') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { x: isl.x - this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === 'ArrowRight') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { x: isl.x + this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === 'ArrowUp') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { z: isl.z - this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === 'ArrowDown') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { z: isl.z + this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === 'PageUp') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { y: isl.y + this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === 'PageDown') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { y: isl.y - this.nudgeStep });
                castleEditorState.notify();
            }
        } else if (e.key === '[') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { rotationY: isl.rotationY - Math.PI / 12 });
                castleEditorState.notify();
            }
        } else if (e.key === ']') {
            if (isl && !isl.locked) {
                this.skyCastles.updateIsland(id!, { rotationY: isl.rotationY + Math.PI / 12 });
                castleEditorState.notify();
            }
        } else if (e.key === 'w' || e.key === 'W') {
            this.targetCenter.z -= this.nudgeStep * 2;
        } else if (e.key === 's' || e.key === 'S') {
            this.targetCenter.z += this.nudgeStep * 2;
        } else if (e.key === 'a' || e.key === 'A') {
            this.targetCenter.x -= this.nudgeStep * 2;
        } else if (e.key === 'd' || e.key === 'D') {
            this.targetCenter.x += this.nudgeStep * 2;
        }
    }
}

export function createBlueprintView(options: BlueprintViewOptions): BlueprintViewController {
    return new BlueprintViewController(options);
}
