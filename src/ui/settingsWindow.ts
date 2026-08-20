import { FLIGHT_MODELS } from '../player/FlightModels';

export type GraphicsProfile = 'high_performance' | 'regular';

export interface SettingsWindowContext {
    onOpenDeveloper: () => void;
    onToggleSound?: (enabled: boolean) => void;
    onChangeGraphics?: (profile: GraphicsProfile) => void;
    onChangeFlightModel?: (index: number) => void;
    getSoundEnabled?: () => boolean;
    getGraphicsProfile?: () => GraphicsProfile;
    getCurrentFlightModel?: () => number;
}

function requireSettingsRoot(): HTMLElement {
    let el = document.getElementById('settings-root');
    if (!el) {
        el = document.createElement('div');
        el.id = 'settings-root';
        document.body.appendChild(el);
    }
    return el;
}

export function createSettingsWindow(contextOrHandler: (() => void) | SettingsWindowContext): {
    open(): void;
    close(): void;
    toggle(): void;
    isOpen(): boolean;
} {
    const ctx: SettingsWindowContext = typeof contextOrHandler === 'function'
        ? { onOpenDeveloper: contextOrHandler }
        : contextOrHandler;

    const root = requireSettingsRoot();
    root.innerHTML = '';

    // Load initial settings
    let soundEnabled = ctx.getSoundEnabled ? ctx.getSoundEnabled() : (localStorage.getItem('settings_sound_enabled') !== 'false');
    let graphicsProfile: GraphicsProfile = ctx.getGraphicsProfile
        ? ctx.getGraphicsProfile()
        : ((localStorage.getItem('settings_graphics_profile') as GraphicsProfile) || 'high_performance');

    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.style.display = 'none';

    const win = document.createElement('div');
    win.className = 'settings-window';

    const header = document.createElement('div');
    header.className = 'settings-header';

    const title = document.createElement('div');
    title.className = 'settings-title';
    title.textContent = 'Settings';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
    });
    header.appendChild(closeBtn);

    win.appendChild(header);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'settings-rows';

    // ── 1. Flight Model Row (Interactive) ───────────────────────────────────
    let modelSelect: HTMLSelectElement | null = null;
    if (ctx.onChangeFlightModel) {
        const modelRow = document.createElement('div');
        modelRow.className = 'settings-row';
        const modelLabel = document.createElement('span');
        modelLabel.className = 'settings-row-label';
        modelLabel.textContent = 'Flight Model';

        modelSelect = document.createElement('select');
        modelSelect.className = 'settings-select-input';

        FLIGHT_MODELS.forEach((m, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = m.name;
            modelSelect!.appendChild(opt);
        });

        if (ctx.getCurrentFlightModel) {
            modelSelect.value = String(ctx.getCurrentFlightModel());
        }

        modelSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const idx = parseInt(modelSelect!.value, 10);
            if (ctx.onChangeFlightModel) ctx.onChangeFlightModel(idx);
        });

        modelRow.appendChild(modelLabel);
        modelRow.appendChild(modelSelect);
        rowsWrap.appendChild(modelRow);
    }

    // ── 2. Sound Row (Interactive) ──────────────────────────────────────────
    const soundRow = document.createElement('div');
    soundRow.className = 'settings-row';
    const soundLabel = document.createElement('span');
    soundLabel.className = 'settings-row-label';
    soundLabel.textContent = 'Sound';
    const soundBtn = document.createElement('button');
    soundBtn.className = 'settings-toggle-btn' + (soundEnabled ? ' is-active' : '');
    soundBtn.textContent = soundEnabled ? 'On' : 'Off';
    soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        updateSoundUI();
        localStorage.setItem('settings_sound_enabled', String(soundEnabled));
        if (ctx.onToggleSound) ctx.onToggleSound(soundEnabled);
    });

    function updateSoundUI() {
        soundBtn.className = 'settings-toggle-btn' + (soundEnabled ? ' is-active' : '');
        soundBtn.textContent = soundEnabled ? 'On' : 'Off';
    }

    soundRow.appendChild(soundLabel);
    soundRow.appendChild(soundBtn);
    rowsWrap.appendChild(soundRow);

    // ── 3. Graphics Row (Interactive: High Performance vs Regular) ───────────
    const graphicsRow = document.createElement('div');
    graphicsRow.className = 'settings-row';
    const graphicsLabel = document.createElement('span');
    graphicsLabel.className = 'settings-row-label';
    graphicsLabel.textContent = 'Graphics';

    const graphicsGroup = document.createElement('div');
    graphicsGroup.className = 'settings-segmented-group';

    const highBtn = document.createElement('button');
    highBtn.className = 'settings-segmented-btn' + (graphicsProfile === 'high_performance' ? ' is-selected' : '');
    highBtn.textContent = 'High Performance';

    const regBtn = document.createElement('button');
    regBtn.className = 'settings-segmented-btn' + (graphicsProfile === 'regular' ? ' is-selected' : '');
    regBtn.textContent = 'Regular';

    function updateGraphicsUI() {
        highBtn.className = 'settings-segmented-btn' + (graphicsProfile === 'high_performance' ? ' is-selected' : '');
        regBtn.className = 'settings-segmented-btn' + (graphicsProfile === 'regular' ? ' is-selected' : '');
    }

    highBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        graphicsProfile = 'high_performance';
        updateGraphicsUI();
        localStorage.setItem('settings_graphics_profile', 'high_performance');
        if (ctx.onChangeGraphics) ctx.onChangeGraphics('high_performance');
    });

    regBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        graphicsProfile = 'regular';
        updateGraphicsUI();
        localStorage.setItem('settings_graphics_profile', 'regular');
        if (ctx.onChangeGraphics) ctx.onChangeGraphics('regular');
    });

    graphicsGroup.appendChild(highBtn);
    graphicsGroup.appendChild(regBtn);
    graphicsRow.appendChild(graphicsLabel);
    graphicsRow.appendChild(graphicsGroup);
    rowsWrap.appendChild(graphicsRow);

    win.appendChild(rowsWrap);

    // ── Developer Options Button ─────────────────────────────────────────────
    const devBtn = document.createElement('button');
    devBtn.className = 'settings-dev-btn';
    devBtn.textContent = 'Developer Options';
    devBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onOpenDeveloper();
    });
    win.appendChild(devBtn);

    overlay.appendChild(win);
    root.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            e.stopPropagation();
            close();
        }
    });

    let isModalOpen = false;

    function open() {
        if (ctx.getSoundEnabled) {
            soundEnabled = ctx.getSoundEnabled();
            updateSoundUI();
        }
        if (ctx.getGraphicsProfile) {
            graphicsProfile = ctx.getGraphicsProfile();
            updateGraphicsUI();
        }
        if (ctx.getCurrentFlightModel && modelSelect) {
            modelSelect.value = String(ctx.getCurrentFlightModel());
        }
        isModalOpen = true;
        overlay.style.display = 'flex';
    }

    function close() {
        isModalOpen = false;
        overlay.style.display = 'none';
    }

    function toggle() {
        if (isModalOpen) {
            close();
        } else {
            open();
        }
    }

    function isOpen() {
        return isModalOpen;
    }

    return { open, close, toggle, isOpen };
}
