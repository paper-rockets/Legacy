import { ControlDef, TabDef, PanelHandle } from './types';
import { renderPanel } from './render';
import './panel.css';

export interface EditorShellOptions {
    /** Existing empty element in index.html, e.g. '#editor-root'. */
    mount: HTMLElement;
    title: string;
    /** Re-read on refresh. Rendered as the header badge, e.g. 'CANDYLAND'. */
    subtitle: () => string;
    /** Rendered as a row of buttons above the tabs. */
    biomeStrip: {
        options: () => Array<{ value: string; text: string }>;
        get: () => string;
        set: (value: string) => void;
    };
    tabs: TabDef[];
    /** Always visible at the bottom of the panel, on every tab. */
    footer: () => ControlDef[];
    /** Header actions on the right, e.g. Teleport and Close. */
    headerActions: ControlDef[];
}

export interface EditorShell {
    open(): void;
    close(): void;
    toggle(): void;
    readonly isOpen: boolean;
    /** Switch tab by TabDef.id. Rebuilds that tab's schema. */
    switchTab(tabId: string): void;
    readonly activeTabId: string;
    /** Refresh the active tab, the footer and the header. Cheap; safe to call often. */
    refresh(): void;
    /** Rebuild the active tab from scratch. Use after the biome changes. */
    rebuild(): void;
    /** Transient message in the header, auto-hides after 3.5 s. */
    status(message: string, isError?: boolean): void;
    destroy(): void;
}

export function createEditorShell(options: EditorShellOptions): EditorShell {
    options.mount.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'dev-panel-container';
    container.id = 'dev-editor-panel';
    options.mount.appendChild(container);

    // 1. Header Bar
    const headerBar = document.createElement('div');
    headerBar.className = 'dev-header-bar';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'dev-header-left';

    const titleEl = document.createElement('span');
    titleEl.className = 'dev-header-title';
    titleEl.textContent = options.title;
    headerLeft.appendChild(titleEl);

    const badgeEl = document.createElement('span');
    badgeEl.className = 'dev-header-badge';
    badgeEl.textContent = options.subtitle();
    headerLeft.appendChild(badgeEl);
    headerBar.appendChild(headerLeft);

    const headerActionsEl = document.createElement('div');
    headerActionsEl.className = 'dev-header-actions';
    headerBar.appendChild(headerActionsEl);
    container.appendChild(headerBar);

    const headerHandle = renderPanel(headerActionsEl, options.headerActions);

    // 2. Status Banner
    const statusBanner = document.createElement('div');
    statusBanner.className = 'dev-status-banner';
    container.appendChild(statusBanner);
    let statusTimer: any = null;

    // 3. Biome Selector Strip
    const biomeNav = document.createElement('div');
    biomeNav.className = 'dev-biome-nav';
    container.appendChild(biomeNav);

    let biomeButtons: Array<{ el: HTMLButtonElement; val: string }> = [];

    function populateBiomeNav() {
        biomeNav.innerHTML = '';
        biomeButtons = [];
        const biomeOpts = options.biomeStrip.options();
        const currentBiome = options.biomeStrip.get();

        biomeOpts.forEach((b) => {
            const btn = document.createElement('button');
            btn.className = 'dev-biome-btn';
            btn.textContent = b.text;
            btn.title = b.text;
            if (b.value === currentBiome) btn.classList.add('active');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                options.biomeStrip.set(b.value);
                updateBiomeNav();
                rebuild();
            });

            biomeNav.appendChild(btn);
            biomeButtons.push({ el: btn, val: b.value });
        });
    }

    function updateBiomeNav() {
        const current = options.biomeStrip.get();
        biomeButtons.forEach((b) => {
            b.el.classList.toggle('active', b.val === current);
        });
    }

    populateBiomeNav();

    // 4. Tab Navigation Bar
    const tabsNav = document.createElement('div');
    tabsNav.className = 'dev-tabs-nav';
    container.appendChild(tabsNav);

    let currentTabId = options.tabs[0]?.id || '';
    const tabButtonMap = new Map<string, HTMLButtonElement>();

    options.tabs.forEach((tab) => {
        const btn = document.createElement('button');
        btn.className = 'dev-tab-btn';
        btn.textContent = tab.label;
        if (tab.id === currentTabId) btn.classList.add('active');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            switchTab(tab.id);
        });

        tabsNav.appendChild(btn);
        tabButtonMap.set(tab.id, btn);
    });

    // 5. Scrolling Body
    const scrollBody = document.createElement('div');
    scrollBody.className = 'dev-scroll-body';
    container.appendChild(scrollBody);

    let activeTabHandle: PanelHandle | null = null;

    // 6. Fixed Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'dev-fixed-footer';
    container.appendChild(footerEl);

    let footerHandle: PanelHandle = renderPanel(footerEl, options.footer());

    let isOpen = false;

    function open() {
        isOpen = true;
        container.style.display = 'flex';
        container.classList.add('is-open');
        rebuild();
    }

    function close() {
        isOpen = false;
        container.style.display = 'none';
        container.classList.remove('is-open');
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    const onGlobalKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    };
    window.addEventListener('keydown', onGlobalKeyDown);

    function switchTab(tabId: string) {
        if (currentTabId === tabId && activeTabHandle) return;
        currentTabId = tabId;

        tabButtonMap.forEach((btn, id) => {
            btn.classList.toggle('active', id === currentTabId);
        });

        rebuild();
    }

    function refresh() {
        badgeEl.textContent = options.subtitle();
        updateBiomeNav();
        headerHandle.refresh();
        if (activeTabHandle) {
            activeTabHandle.refresh();
        }
        footerHandle.refresh();
    }

    function rebuild() {
        badgeEl.textContent = options.subtitle();
        updateBiomeNav();

        if (activeTabHandle) {
            activeTabHandle.destroy();
            activeTabHandle = null;
        }

        const tab = options.tabs.find((t) => t.id === currentTabId) || options.tabs[0];
        if (tab) {
            const schema = tab.build();
            activeTabHandle = renderPanel(scrollBody, schema);
        }

        footerHandle.destroy();
        footerHandle = renderPanel(footerEl, options.footer());
    }

    function status(message: string, isError: boolean = false) {
        if (statusTimer) clearTimeout(statusTimer);
        statusBanner.textContent = message;
        statusBanner.classList.toggle('is-error', isError);
        statusBanner.classList.add('is-visible');

        statusTimer = setTimeout(() => {
            statusBanner.classList.remove('is-visible');
            statusTimer = null;
        }, 3500);
    }

    function destroy() {
        if (statusTimer) clearTimeout(statusTimer);
        window.removeEventListener('keydown', onGlobalKeyDown);
        headerHandle.destroy();
        if (activeTabHandle) activeTabHandle.destroy();
        footerHandle.destroy();
        options.mount.innerHTML = '';
    }

    return {
        open,
        close,
        toggle,
        get isOpen() {
            return isOpen;
        },
        switchTab,
        get activeTabId() {
            return currentTabId;
        },
        refresh,
        rebuild,
        status,
        destroy
    };
}
