import './hud.css';
import { RenderPipeline } from '../core/renderer';
import { PlayerSystem } from '../player/player';
import { ControlsManager } from '../player/controls';
import { LightingSystem } from '../world/lighting';
import { TerrainSystem } from '../world/terrain';
import { WaterSystem } from '../world/water';
import { PropsSystem } from '../world/props';
import { TreeSystem } from '../world/trees';
import { SkyCastleSystem } from '../world/skyCastles';
import { AmbientAudioEngine } from '../audio/audio';
import { FLIGHT_MODELS } from '../player/FlightModels';
import { BIOME_LOCATIONS } from '../world/noise';
import { globalConfigManager } from '../core/config';

/**
 * The top bar and top-right quick actions. Built entirely in TypeScript and mounted
 * into #hud-root. No markup lives in index.html for any of this.
 *
 * Ports the BEHAVIOUR of the archived ui.ts top bar (lines 60-245) and its
 * travelToBiome helper (lines 646-669), not its DOM structure.
 */
export interface HudDeps {
    pipeline: RenderPipeline;
    player: PlayerSystem;
    controls: ControlsManager;
    lighting: LightingSystem;
    terrain: TerrainSystem;
    water: WaterSystem;
    props: PropsSystem;
    trees: TreeSystem;
    skyCastles: SkyCastleSystem;
    audio: AmbientAudioEngine;
    /** Called when the cogwheel button is clicked. Opens the Settings decoy window. */
    onOpenSettings: () => void;
}

export interface Hud {
    /** Per-frame work: samples FPS about every 200ms and refreshes the biome status text. */
    update(dt: number): void;
    /** Shows or hides the entire HUD. Used by photo mode to produce a clean frame. */
    setVisible(v: boolean): void;
}

function requireHudRoot(): HTMLElement {
    const el = document.getElementById('hud-root');
    if (!el) throw new Error('hud.ts: #hud-root not found in index.html');
    return el;
}

