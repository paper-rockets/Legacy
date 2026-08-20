export type GraphicsProfile = 'high_performance' | 'regular';

export interface SettingsWindowContext {
    onOpenDeveloper: () => void;
    onToggleSound?: (enabled: boolean) => void;
    onChangeGraphics?: (profile: GraphicsProfile) => void;
    getSoundEnabled?: () => boolean;
    getGraphicsProfile?: () => GraphicsProfile;
}

function requireSettingsRoot(): HTMLElement {
    const el = document.getElementById('settings-root');
    if (!el) throw new Error('settingsWindow.ts: #settings-root not found in index.html');
    return el;
}

export function createSettingsWindow(contextOrHandler: (() => void) | SettingsWindowContext): {
    open(): void;
    close(): void;
    toggle(): void;
} {
    const ctx: SettingsWindowContext = typeof contextOrHandler === 'function'
        ? { onOpenDeveloper: contextOrHandler }
        : contextOrHandler;

    const root = requireSettingsRoot();
    root.innerHTML = '';

    // Load initial settings from localStorage
    let soundEnabled = ctx.getSoundEnabled ? ctx.getSoundEnabled() : (localStorage.getItem('settings_sound_enabled') !== 'false');
    let graphicsProfile: GraphicsProfile = ctx.getGraphicsProfile
        ? ctx.getGraphicsProfile()
        : ((localStorage.getItem('settings_graphics_profile') as GraphicsProfile) || 'high_performance');

    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';

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
    closeBtn.addEventListener('click', () => close());
    header.appendChild(closeBtn);

    win.appendChild(header);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'settings-rows';

    // ── 1. Sound Row (Interactive) ──────────────────────────────────────────
    const soundRow = document.createElement('div');
    soundRow.className = 'settings-row';
    const soundLabel = document.createElement('span');
    soundLabel.className = 'settings-row-label';
    soundLabel.textContent = 'Sound';
    const soundBtn = document.createElement('button');
    soundBtn.className = 'settings-toggle-btn' + (soundEnabled ? ' is-active' : '');
    soundBtn.textContent = soundEnabled ? 'On' : 'Off';
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.className = 'settings-toggle-btn' + (soundEnabled ? ' is-active' : '');
        soundBtn.textContent = soundEnabled ? 'On' : 'Off';
        localStorage.setItem('settings_sound_enabled', String(soundEnabled));
        if (ctx.onToggleSound) ctx.onToggleSound(soundEnabled);
    });
    soundRow.appendChild(soundLabel);
    soundRow.appendChild(soundBtn);
    rowsWrap.appendChild(soundRow);

    // ── 2. Graphics Row (Interactive: High Performance vs Regular) ───────────
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

    highBtn.addEventListener('click', () => {
        graphicsProfile = 'high_performance';
        highBtn.className = 'settings-segmented-btn is-selected';
        regBtn.className = 'settings-segmented-btn';
        localStorage.setItem('settings_graphics_profile', 'high_performance');
        if (ctx.onChangeGraphics) ctx.onChangeGraphics('high_performance');
    });

    regBtn.addEventListener('click', () => {
        graphicsProfile = 'regular';
        regBtn.className = 'settings-segmented-btn is-selected';
        highBtn.className = 'settings-segmented-btn';
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
    devBtn.addEventListener('click', () => {
        ctx.onOpenDeveloper();
    });
    win.appendChild(devBtn);

    overlay.appendChild(win);
    root.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    let isOpen = false;

    function open() {
        isOpen = true;
        overlay.style.display = 'flex';
    }

    function close() {
        isOpen = false;
        overlay.style.display = 'none';
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    return { open, close, toggle };
}
