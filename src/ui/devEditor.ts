import { RenderPipeline } from '../core/renderer';
import { LightingSystem } from '../world/lighting';
import { PropsSystem } from '../world/props';
import { TreeSystem, BIOME_VEG_PRESETS, TREE_CATALOG } from '../world/trees';
import { WaterSystem } from '../world/water';
import { TerrainSystem, TERRAIN_PALETTES } from '../world/terrain';
import { PlayerSystem } from '../player/player';
import { globalConfigManager, EnvPhaseConfig } from '../core/config';
import { BiomeId, BIOME_LOCATIONS } from '../world/noise';

export class DevEditor {
    public isOpen = false;
    public activeBiomeId: BiomeId = 'meadow';
    public activeEnvPhase: number = 0;
    public selectedTreeCategory: string = 'all';

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
        this.syncBiomeUI();
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
        statusEl.style.color = isError ? '#f87171' : '#38bdf8';

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
        
        const biomeCfg = globalConfigManager.getBiomeConfig(biomeId);
        if (biomeCfg) {
            this.pipeline.applyBiomeBloom(biomeCfg.bloom);
            this.props.applyBiomeCloud(biomeCfg.bloom);
        }
        
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
        const biomeCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
        const phaseCfg = biomeCfg.phases[this.activeEnvPhase];

        // ── 1. 3D Trees & Foliage ─────────────────────────────────────────────
        const veg = biomeCfg.vegetation;
        const activeTreeIds = veg.selectedTreeModelIds || [];
        this.renderTreeModelSelector(activeTreeIds);

        const countEl = document.getElementById('dev-tree-active-count');
        if (countEl) {
            countEl.textContent = activeTreeIds.length === 0 
                ? '0 / 50 Active (No Trees)' 
                : `${activeTreeIds.length} / 50 Active`;
        }

        this.setSliderAndLabel('dev-veg-tree-scale', 'dev-veg-tree-scale-val', veg.treeScale, 'x');
        this.setSliderAndLabel('dev-veg-tree-density', 'dev-veg-tree-density-val', veg.treeDensity, '');
        this.setSliderAndLabel('dev-veg-bush-scale', 'dev-veg-bush-scale-val', veg.bushScale, 'x');
        this.setSliderAndLabel('dev-veg-bush-density', 'dev-veg-bush-density-val', veg.bushDensity, '');

        this.renderCanopyColorSwatches(veg.canopyColors);
        this.renderTrunkColorSwatches(veg.trunkColors);

        const vegPresetBtns = document.querySelectorAll('.dev-veg-preset-btn');
        vegPresetBtns.forEach((btn) => {
            const pKey = btn.getAttribute('data-preset');
            btn.classList.toggle('active', pKey === veg.activePreset);
        });

        // ── 2. Atmosphere & Sky ───────────────────────────────────────────────
        const phaseBtns = document.querySelectorAll('.dev-phase-btn');
        phaseBtns.forEach((btn) => {
            const phase = parseInt(btn.getAttribute('data-phase') || '0', 10);
            btn.classList.toggle('active', phase === this.activeEnvPhase);
        });

        this.setInputValueAndHex('dev-env-bg', 'dev-env-bg-hex', phaseCfg.bg);
        this.setInputValueAndHex('dev-env-fog', 'dev-env-fog-hex', phaseCfg.fog);
        this.setSliderAndLabel('dev-env-fognear', 'dev-env-fognear-val', phaseCfg.fogNear, '');
        this.setSliderAndLabel('dev-env-fogfar', 'dev-env-fogfar-val', phaseCfg.fogFar, '');
        this.setInputValueAndHex('dev-env-amb-color', 'dev-env-amb-color-hex', phaseCfg.amb);
        this.setSliderAndLabel('dev-env-amb-intensity', 'dev-env-amb-intensity-val', phaseCfg.ambI, '');
        this.setInputValueAndHex('dev-env-dir-color', 'dev-env-dir-color-hex', phaseCfg.dir);
        this.setSliderAndLabel('dev-env-dir-intensity', 'dev-env-dir-intensity-val', phaseCfg.dirI, '');
        this.setSliderAndLabel('dev-env-hemi-intensity', 'dev-env-hemi-intensity-val', phaseCfg.hemi, '');
        this.setInputValueAndHex('dev-env-sun-color', 'dev-env-sun-color-hex', phaseCfg.sunC);
        this.setSliderAndLabel('dev-env-sun-intensity', 'dev-env-sun-intensity-val', phaseCfg.sunI, '');
        this.setSliderAndLabel('dev-env-sun-scale', 'dev-env-sun-scale-val', phaseCfg.sunScale, 'x');
        this.setSliderAndLabel('dev-env-star-opacity', 'dev-env-star-opacity-val', phaseCfg.starOp, '');