export function createHud(deps: HudDeps): Hud {
    const root = requireHudRoot();
    root.innerHTML = '';

    // ------------------------------------------------------------------
    // Biome travel, ported from _ARCHIVE/ui.ts travelToBiome (lines 646-669).
    // ------------------------------------------------------------------
    function travelToBiome(x: number, z: number, y?: number) {
        deps.player.teleportTo(x, z, 50, y);
        const pos = deps.player.playerGrp.position;
        deps.terrain.update(pos.x, pos.z);
        deps.trees.update(pos.x, pos.z);
        deps.props.update(pos.x, pos.z, 0.016);
        deps.water.update(pos.x, pos.z, 0.016);
        deps.skyCastles.update(pos, 0.016);

        const biomeId = deps.player.currentBiome;
        globalConfigManager.config.activeBiomeId = biomeId;
        const bCfg = globalConfigManager.getBiomeConfig(biomeId);
        if (bCfg) {
            deps.pipeline.applyBiomeBloom(bCfg.bloom);
            deps.props.applyBiomeCloud(bCfg.bloom);
            deps.skyCastles.applyBiomeCloud(bCfg.bloom);
            deps.lighting.switchBiome(biomeId, deps.pipeline.scene);
        }
        updateBiomeButtonUI();
    }

    // ------------------------------------------------------------------
    // Top bar
    // ------------------------------------------------------------------
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    // Pause / resume
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'hud-btn';
    pauseBtn.title = 'Pause / Resume';
    topBar.appendChild(pauseBtn);

    const pauseIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>';
    const playIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';

    function updatePauseUI() {
        pauseBtn.innerHTML = deps.controls.isFlightPaused ? playIconSvg : pauseIconSvg;
        pauseBtn.classList.toggle('paused', deps.controls.isFlightPaused);
    }
    pauseBtn.addEventListener('click', () => {
        deps.controls.isFlightPaused = !deps.controls.isFlightPaused;
        updatePauseUI();
    });
    updatePauseUI();

    // Day / Dusk / Twilight segmented control
    const segmented = document.createElement('div');
    segmented.className = 'hud-segmented';
    topBar.appendChild(segmented);

    const timeButtons: Array<{ el: HTMLButtonElement; phase: number }> = [];
    (['Day', 'Dusk', 'Twilight'] as const).forEach((label, phase) => {
        const btn = document.createElement('button');
        btn.className = 'hud-seg-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => setTimeActive(phase));
        segmented.appendChild(btn);
        timeButtons.push({ el: btn, phase });
    });

    function setTimeActive(phase: number) {
        deps.lighting.setTimePhase(phase);
        for (const item of timeButtons) {
            item.el.classList.toggle('active', item.phase === phase);
        }
    }
    setTimeActive(deps.lighting.timePhase || 0);

    topBar.appendChild(makeDivider());

    // Avatar / flight model selector
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'hud-dropdown-wrap';
    const avatarBtn = document.createElement('button');
    avatarBtn.className = 'hud-btn';
    const avatarDropdown = document.createElement('div');
    avatarDropdown.className = 'hud-dropdown';
    avatarDropdown.hidden = true;
    avatarWrap.appendChild(avatarBtn);
    avatarWrap.appendChild(avatarDropdown);
    topBar.appendChild(avatarWrap);

    const modelButtons: HTMLButtonElement[] = [];
    FLIGHT_MODELS.forEach((m, idx) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'hud-dropdown-item';
        optBtn.textContent = m.name;
        optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deps.player.setModel(idx);
            deps.audio.onFlightModelChanged(deps.player.getCurrentModelDef());
            updateModelButtonUI();
            closeAllDropdowns();
        });
        avatarDropdown.appendChild(optBtn);
        modelButtons.push(optBtn);
    });

    function updateModelButtonUI() {
        const def = deps.player.getCurrentModelDef();
        avatarBtn.textContent = def.name;
        modelButtons.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === deps.player.currentModelIndex);
        });
    }
    deps.player.onModelChanged = () => updateModelButtonUI();
    updateModelButtonUI();

    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(avatarDropdown);
    });

    // Biome / destination selector
    const biomeWrap = document.createElement('div');
    biomeWrap.className = 'hud-dropdown-wrap';
    const biomeBtn = document.createElement('button');
    biomeBtn.className = 'hud-btn';
    const biomeDropdown = document.createElement('div');
    biomeDropdown.className = 'hud-dropdown hud-dropdown-wide';
    biomeDropdown.hidden = true;
    biomeWrap.appendChild(biomeBtn);
    biomeWrap.appendChild(biomeDropdown);
    topBar.appendChild(biomeWrap);

    const biomeButtons: HTMLButtonElement[] = [];
    BIOME_LOCATIONS.forEach((loc) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'hud-dropdown-item';

        const title = document.createElement('div');
        title.className = 'hud-dropdown-item-title';
        title.textContent = loc.name;

        optBtn.appendChild(title);

        optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            travelToBiome(loc.x, loc.z, loc.y);
            closeAllDropdowns();
        });

        biomeDropdown.appendChild(optBtn);
        biomeButtons.push(optBtn);
    });

    function updateBiomeButtonUI() {
        let status = deps.player.currentBiomeName;
        if (deps.player.isSkimmingWater) {
            status += ' (Skimming)';
        } else if (deps.player.isUpdraftLift) {
            status += ' (Updraft)';
        }
        biomeBtn.textContent = status;
        biomeButtons.forEach((btn, idx) => {
            btn.classList.toggle('active', BIOME_LOCATIONS[idx].id === deps.player.currentBiome);
        });
    }
    updateBiomeButtonUI();

    biomeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(biomeDropdown);
    });

    topBar.appendChild(makeDivider());

    // FPS readout
    const fpsEl = document.createElement('span');
    fpsEl.className = 'hud-fps';
    fpsEl.textContent = '-- FPS';
    topBar.appendChild(fpsEl);

    root.appendChild(topBar);

    // ------------------------------------------------------------------
    // Dropdown open/close helpers (only one open at a time, closes on outside click)
    // ------------------------------------------------------------------
    let openDropdown: HTMLElement | null = null;

    function closeAllDropdowns() {
        avatarDropdown.hidden = true;
        biomeDropdown.hidden = true;
        openDropdown = null;
    }

    function toggleDropdown(dropdown: HTMLElement) {
        const willOpen = dropdown.hidden;
        closeAllDropdowns();
        if (willOpen) {
            dropdown.hidden = false;
            openDropdown = dropdown;
        }
    }

    document.addEventListener('click', (e) => {
        if (!openDropdown) return;
        if (openDropdown.contains(e.target as Node)) return;
        closeAllDropdowns();
    });

    // ------------------------------------------------------------------
    // Top-right quick actions
    // ------------------------------------------------------------------
    const quickBar = document.createElement('div');
    quickBar.className = 'hud-quick-bar';

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'hud-quick-btn';
    fullscreenBtn.title = 'Toggle Fullscreen';
    fullscreenBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            document.exitFullscreen().catch((err) => {
                console.error(`Exit fullscreen error: ${err.message}`);
            });
        }
    });
    quickBar.appendChild(fullscreenBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'hud-quick-btn';
    settingsBtn.title = 'Settings';
    settingsBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        deps.onOpenSettings();
    });
    quickBar.appendChild(settingsBtn);

    root.appendChild(quickBar);

    // ------------------------------------------------------------------
    // Per-frame FPS sampling, about every 200ms (ported from ui.ts updateFPS)
    // ------------------------------------------------------------------
    let fpsFrames = 0;
    let fpsPrevTime = performance.now();

    function update(_dt: number) {
        fpsFrames++;
        const now = performance.now();
        if (now >= fpsPrevTime + 200) {
            const currentFps = Math.round((fpsFrames * 1000) / (now - fpsPrevTime));
            fpsEl.textContent = `${currentFps} FPS`;
            updateBiomeButtonUI();
            fpsFrames = 0;
            fpsPrevTime = now;
        }
    }

    function setVisible(v: boolean) {
        root.style.display = v ? '' : 'none';
    }

    return { update, setVisible };
}

function makeDivider(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'hud-divider';
    return d;
}
