import { RenderPipeline } from '../core/renderer';
import { ControlsManager } from '../player/controls';

export interface DeviceProfile {
    id: string;
    name: string;
    description: string;
    aspectRatio: string;
    portrait: { width: number; height: number };
    landscape: { width: number; height: number };
    physicalResolution: { width: number; height: number };
    dpr: number;
    borderRadius: number;
}

export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
    'fullscreen': {
        id: 'fullscreen',
        name: 'Fullscreen / Native',
        description: 'Native responsive viewport',
        aspectRatio: 'Auto',
        portrait: { width: 0, height: 0 },
        landscape: { width: 0, height: 0 },
        physicalResolution: { width: 0, height: 0 },
        dpr: 1.0,
        borderRadius: 0
    },
    's25-ultra': {
        id: 's25-ultra',
        name: 'Samsung Galaxy S25 Ultra',
        description: '6.9 inch Dynamic AMOLED 2X',
        aspectRatio: '19.5:9',
        portrait: { width: 412, height: 892 },
        landscape: { width: 892, height: 412 },
        physicalResolution: { width: 1440, height: 3120 },
        dpr: 3.5,
        borderRadius: 28
    },
    'tab-s6-lite': {
        id: 'tab-s6-lite',
        name: 'Samsung Galaxy Tab S6 Lite',
        description: '10.4 inch WUXGA+ Display',
        aspectRatio: '5:3 (15:9)',
        portrait: { width: 800, height: 1280 },
        landscape: { width: 1280, height: 800 },
        physicalResolution: { width: 1200, height: 2000 },
        dpr: 1.5,
        borderRadius: 18
    }
};

export type DeviceOrientation = 'landscape' | 'portrait';
export type ScaleMode = 'fit' | 'actual';

export class DeviceSimulator {
    public activeDeviceId: string = 'fullscreen';
    public activeOrientation: DeviceOrientation = 'landscape';
    public activeScaleMode: ScaleMode = 'fit';
    public currentScale: number = 1.0;

    private rootEl: HTMLElement | null = null;
    private stageEl: HTMLElement | null = null;
    private frameEl: HTMLElement | null = null;
    private screenEl: HTMLElement | null = null;
    private infoEl: HTMLElement | null = null;
    private isToolbarCollapsed: boolean = false;

    constructor(
        private pipeline: RenderPipeline,
        private controls: ControlsManager
    ) {
        this.initFromUrlParams();
        this.buildUI();
        this.setupEventListeners();
        this.applyDeviceMode(this.activeDeviceId, this.activeOrientation, false);
    }

    private initFromUrlParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const dev = params.get('device') || params.get('dev');
            const ori = params.get('orientation') || params.get('ori');
            const scale = params.get('scale');

