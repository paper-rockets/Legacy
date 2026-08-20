/**
 * The player-facing Settings window. It is deliberately inert: nothing in it
 * changes the world. Every real control lives in the developer editor.
 *
 * Implements CONTRACTS.md section 5 exactly. Mounted into #settings-root.
 * Besides Close, the ONLY interactive control is the Developer Options button,
 * and only when SETTINGS_DECOY.showDeveloperEntry is true. The five rows are
 * label plus a fixed value - no input, no slider, no select, no toggle.
 */
export interface SettingsDecoyConfig {
    /**
     * When true, the window shows a 'Developer Options' entry that opens the
     * developer editor. Set false for a build handed to a player. F2 still works.
     */
    showDeveloperEntry: boolean;
    /** Inert rows, rendered as label plus a fixed value. Purely cosmetic. */
    rows: Array<{ label: string; value: string }>;
}

export const SETTINGS_DECOY: SettingsDecoyConfig = {
    showDeveloperEntry: true,
    rows: [
        { label: 'Graphics', value: 'Automatic' },
        { label: 'Sound', value: 'On' },
        { label: 'Controls', value: 'Standard' },
        { label: 'Language', value: 'English' },
        { label: 'Version', value: '1.0' }
    ]
};

function requireSettingsRoot(): HTMLElement {
    const el = document.getElementById('settings-root');
    if (!el) throw new Error('settingsWindow.ts: #settings-root not found in index.html');
    return el;
}

export function createSettingsWindow(onOpenDeveloper: () => void): {
    open(): void;
    close(): void;
    toggle(): void;
} {
    const root = requireSettingsRoot();
    root.innerHTML = '';

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
    for (const row of SETTINGS_DECOY.rows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'settings-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'settings-row-label';
        labelEl.textContent = row.label;

        const valueEl = document.createElement('span');
        valueEl.className = 'settings-row-value';
        valueEl.textContent = row.value;

        rowEl.appendChild(labelEl);
        rowEl.appendChild(valueEl);
        rowsWrap.appendChild(rowEl);
    }
    win.appendChild(rowsWrap);

    if (SETTINGS_DECOY.showDeveloperEntry) {
        const devBtn = document.createElement('button');
        devBtn.className = 'settings-dev-btn';
        devBtn.textContent = 'Developer Options';
        devBtn.addEventListener('click', () => {
            onOpenDeveloper();
        });
        win.appendChild(devBtn);
    }

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
