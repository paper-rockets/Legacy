import { RenderPipeline } from '../core/renderer';
import { LightingSystem } from '../world/lighting';
import { PropsSystem } from '../world/props';
import { TreeSystem, BIOME_VEG_PRESETS } from '../world/trees';
import { WaterSystem } from '../world/water';
import { TerrainSystem, TERRAIN_PALETTES } from '../world/terrain';
import { PlayerSystem } from '../player/player';
import { globalConfigManager, EnvPhaseConfig } from '../core/config';
import { BiomeId, BIOME_LOCATIONS } from '../world/noise';

export class DevEditor {
    public isOpen = false;
    public activeBiomeId: BiomeId = 'meadow';
    private activeTab: 'env' | 'trees' | 'terrain' | 'water' | 'global' | 'save' = 'env';
    public activeEnvPhase: number = 0;

    private panel: HTMLElement | null = null;
    private saveStatusTimer: number | null = null;

    constructor(
        private pipeline: RenderPipeline,
        private lighting: LightingSystem,
        private props: PropsSystem,
        private trees: TreeSystem,
        private water: WaterSystem,
        private terrain: TerrainSystem,
        private player?: PlayerSystem
    ) {
        this.activeBiomeId = globalConfigManager.config.activeBiomeId || 'meadow';
        this.activeEnvPhase = this.lighting.timePhase || 0;
        this.initDOM();
        this.bindEvents();
        this.bindKeyboardShortcut();
        this.refreshUI();
    }

    private initDOM() {
        this.panel = document.getElementById('dev-editor-panel');
    }

    public open() {
        this.isOpen = true;
        if (this.panel) {
            this.panel.style.display = 'flex';
        }
        const btn = document.getElementById('dev-editor-toggle');
        if (btn) btn.classList.add('active');

        // Close settings dropdown if open
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu) settingsMenu.style.display = 'none';