            if (dev) {
                const normalized = dev.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalized.includes('25') || normalized.includes('s25')) {
                    this.activeDeviceId = 's25-ultra';
                } else if (normalized.includes('s6') || normalized.includes('tab')) {
                    this.activeDeviceId = 'tab-s6-lite';
                } else if (normalized === 'fullscreen' || normalized === 'full' || normalized === 'native') {
                    this.activeDeviceId = 'fullscreen';
                }
            }

            if (ori) {
                const normOri = ori.toLowerCase();
                if (normOri.startsWith('port') || normOri === 'v' || normOri === 'vertical') {
                    this.activeOrientation = 'portrait';
                } else if (normOri.startsWith('land') || normOri === 'h' || normOri === 'horizontal') {
                    this.activeOrientation = 'landscape';
                }
            }

            if (scale) {
                if (scale === '100' || scale === 'actual' || scale === '1') {
                    this.activeScaleMode = 'actual';
                } else {
                    this.activeScaleMode = 'fit';
                }
            }
        } catch (e) {
            console.warn('Failed to parse URL params for device simulator:', e);
        }
    }

    private buildUI() {
        this.rootEl = document.getElementById('simulator-root');
        this.stageEl = document.getElementById('device-stage');
        this.frameEl = document.getElementById('device-frame');
        this.screenEl = document.getElementById('device-screen');
        this.infoEl = document.getElementById('simulator-info-text');

        this.updateButtonStates();
    }

    private setupEventListeners() {
        const btnS25 = document.getElementById('sim-btn-s25');
        const btnTab = document.getElementById('sim-btn-tabs6');
        const btnFull = document.getElementById('sim-btn-fullscreen');
        const btnOrientation = document.getElementById('sim-btn-orientation');
        const btnScale = document.getElementById('sim-btn-scale');
        const btnToggleBar = document.getElementById('sim-btn-toggle-bar');
        const btnSettingsDev = document.getElementById('settings-device-toggle');

        if (btnS25) {
            btnS25.addEventListener('click', () => {
                this.applyDeviceMode('s25-ultra', this.activeOrientation);
            });
        }

        if (btnTab) {
            btnTab.addEventListener('click', () => {
                this.applyDeviceMode('tab-s6-lite', this.activeOrientation);
            });
        }

        if (btnFull) {
            btnFull.addEventListener('click', () => {
                this.applyDeviceMode('fullscreen', this.activeOrientation);
            });
        }

        if (btnOrientation) {
            btnOrientation.addEventListener('click', () => {
                const nextOri: DeviceOrientation = this.activeOrientation === 'landscape' ? 'portrait' : 'landscape';
                this.setOrientation(nextOri);
            });
        }

        if (btnScale) {
            btnScale.addEventListener('click', () => {
                const nextScale: ScaleMode = this.activeScaleMode === 'fit' ? 'actual' : 'fit';
                this.setScaleMode(nextScale);
            });
        }

        if (btnToggleBar) {
            btnToggleBar.addEventListener('click', () => {
                this.toggleToolbar();
            });
        }

        if (btnSettingsDev) {
            btnSettingsDev.addEventListener('click', () => {
                if (this.activeDeviceId === 'fullscreen') {
                    this.applyDeviceMode('s25-ultra', 'landscape');
                } else if (this.activeDeviceId === 's25-ultra') {
                    this.applyDeviceMode('tab-s6-lite', 'landscape');
                } else {
                    this.applyDeviceMode('fullscreen', 'landscape');
                }
            });
        }

        // Hotkey 'M' to cycle device, 'O' to toggle orientation
        window.addEventListener('keydown', (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const k = e.key.toLowerCase();
            if (k === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                this.cycleDevice();
            } else if (k === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey && this.activeDeviceId !== 'fullscreen') {
                const nextOri: DeviceOrientation = this.activeOrientation === 'landscape' ? 'portrait' : 'landscape';
                this.setOrientation(nextOri);
            }
        });

        window.addEventListener('resize', () => {
            this.recalculateLayout();
        });
    }

    public cycleDevice() {
        if (this.activeDeviceId === 'fullscreen') {
            this.applyDeviceMode('s25-ultra', 'landscape');
        } else if (this.activeDeviceId === 's25-ultra') {
            this.applyDeviceMode('tab-s6-lite', 'landscape');
        } else {
            this.applyDeviceMode('fullscreen', 'landscape');
        }
    }

    public applyDeviceMode(deviceId: string, orientation: DeviceOrientation = 'landscape', updateUrl: boolean = true) {
        const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES['fullscreen'];
        this.activeDeviceId = profile.id;
        this.activeOrientation = orientation;

        if (updateUrl) {
            this.syncUrlParams();
        }

        const isSimulated = profile.id !== 'fullscreen';
        document.body.classList.toggle('is-device-simulated', isSimulated);
        document.body.classList.toggle('is-device-s25', profile.id === 's25-ultra');
        document.body.classList.toggle('is-device-tabs6', profile.id === 'tab-s6-lite');
        document.body.classList.toggle('is-orientation-landscape', orientation === 'landscape');
        document.body.classList.toggle('is-orientation-portrait', orientation === 'portrait');

        if (isSimulated) {
            this.controls.forceTouchControls(true);
        } else {
            this.controls.restoreTouchMode();
        }

        this.recalculateLayout();
        this.updateButtonStates();
        this.updateInfoDisplay();
    }

    public setOrientation(orientation: DeviceOrientation) {
        this.activeOrientation = orientation;
        this.applyDeviceMode(this.activeDeviceId, this.activeOrientation);
    }

    public setScaleMode(mode: ScaleMode) {
        this.activeScaleMode = mode;
        this.recalculateLayout();
        this.updateButtonStates();
    }

    public toggleToolbar() {
        this.isToolbarCollapsed = !this.isToolbarCollapsed;
        const toolbar = document.getElementById('simulator-toolbar');
        const toggleBtn = document.getElementById('sim-btn-toggle-bar');
        if (toolbar) {
            toolbar.classList.toggle('collapsed', this.isToolbarCollapsed);
        }
        if (toggleBtn) {
            toggleBtn.innerText = this.isToolbarCollapsed ? '[ SHOW BAR ]' : '[ HIDE BAR ]';
        }
        this.recalculateLayout();
    }

    public recalculateLayout() {
        const profile = DEVICE_PROFILES[this.activeDeviceId] || DEVICE_PROFILES['fullscreen'];
        if (!this.stageEl || !this.frameEl || !this.screenEl) return;

        if (profile.id === 'fullscreen') {
            this.currentScale = 1.0;
            this.stageEl.style.width = '100vw';
            this.stageEl.style.height = '100vh';
            this.stageEl.style.transform = 'none';
            this.frameEl.style.width = '100%';
            this.frameEl.style.height = '100%';
            this.frameEl.style.borderRadius = '0px';
            this.screenEl.style.width = '100%';
            this.screenEl.style.height = '100%';
            this.pipeline.handleResize(window.innerWidth, window.innerHeight);
            return;
        }

        const dims = this.activeOrientation === 'landscape' ? profile.landscape : profile.portrait;
        const targetW = dims.width;
        const targetH = dims.height;

        this.screenEl.style.width = `${targetW}px`;
        this.screenEl.style.height = `${targetH}px`;
        this.frameEl.style.borderRadius = `${profile.borderRadius}px`;

        const toolbarHeight = this.isToolbarCollapsed ? 0 : 54;
        const paddingX = 40;
        const paddingY = 40;
        const availW = Math.max(100, window.innerWidth - paddingX);
        const availH = Math.max(100, window.innerHeight - toolbarHeight - paddingY);

        if (this.activeScaleMode === 'fit') {
            const scaleX = availW / targetW;
            const scaleY = availH / targetH;
            this.currentScale = Math.min(1.0, scaleX, scaleY);
        } else {
            this.currentScale = 1.0;
        }

        this.stageEl.style.width = `${targetW}px`;
        this.stageEl.style.height = `${targetH}px`;
        this.stageEl.style.transform = `scale(${this.currentScale})`;

        this.pipeline.handleResize(targetW, targetH);
    }

    private updateButtonStates() {
        const btnS25 = document.getElementById('sim-btn-s25');
        const btnTab = document.getElementById('sim-btn-tabs6');
        const btnFull = document.getElementById('sim-btn-fullscreen');
        const btnOrientation = document.getElementById('sim-btn-orientation');
        const btnScale = document.getElementById('sim-btn-scale');
        const btnSettingsDev = document.getElementById('settings-device-toggle');

        if (btnS25) btnS25.classList.toggle('active', this.activeDeviceId === 's25-ultra');
        if (btnTab) btnTab.classList.toggle('active', this.activeDeviceId === 'tab-s6-lite');
        if (btnFull) btnFull.classList.toggle('active', this.activeDeviceId === 'fullscreen');

        if (btnOrientation) {
            btnOrientation.innerText = this.activeOrientation === 'landscape' ? '[ LANDSCAPE / HORIZONTAL ]' : '[ PORTRAIT / VERTICAL ]';
            btnOrientation.style.display = this.activeDeviceId === 'fullscreen' ? 'none' : 'inline-block';
        }

        if (btnScale) {
            btnScale.innerText = this.activeScaleMode === 'fit' ? '[ SCALE: FIT ]' : '[ SCALE: 100% ]';
            btnScale.style.display = this.activeDeviceId === 'fullscreen' ? 'none' : 'inline-block';
        }

        if (btnSettingsDev) {
            const profile = DEVICE_PROFILES[this.activeDeviceId];
            btnSettingsDev.innerText = `Device: ${profile.name}`;
        }
    }

    private updateInfoDisplay() {
        if (!this.infoEl) return;
        const profile = DEVICE_PROFILES[this.activeDeviceId] || DEVICE_PROFILES['fullscreen'];
        if (profile.id === 'fullscreen') {
            this.infoEl.innerText = `NATIVE DISPLAY | ${window.innerWidth} x ${window.innerHeight} PX`;
            return;
        }

        const dims = this.activeOrientation === 'landscape' ? profile.landscape : profile.portrait;
        const natDims = this.activeOrientation === 'landscape'
            ? { width: profile.physicalResolution.height, height: profile.physicalResolution.width }
            : profile.physicalResolution;

        const oriLabel = this.activeOrientation.toUpperCase();
        this.infoEl.innerText = `${profile.name.toUpperCase()} | ${oriLabel} | ${dims.width} x ${dims.height} CSS PX (${profile.aspectRatio}) | NATIVE: ${natDims.width} x ${natDims.height} PX`;
    }

    private syncUrlParams() {
        try {
            const url = new URL(window.location.href);
            if (this.activeDeviceId === 'fullscreen') {
                url.searchParams.delete('device');
                url.searchParams.delete('orientation');
                url.searchParams.delete('scale');
            } else {
                url.searchParams.set('device', this.activeDeviceId);
                url.searchParams.set('orientation', this.activeOrientation);
                if (this.activeScaleMode !== 'fit') {
                    url.searchParams.set('scale', this.activeScaleMode);
                } else {
                    url.searchParams.delete('scale');
                }
            }
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            // Ignore if in restricted context
        }
    }
}