        // ── 3. Bloom & Glow (Biome Locked) ────────────────────────────────────
        const blm = biomeCfg.bloom;
        this.setSliderAndLabel('dev-bloom-strength', 'dev-bloom-strength-val', blm.globalStrength, '');
        this.setSliderAndLabel('dev-bloom-radius', 'dev-bloom-radius-val', blm.globalRadius, '');
        this.setSliderAndLabel('dev-bloom-threshold', 'dev-bloom-threshold-val', blm.globalThreshold, '');

        this.setSliderAndLabel('dev-tree-bloom', 'dev-tree-bloom-val', blm.treeBloom, '');
        this.setSliderAndLabel('dev-tree-canopy-glow', 'dev-tree-canopy-glow-val', blm.treeCanopyGlow, '');
        this.setSliderAndLabel('dev-tree-trunk-glow', 'dev-tree-trunk-glow-val', blm.treeTrunkGlow, '');
        this.setSliderAndLabel('dev-bush-bloom', 'dev-bush-bloom-val', blm.bushBloom, '');
        this.setSliderAndLabel('dev-bush-glow', 'dev-bush-glow-val', blm.bushGlow, '');

        this.setSliderAndLabel('dev-shore-bloom', 'dev-shore-bloom-val', blm.shoreBloom, '');
        this.setInputValueAndHex('dev-shore-color', 'dev-shore-color-hex', blm.shoreColor);
        this.setSliderAndLabel('dev-shore-width', 'dev-shore-width-val', blm.shoreWidth, '');

        this.setSliderAndLabel('dev-cloud-bloom', 'dev-cloud-bloom-val', blm.cloudBloom, '');
        this.setInputValueAndHex('dev-cloud-color', 'dev-cloud-color-hex', blm.cloudColor);
        this.setInputValueAndHex('dev-cloud-emissive', 'dev-cloud-emissive-hex', blm.cloudEmissive);

        // ── 4. Terrain & Water ────────────────────────────────────────────────
        const ter = biomeCfg.terrain;
        this.setInputValueAndHex('dev-terrain-low', 'dev-terrain-low-hex', ter.colorLow);
        this.setInputValueAndHex('dev-terrain-high', 'dev-terrain-high-hex', ter.colorHigh);
        this.setInputValueAndHex('dev-terrain-dirt', 'dev-terrain-dirt-hex', ter.colorDirt);
        this.setInputValueAndHex('dev-terrain-path', 'dev-terrain-path-hex', ter.colorPath);
        this.setInputValueAndHex('dev-terrain-sand', 'dev-terrain-sand-hex', ter.colorSand);

        const paletteBtns = document.querySelectorAll('.dev-palette-btn');
        paletteBtns.forEach((btn) => {
            const palName = btn.getAttribute('data-palette');
            btn.classList.toggle('active', palName === ter.presetName);
        });

        const terrainToonBtn = document.getElementById('dev-terrain-toon-toggle');
        if (terrainToonBtn) {
            const isToon = ter.isToonMode ?? true;
            terrainToonBtn.textContent = isToon ? 'Terrain Style: Painterly Ghibli' : 'Terrain Style: Modern Soft PBR';
            terrainToonBtn.classList.toggle('active', isToon);
        }

        const wat = biomeCfg.water;
        this.setInputValueAndHex('dev-water-color', 'dev-water-color-hex', wat.color);
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

