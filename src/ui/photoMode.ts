import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderPipeline } from '../core/renderer';
import { PlayerSystem } from '../player/player';

/**
 * Photo mode: OrbitControls plus a clean frame capture.
 * Ported from _ARCHIVE/ui.ts lines 402-470 as a standalone module. Behaviour is
 * identical: enable OrbitControls, hide the HUD, capture a frame with no UI visible
 * to a download named Wanderlust_Screenshot.png, restore camera FOV and position on exit.
 *
 * Builds its own bottom bar directly on document.body (no id, no markup dependency) -
 * there is no dedicated mount point for it in the markup contract.
 */
export interface PhotoModeDeps {
    pipeline: RenderPipeline;
    player: PlayerSystem;
    hud: { setVisible(v: boolean): void };
    /** Optional: closed on entering photo mode so it never sits on top of a screenshot. */
    settingsWindow?: { close(): void };
}

export interface PhotoMode {
    readonly isActive: boolean;
    enter(): void;
    exit(): void;
    update(dt: number): void;
}

export function createPhotoMode(deps: PhotoModeDeps): PhotoMode {
    let active = false;
    let orbit: OrbitControls | null = null;

    const bar = document.createElement('div');
    bar.className = 'photo-mode-bar';

    const label = document.createElement('span');
    label.textContent = 'PHOTO MODE';
    bar.appendChild(label);

    const captureBtn = document.createElement('button');
    captureBtn.className = 'photo-mode-btn';
    captureBtn.textContent = 'Capture';
    bar.appendChild(captureBtn);

    const exitBtn = document.createElement('button');
    exitBtn.className = 'photo-mode-btn';
    exitBtn.textContent = 'Exit';
    bar.appendChild(exitBtn);

    document.body.appendChild(bar);

    function hideTouchControls(hidden: boolean) {
        const touch = document.getElementById('touch-controls');
        if (touch) touch.style.display = hidden ? 'none' : '';
    }

    function enter() {
        active = true;
        deps.settingsWindow?.close();
        deps.hud.setVisible(false);
        hideTouchControls(true);
        bar.style.display = 'flex';

        if (!orbit) {
            orbit = new OrbitControls(deps.pipeline.camera, deps.pipeline.renderer.domElement);
        }
        orbit.enabled = true;
        orbit.target.copy(deps.player.playerGrp.position);
        orbit.update();
    }

    function exit() {
        active = false;
        deps.hud.setVisible(true);
        hideTouchControls(false);
        bar.style.display = 'none';

        deps.pipeline.camera.fov = 60;
        deps.pipeline.camera.position.set(0, 3.2, 12);
        deps.pipeline.camera.rotation.set(-Math.atan2(3.2 - 0.5, 12), 0, 0);
        deps.player.cameraPivot.rotation.set(0, 0, 0);
        deps.pipeline.camera.updateProjectionMatrix();

        if (orbit) orbit.enabled = false;
    }

    function capture() {
        bar.style.display = 'none';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                deps.pipeline.render();
                const dataURL = deps.pipeline.renderer.domElement.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'Wanderlust_Screenshot.png';
                link.href = dataURL;
                link.click();
                if (active) bar.style.display = 'flex';
            });
        });
    }

    captureBtn.addEventListener('click', capture);
    exitBtn.addEventListener('click', exit);

    function update(_dt: number) {
        if (active && orbit) {
            orbit.update();
        }
    }

    return {
        get isActive() {
            return active;
        },
        enter,
        exit,
        update
    };
}