        this.syncBiomeUI();
        this.refreshUI();
    }

    public close() {
        this.isOpen = false;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        const btn = document.getElementById('dev-editor-toggle');
        if (btn) btn.classList.remove('active');
    }

    public toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    private bindKeyboardShortcut() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    private showStatus(msg: string, isError: boolean = false) {
        const statusEl = document.getElementById('dev-status-msg');
        if (!statusEl) return;

        statusEl.textContent = msg;
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? '#ff6b6b' : '#69db7c';

        if (this.saveStatusTimer) {
            window.clearTimeout(this.saveStatusTimer);
        }
        this.saveStatusTimer = window.setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3500);
    }

    public selectBiome(biomeId: BiomeId) {
        this.activeBiomeId = biomeId;
        globalConfigManager.config.activeBiomeId = biomeId;
        this.lighting.switchBiome(biomeId, this.pipeline.scene);
        this.water.switchBiome(biomeId);
        if (this.player) {
            const loc = BIOME_LOCATIONS.find(b => b.id === biomeId);
            if (loc) {
                this.player.teleportTo(loc.x, loc.z, 50);
                const pos = this.player.playerGrp.position;
                this.terrain.update(pos.x, pos.z);
                if (this.trees) this.trees.update(pos.x, pos.z);
                this.props.update(pos.x, pos.z, 0.016);
                this.water.update(pos.x, pos.z, 0.016);
            }
        }
        this.syncBiomeUI();
        this.refreshUI();
    }

    public teleportToActiveBiome() {
        const loc = BIOME_LOCATIONS.find(b => b.id === this.activeBiomeId);
        if (loc && this.player) {
            this.player.teleportTo(loc.x, loc.z, 50);
            const pos = this.player.playerGrp.position;
            this.terrain.update(pos.x, pos.z);
            if (this.trees) this.trees.update(pos.x, pos.z);
            this.props.update(pos.x, pos.z, 0.016);
            this.water.update(pos.x, pos.z, 0.016);
            this.showStatus(`Teleported to ${loc.name}`);
        }
    }

    private syncBiomeUI() {
        const biomeBtns = document.querySelectorAll('.dev-biome-btn');
        biomeBtns.forEach((btn) => {
            const bId = btn.getAttribute('data-biome');
            btn.classList.toggle('active', bId === this.activeBiomeId);
        });

        const biomeTitle = document.getElementById('dev-active-biome-title');
        const biomeCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
        if (biomeTitle) {
            biomeTitle.textContent = biomeCfg.name;
        }

        const saveBiomeBtn = document.getElementById('dev-save-biome-btn');
        if (saveBiomeBtn) {
            saveBiomeBtn.textContent = `Set As Default for ${biomeCfg.name}`;
        }

        const resetBiomeBtn = document.getElementById('dev-reset-biome-btn');
        if (resetBiomeBtn) {
            resetBiomeBtn.textContent = `Reset ${biomeCfg.name} to Factory`;
        }
    }

    public refreshUI() {
        const cfg = globalConfigManager.config;
        const biomeCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
        const phaseCfg = biomeCfg.phases[this.activeEnvPhase];

        // ── Tab 1: Environment (Day/Dusk/Twilight) ──────────────────────────────
        const phaseBtns = document.querySelectorAll('.dev-phase-btn');
        phaseBtns.forEach((btn) => {
            const phase = parseInt(btn.getAttribute('data-phase') || '0', 10);
            btn.classList.toggle('active', phase === this.activeEnvPhase);
        });

        this.setInputValue('dev-env-bg', phaseCfg.bg);
        this.setInputValue('dev-env-fog', phaseCfg.fog);
        this.setSliderAndLabel('dev-env-fognear', 'dev-env-fognear-val', phaseCfg.fogNear, '');
        this.setSliderAndLabel('dev-env-fogfar', 'dev-env-fogfar-val', phaseCfg.fogFar, '');
        this.setInputValue('dev-env-amb-color', phaseCfg.amb);
        this.setSliderAndLabel('dev-env-amb-intensity', 'dev-env-amb-intensity-val', phaseCfg.ambI, '');
        this.setInputValue('dev-env-dir-color', phaseCfg.dir);
        this.setSliderAndLabel('dev-env-dir-intensity', 'dev-env-dir-intensity-val', phaseCfg.dirI, '');
        this.setSliderAndLabel('dev-env-hemi-intensity', 'dev-env-hemi-intensity-val', phaseCfg.hemi, '');
        this.setInputValue('dev-env-sun-color', phaseCfg.sunC);
        this.setSliderAndLabel('dev-env-sun-intensity', 'dev-env-sun-intensity-val', phaseCfg.sunI, '');
        this.setSliderAndLabel('dev-env-sun-scale', 'dev-env-sun-scale-val', phaseCfg.sunScale, 'x');
        this.setSliderAndLabel('dev-env-star-opacity', 'dev-env-star-opacity-val', phaseCfg.starOp, '');

        // ── Tab 2: Trees & Foliage ─────────────────────────────────────────────
        const veg = biomeCfg.vegetation;
        const blm = biomeCfg.bloom;

        this.setSliderAndLabel('dev-veg-tree-scale', 'dev-veg-tree-scale-val', veg.treeScale, 'x');
        this.setSliderAndLabel('dev-veg-tree-density', 'dev-veg-tree-density-val', veg.treeDensity, '');
        this.setSliderAndLabel('dev-veg-bush-scale', 'dev-veg-bush-scale-val', veg.bushScale, 'x');
        this.setSliderAndLabel('dev-veg-bush-density', 'dev-veg-bush-density-val', veg.bushDensity, '');

        this.setSliderAndLabel('dev-tree-bloom', 'dev-tree-bloom-val', blm.treeBloom, '');
        this.setSliderAndLabel('dev-tree-canopy-glow', 'dev-tree-canopy-glow-val', blm.treeCanopyGlow, '');
        this.setSliderAndLabel('dev-tree-trunk-glow', 'dev-tree-trunk-glow-val', blm.treeTrunkGlow, '');
        this.setSliderAndLabel('dev-bush-bloom', 'dev-bush-bloom-val', blm.bushBloom, '');
        this.setSliderAndLabel('dev-bush-glow', 'dev-bush-glow-val', blm.bushGlow, '');

        this.renderCanopyColorSwatches(veg.canopyColors);
        this.renderTrunkColorSwatches(veg.trunkColors);

        const vegPresetBtns = document.querySelectorAll('.dev-veg-preset-btn');
        vegPresetBtns.forEach((btn) => {
            const pKey = btn.getAttribute('data-preset');
            btn.classList.toggle('active', pKey === veg.activePreset);
        });

        // ── Tab 3: Terrain Colors ──────────────────────────────────────────────
        const ter = biomeCfg.terrain;
        this.setInputValue('dev-terrain-low', ter.colorLow);
        this.setInputValue('dev-terrain-high', ter.colorHigh);
        this.setInputValue('dev-terrain-dirt', ter.colorDirt);
        this.setInputValue('dev-terrain-path', ter.colorPath);
        this.setInputValue('dev-terrain-sand', ter.colorSand);

        const paletteBtns = document.querySelectorAll('.dev-palette-btn');
        paletteBtns.forEach((btn) => {
            const palName = btn.getAttribute('data-palette');
            btn.classList.toggle('active', palName === ter.presetName);
        });

        // ── Tab 4: Water & Shores ──────────────────────────────────────────────
        const wat = biomeCfg.water;
        this.setInputValue('dev-water-color', wat.color);
        this.setSliderAndLabel('dev-water-opacity', 'dev-water-opacity-val', wat.opacity, '');
        this.setSliderAndLabel('dev-water-reflectivity', 'dev-water-reflectivity-val', wat.reflectivity, '');
        this.setSliderAndLabel('dev-water-roughness', 'dev-water-roughness-val', wat.roughness, '');
        this.setSliderAndLabel('dev-water-metalness', 'dev-water-metalness-val', wat.metalness, '');
        this.setSliderAndLabel('dev-water-clearcoat', 'dev-water-clearcoat-val', wat.clearcoat, '');
        this.setSliderAndLabel('dev-water-clearcoat-roughness', 'dev-water-clearcoat-roughness-val', wat.clearcoatRoughness, '');

        const toonBtn = document.getElementById('dev-water-toon-toggle');
        if (toonBtn) {
            toonBtn.textContent = wat.isToonMode ? 'Shader Mode: MeshToon (Fast)' : 'Shader Mode: MeshPhysical (Realistic)';
            toonBtn.classList.toggle('active', wat.isToonMode);
        }

        this.setSliderAndLabel('dev-shore-bloom', 'dev-shore-bloom-val', blm.shoreBloom, '');
        this.setInputValue('dev-shore-color', blm.shoreColor);
        this.setSliderAndLabel('dev-shore-width', 'dev-shore-width-val', blm.shoreWidth, '');

        // ── Tab 5: Global Post & Cloud ─────────────────────────────────────────
        const gblm = cfg.globalBloom;
        const cld = cfg.cloud;
        this.setSliderAndLabel('dev-bloom-strength', 'dev-bloom-strength-val', gblm.strength, '');
        this.setSliderAndLabel('dev-bloom-radius', 'dev-bloom-radius-val', gblm.radius, '');
        this.setSliderAndLabel('dev-bloom-threshold', 'dev-bloom-threshold-val', gblm.threshold, '');

        this.setSliderAndLabel('dev-cloud-bloom', 'dev-cloud-bloom-val', cld.bloom, '');
        this.setInputValue('dev-cloud-color', cld.color);
        this.setInputValue('dev-cloud-emissive', cld.emissive);

        // ── Tab 6: Defaults JSON ───────────────────────────────────────────────
        const jsonArea = document.getElementById('dev-json-export') as HTMLTextAreaElement | null;
        if (jsonArea) {
            jsonArea.value = globalConfigManager.exportJSON();
        }
    }

    private renderCanopyColorSwatches(colors: string[]) {
        const container = document.getElementById('dev-canopy-swatches');
        if (!container) return;
        container.innerHTML = '';

        colors.forEach((hex, idx) => {
            const swatch = document.createElement('div');
            swatch.className = 'dev-color-chip';
            swatch.style.backgroundColor = hex;
            swatch.title = `Canopy Color ${idx + 1}: ${hex} (Click to change)`;

            const picker = document.createElement('input');
            picker.type = 'color';
            picker.value = hex;
            picker.className = 'dev-chip-picker';
            picker.addEventListener('input', (e) => {
                const newHex = (e.target as HTMLInputElement).value;
                swatch.style.backgroundColor = newHex;
                const veg = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation;
                veg.canopyColors[idx] = newHex;
                this.trees.setBiomeCanopyColors(this.activeBiomeId, veg.canopyColors);
            });

            swatch.appendChild(picker);
            container.appendChild(swatch);
        });
    }

    private renderTrunkColorSwatches(colors: string[]) {
        const container = document.getElementById('dev-trunk-swatches');
        if (!container) return;
        container.innerHTML = '';

        colors.forEach((hex, idx) => {
            const swatch = document.createElement('div');
            swatch.className = 'dev-color-chip';
            swatch.style.backgroundColor = hex;
            swatch.title = `Trunk Color ${idx + 1}: ${hex} (Click to change)`;

            const picker = document.createElement('input');
            picker.type = 'color';
            picker.value = hex;
            picker.className = 'dev-chip-picker';
            picker.addEventListener('input', (e) => {
                const newHex = (e.target as HTMLInputElement).value;
                swatch.style.backgroundColor = newHex;
                const veg = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation;
                veg.trunkColors[idx] = newHex;
                this.trees.setBiomeTrunkColors(this.activeBiomeId, veg.trunkColors);
            });

            swatch.appendChild(picker);
            container.appendChild(swatch);
        });
    }

    private setInputValue(id: string, val: string) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = val;
    }

    private setSliderAndLabel(sliderId: string, labelId: string, val: number, unit: string = '') {
        const slider = document.getElementById(sliderId) as HTMLInputElement | null;
        const label = document.getElementById(labelId);
        if (slider) slider.value = val.toString();
        if (label) {
            label.textContent = typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(2) + unit : val.toString() + unit;
        }
    }

    private bindEvents() {
        // Toggle & Close Buttons
        const toggleBtn = document.getElementById('dev-editor-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }
        const closeBtn = document.getElementById('dev-editor-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // Biome Selector Navigation
        const biomeBtns = document.querySelectorAll('.dev-biome-btn');
        biomeBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const bId = (e.currentTarget as HTMLElement).getAttribute('data-biome') as BiomeId;
                if (bId) this.selectBiome(bId);
            });
        });

        // Teleport Button
        const tpBtn = document.getElementById('dev-biome-tp-btn');
        if (tpBtn) {
            tpBtn.addEventListener('click', () => this.teleportToActiveBiome());
        }

        // Sub-Tab Navigation
        const tabBtns = document.querySelectorAll('.dev-tab-btn');
        tabBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;
                if (!target) return;
                this.activeTab = target;
                tabBtns.forEach(b => b.classList.remove('active'));
                (e.currentTarget as HTMLElement).classList.add('active');

                const pages = document.querySelectorAll('.dev-tab-page');
                pages.forEach(p => (p as HTMLElement).style.display = 'none');
                const activePage = document.getElementById(`dev-page-${target}`);
                if (activePage) activePage.style.display = 'flex';

                if (target === 'save') {
                    const jsonArea = document.getElementById('dev-json-export') as HTMLTextAreaElement | null;
                    if (jsonArea) jsonArea.value = globalConfigManager.exportJSON();
                }
            });
        });

        // Environment Phase Switcher
        const phaseBtns = document.querySelectorAll('.dev-phase-btn');
        phaseBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const phase = parseInt((e.currentTarget as HTMLElement).getAttribute('data-phase') || '0', 10);
                this.activeEnvPhase = phase;
                this.lighting.setTimePhase(phase, this.pipeline.scene);
                this.refreshUI();
            });
        });

        // ── Tab 1 Environment Inputs ───────────────────────────────────────────
        const updateEnvField = (partial: Partial<EnvPhaseConfig>) => {
            this.lighting.updateBiomePhaseConfig(this.activeBiomeId, this.activeEnvPhase, partial, this.pipeline.scene);
        };

        const bindEnvColor = (id: string, key: keyof EnvPhaseConfig) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (el) {
                el.addEventListener('input', () => updateEnvField({ [key]: el.value }));
            }
        };

        const bindEnvSlider = (sliderId: string, labelId: string, key: keyof EnvPhaseConfig, unit: string = '') => {
            const slider = document.getElementById(sliderId) as HTMLInputElement | null;
            const label = document.getElementById(labelId);
            if (slider) {
                slider.addEventListener('input', () => {
                    const val = parseFloat(slider.value);
                    if (label) label.textContent = !Number.isInteger(val) ? val.toFixed(2) + unit : val.toString() + unit;
                    updateEnvField({ [key]: val });
                });
            }
        };

        bindEnvColor('dev-env-bg', 'bg');
        bindEnvColor('dev-env-fog', 'fog');
        bindEnvSlider('dev-env-fognear', 'dev-env-fognear-val', 'fogNear');
        bindEnvSlider('dev-env-fogfar', 'dev-env-fogfar-val', 'fogFar');
        bindEnvColor('dev-env-amb-color', 'amb');
        bindEnvSlider('dev-env-amb-intensity', 'dev-env-amb-intensity-val', 'ambI');
        bindEnvColor('dev-env-dir-color', 'dir');
        bindEnvSlider('dev-env-dir-intensity', 'dev-env-dir-intensity-val', 'dirI');
        bindEnvSlider('dev-env-hemi-intensity', 'dev-env-hemi-intensity-val', 'hemi');
        bindEnvColor('dev-env-sun-color', 'sunC');
        bindEnvSlider('dev-env-sun-intensity', 'dev-env-sun-intensity-val', 'sunI');
        bindEnvSlider('dev-env-sun-scale', 'dev-env-sun-scale-val', 'sunScale', 'x');
        bindEnvSlider('dev-env-star-opacity', 'dev-env-star-opacity-val', 'starOp');

        // ── Tab 2 Trees & Foliage Inputs ───────────────────────────────────────
        const bindSlider = (sliderId: string, labelId: string, callback: (val: number) => void) => {
            const slider = document.getElementById(sliderId) as HTMLInputElement | null;
            const label = document.getElementById(labelId);
            if (slider) {
                slider.addEventListener('input', () => {
                    const val = parseFloat(slider.value);
                    if (label) label.textContent = !Number.isInteger(val) ? val.toFixed(2) : val.toString();
                    callback(val);
                });
            }
        };

        bindSlider('dev-veg-tree-scale', 'dev-veg-tree-scale-val', (v) => this.trees.setBiomeTreeScale(this.activeBiomeId, v));
        bindSlider('dev-veg-tree-density', 'dev-veg-tree-density-val', (v) => this.trees.setBiomeTreeDensity(this.activeBiomeId, v));
        bindSlider('dev-veg-bush-scale', 'dev-veg-bush-scale-val', (v) => this.trees.setBiomeBushScale(this.activeBiomeId, v));
        bindSlider('dev-veg-bush-density', 'dev-veg-bush-density-val', (v) => this.trees.setBiomeBushDensity(this.activeBiomeId, v));

        bindSlider('dev-tree-bloom', 'dev-tree-bloom-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeBloom: v }));
        bindSlider('dev-tree-canopy-glow', 'dev-tree-canopy-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeCanopyGlow: v }));
        bindSlider('dev-tree-trunk-glow', 'dev-tree-trunk-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeTrunkGlow: v }));
        bindSlider('dev-bush-bloom', 'dev-bush-bloom-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { bushBloom: v }));
        bindSlider('dev-bush-glow', 'dev-bush-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { bushGlow: v }));

        const vegPresetBtns = document.querySelectorAll('.dev-veg-preset-btn');
        vegPresetBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const pKey = (e.currentTarget as HTMLElement).getAttribute('data-preset');
                if (pKey && BIOME_VEG_PRESETS[pKey]) {
                    this.trees.applyBiomeVegPreset(this.activeBiomeId, pKey);
                    vegPresetBtns.forEach(b => b.classList.remove('active'));
                    (e.currentTarget as HTMLElement).classList.add('active');
                    this.refreshUI();
                }
            });
        });

        // ── Tab 3 Terrain Colors ───────────────────────────────────────────────
        const getPlayerCoords = () => {
            if (this.player) return { x: this.player.playerGrp.position.x, z: this.player.playerGrp.position.z };
            return { x: this.terrain.lastPlayerX, z: this.terrain.lastPlayerZ };
        };

        const bindTerrainColor = (id: string, key: string) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (el) {
                el.addEventListener('input', () => {
                    const coords = getPlayerCoords();
                    this.terrain.setBiomeTerrainColors(this.activeBiomeId, { [key]: el.value }, coords.x, coords.z);
                });
            }
        };

        bindTerrainColor('dev-terrain-low', 'colorLow');
        bindTerrainColor('dev-terrain-high', 'colorHigh');
        bindTerrainColor('dev-terrain-dirt', 'colorDirt');
        bindTerrainColor('dev-terrain-path', 'colorPath');
        bindTerrainColor('dev-terrain-sand', 'colorSand');

        const paletteBtns = document.querySelectorAll('.dev-palette-btn');
        paletteBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const palName = (e.currentTarget as HTMLElement).getAttribute('data-palette');
                if (palName && TERRAIN_PALETTES[palName]) {
                    const coords = getPlayerCoords();
                    this.terrain.applyBiomePalette(this.activeBiomeId, palName, coords.x, coords.z);
                    paletteBtns.forEach(b => b.classList.remove('active'));
                    (e.currentTarget as HTMLElement).classList.add('active');
                    this.refreshUI();
                }
            });
        });

        // ── Tab 4 Water & Shoreline Bloom ──────────────────────────────────────
        const waterColorInp = document.getElementById('dev-water-color') as HTMLInputElement | null;
        if (waterColorInp) {
            waterColorInp.addEventListener('input', () => this.water.setColor(waterColorInp.value, this.activeBiomeId));
        }
        bindSlider('dev-water-opacity', 'dev-water-opacity-val', (v) => this.water.setOpacity(v, this.activeBiomeId));
        bindSlider('dev-water-reflectivity', 'dev-water-reflectivity-val', (v) => this.water.setReflectivity(v, this.activeBiomeId));
        bindSlider('dev-water-roughness', 'dev-water-roughness-val', (v) => this.water.setRoughness(v, this.activeBiomeId));
        bindSlider('dev-water-metalness', 'dev-water-metalness-val', (v) => this.water.setMetalness(v, this.activeBiomeId));
        bindSlider('dev-water-clearcoat', 'dev-water-clearcoat-val', (v) => this.water.setClearcoat(v, this.activeBiomeId));
        bindSlider('dev-water-clearcoat-roughness', 'dev-water-clearcoat-roughness-val', (v) => this.water.setClearcoatRoughness(v, this.activeBiomeId));

        const waterToonToggle = document.getElementById('dev-water-toon-toggle');
        if (waterToonToggle) {
            waterToonToggle.addEventListener('click', () => {
                const current = globalConfigManager.getBiomeConfig(this.activeBiomeId).water.isToonMode;
                const next = !current;
                this.water.setToonMode(next, this.activeBiomeId);
                waterToonToggle.textContent = next ? 'Shader Mode: MeshToon (Fast)' : 'Shader Mode: MeshPhysical (Realistic)';
                waterToonToggle.classList.toggle('active', next);
            });
        }

        bindSlider('dev-shore-bloom', 'dev-shore-bloom-val', (v) => this.terrain.setShoreBloom(v, undefined, undefined, this.activeBiomeId));
        const shoreColorInp = document.getElementById('dev-shore-color') as HTMLInputElement | null;
        if (shoreColorInp) {
            shoreColorInp.addEventListener('input', () => {
                const blm = globalConfigManager.getBiomeConfig(this.activeBiomeId).bloom;
                this.terrain.setShoreBloom(blm.shoreBloom, shoreColorInp.value, undefined, this.activeBiomeId);
            });
        }
        bindSlider('dev-shore-width', 'dev-shore-width-val', (v) => {
            const blm = globalConfigManager.getBiomeConfig(this.activeBiomeId).bloom;
            this.terrain.setShoreBloom(blm.shoreBloom, undefined, v, this.activeBiomeId);
        });

        // ── Tab 5 Global Post & Clouds ─────────────────────────────────────────
        bindSlider('dev-bloom-strength', 'dev-bloom-strength-val', (v) => {
            globalConfigManager.config.globalBloom.strength = v;
            this.pipeline.setBloomStrength(v);
        });
        bindSlider('dev-bloom-radius', 'dev-bloom-radius-val', (v) => {
            globalConfigManager.config.globalBloom.radius = v;
            this.pipeline.setBloomRadius(v);
        });
        bindSlider('dev-bloom-threshold', 'dev-bloom-threshold-val', (v) => {
            globalConfigManager.config.globalBloom.threshold = v;
            this.pipeline.setBloomThreshold(v);
        });

        bindSlider('dev-cloud-bloom', 'dev-cloud-bloom-val', (v) => {
            globalConfigManager.config.cloud.bloom = v;
            this.props.setCloudBloom(v);
        });
        const cloudColorInp = document.getElementById('dev-cloud-color') as HTMLInputElement | null;
        if (cloudColorInp) {
            cloudColorInp.addEventListener('input', () => {
                globalConfigManager.config.cloud.color = cloudColorInp.value;
                this.props.setCloudColor(cloudColorInp.value);
            });
        }
        const cloudEmissiveInp = document.getElementById('dev-cloud-emissive') as HTMLInputElement | null;
        if (cloudEmissiveInp) {
            cloudEmissiveInp.addEventListener('input', () => {
                globalConfigManager.config.cloud.emissive = cloudEmissiveInp.value;
                this.props.setCloudEmissive(cloudEmissiveInp.value);
            });
        }

        // ── Tab 6 Defaults & Profiles ──────────────────────────────────────────
        const saveBiomeBtn = document.getElementById('dev-save-biome-btn');
        if (saveBiomeBtn) {
            saveBiomeBtn.addEventListener('click', () => {
                globalConfigManager.saveBiomeDefault(this.activeBiomeId);
                const bName = globalConfigManager.getBiomeConfig(this.activeBiomeId).name;
                this.showStatus(`Default settings saved for ${bName}`);
            });
        }

        const saveAllBtn = document.getElementById('dev-save-all-btn');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', () => {
                globalConfigManager.saveGlobalDefaults();
                this.showStatus('All biomes saved as defaults');
            });
        }

        const resetBiomeBtn = document.getElementById('dev-reset-biome-btn');
        if (resetBiomeBtn) {
            resetBiomeBtn.addEventListener('click', () => {
                const bName = globalConfigManager.getBiomeConfig(this.activeBiomeId).name;
                if (confirm(`Reset ${bName} to factory defaults?`)) {
                    globalConfigManager.resetBiomeDefaults(this.activeBiomeId);
                    this.lighting.switchBiome(this.activeBiomeId, this.pipeline.scene);
                    this.water.switchBiome(this.activeBiomeId);
                    this.terrain.reloadColorsFromConfig();
                    this.trees.forceRebuild();
                    this.refreshUI();
                    this.showStatus(`Reset ${bName} to factory defaults`);
                }
            });
        }

        const resetAllBtn = document.getElementById('dev-reset-all-btn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                if (confirm('Reset all biomes and global settings to original factory defaults?')) {
                    globalConfigManager.resetFactoryDefaults();
                    this.lighting.switchBiome(this.activeBiomeId, this.pipeline.scene);
                    this.water.switchBiome(this.activeBiomeId);
                    this.terrain.reloadColorsFromConfig();
                    this.trees.forceRebuild();
                    this.refreshUI();
                    this.showStatus('Reset all settings to factory defaults');
                }
            });
        }

        const copyJsonBtn = document.getElementById('dev-copy-json-btn');
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', () => {
                const json = globalConfigManager.exportJSON();
                navigator.clipboard.writeText(json).then(() => {
                    this.showStatus('Configuration JSON copied to clipboard');
                }).catch(() => {
                    this.showStatus('Failed to copy to clipboard', true);
                });
            });
        }

        const applyJsonBtn = document.getElementById('dev-apply-json-btn');
        if (applyJsonBtn) {
            applyJsonBtn.addEventListener('click', () => {
                const jsonArea = document.getElementById('dev-json-export') as HTMLTextAreaElement | null;
                if (jsonArea && jsonArea.value.trim()) {
                    const success = globalConfigManager.importJSON(jsonArea.value.trim());
                    if (success) {
                        this.lighting.switchBiome(this.activeBiomeId, this.pipeline.scene);
                        this.water.switchBiome(this.activeBiomeId);
                        this.terrain.reloadColorsFromConfig();
                        this.trees.forceRebuild();
                        this.refreshUI();
                        this.showStatus('Imported configuration successfully');
                    } else {
                        this.showStatus('Invalid JSON configuration syntax', true);
                    }
                }
            });
        }
    }
}