        // ── 5. Profile JSON ───────────────────────────────────────────────────
        const jsonArea = document.getElementById('dev-json-export') as HTMLTextAreaElement | null;
        if (jsonArea) {
            jsonArea.value = globalConfigManager.exportJSON();
        }
    }

    private renderTreeModelSelector(selectedModelIds: string[]) {
        const container = document.getElementById('dev-tree-models-grid');
        if (!container) return;
        container.innerHTML = '';

        const filterCat = this.selectedTreeCategory.toLowerCase();
        const filteredList = TREE_CATALOG.filter((item) => {
            if (filterCat === 'all') return true;
            return item.category.toLowerCase() === filterCat;
        });

        filteredList.forEach((item) => {
            const isSelected = selectedModelIds.includes(item.id);
            const card = document.createElement('div');
            card.className = `dev-tree-card ${isSelected ? 'active' : ''}`;
            card.title = `${item.name} (${item.category})\nClick to ${isSelected ? 'remove' : 'add'} in ${this.activeBiomeId}`;
            card.innerHTML = `
                <div class="dev-tree-thumb-box">
                    <img src="${item.previewImage}" class="dev-tree-thumb-img" alt="${item.name}" loading="lazy" />
                </div>
                <div class="dev-tree-card-title">${item.name}</div>
                <div class="dev-tree-card-meta">
                    <span class="dev-tree-card-tag">${item.category}</span>
                    <span class="dev-tree-card-status">${isSelected ? 'ON' : 'OFF'}</span>
                </div>
            `;
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.trees.toggleBiomeTreeModel(this.activeBiomeId, item.id);
                this.refreshUI();
            });
            container.appendChild(card);
        });
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

    private setInputValueAndHex(inputId: string, hexLabelId: string | undefined, val: string) {
        const el = document.getElementById(inputId) as HTMLInputElement | null;
        if (el) el.value = val;
        if (hexLabelId) {
            const hexEl = document.getElementById(hexLabelId);
            if (hexEl) hexEl.textContent = val;
        }
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

        // ── Section 1: Tree Category Filtering & File Input & Batch Buttons ───
        const catBtns = document.querySelectorAll('.dev-tree-cat-btn');
        catBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') || 'all';
                this.selectedTreeCategory = cat;
                catBtns.forEach(b => b.classList.remove('active'));
                (e.currentTarget as HTMLElement).classList.add('active');
                const veg = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation;
                this.renderTreeModelSelector(veg.selectedTreeModelIds || []);
            });
        });

        const fileInp = document.getElementById('dev-tree-file-input') as HTMLInputElement | null;
        const uploadBtn = document.getElementById('dev-upload-tree-btn');
        if (uploadBtn && fileInp) {
            uploadBtn.addEventListener('click', () => {
                fileInp.click();
            });
            fileInp.addEventListener('change', async () => {
                if (fileInp.files && fileInp.files.length > 0) {
                    const file = fileInp.files[0];
                    try {
                        this.showStatus(`Loading custom tree model: ${file.name}...`);
                        const buffer = await file.arrayBuffer();
                        const loadedItem = await this.trees.loadCustomTreeModel(file.name, buffer, 1.0);
                        this.refreshUI();
                        this.showStatus(`Loaded custom tree model: ${loadedItem.name}`);
                    } catch (err) {
                        console.error('Failed to load custom GLB model:', err);
                        this.showStatus('Failed to load GLB tree model file', true);
                    }
                    fileInp.value = '';
                }
            });
        }

        const selectAllTreesBtn = document.getElementById('dev-select-all-trees-btn');
        if (selectAllTreesBtn) {
            selectAllTreesBtn.addEventListener('click', () => {
                const filterCat = this.selectedTreeCategory.toLowerCase();
                const idsToAdd = TREE_CATALOG
                    .filter(t => filterCat === 'all' || t.category.toLowerCase() === filterCat)
                    .map(t => t.id);

                const currentIds = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation.selectedTreeModelIds || [];
                const merged = Array.from(new Set([...currentIds, ...idsToAdd]));

                this.trees.setBiomeTreeModels(this.activeBiomeId, merged);
                this.refreshUI();
                this.showStatus(`Selected ${merged.length} tree models for ${this.activeBiomeId}`);
            });
        }

        const clearTreesBtn = document.getElementById('dev-clear-trees-btn');
        if (clearTreesBtn) {
            clearTreesBtn.addEventListener('click', () => {
                // By default clear all trees for this biome (0 trees in world)
                this.trees.setBiomeTreeModels(this.activeBiomeId, []);
                this.refreshUI();
                this.showStatus(`Cleared all tree models for ${this.activeBiomeId} (No trees)`);
            });
        }

        // Tree & Bush Sliders
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

        // ── Section 2: Atmosphere & Lighting Inputs ────────────────────────────
        const phaseBtns = document.querySelectorAll('.dev-phase-btn');
        phaseBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const phase = parseInt((e.currentTarget as HTMLElement).getAttribute('data-phase') || '0', 10);
                this.activeEnvPhase = phase;
                this.lighting.setTimePhase(phase, this.pipeline.scene);
                this.refreshUI();
            });
        });

        const updateEnvField = (partial: Partial<EnvPhaseConfig>) => {
            this.lighting.updateBiomePhaseConfig(this.activeBiomeId, this.activeEnvPhase, partial, this.pipeline.scene);
        };

        const bindEnvColor = (id: string, hexLabelId: string, key: keyof EnvPhaseConfig) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            const hexEl = document.getElementById(hexLabelId);
            if (el) {
                el.addEventListener('input', () => {
                    if (hexEl) hexEl.textContent = el.value;
                    updateEnvField({ [key]: el.value });
                });
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

        bindEnvColor('dev-env-bg', 'dev-env-bg-hex', 'bg');
        bindEnvColor('dev-env-fog', 'dev-env-fog-hex', 'fog');
        bindEnvSlider('dev-env-fognear', 'dev-env-fognear-val', 'fogNear');
        bindEnvSlider('dev-env-fogfar', 'dev-env-fogfar-val', 'fogFar');
        bindEnvColor('dev-env-amb-color', 'dev-env-amb-color-hex', 'amb');
        bindEnvSlider('dev-env-amb-intensity', 'dev-env-amb-intensity-val', 'ambI');
        bindEnvColor('dev-env-dir-color', 'dev-env-dir-color-hex', 'dir');
        bindEnvSlider('dev-env-dir-intensity', 'dev-env-dir-intensity-val', 'dirI');
        bindEnvSlider('dev-env-hemi-intensity', 'dev-env-hemi-intensity-val', 'hemi');
        bindEnvColor('dev-env-sun-color', 'dev-env-sun-color-hex', 'sunC');
        bindEnvSlider('dev-env-sun-intensity', 'dev-env-sun-intensity-val', 'sunI');
        bindEnvSlider('dev-env-sun-scale', 'dev-env-sun-scale-val', 'sunScale', 'x');
        bindEnvSlider('dev-env-star-opacity', 'dev-env-star-opacity-val', 'starOp');

        // ── Section 3: Bloom & Glow Inputs ─────────────────────────────────────
        bindSlider('dev-bloom-strength', 'dev-bloom-strength-val', (v) => {
            this.pipeline.setBloomStrength(v, this.activeBiomeId);
        });
        bindSlider('dev-bloom-radius', 'dev-bloom-radius-val', (v) => {
            this.pipeline.setBloomRadius(v, this.activeBiomeId);
        });
        bindSlider('dev-bloom-threshold', 'dev-bloom-threshold-val', (v) => {
            this.pipeline.setBloomThreshold(v, this.activeBiomeId);
        });

        bindSlider('dev-tree-bloom', 'dev-tree-bloom-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeBloom: v }));
        bindSlider('dev-tree-canopy-glow', 'dev-tree-canopy-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeCanopyGlow: v }));
        bindSlider('dev-tree-trunk-glow', 'dev-tree-trunk-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { treeTrunkGlow: v }));
        bindSlider('dev-bush-bloom', 'dev-bush-bloom-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { bushBloom: v }));
        bindSlider('dev-bush-glow', 'dev-bush-glow-val', (v) => this.trees.setBiomeBloomAndGlow(this.activeBiomeId, { bushGlow: v }));

        bindSlider('dev-shore-bloom', 'dev-shore-bloom-val', (v) => this.terrain.setShoreBloom(v, undefined, undefined, this.activeBiomeId));
        const shoreColorInp = document.getElementById('dev-shore-color') as HTMLInputElement | null;
        const shoreColorHex = document.getElementById('dev-shore-color-hex');
        if (shoreColorInp) {
            shoreColorInp.addEventListener('input', () => {
                if (shoreColorHex) shoreColorHex.textContent = shoreColorInp.value;
                const blm = globalConfigManager.getBiomeConfig(this.activeBiomeId).bloom;
                this.terrain.setShoreBloom(blm.shoreBloom, shoreColorInp.value, undefined, this.activeBiomeId);
            });
        }
        bindSlider('dev-shore-width', 'dev-shore-width-val', (v) => {
            const blm = globalConfigManager.getBiomeConfig(this.activeBiomeId).bloom;
            this.terrain.setShoreBloom(blm.shoreBloom, undefined, v, this.activeBiomeId);
        });

        bindSlider('dev-cloud-bloom', 'dev-cloud-bloom-val', (v) => {
            this.props.setCloudBloom(v, this.activeBiomeId);
        });
        const cloudColorInp = document.getElementById('dev-cloud-color') as HTMLInputElement | null;
        const cloudColorHex = document.getElementById('dev-cloud-color-hex');
        if (cloudColorInp) {
            cloudColorInp.addEventListener('input', () => {
                if (cloudColorHex) cloudColorHex.textContent = cloudColorInp.value;
                this.props.setCloudColor(cloudColorInp.value, this.activeBiomeId);
            });
        }
        const cloudEmissiveInp = document.getElementById('dev-cloud-emissive') as HTMLInputElement | null;
        const cloudEmissiveHex = document.getElementById('dev-cloud-emissive-hex');
        if (cloudEmissiveInp) {
            cloudEmissiveInp.addEventListener('input', () => {
                if (cloudEmissiveHex) cloudEmissiveHex.textContent = cloudEmissiveInp.value;
                this.props.setCloudEmissive(cloudEmissiveInp.value, this.activeBiomeId);
            });
        }

        // ── Section 4: Terrain & Water Inputs ──────────────────────────────────
        const getPlayerCoords = () => {
            if (this.player) return { x: this.player.playerGrp.position.x, z: this.player.playerGrp.position.z };
            return { x: this.terrain.lastPlayerX, z: this.terrain.lastPlayerZ };
        };

        const bindTerrainColor = (id: string, hexLabelId: string, key: string) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            const hexEl = document.getElementById(hexLabelId);
            if (el) {
                el.addEventListener('input', () => {
                    if (hexEl) hexEl.textContent = el.value;
                    const coords = getPlayerCoords();
                    this.terrain.setBiomeTerrainColors(this.activeBiomeId, { [key]: el.value }, coords.x, coords.z);
                });
            }
        };

        bindTerrainColor('dev-terrain-low', 'dev-terrain-low-hex', 'colorLow');
        bindTerrainColor('dev-terrain-high', 'dev-terrain-high-hex', 'colorHigh');
        bindTerrainColor('dev-terrain-dirt', 'dev-terrain-dirt-hex', 'colorDirt');
        bindTerrainColor('dev-terrain-path', 'dev-terrain-path-hex', 'colorPath');
        bindTerrainColor('dev-terrain-sand', 'dev-terrain-sand-hex', 'colorSand');

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

        const waterColorInp = document.getElementById('dev-water-color') as HTMLInputElement | null;
        const waterColorHex = document.getElementById('dev-water-color-hex');
        if (waterColorInp) {
            waterColorInp.addEventListener('input', () => {
                if (waterColorHex) waterColorHex.textContent = waterColorInp.value;
                this.water.setColor(waterColorInp.value, this.activeBiomeId);
            });
        }
        bindSlider('dev-water-opacity', 'dev-water-opacity-val', (v) => this.water.setOpacity(v, this.activeBiomeId));
        bindSlider('dev-water-reflectivity', 'dev-water-reflectivity-val', (v) => this.water.setReflectivity(v, this.activeBiomeId));
        bindSlider('dev-water-roughness', 'dev-water-roughness-val', (v) => this.water.setRoughness(v, this.activeBiomeId));
        bindSlider('dev-water-metalness', 'dev-water-metalness-val', (v) => this.water.setMetalness(v, this.activeBiomeId));
        bindSlider('dev-water-clearcoat', 'dev-water-clearcoat-val', (v) => this.water.setClearcoat(v, this.activeBiomeId));
        bindSlider('dev-water-clearcoat-roughness', 'dev-water-clearcoat-roughness-val', (v) => this.water.setClearcoatRoughness(v, this.activeBiomeId));

        const terrainToonToggle = document.getElementById('dev-terrain-toon-toggle');
        if (terrainToonToggle) {
            terrainToonToggle.addEventListener('click', () => {
                const current = globalConfigManager.getBiomeConfig(this.activeBiomeId).terrain.isToonMode ?? true;
                const next = !current;
                this.terrain.setToonMode(next, this.activeBiomeId);
                terrainToonToggle.textContent = next ? 'Terrain Style: Painterly Ghibli' : 'Terrain Style: Modern Soft PBR';
                terrainToonToggle.classList.toggle('active', next);
                const settingsToggle = document.getElementById('terrain-shading-toggle');
                if (settingsToggle) {
                    settingsToggle.textContent = next ? 'Style: Painterly Ghibli' : 'Style: Modern Soft PBR';
                }
            });
        }

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

        // ── Section 5: Profile & Presets Actions ───────────────────────────────
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
                    const bCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
                    if (bCfg) {
                        this.pipeline.applyBiomeBloom(bCfg.bloom);
                        this.props.applyBiomeCloud(bCfg.bloom);
                    }
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
                    const bCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
                    if (bCfg) {
                        this.pipeline.applyBiomeBloom(bCfg.bloom);
                        this.props.applyBiomeCloud(bCfg.bloom);
                    }
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
                        const bCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
                        if (bCfg) {
                            this.pipeline.applyBiomeBloom(bCfg.bloom);
                            this.props.applyBiomeCloud(bCfg.bloom);
                        }
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


