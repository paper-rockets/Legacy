import * as THREE from 'three';
import { RenderPipeline } from '../core/renderer';
import { LightingSystem } from '../world/lighting';
import { PropsSystem } from '../world/props';
import { TreeSystem, BIOME_VEG_PRESETS, TREE_CATALOG } from '../world/trees';
import { WaterSystem } from '../world/water';
import { TerrainSystem, TERRAIN_PALETTES } from '../world/terrain';
import { WorldPropsSystem, WORLD_PROP_CATALOG, WorldPropCatalogItem } from '../world/worldProps';
import { SkyCastleSystem, CASTLE_MODEL_CATALOG, CASTLE_COLOR_PRESETS } from '../world/skyCastles';
import { PlayerSystem } from '../player/player';
import { globalConfigManager, EnvPhaseConfig, PlacedWorldProp, SkyCastleIslandDef, CastleColorSettings } from '../core/config';
import { BiomeId, BIOME_LOCATIONS } from '../world/noise';
import { TopViewController } from './topViewController';
import { ThumbnailGenerator } from './thumbnailGenerator';

export class DevEditor {
    public isOpen = false;
    public activeBiomeId: BiomeId = 'meadow';
    public activeEnvPhase: number = 0;
    public selectedTreeCategory: string = 'all';
    public selectedPropCategory: string = 'all';
    public activeTab: string = 'tab-models';
    public inspectedModelId: string | null = null;
    public selectedCastleIslandId: string | null = null;
    public modelSearchQuery: string = '';
    public propSearchQuery: string = '';
    public topViewController: TopViewController | null = null;

    private panel: HTMLElement | null = null;
    private saveStatusTimer: number | null = null;

    constructor(
        private pipeline: RenderPipeline,
        private lighting: LightingSystem,
        private props: PropsSystem,
        private trees: TreeSystem,
        private water: WaterSystem,
        private terrain: TerrainSystem,
        private worldProps: WorldPropsSystem,
        private player?: PlayerSystem,
        private skyCastles?: SkyCastleSystem
    ) {
        this.activeBiomeId = globalConfigManager.config.activeBiomeId || 'meadow';
        this.activeEnvPhase = this.lighting.timePhase || 0;
        if (this.player) {
            this.topViewController = new TopViewController(this.pipeline, this.player, this.skyCastles, this.worldProps, this.lighting);
            this.topViewController.setOnIslandMoved((id, x, z) => {
                this.renderCastleArchipelagoEditor();
            });
            this.topViewController.setOnIslandSelected((id) => {
                this.selectedCastleIslandId = id;
                this.renderCastleArchipelagoEditor();
            });
        }
        this.initDOM();
        this.bindEvents();
        this.bindKeyboardShortcut();
        this.syncBiomeUI();
        this.switchTab('tab-models');
        this.refreshUI();
    }

    private initDOM() {
        this.panel = document.getElementById('dev-editor-panel');
    }

    public switchTab(tabId: string) {
        this.activeTab = tabId;
        const tabBtns = document.querySelectorAll('.dev-tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        const panes = document.querySelectorAll('.dev-tab-pane');
        panes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
    }

    public open() {
        this.isOpen = true;
        if (this.panel) {
            this.panel.style.display = 'flex';
        }
        const btn = document.getElementById('dev-editor-toggle');
        if (btn) btn.classList.add('active');

        // Disable all fog in editor mode
        this.lighting.setFogDisabled(true, this.pipeline.scene);
        if (this.skyCastles) this.skyCastles.setFogDeckDisabled(true);

        // Close settings dropdown if open
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu) settingsMenu.style.display = 'none';

        this.syncBiomeUI();
        this.switchTab(this.activeTab || 'tab-models');
        this.refreshUI();
    }

    public close() {
        this.isOpen = false;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        const btn = document.getElementById('dev-editor-toggle');
        if (btn) btn.classList.remove('active');

        // Restore normal biome fog if top view is not active
        if (!this.topViewController?.isActive) {
            this.lighting.setFogDisabled(false, this.pipeline.scene);
            if (this.skyCastles) this.skyCastles.setFogDeckDisabled(false);
        }
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
            if (this.skyCastles) this.skyCastles.applyBiomeCloud(biomeCfg.bloom);
        }
        
        this.lighting.switchBiome(biomeId, this.pipeline.scene);
        this.water.switchBiome(biomeId);

        if (this.player) {
            const loc = BIOME_LOCATIONS.find(b => b.id === biomeId);
            if (loc) {
                this.player.teleportTo(loc.x, loc.z, 50, loc.y);
                const pos = this.player.playerGrp.position;
                this.terrain.update(pos.x, pos.z);
                if (this.trees) this.trees.update(pos.x, pos.z);
                this.props.update(pos.x, pos.z, 0.016);
                this.water.update(pos.x, pos.z, 0.016);
                if (this.skyCastles) this.skyCastles.update(pos, 0.016);
            }
        }
        this.syncBiomeUI();
        this.refreshUI();
    }

    public teleportToActiveBiome() {
        const loc = BIOME_LOCATIONS.find(b => b.id === this.activeBiomeId);
        if (loc && this.player) {
            this.player.teleportTo(loc.x, loc.z, 50, loc.y);
            const pos = this.player.playerGrp.position;
            this.terrain.update(pos.x, pos.z);
            if (this.trees) this.trees.update(pos.x, pos.z);
            this.props.update(pos.x, pos.z, 0.016);
            this.water.update(pos.x, pos.z, 0.016);
            if (this.skyCastles) this.skyCastles.update(pos, 0.016);
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
    }

    public refreshUI() {
        const biomeCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId);
        const phaseCfg = biomeCfg.phases[this.activeEnvPhase];

        // ── 1. 3D Trees & Foliage ─────────────────────────────────────────────
        const veg = biomeCfg.vegetation;
        const activeTreeIds = veg.selectedTreeModelIds || [];

        // Ensure an inspected model is chosen
        if (!this.inspectedModelId || !TREE_CATALOG.some(t => t.id === this.inspectedModelId)) {
            this.inspectedModelId = activeTreeIds.length > 0 ? activeTreeIds[0] : (TREE_CATALOG[0]?.id || null);
        }

        this.renderTreeModelSelector(activeTreeIds);
        this.renderModelInspector();

        const countEl = document.getElementById('dev-tree-active-count');
        if (countEl) {
            countEl.textContent = activeTreeIds.length === 0 
                ? `0 / ${TREE_CATALOG.length} Active (No Models)` 
                : `${activeTreeIds.length} / ${TREE_CATALOG.length} Active`;
        }

        this.setSliderAndLabel('dev-veg-bush-scale', 'dev-veg-bush-scale-val', veg.bushScale, 'x');
        this.setSliderAndLabel('dev-veg-bush-density', 'dev-veg-bush-density-val', veg.bushDensity, '');

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

        // ── 3. Bioluminescence (Foliage Glow) ──────────────────────────────────
        const bioVal = veg.bioluminescence !== undefined ? Math.round(veg.bioluminescence * 100) : 80;
        this.setSliderAndLabel('dev-model-biolum', 'dev-model-biolum-val', bioVal, '%');
        const biolumNum = document.getElementById('dev-model-biolum-num') as HTMLInputElement | null;
        if (biolumNum) biolumNum.value = bioVal.toString();

        const quickBioSlider = document.getElementById('bioluminescence-slider') as HTMLInputElement | null;
        const quickBioVal = document.getElementById('bioluminescence-val');
        if (quickBioSlider) quickBioSlider.value = bioVal.toString();
        if (quickBioVal) quickBioVal.textContent = bioVal.toString() + '%';

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

        const terrainStyle = ter.terrainStyle || (ter.isCrystalMode ? 'crystal' : (ter.isToonMode ?? true ? 'toon' : 'standard'));
        const terrainToonBtn = document.getElementById('dev-terrain-toon-toggle');
        if (terrainToonBtn) {
            let label = 'Terrain Style: Painterly Ghibli';
            if (terrainStyle === 'standard') label = 'Terrain Style: Modern Soft PBR';
            else if (terrainStyle === 'crystal') label = 'Terrain Style: Translucent Crystal Glass';
            terrainToonBtn.textContent = label;
            terrainToonBtn.classList.toggle('active', terrainStyle === 'crystal');
        }

        const crystalPanel = document.getElementById('dev-crystal-terrain-controls');
        if (crystalPanel) {
            crystalPanel.style.display = terrainStyle === 'crystal' ? 'block' : 'none';
        }

        this.setSliderAndLabel('dev-crystal-transmission', 'dev-crystal-transmission-val', ter.glassTransmission ?? 0.65, '');
        this.setSliderAndLabel('dev-crystal-iridescence', 'dev-crystal-iridescence-val', ter.iridescence ?? 1.35, '');
        this.setSliderAndLabel('dev-crystal-specular', 'dev-crystal-specular-val', ter.specularGlint ?? 2.20, '');
        this.setSliderAndLabel('dev-crystal-bevel', 'dev-crystal-bevel-val', ter.bevelGleam ?? 1.10, '');
        this.setSliderAndLabel('dev-crystal-vein', 'dev-crystal-vein-val', ter.veinGlow ?? 1.00, '');
        this.setSliderAndLabel('dev-crystal-refraction', 'dev-crystal-refraction-val', ter.glassRefraction ?? 1.52, '');
        this.setSliderAndLabel('dev-crystal-tint', 'dev-crystal-tint-val', ter.glassTint ?? 1.00, '');
        this.setSliderAndLabel('dev-crystal-vein-scale', 'dev-crystal-vein-scale-val', ter.veinScale ?? 1.00, 'x');

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

        // ── 5. World Props & Structures ───────────────────────────────────────
        this.renderPropCatalog();
        this.renderPlacedPropsList();
        this.renderPlacedPropInspector();

        // ── 6. Sky Castles Archipelago ─────────────────────────────────────────
        this.renderCastleArchipelagoEditor();
    }

    private renderTreeModelSelector(selectedModelIds: string[]) {
        const container = document.getElementById('dev-tree-models-grid');
        if (!container) return;
        container.innerHTML = '';

        const filterCat = this.selectedTreeCategory.toLowerCase();
        const search = this.modelSearchQuery.toLowerCase();

        const filteredList = TREE_CATALOG.filter((item) => {
            const itemCat = item.category.toLowerCase();
            const itemName = item.name.toLowerCase();
            const itemId = item.id.toLowerCase();
            const isFlower = itemCat.includes('flower') || itemCat.includes('flora') || itemId.includes('flower') || itemId.includes('clover') || itemId.includes('bush');
            const isTree = !isFlower && (itemCat.includes('tree') || itemCat.includes('palm') || itemCat.includes('jungle') || itemId.includes('tree') || itemId.includes('palm') || itemId.includes('cartoon'));

            let matchCat = false;
            if (filterCat === 'all' || filterCat === 'vegetation') {
                matchCat = true;
            } else if (filterCat === 'trees' || filterCat === 'tree') {
                matchCat = isTree;
            } else if (filterCat === 'flowers' || filterCat === 'flower' || filterCat === 'flora') {
                matchCat = isFlower;
            } else {
                matchCat = itemCat.includes(filterCat) || itemName.includes(filterCat);
            }

            const matchSearch = !search || itemName.includes(search) || itemCat.includes(search) || item.description.toLowerCase().includes(search);
            return matchCat && matchSearch;
        });

        filteredList.forEach((item) => {
            const isSelected = selectedModelIds.includes(item.id);
            const isInspected = item.id === this.inspectedModelId;

            const card = document.createElement('div');
            card.className = `dev-tree-card ${isSelected ? 'active' : ''} ${isInspected ? 'inspected' : ''}`;
            card.title = `${item.name} (${item.category})\nClick card to inspect properties\nClick [ ON ] / [ OFF ] to select/unselect for this biome`;
            card.innerHTML = `
                <div class="dev-tree-thumb-box">
                    <img src="${item.previewImage}" class="dev-tree-thumb-img" alt="${item.name}" loading="lazy" />
                </div>
                <div class="dev-tree-card-title">${item.name}</div>
                <div class="dev-tree-card-meta">
                    <span class="dev-tree-card-tag">${item.category}</span>
                    <button class="dev-tree-card-toggle ${isSelected ? 'active' : ''}">${isSelected ? '[ ON ]' : '[ OFF ]'}</button>
                </div>
            `;
            card.addEventListener('click', () => {
                this.inspectedModelId = item.id;
                this.refreshUI();
            });
            const toggleBtn = card.querySelector('.dev-tree-card-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.inspectedModelId = item.id;
                    this.trees.toggleBiomeTreeModel(this.activeBiomeId, item.id);
                    this.refreshUI();
                });
            }
            container.appendChild(card);
        });
    }

    private renderModelInspector() {
        if (!this.inspectedModelId) return;
        const item = TREE_CATALOG.find(t => t.id === this.inspectedModelId) || TREE_CATALOG[0];
        if (!item) return;

        const mCfg = this.trees.getModelConfig(this.activeBiomeId, item.id);
        const veg = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation;
        const isEnabled = (veg.selectedTreeModelIds || []).includes(item.id);

        const imgEl = document.getElementById('dev-inspector-img') as HTMLImageElement | null;
        if (imgEl) imgEl.src = item.previewImage;

        const titleEl = document.getElementById('dev-inspector-title');
        if (titleEl) titleEl.textContent = item.name;

        const catEl = document.getElementById('dev-inspector-cat');
        if (catEl) catEl.textContent = `${item.category} - ${item.description}`;

        const toggleBtn = document.getElementById('dev-inspector-toggle-btn');
        if (toggleBtn) {
            toggleBtn.textContent = isEnabled ? 'Active in Biome' : 'Disabled: Click to Enable';
            toggleBtn.classList.toggle('active', isEnabled);
        }

        this.setSliderAndLabel('dev-model-scale', 'dev-model-scale-val', mCfg.scale, 'x');
        const scaleNum = document.getElementById('dev-model-scale-num') as HTMLInputElement | null;
        if (scaleNum) scaleNum.value = mCfg.scale.toFixed(1);

        this.setSliderAndLabel('dev-model-density', 'dev-model-density-val', mCfg.density, '');
        const densNum = document.getElementById('dev-model-density-num') as HTMLInputElement | null;
        if (densNum) densNum.value = mCfg.density.toString();

        const curBio = mCfg.bioluminescence !== undefined ? Math.round(mCfg.bioluminescence * 100) : 80;
        this.setSliderAndLabel('dev-model-biolum', 'dev-model-biolum-val', curBio, '%');
        const biolumNum = document.getElementById('dev-model-biolum-num') as HTMLInputElement | null;
        if (biolumNum) biolumNum.value = curBio.toString();

        const isOrig = (mCfg.useOriginalColors || mCfg.activePreset === 'original');
        const origBtn = document.getElementById('dev-model-orig-btn');
        const custBtn = document.getElementById('dev-model-custom-btn');
        if (origBtn) origBtn.classList.toggle('active', isOrig);
        if (custBtn) custBtn.classList.toggle('active', !isOrig);

        const customWrap = document.getElementById('dev-model-custom-colors-wrap');
        if (customWrap) {
            customWrap.style.display = isOrig ? 'none' : 'flex';
        }

        const isFlower = item.id.includes('flower') || item.id.includes('clover') || item.id.includes('bush');
        const isCastle = item.id.includes('castle');
        const isShip = item.id.includes('ship') || item.id.includes('boat') || item.id.includes('galleon');

        const canopyLbl = document.getElementById('dev-model-canopy-label');
        const leafLbl = document.getElementById('dev-model-leaf-label');
        const trunkLbl = document.getElementById('dev-model-trunk-label');

        if (isFlower) {
            if (canopyLbl) canopyLbl.textContent = 'Flower / Blossom Colors';
            if (leafLbl) leafLbl.textContent = 'Leaf Colors';
            if (trunkLbl) trunkLbl.textContent = 'Stem / Stalk Colors';
        } else if (isCastle) {
            if (canopyLbl) canopyLbl.textContent = 'Roof & Spire Colors';
            if (leafLbl) leafLbl.textContent = 'Accent & Trim Colors';
            if (trunkLbl) trunkLbl.textContent = 'Building & Wall Colors';
        } else if (isShip) {
            if (canopyLbl) canopyLbl.textContent = 'Sails & Accents';
            if (leafLbl) leafLbl.textContent = 'Cabin & Trim';
            if (trunkLbl) trunkLbl.textContent = 'Hull & Deck';
        } else {
            if (canopyLbl) canopyLbl.textContent = 'Canopy Colors';
            if (leafLbl) leafLbl.textContent = 'Leaf / Accent Colors';
            if (trunkLbl) trunkLbl.textContent = 'Trunk / Bark Colors';
        }

        if (!mCfg.leafColors || mCfg.leafColors.length === 0) {
            mCfg.leafColors = ['#22c55e', '#16a34a', '#15803d', '#4ade80', '#10b981'];
        }

        this.renderModelCanopySwatches(mCfg.canopyColors);
        this.renderModelLeafSwatches(mCfg.leafColors);
        this.renderModelTrunkSwatches(mCfg.trunkColors);

        const presetBtns = document.querySelectorAll('.dev-model-preset-btn');
        presetBtns.forEach(btn => {
            const pKey = btn.getAttribute('data-preset');
            btn.classList.toggle('active', pKey === mCfg.activePreset);
        });
    }

    private renderModelCanopySwatches(colors: string[]) {
        const container = document.getElementById('dev-model-canopy-swatches');
        if (!container || !this.inspectedModelId) return;
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
                if (this.inspectedModelId) {
                    const mCfg = this.trees.getModelConfig(this.activeBiomeId, this.inspectedModelId);
                    mCfg.canopyColors[idx] = newHex;
                    this.trees.setModelCanopyColors(this.activeBiomeId, this.inspectedModelId, mCfg.canopyColors);
                }
            });

            swatch.appendChild(picker);
            container.appendChild(swatch);
        });
    }

    private renderModelLeafSwatches(colors: string[]) {
        const container = document.getElementById('dev-model-leaf-swatches');
        if (!container || !this.inspectedModelId) return;
        container.innerHTML = '';

        colors.forEach((hex, idx) => {
            const swatch = document.createElement('div');
            swatch.className = 'dev-color-chip';
            swatch.style.backgroundColor = hex;
            swatch.title = `Leaf Color ${idx + 1}: ${hex} (Click to change)`;

            const picker = document.createElement('input');
            picker.type = 'color';
            picker.value = hex;
            picker.className = 'dev-chip-picker';
            picker.addEventListener('input', (e) => {
                const newHex = (e.target as HTMLInputElement).value;
                swatch.style.backgroundColor = newHex;
                if (this.inspectedModelId) {
                    const mCfg = this.trees.getModelConfig(this.activeBiomeId, this.inspectedModelId);
                    if (!mCfg.leafColors) mCfg.leafColors = ['#22c55e', '#16a34a', '#15803d', '#4ade80', '#10b981'];
                    mCfg.leafColors[idx] = newHex;
                    this.trees.setModelLeafColors(this.activeBiomeId, this.inspectedModelId, mCfg.leafColors);
                }
            });

            swatch.appendChild(picker);
            container.appendChild(swatch);
        });
    }

    private renderModelTrunkSwatches(colors: string[]) {
        const container = document.getElementById('dev-model-trunk-swatches');
        if (!container || !this.inspectedModelId) return;
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
                if (this.inspectedModelId) {
                    const mCfg = this.trees.getModelConfig(this.activeBiomeId, this.inspectedModelId);
                    mCfg.trunkColors[idx] = newHex;
                    this.trees.setModelTrunkColors(this.activeBiomeId, this.inspectedModelId, mCfg.trunkColors);
                }
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

    public showPlacementHUD(msg: string) {
        const hud = document.getElementById('dev-placement-hud');
        const text = document.getElementById('dev-placement-hud-text');
        if (hud) hud.style.display = 'flex';
        if (text) text.textContent = msg;
    }

    public hidePlacementHUD() {
        const hud = document.getElementById('dev-placement-hud');
        if (hud) hud.style.display = 'none';
    }

    private renderPropCatalog() {
        const container = document.getElementById('dev-prop-catalog-grid');
        if (!container) return;
        container.innerHTML = '';

        const filterCat = this.selectedPropCategory.toLowerCase();
        const search = this.propSearchQuery.toLowerCase();

        const filteredList = WORLD_PROP_CATALOG.filter((item) => {
            const itemCat = item.category.toLowerCase();
            const itemName = item.name.toLowerCase();
            const matchCat = filterCat === 'all' || itemCat === filterCat || (filterCat.includes('castle') && itemCat.includes('castle')) || (filterCat.includes('ship') && (itemCat.includes('ship') || itemCat.includes('vessel')));
            const matchSearch = !search || itemName.includes(search) || itemCat.includes(search) || item.description.toLowerCase().includes(search);
            return matchCat && matchSearch;
        });

        filteredList.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'dev-tree-card';
            card.title = `${item.name} (${item.category})\nClick to enter manual placement mode`;
            card.innerHTML = `
                <div class="dev-tree-thumb-box">
                    <img src="${item.previewImage}" alt="${item.name}" class="dev-tree-thumb-img" onerror="this.style.display='none'" />
                </div>
                <div class="dev-tree-card-title">${item.name}</div>
                <div class="dev-tree-card-meta">${item.category}</div>
                <button class="dev-btn dev-prop-place-btn" style="margin-top: 4px; width: 100%; font-size: 9.5px; font-weight: 800;">[ PLACE IN WORLD ]</button>
            `;

            const startPlace = () => {
                this.worldProps.startPlacement(item.id);
                this.showPlacementHUD(`PLACEMENT MODE: CLICK TERRAIN/WATER TO PLACE ${item.name.toUpperCase()} | ESC TO CANCEL`);
                this.showStatus(`Placing ${item.name}. Click in 3D viewport to place.`);
            };

            card.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                startPlace();
            });

            const placeBtn = card.querySelector('.dev-prop-place-btn');
            if (placeBtn) {
                placeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startPlace();
                });
            }

            container.appendChild(card);
        });
    }

    public nudgeSelectedProp(dx: number, dz: number) {
        if (this.worldProps.isPlacing) {
            this.worldProps.nudgeGhostPosition(dx, dz);
        } else if (this.worldProps.selectedPropId) {
            this.worldProps.nudgePropPosition(this.worldProps.selectedPropId, dx, dz);
            this.renderPlacedPropsList();
            this.renderPlacedPropInspector();
        }
    }

    public nudgeSelectedPropElevation(deltaM: number) {
        if (this.worldProps.isPlacing) {
            this.worldProps.nudgeGhostElevation(deltaM);
        } else if (this.worldProps.selectedPropId) {
            this.worldProps.nudgePropElevation(this.worldProps.selectedPropId, deltaM);
            this.renderPlacedPropInspector();
        }
    }

    public nudgeSelectedPropScale(deltaScale: number) {
        if (this.worldProps.isPlacing) {
            this.worldProps.nudgeGhostScale(deltaScale);
        } else if (this.worldProps.selectedPropId) {
            this.worldProps.nudgePropScale(this.worldProps.selectedPropId, deltaScale);
            this.renderPlacedPropInspector();
        }
    }

    public nudgeSelectedPropRotation(deltaDeg: number) {
        if (this.worldProps.isPlacing) {
            this.worldProps.nudgeGhostRotation(deltaDeg);
        } else if (this.worldProps.selectedPropId) {
            this.worldProps.nudgePropRotation(this.worldProps.selectedPropId, deltaDeg);
            this.renderPlacedPropInspector();
        }
    }

    private renderPlacedPropsList() {
        const container = document.getElementById('dev-placed-props-list');
        const countEl = document.getElementById('dev-placed-props-count');
        if (!container) return;
        container.innerHTML = '';

        const placed = this.worldProps.getPlacedProps();
        if (countEl) {
            countEl.textContent = `${placed.length} PLACED`;
        }

        if (placed.length === 0) {
            container.innerHTML = `<div style="font-size: 10px; color: #555555; text-align: center; padding: 8px;">No objects placed yet. Select a model above to place in the world.</div>`;
            return;
        }

        placed.forEach((prop) => {
            const isSelected = prop.id === this.worldProps.selectedPropId;
            const item = document.createElement('div');
            item.className = `dev-placed-item ${isSelected ? 'active' : ''}`;
            const x = Math.round(prop.position[0]);
            const y = Math.round(prop.position[1]);
            const z = Math.round(prop.position[2]);
            item.innerHTML = `
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                    <span>${prop.name}</span>
                    <span style="font-size: 9px; opacity: 0.7; margin-left: 4px;">(${x}, ${y}, ${z})</span>
                </div>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <button class="dev-placed-item-del" title="Delete object">[ DEL ]</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).classList.contains('dev-placed-item-del')) return;
                this.worldProps.selectProp(prop.id);
                this.renderPlacedPropsList();
                this.renderPlacedPropInspector();
            });

            const delBtn = item.querySelector('.dev-placed-item-del');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.worldProps.deleteProp(prop.id);
                    this.renderPlacedPropsList();
                    this.renderPlacedPropInspector();
                    this.showStatus(`Deleted ${prop.name}`);
                });
            }

            container.appendChild(item);
        });
    }

    private renderPlacedPropInspector() {
        const inspector = document.getElementById('dev-prop-inspector');
        if (!inspector) return;

        const prop = this.worldProps.getSelectedProp();
        if (!prop) {
            inspector.style.display = 'none';
            return;
        }

        inspector.style.display = 'flex';

        const catalogItem = WORLD_PROP_CATALOG.find(i => i.id === prop.modelId);
        const imgEl = document.getElementById('dev-prop-inspector-img') as HTMLImageElement | null;
        const titleEl = document.getElementById('dev-prop-inspector-title');
        const catEl = document.getElementById('dev-prop-inspector-cat');

        if (imgEl && catalogItem) {
            imgEl.src = catalogItem.previewImage;
            imgEl.style.display = 'block';
        } else if (imgEl) {
            imgEl.style.display = 'none';
        }

        if (titleEl) titleEl.textContent = prop.name;
        if (catEl) catEl.textContent = catalogItem ? `${catalogItem.category} | Scale: ${prop.scale.toFixed(2)}x` : `Custom Structure`;

        this.setSliderAndLabel('dev-prop-scale', 'dev-prop-scale-val', prop.scale, 'x');
        const scaleNum = document.getElementById('dev-prop-scale-num') as HTMLInputElement | null;
        if (scaleNum) scaleNum.value = prop.scale.toString();

        this.setSliderAndLabel('dev-prop-offset', 'dev-prop-offset-val', prop.groundOffset, 'm');
        const offsetNum = document.getElementById('dev-prop-offset-num') as HTMLInputElement | null;
        if (offsetNum) offsetNum.value = prop.groundOffset.toString();

        const yawDeg = Math.round((prop.rotation[1] * (180 / Math.PI)) % 360);
        const normYaw = yawDeg < 0 ? yawDeg + 360 : yawDeg;
        this.setSliderAndLabel('dev-prop-yaw', 'dev-prop-yaw-val', normYaw, ' deg');
    }

    public renderCastleArchipelagoEditor() {
        if (!this.skyCastles) return;
        const islands = this.skyCastles.getIslands();
        if (islands.length === 0) return;

        if (!this.selectedCastleIslandId || !islands.some(i => i.id === this.selectedCastleIslandId)) {
            this.selectedCastleIslandId = islands[0].id;
        }

        const tagEl = document.getElementById('dev-castles-count-tag');
        if (tagEl) tagEl.textContent = `${islands.length} ISLANDS`;

        // 1. Populate Island Chips Strip
        const chipsContainer = document.getElementById('dev-castle-island-chips');
        if (chipsContainer) {
            chipsContainer.innerHTML = '';
            islands.forEach((isl, idx) => {
                const chip = document.createElement('button');
                const isSelected = isl.id === this.selectedCastleIslandId;
                chip.className = `dev-island-chip ${isSelected ? 'active' : ''}`;
                chip.innerHTML = `
                    <span class="chip-num">${idx + 1}</span>
                    <span class="chip-name">${isl.name}</span>
                    ${isl.locked ? '<span class="chip-lock-tag">[LOCK]</span>' : ''}
                `;
                chip.addEventListener('click', () => {
                    this.selectedCastleIslandId = isl.id;
                    this.renderCastleArchipelagoEditor();
                });
                chipsContainer.appendChild(chip);
            });
        }

        // 2. Island Select Dropdown (for fallback sync)
        const islandSelect = document.getElementById('dev-castle-island-select') as HTMLSelectElement | null;
        if (islandSelect) {
            islandSelect.innerHTML = '';
            islands.forEach((isl, idx) => {
                const opt = document.createElement('option');
                opt.value = isl.id;
                opt.textContent = `${idx + 1}. ${isl.name}`;
                if (isl.id === this.selectedCastleIslandId) opt.selected = true;
                islandSelect.appendChild(opt);
            });
        }

        const currentIsland = this.skyCastles.getIsland(this.selectedCastleIslandId);
        if (!currentIsland) return;

        // 3. Populate Visual 3D Castle Model Card Grid
        const modelGrid = document.getElementById('dev-castle-model-grid');
        if (modelGrid) {
            modelGrid.innerHTML = '';
            CASTLE_MODEL_CATALOG.forEach((cat) => {
                const isCurrent = cat.path === currentIsland.modelPath;
                const card = document.createElement('div');
                card.className = `castle-model-card ${isCurrent ? 'active' : ''}`;
                card.setAttribute('data-path', cat.path);
                card.draggable = true;

                const thumbWrap = document.createElement('div');
                thumbWrap.className = 'castle-model-thumb-wrap';

                const img = document.createElement('img');
                img.className = 'castle-model-thumb';
                img.alt = cat.name;
                img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%231e293b"/></svg>';

                ThumbnailGenerator.getModelThumbnail(cat.path).then(dataUrl => {
                    img.src = dataUrl;
                });

                thumbWrap.appendChild(img);

                const info = document.createElement('div');
                info.className = 'castle-model-card-info';
                info.innerHTML = `
                    <div class="castle-model-card-name">${cat.name.split(' (')[0]}</div>
                    <div class="castle-model-card-tag">Drag to Place</div>
                `;

                card.appendChild(thumbWrap);
                card.appendChild(info);

                card.addEventListener('dragstart', (e) => {
                    (window as any).__draggedCastleModel = cat.path;
                    if (e.dataTransfer) {
                        e.dataTransfer.setData('text/plain', cat.path);
                        e.dataTransfer.effectAllowed = 'copy';
                    }
                    card.classList.add('dragging');
                    this.showStatus(`Drag & drop ${cat.name.split(' (')[0]} onto the world to place`);
                });

                card.addEventListener('dragend', () => {
                    (window as any).__draggedCastleModel = null;
                    card.classList.remove('dragging');
                });

                card.addEventListener('click', async () => {
                    if (this.selectedCastleIslandId && this.skyCastles) {
                        await this.skyCastles.setIslandModel(this.selectedCastleIslandId, cat.path);
                        this.renderCastleArchipelagoEditor();
                        this.showStatus(`Changed to ${cat.name.split(' (')[0]}`);
                    }
                });

                modelGrid.appendChild(card);
            });
        }

        const modelSelect = document.getElementById('dev-castle-model-select') as HTMLSelectElement | null;
        if (modelSelect) {
            modelSelect.value = currentIsland.modelPath;
        }

        // 3. Transform inputs
        this.setSliderAndLabel('dev-castle-x', 'dev-castle-x-val', currentIsland.x, 'm');
        const numX = document.getElementById('dev-castle-x-num') as HTMLInputElement | null;
        if (numX) numX.value = String(currentIsland.x);

        this.setSliderAndLabel('dev-castle-y', 'dev-castle-y-val', currentIsland.y, 'm');
        const numY = document.getElementById('dev-castle-y-num') as HTMLInputElement | null;
        if (numY) numY.value = String(currentIsland.y);

        this.setSliderAndLabel('dev-castle-z', 'dev-castle-z-val', currentIsland.z, 'm');
        const numZ = document.getElementById('dev-castle-z-num') as HTMLInputElement | null;
        if (numZ) numZ.value = String(currentIsland.z);

        const degRot = Math.round(((THREE.MathUtils.radToDeg(currentIsland.rotationY) % 360) + 360) % 360);
        this.setSliderAndLabel('dev-castle-rot', 'dev-castle-rot-val', degRot, ' deg');
        const numRot = document.getElementById('dev-castle-rot-num') as HTMLInputElement | null;
        if (numRot) numRot.value = String(degRot);

        this.setSliderAndLabel('dev-castle-scale', 'dev-castle-scale-val', currentIsland.scale, 'x');
        const numScale = document.getElementById('dev-castle-scale-num') as HTMLInputElement | null;
        if (numScale) numScale.value = String(currentIsland.scale);

        this.setSliderAndLabel('dev-castle-cldrad', 'dev-castle-cldrad-val', currentIsland.cloudRadius, 'm');
        const numCldRad = document.getElementById('dev-castle-cldrad-num') as HTMLInputElement | null;
        if (numCldRad) numCldRad.value = String(currentIsland.cloudRadius);

        this.setSliderAndLabel('dev-castle-puffs', 'dev-castle-puffs-val', currentIsland.cloudPuffCount, '');
        const numPuffs = document.getElementById('dev-castle-puffs-num') as HTMLInputElement | null;
        if (numPuffs) numPuffs.value = String(currentIsland.cloudPuffCount);

        // 4. Lock and Top View State Controls
        const isLocked = currentIsland.locked ?? false;
        const lockBadge = document.getElementById('dev-castle-lock-badge');
        if (lockBadge) {
            lockBadge.textContent = isLocked ? 'LOCKED' : 'UNLOCKED';
            lockBadge.style.background = isLocked ? '#ef4444' : '#22c55e';
            lockBadge.style.color = isLocked ? '#ffffff' : '#000000';
        }

        const lockItemBtn = document.getElementById('dev-castle-lock-item-btn');
        if (lockItemBtn) {
            lockItemBtn.textContent = isLocked ? 'Locked: On' : 'Lock: Off';
            lockItemBtn.style.background = isLocked ? '#ef4444' : '#0284c7';
        }

        const lockAllBtn = document.getElementById('dev-castle-lock-all-btn');
        if (lockAllBtn && this.skyCastles) {
            const allLocked = this.skyCastles.areAllIslandsLocked();
            lockAllBtn.textContent = allLocked ? 'Unlock All' : 'Lock All';
            lockAllBtn.style.background = allLocked ? '#ef4444' : '#eab308';
            lockAllBtn.style.color = allLocked ? '#ffffff' : '#000000';
        }

        const topViewBtn = document.getElementById('dev-castle-top-view-btn');
        if (topViewBtn && this.topViewController) {
            topViewBtn.textContent = this.topViewController.isActive ? '3D Exploration View' : 'Top-Down Blueprint';
            topViewBtn.style.background = this.topViewController.isActive ? '#10b981' : '#4f46e5';
        }

        // Disable transform sliders and numeric inputs when locked
        const transformInputs = [
            'dev-castle-x', 'dev-castle-x-num',
            'dev-castle-y', 'dev-castle-y-num',
            'dev-castle-z', 'dev-castle-z-num',
            'dev-castle-rot', 'dev-castle-rot-num',
            'dev-castle-scale', 'dev-castle-scale-num',
            'dev-castle-cldrad', 'dev-castle-cldrad-num',
            'dev-castle-puffs', 'dev-castle-puffs-num'
        ];
        transformInputs.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (el) el.disabled = isLocked;
        });

        // 5. Color Controls
        const colors = currentIsland.colors || { preset: 'ruby', roofColor: '#e11d48', wallColor: '#fdf2f8', trimColor: '#f59e0b', crystalColor: '#ec4899', crystalBloom: 0.6 };
        const activePreset = colors.preset || 'custom';
        const presetBtns = document.querySelectorAll('.dev-castle-color-preset-btn');
        presetBtns.forEach(btn => {
            const pKey = btn.getAttribute('data-preset');
            btn.classList.toggle('active', pKey === activePreset);
        });

        this.setInputValueAndHex('dev-castle-roof', 'dev-castle-roof-hex', colors.roofColor || '#e11d48');
        this.setInputValueAndHex('dev-castle-wall', 'dev-castle-wall-hex', colors.wallColor || '#fdf2f8');
        this.setInputValueAndHex('dev-castle-trim', 'dev-castle-trim-hex', colors.trimColor || '#f59e0b');
        this.setInputValueAndHex('dev-castle-crystal', 'dev-castle-crystal-hex', colors.crystalColor || '#ec4899');
        this.setSliderAndLabel('dev-castle-crystal-bloom', 'dev-castle-crystal-bloom-val', colors.crystalBloom !== undefined ? colors.crystalBloom : 0.6, '');

        // 6. Layer Fog Deck Controls
        const fogToggleBtn = document.getElementById('dev-layer-fog-toggle');
        if (fogToggleBtn) {
            fogToggleBtn.textContent = this.skyCastles.layerFogEnabled ? 'Cloud Sea Deck: Enabled' : 'Cloud Sea Deck: Disabled';
            fogToggleBtn.classList.toggle('active', this.skyCastles.layerFogEnabled);
        }
        this.setSliderAndLabel('dev-layer-fog-alt', 'dev-layer-fog-alt-val', this.skyCastles.layerFogAltitude, 'm');
        const numFogAlt = document.getElementById('dev-layer-fog-alt-num') as HTMLInputElement | null;
        if (numFogAlt) numFogAlt.value = String(this.skyCastles.layerFogAltitude);

        this.setSliderAndLabel('dev-layer-fog-density', 'dev-layer-fog-density-val', this.skyCastles.layerFogDensity, '');

        if (this.topViewController && this.topViewController.isActive) {
            this.topViewController.refreshInspector(this.selectedCastleIslandId || undefined);
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

        // Top Tab Navigation Bar
        const tabBtns = document.querySelectorAll('.dev-tab-btn');
        tabBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab');
                if (tab) this.switchTab(tab);
            });
        });

        // Teleport Button
        const tpBtn = document.getElementById('dev-biome-tp-btn');
        if (tpBtn) {
            tpBtn.addEventListener('click', () => this.teleportToActiveBiome());
        }

        // ── TAB 1: Models Catalog, Search, Categories & Batch Buttons ───────────
        const searchInp = document.getElementById('dev-tree-search') as HTMLInputElement | null;
        if (searchInp) {
            searchInp.addEventListener('input', () => {
                this.modelSearchQuery = searchInp.value.trim().toLowerCase();
                const veg = globalConfigManager.getBiomeConfig(this.activeBiomeId).vegetation;
                this.renderTreeModelSelector(veg.selectedTreeModelIds || []);
            });
        }

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
                        this.inspectedModelId = loadedItem.id;
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
                this.showStatus(`Selected ${merged.length} models for ${this.activeBiomeId}`);
            });
        }

        const clearTreesBtn = document.getElementById('dev-clear-trees-btn');
        if (clearTreesBtn) {
            clearTreesBtn.addEventListener('click', () => {
                this.trees.setBiomeTreeModels(this.activeBiomeId, []);
                this.refreshUI();
                this.showStatus(`Cleared all models for ${this.activeBiomeId} (0 models active)`);
            });
        }

        // ── Model Inspector Controls ──────────────────────────────────────────
        const inspToggle = document.getElementById('dev-inspector-toggle-btn');
        if (inspToggle) {
            inspToggle.addEventListener('click', () => {
                if (this.inspectedModelId) {
                    this.trees.toggleBiomeTreeModel(this.activeBiomeId, this.inspectedModelId);
                    this.refreshUI();
                }
            });
        }

        const scaleInp = document.getElementById('dev-model-scale') as HTMLInputElement | null;
        const scaleNum = document.getElementById('dev-model-scale-num') as HTMLInputElement | null;
        const scaleVal = document.getElementById('dev-model-scale-val');
        if (scaleInp) {
            scaleInp.addEventListener('input', () => {
                if (this.inspectedModelId) {
                    const v = parseFloat(scaleInp.value);
                    if (scaleVal) scaleVal.textContent = v.toFixed(2) + 'x';
                    if (scaleNum) scaleNum.value = v.toFixed(1);
                    this.trees.setModelScale(this.activeBiomeId, this.inspectedModelId, v);
                }
            });
        }
        if (scaleNum) {
            scaleNum.addEventListener('input', () => {
                if (this.inspectedModelId) {
                    const v = parseFloat(scaleNum.value);
                    if (!isNaN(v) && v > 0) {
                        if (scaleInp) scaleInp.value = v.toString();
                        if (scaleVal) scaleVal.textContent = v.toFixed(2) + 'x';
                        this.trees.setModelScale(this.activeBiomeId, this.inspectedModelId, v);
                    }
                }
            });
        }

        const densInp = document.getElementById('dev-model-density') as HTMLInputElement | null;
        const densNum = document.getElementById('dev-model-density-num') as HTMLInputElement | null;
        const densVal = document.getElementById('dev-model-density-val');
        if (densInp) {
            densInp.addEventListener('input', () => {
                if (this.inspectedModelId) {
                    const v = parseInt(densInp.value, 10);
                    if (densVal) densVal.textContent = v.toString();
                    if (densNum) densNum.value = v.toString();
                    this.trees.setModelDensity(this.activeBiomeId, this.inspectedModelId, v);
                }
            });
        }
        if (densNum) {
            densNum.addEventListener('input', () => {
                if (this.inspectedModelId) {
                    const v = parseInt(densNum.value, 10);
                    if (!isNaN(v) && v >= 0) {
                        if (densInp) densInp.value = v.toString();
                        if (densVal) densVal.textContent = v.toString();
                        this.trees.setModelDensity(this.activeBiomeId, this.inspectedModelId, v);
                    }
                }
            });
        }

        const origBtn = document.getElementById('dev-model-orig-btn');
        const custBtn = document.getElementById('dev-model-custom-btn');
        if (origBtn) {
            origBtn.addEventListener('click', () => {
                if (this.inspectedModelId) {
                    this.trees.setModelColorMode(this.activeBiomeId, this.inspectedModelId, true);
                    this.refreshUI();
                }
            });
        }
        if (custBtn) {
            custBtn.addEventListener('click', () => {
                if (this.inspectedModelId) {
                    this.trees.setModelColorMode(this.activeBiomeId, this.inspectedModelId, false);
                    this.refreshUI();
                }
            });
        }

        const modelPresetBtns = document.querySelectorAll('.dev-model-preset-btn');
        modelPresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pKey = (e.currentTarget as HTMLElement).getAttribute('data-preset');
                if (pKey && this.inspectedModelId) {
                    this.trees.applyModelPreset(this.activeBiomeId, this.inspectedModelId, pKey);
                    this.refreshUI();
                }
            });
        });

        // Global Bush Sliders
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

        bindSlider('dev-veg-bush-scale', 'dev-veg-bush-scale-val', (v) => this.trees.setBiomeBushScale(this.activeBiomeId, v));
        bindSlider('dev-veg-bush-density', 'dev-veg-bush-density-val', (v) => this.trees.setBiomeBushDensity(this.activeBiomeId, v));

        // ── TAB 2: Atmosphere & Lighting Inputs ────────────────────────────────
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

        // Bioluminescence Inputs
        const biolumInp = document.getElementById('dev-model-biolum') as HTMLInputElement | null;
        const biolumNum = document.getElementById('dev-model-biolum-num') as HTMLInputElement | null;
        const biolumVal = document.getElementById('dev-model-biolum-val');
        if (biolumInp) {
            biolumInp.addEventListener('input', () => {
                const v = parseInt(biolumInp.value, 10);
                if (biolumVal) biolumVal.textContent = v.toString() + '%';
                if (biolumNum) biolumNum.value = v.toString();
                this.trees.setBioluminescence(v / 100.0, this.activeBiomeId);
            });
        }
        if (biolumNum) {
            biolumNum.addEventListener('input', () => {
                const v = parseInt(biolumNum.value, 10);
                if (!isNaN(v) && v >= 0 && v <= 100) {
                    if (biolumInp) biolumInp.value = v.toString();
                    if (biolumVal) biolumVal.textContent = v.toString() + '%';
                    this.trees.setBioluminescence(v / 100.0, this.activeBiomeId);
                }
            });
        }

        // Quick Settings Bioluminescence Slider
        const quickBioSlider = document.getElementById('bioluminescence-slider') as HTMLInputElement | null;
        const quickBioVal = document.getElementById('bioluminescence-val');
        if (quickBioSlider) {
            quickBioSlider.addEventListener('input', () => {
                const v = parseInt(quickBioSlider.value, 10);
                if (quickBioVal) quickBioVal.textContent = v.toString() + '%';
                if (biolumInp) biolumInp.value = v.toString();
                if (biolumVal) biolumVal.textContent = v.toString() + '%';
                if (biolumNum) biolumNum.value = v.toString();
                this.trees.setBioluminescence(v / 100.0, this.activeBiomeId);
            });
        }

        // ── TAB 4: Terrain & Water Inputs ──────────────────────────────────────
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
                const bCfg = globalConfigManager.getBiomeConfig(this.activeBiomeId).terrain;
                const currentStyle = bCfg.terrainStyle || (bCfg.isCrystalMode ? 'crystal' : (bCfg.isToonMode ?? true ? 'toon' : 'standard'));
                let nextStyle: 'toon' | 'standard' | 'crystal' = 'toon';
                if (currentStyle === 'toon') nextStyle = 'standard';
                else if (currentStyle === 'standard') nextStyle = 'crystal';
                else nextStyle = 'toon';

                this.terrain.setTerrainStyle(nextStyle, this.activeBiomeId);
                this.refreshUI();
            });
        }

        bindSlider('dev-crystal-transmission', 'dev-crystal-transmission-val', (v) => this.terrain.setCrystalParams({ glassTransmission: v }, this.activeBiomeId));
        bindSlider('dev-crystal-iridescence', 'dev-crystal-iridescence-val', (v) => this.terrain.setCrystalParams({ iridescence: v }, this.activeBiomeId));
        bindSlider('dev-crystal-specular', 'dev-crystal-specular-val', (v) => this.terrain.setCrystalParams({ specularGlint: v }, this.activeBiomeId));
        bindSlider('dev-crystal-bevel', 'dev-crystal-bevel-val', (v) => this.terrain.setCrystalParams({ bevelGleam: v }, this.activeBiomeId));
        bindSlider('dev-crystal-vein', 'dev-crystal-vein-val', (v) => this.terrain.setCrystalParams({ veinGlow: v }, this.activeBiomeId));

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

        // ── TAB 5: Profile & Persistence Actions ───────────────────────────────
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

        const exportBtn = document.getElementById('dev-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const json = globalConfigManager.exportJSON();
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `biome_config_${this.activeBiomeId}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showStatus('Exported JSON configuration file');
            });
        }

        const importInput = document.getElementById('dev-import-input') as HTMLInputElement | null;
        const importBtn = document.getElementById('dev-import-btn');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => {
                importInput.click();
            });
            importInput.addEventListener('change', async () => {
                if (importInput.files && importInput.files.length > 0) {
                    const text = await importInput.files[0].text();
                    const success = globalConfigManager.importJSON(text);
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
                        this.showStatus('Imported JSON configuration successfully');
                    } else {
                        this.showStatus('Failed to import JSON config', true);
                    }
                    importInput.value = '';
                }
            });
        }

        // ── TAB 2: World Props Interactive Placement & Controls ────────────────
        const propSearchInp = document.getElementById('dev-prop-search') as HTMLInputElement | null;
        if (propSearchInp) {
            propSearchInp.addEventListener('input', () => {
                this.propSearchQuery = propSearchInp.value.trim().toLowerCase();
                this.renderPropCatalog();
            });
        }

        const propCatBtns = document.querySelectorAll('.dev-prop-cat-btn');
        propCatBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') || 'all';
                this.selectedPropCategory = cat;
                propCatBtns.forEach(b => b.classList.remove('active'));
                (e.currentTarget as HTMLElement).classList.add('active');
                this.renderPropCatalog();
            });
        });

        // On-screen nudge buttons
        const btnNudgeN = document.getElementById('dev-prop-nudge-n');
        if (btnNudgeN) btnNudgeN.addEventListener('click', () => this.nudgeSelectedProp(0, -2.0));

        const btnNudgeS = document.getElementById('dev-prop-nudge-s');
        if (btnNudgeS) btnNudgeS.addEventListener('click', () => this.nudgeSelectedProp(0, 2.0));

        const btnNudgeW = document.getElementById('dev-prop-nudge-w');
        if (btnNudgeW) btnNudgeW.addEventListener('click', () => this.nudgeSelectedProp(-2.0, 0));

        const btnNudgeE = document.getElementById('dev-prop-nudge-e');
        if (btnNudgeE) btnNudgeE.addEventListener('click', () => this.nudgeSelectedProp(2.0, 0));

        const btnNudgeUp = document.getElementById('dev-prop-nudge-up');
        if (btnNudgeUp) btnNudgeUp.addEventListener('click', () => this.nudgeSelectedPropElevation(1.0));

        const btnNudgeDn = document.getElementById('dev-prop-nudge-dn');
        if (btnNudgeDn) btnNudgeDn.addEventListener('click', () => this.nudgeSelectedPropElevation(-1.0));

        const btnScaleDn = document.getElementById('dev-prop-scale-dn');
        if (btnScaleDn) btnScaleDn.addEventListener('click', () => this.nudgeSelectedPropScale(-0.2));

        const btnScaleUp = document.getElementById('dev-prop-scale-up');
        if (btnScaleUp) btnScaleUp.addEventListener('click', () => this.nudgeSelectedPropScale(0.2));

        window.addEventListener('pointermove', (e) => {
            if (this.worldProps.isPlacing) {
                this.worldProps.updatePlacementFromMouse(e.clientX, e.clientY, this.pipeline.camera);
            }
        });

        window.addEventListener('pointerdown', (e) => {
            const panel = document.getElementById('dev-editor-panel');
            const hud = document.getElementById('dev-placement-hud');
            const topBar = document.getElementById('top-bar');
            if (panel && panel.contains(e.target as Node)) return;
            if (hud && hud.contains(e.target as Node)) return;
            if (topBar && topBar.contains(e.target as Node)) return;

            if (this.worldProps.isPlacing) {
                const placed = this.worldProps.confirmPlacement();
                if (placed) {
                    this.hidePlacementHUD();
                    this.renderPlacedPropsList();
                    this.renderPlacedPropInspector();
                    this.showStatus(`Placed ${placed.name} in world!`);
                }
            } else if (this.isOpen && this.activeTab === 'tab-props') {
                const hitPropId = this.worldProps.raycastPlacedProps(e.clientX, e.clientY, this.pipeline.camera);
                if (hitPropId) {
                    this.worldProps.selectProp(hitPropId);
                    this.renderPlacedPropsList();
                    this.renderPlacedPropInspector();
                    const selected = this.worldProps.getSelectedProp();
                    if (selected) this.showStatus(`Selected ${selected.name}`);
                }
            } else if (this.isOpen && this.activeTab === 'tab-castles' && this.skyCastles) {
                const hitIslandId = this.skyCastles.raycastCastles(e.clientX, e.clientY, this.pipeline.camera);
                if (hitIslandId) {
                    this.selectedCastleIslandId = hitIslandId;
                    this.renderCastleArchipelagoEditor();
                    const isl = this.skyCastles.getIsland(hitIslandId);
                    if (isl) this.showStatus(`Selected ${isl.name}`);
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.worldProps.isPlacing) {
                this.worldProps.cancelPlacement();
                this.hidePlacementHUD();
                this.renderPlacedPropsList();
                this.renderPlacedPropInspector();
                this.showStatus('Placement cancelled');
                return;
            }

            if (!this.isOpen) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            if (this.activeTab === 'tab-props') {
                const hasTarget = this.worldProps.isPlacing || Boolean(this.worldProps.selectedPropId);
                if (!hasTarget) return;

                const step = e.shiftKey ? 10.0 : 2.0;
                const elevStep = e.shiftKey ? 5.0 : 1.0;
                const scaleStep = e.shiftKey ? 0.5 : 0.2;
                const rotStep = e.shiftKey ? 45 : 15;

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.nudgeSelectedProp(0, -step);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.nudgeSelectedProp(0, step);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.nudgeSelectedProp(-step, 0);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.nudgeSelectedProp(step, 0);
                } else if (e.key === 'PageUp') {
                    e.preventDefault();
                    this.nudgeSelectedPropElevation(elevStep);
                } else if (e.key === 'PageDown') {
                    e.preventDefault();
                    this.nudgeSelectedPropElevation(-elevStep);
                } else if (e.key === '[' || e.key === '-') {
                    e.preventDefault();
                    this.nudgeSelectedPropScale(-scaleStep);
                } else if (e.key === ']' || e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.nudgeSelectedPropScale(scaleStep);
                } else if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    this.nudgeSelectedPropRotation(e.shiftKey ? -rotStep : rotStep);
                } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.worldProps.selectedPropId && !this.worldProps.isPlacing) {
                    e.preventDefault();
                    const selected = this.worldProps.getSelectedProp();
                    if (selected) {
                        this.worldProps.deleteProp(selected.id);
                        this.renderPlacedPropsList();
                        this.renderPlacedPropInspector();
                        this.showStatus(`Deleted ${selected.name}`);
                    }
                } else if ((e.key === 'd' || e.key === 'D') && this.worldProps.selectedPropId && !this.worldProps.isPlacing && !e.ctrlKey) {
                    e.preventDefault();
                    const selected = this.worldProps.getSelectedProp();
                    if (selected) {
                        const dup = this.worldProps.duplicateProp(selected.id);
                        if (dup) {
                            this.renderPlacedPropsList();
                            this.renderPlacedPropInspector();
                            this.showStatus(`Duplicated ${dup.name}`);
                        }
                    }
                } else if ((e.key === 'f' || e.key === 'F') && this.worldProps.selectedPropId && this.player) {
                    e.preventDefault();
                    const selected = this.worldProps.getSelectedProp();
                    if (selected) {
                        this.player.teleportTo(selected.position[0], selected.position[2], selected.position[1] + 15);
                        this.showStatus(`Focused on ${selected.name}`);
                    }
                }
            }
        });

        const hudCancelBtn = document.getElementById('dev-placement-cancel-btn');
        if (hudCancelBtn) {
            hudCancelBtn.addEventListener('click', () => {
                this.worldProps.cancelPlacement();
                this.hidePlacementHUD();
                this.renderPlacedPropsList();
                this.renderPlacedPropInspector();
                this.showStatus('Placement cancelled');
            });
        }

        const moveBtn = document.getElementById('dev-prop-move-btn');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected) {
                    this.worldProps.startMoving(selected.id);
                    this.showPlacementHUD(`MOVING ${selected.name.toUpperCase()}: CLICK NEW LOCATION | ESC TO CANCEL`);
                    this.showStatus(`Moving ${selected.name}. Click new location in 3D viewport.`);
                }
            });
        }

        const propScaleSlider = document.getElementById('dev-prop-scale') as HTMLInputElement | null;
        const propScaleNum = document.getElementById('dev-prop-scale-num') as HTMLInputElement | null;
        const propScaleVal = document.getElementById('dev-prop-scale-val');
        const updatePropScale = (val: number) => {
            const selected = this.worldProps.getSelectedProp();
            if (!selected) return;
            this.worldProps.setPropScale(selected.id, val);
            if (propScaleSlider) propScaleSlider.value = val.toString();
            if (propScaleNum) propScaleNum.value = val.toString();
            if (propScaleVal) propScaleVal.textContent = val.toFixed(2) + 'x';
        };
        if (propScaleSlider) propScaleSlider.addEventListener('input', () => updatePropScale(parseFloat(propScaleSlider.value)));
        if (propScaleNum) propScaleNum.addEventListener('input', () => updatePropScale(parseFloat(propScaleNum.value) || 1.0));

        const propOffsetSlider = document.getElementById('dev-prop-offset') as HTMLInputElement | null;
        const propOffsetNum = document.getElementById('dev-prop-offset-num') as HTMLInputElement | null;
        const propOffsetVal = document.getElementById('dev-prop-offset-val');
        const updatePropOffset = (val: number) => {
            const selected = this.worldProps.getSelectedProp();
            if (!selected) return;
            this.worldProps.setPropGroundOffset(selected.id, val);
            if (propOffsetSlider) propOffsetSlider.value = val.toString();
            if (propOffsetNum) propOffsetNum.value = val.toString();
            if (propOffsetVal) propOffsetVal.textContent = val.toFixed(2) + 'm';
        };
        if (propOffsetSlider) propOffsetSlider.addEventListener('input', () => updatePropOffset(parseFloat(propOffsetSlider.value)));
        if (propOffsetNum) propOffsetNum.addEventListener('input', () => updatePropOffset(parseFloat(propOffsetNum.value) || 0.0));

        const snapGroundBtn = document.getElementById('dev-prop-snap-ground-btn');
        if (snapGroundBtn) {
            snapGroundBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected) {
                    this.worldProps.snapToGround(selected.id);
                    this.renderPlacedPropInspector();
                    this.showStatus(`Snapped ${selected.name} to ground surface`);
                }
            });
        }

        const snapWaterBtn = document.getElementById('dev-prop-snap-water-btn');
        if (snapWaterBtn) {
            snapWaterBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected) {
                    this.worldProps.snapToWater(selected.id);
                    this.renderPlacedPropInspector();
                    this.showStatus(`Snapped ${selected.name} to water level`);
                }
            });
        }

        const propYawSlider = document.getElementById('dev-prop-yaw') as HTMLInputElement | null;
        const propYawVal = document.getElementById('dev-prop-yaw-val');
        if (propYawSlider) {
            propYawSlider.addEventListener('input', () => {
                const selected = this.worldProps.getSelectedProp();
                if (!selected) return;
                const deg = parseFloat(propYawSlider.value);
                this.worldProps.setPropRotation(selected.id, deg);
                if (propYawVal) propYawVal.textContent = `${deg} deg`;
            });
        }

        const propTpBtn = document.getElementById('dev-prop-tp-btn');
        if (propTpBtn) {
            propTpBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected && this.player) {
                    this.player.teleportTo(selected.position[0], selected.position[2], selected.position[1] + 15);
                    const pos = this.player.playerGrp.position;
                    this.terrain.update(pos.x, pos.z);
                    if (this.trees) this.trees.update(pos.x, pos.z);
                    this.props.update(pos.x, pos.z, 0.016);
                    this.water.update(pos.x, pos.z, 0.016);
                    this.showStatus(`Teleported to ${selected.name}`);
                }
            });
        }

        const propDupBtn = document.getElementById('dev-prop-dup-btn');
        if (propDupBtn) {
            propDupBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected) {
                    const dup = this.worldProps.duplicateProp(selected.id);
                    if (dup) {
                        this.renderPlacedPropsList();
                        this.renderPlacedPropInspector();
                        this.showStatus(`Duplicated ${dup.name}`);
                    }
                }
            });
        }

        const propDelBtn = document.getElementById('dev-prop-del-btn');
        if (propDelBtn) {
            propDelBtn.addEventListener('click', () => {
                const selected = this.worldProps.getSelectedProp();
                if (selected) {
                    this.worldProps.deleteProp(selected.id);
                    this.renderPlacedPropsList();
                    this.renderPlacedPropInspector();
                    this.showStatus(`Deleted ${selected.name}`);
                }
            });
        }

        const clearPropsBtn = document.getElementById('dev-clear-props-btn');
        if (clearPropsBtn) {
            clearPropsBtn.addEventListener('click', () => {
                if (confirm('Remove all manually placed objects from the world?')) {
                    this.worldProps.clearAllProps();
                    this.renderPlacedPropsList();
                    this.renderPlacedPropInspector();
                    this.showStatus('Cleared all placed world objects');
                }
            });
        }

        const uploadPropBtn = document.getElementById('dev-upload-prop-btn');
        const propFileInput = document.getElementById('dev-prop-file-input') as HTMLInputElement | null;
        if (uploadPropBtn && propFileInput) {
            uploadPropBtn.addEventListener('click', () => propFileInput.click());
            propFileInput.addEventListener('change', async () => {
                if (propFileInput.files && propFileInput.files.length > 0) {
                    const file = propFileInput.files[0];
                    const buffer = await file.arrayBuffer();
                    try {
                        const item = await this.worldProps.loadCustomPropModel(file.name, buffer);
                        this.renderPropCatalog();
                        this.worldProps.startPlacement(item.id);
                        this.showPlacementHUD(`PLACEMENT MODE: CLICK TERRAIN/WATER TO PLACE ${item.name.toUpperCase()} | ESC TO CANCEL`);
                        this.showStatus(`Loaded ${item.name}. Click terrain to place.`);
                    } catch (err) {
                        console.error('Failed to parse custom structure GLB', err);
                        this.showStatus('Failed to load custom GLB file', true);
                    }
                    propFileInput.value = '';
                }
            });
        }

        // ── TAB: Sky Castles Archipelago Events ──────────────────────────────
        const castleIslandSelect = document.getElementById('dev-castle-island-select') as HTMLSelectElement | null;
        if (castleIslandSelect) {
            castleIslandSelect.addEventListener('change', () => {
                this.selectedCastleIslandId = castleIslandSelect.value;
                this.renderCastleArchipelagoEditor();
            });
        }

        const castleModelSelect = document.getElementById('dev-castle-model-select') as HTMLSelectElement | null;
        if (castleModelSelect) {
            castleModelSelect.addEventListener('change', async () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    await this.skyCastles.setIslandModel(this.selectedCastleIslandId, castleModelSelect.value);
                    this.renderCastleArchipelagoEditor();
                    this.showStatus('Castle model updated');
                }
            });
        }

        const bindCastleSliderAndNum = (sliderId: string, numId: string, labelId: string, unit: string, key: keyof SkyCastleIslandDef, isAngle = false) => {
            const slider = document.getElementById(sliderId) as HTMLInputElement | null;
            const num = document.getElementById(numId) as HTMLInputElement | null;
            const label = document.getElementById(labelId);

            const handleVal = (val: number) => {
                if (this.selectedCastleIslandId && this.skyCastles && this.skyCastles.isIslandLocked(this.selectedCastleIslandId)) {
                    this.showStatus('Castle is locked. Unlock to reposition.', true);
                    this.renderCastleArchipelagoEditor();
                    return;
                }
                if (label) label.textContent = `${val.toFixed(isAngle ? 0 : (unit === 'x' ? 2 : 0))}${unit}`;
                if (slider && parseFloat(slider.value) !== val) slider.value = String(val);
                if (num && parseFloat(num.value) !== val) num.value = String(val);
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const actualVal = isAngle ? THREE.MathUtils.degToRad(val) : val;
                    this.skyCastles.updateIsland(this.selectedCastleIslandId, { [key]: actualVal } as any);
                    if (this.topViewController && this.topViewController.isActive) {
                        this.topViewController.updateHUDMetrics(this.selectedCastleIslandId);
                    }
                }
            };

            if (slider) {
                slider.addEventListener('input', () => handleVal(parseFloat(slider.value)));
            }
            if (num) {
                num.addEventListener('input', () => {
                    const v = parseFloat(num.value);
                    if (!isNaN(v)) handleVal(v);
                });
            }
        };

        bindCastleSliderAndNum('dev-castle-x', 'dev-castle-x-num', 'dev-castle-x-val', 'm', 'x');
        bindCastleSliderAndNum('dev-castle-y', 'dev-castle-y-num', 'dev-castle-y-val', 'm', 'y');
        bindCastleSliderAndNum('dev-castle-z', 'dev-castle-z-num', 'dev-castle-z-val', 'm', 'z');
        bindCastleSliderAndNum('dev-castle-rot', 'dev-castle-rot-num', 'dev-castle-rot-val', ' deg', 'rotationY', true);
        bindCastleSliderAndNum('dev-castle-scale', 'dev-castle-scale-num', 'dev-castle-scale-val', 'x', 'scale');
        bindCastleSliderAndNum('dev-castle-cldrad', 'dev-castle-cldrad-num', 'dev-castle-cldrad-val', 'm', 'cloudRadius');
        bindCastleSliderAndNum('dev-castle-puffs', 'dev-castle-puffs-num', 'dev-castle-puffs-val', '', 'cloudPuffCount');

        // Castle Colors
        const bindCastleColor = (inpId: string, hexId: string, colorProp: keyof CastleColorSettings) => {
            const inp = document.getElementById(inpId) as HTMLInputElement | null;
            const hex = document.getElementById(hexId);
            if (inp) {
                inp.addEventListener('input', () => {
                    if (hex) hex.textContent = inp.value;
                    if (this.selectedCastleIslandId && this.skyCastles) {
                        const currentIsl = this.skyCastles.getIsland(this.selectedCastleIslandId);
                        const colors = currentIsl?.colors || {};
                        this.skyCastles.setIslandColors(this.selectedCastleIslandId, {
                            ...colors,
                            preset: 'custom',
                            [colorProp]: inp.value
                        });
                        const presetBtns = document.querySelectorAll('.dev-castle-color-preset-btn');
                        presetBtns.forEach(b => b.classList.remove('active'));
                    }
                });
            }
        };

        bindCastleColor('dev-castle-roof', 'dev-castle-roof-hex', 'roofColor');
        bindCastleColor('dev-castle-wall', 'dev-castle-wall-hex', 'wallColor');
        bindCastleColor('dev-castle-trim', 'dev-castle-trim-hex', 'trimColor');
        bindCastleColor('dev-castle-crystal', 'dev-castle-crystal-hex', 'crystalColor');

        const crystalBloomSlider = document.getElementById('dev-castle-crystal-bloom') as HTMLInputElement | null;
        const crystalBloomVal = document.getElementById('dev-castle-crystal-bloom-val');
        if (crystalBloomSlider) {
            crystalBloomSlider.addEventListener('input', () => {
                const v = parseFloat(crystalBloomSlider.value);
                if (crystalBloomVal) crystalBloomVal.textContent = v.toFixed(2);
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const currentIsl = this.skyCastles.getIsland(this.selectedCastleIslandId);
                    const colors = currentIsl?.colors || {};
                    this.skyCastles.setIslandColors(this.selectedCastleIslandId, {
                        ...colors,
                        crystalBloom: v
                    });
                }
            });
        }

        // Color Presets
        const castlePresetBtns = document.querySelectorAll('.dev-castle-color-preset-btn');
        castlePresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const pKey = btn.getAttribute('data-preset');
                if (pKey && this.selectedCastleIslandId && this.skyCastles) {
                    const preset = CASTLE_COLOR_PRESETS[pKey];
                    if (preset) {
                        this.skyCastles.setIslandColors(this.selectedCastleIslandId, { ...preset });
                        this.renderCastleArchipelagoEditor();
                        this.showStatus(`Applied color theme: ${pKey.toUpperCase()}`);
                    }
                }
            });
        });

        const applyAllColorsBtn = document.getElementById('dev-castle-apply-all-colors-btn');
        if (applyAllColorsBtn) {
            applyAllColorsBtn.addEventListener('click', () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const currentIsl = this.skyCastles.getIsland(this.selectedCastleIslandId);
                    if (currentIsl?.colors) {
                        const islands = this.skyCastles.getIslands();
                        islands.forEach(isl => {
                            this.skyCastles!.setIslandColors(isl.id, JSON.parse(JSON.stringify(currentIsl.colors)));
                        });
                        this.showStatus('Applied colors to all floating castle islands');
                    }
                }
            });
        }

        // Top View Toggle Button
        const castleTopViewBtn = document.getElementById('dev-castle-top-view-btn');
        if (castleTopViewBtn) {
            castleTopViewBtn.addEventListener('click', () => {
                if (this.topViewController) {
                    this.topViewController.toggleTopView();
                    this.renderCastleArchipelagoEditor();
                    this.showStatus(this.topViewController.isActive ? 'Entered Top-Down Blueprint View' : 'Returned to 3D Exploration View');
                }
            });
        }

        // Castle Island Locking Controls
        const castleLockItemBtn = document.getElementById('dev-castle-lock-item-btn');
        if (castleLockItemBtn) {
            castleLockItemBtn.addEventListener('click', () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const currentlyLocked = this.skyCastles.isIslandLocked(this.selectedCastleIslandId);
                    const nextLocked = !currentlyLocked;
                    this.skyCastles.setIslandLocked(this.selectedCastleIslandId, nextLocked);
                    this.renderCastleArchipelagoEditor();
                    if (this.topViewController && this.topViewController.isActive) {
                        this.topViewController.updateHUDMetrics(this.selectedCastleIslandId);
                    }
                    this.showStatus(nextLocked ? 'Castle transform locked' : 'Castle transform unlocked');
                }
            });
        }

        const castleLockAllBtn = document.getElementById('dev-castle-lock-all-btn');
        if (castleLockAllBtn) {
            castleLockAllBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    const allLocked = this.skyCastles.areAllIslandsLocked();
                    const nextLocked = !allLocked;
                    this.skyCastles.lockAllIslands(nextLocked);
                    this.renderCastleArchipelagoEditor();
                    if (this.topViewController && this.topViewController.isActive) {
                        this.topViewController.updateHUDMetrics(this.selectedCastleIslandId || undefined);
                    }
                    this.showStatus(nextLocked ? 'All castles locked' : 'All castles unlocked');
                }
            });
        }

        const topViewLockToggleBtn = document.getElementById('top-view-lock-toggle-btn');
        if (topViewLockToggleBtn) {
            topViewLockToggleBtn.addEventListener('click', () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const nextLocked = !this.skyCastles.isIslandLocked(this.selectedCastleIslandId);
                    this.skyCastles.setIslandLocked(this.selectedCastleIslandId, nextLocked);
                    this.renderCastleArchipelagoEditor();
                    if (this.topViewController) {
                        this.topViewController.updateHUDMetrics(this.selectedCastleIslandId);
                    }
                    this.showStatus(nextLocked ? 'Castle transform locked' : 'Castle transform unlocked');
                }
            });
        }

        // Island Actions (Focus, New, Del, Presets)
        const castleTpBtn = document.getElementById('dev-castle-tp-btn');
        if (castleTpBtn) {
            castleTpBtn.addEventListener('click', () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const isl = this.skyCastles.getIsland(this.selectedCastleIslandId);
                    if (isl) {
                        if (this.topViewController && this.topViewController.isActive) {
                            this.topViewController.focusOnCoordinates(isl.x, isl.z, isl.y);
                        } else if (this.player) {
                            this.player.teleportTo(isl.x, isl.z, 30, isl.y + 20);
                        }
                        this.showStatus(`Focused on ${isl.name}`);
                    }
                }
            });
        }

        const castleAddBtn = document.getElementById('dev-castle-add-btn');
        if (castleAddBtn) {
            castleAddBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    const newIsl = this.skyCastles.addIsland();
                    this.selectedCastleIslandId = newIsl.id;
                    this.renderCastleArchipelagoEditor();
                    if (this.topViewController && this.topViewController.isActive) {
                        this.topViewController.focusOnCoordinates(newIsl.x, newIsl.z, newIsl.y);
                    }
                    this.showStatus(`Created ${newIsl.name}`);
                }
            });
        }

        const castleDelBtn = document.getElementById('dev-castle-del-btn');
        if (castleDelBtn) {
            castleDelBtn.addEventListener('click', () => {
                if (this.selectedCastleIslandId && this.skyCastles) {
                    const isl = this.skyCastles.getIsland(this.selectedCastleIslandId);
                    if (isl && confirm(`Delete castle island "${isl.name}"?`)) {
                        this.skyCastles.removeIsland(this.selectedCastleIslandId);
                        this.selectedCastleIslandId = null;
                        this.renderCastleArchipelagoEditor();
                        this.showStatus('Castle island removed');
                    }
                }
            });
        }

        const presetSpaciousBtn = document.getElementById('dev-castle-preset-spacious');
        if (presetSpaciousBtn) {
            presetSpaciousBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    this.skyCastles.applyLayoutPreset('spacious');
                    this.renderCastleArchipelagoEditor();
                    this.showStatus('Applied spacious archipelago layout');
                }
            });
        }

        const presetRingBtn = document.getElementById('dev-castle-preset-ring');
        if (presetRingBtn) {
            presetRingBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    this.skyCastles.applyLayoutPreset('ring');
                    this.renderCastleArchipelagoEditor();
                    this.showStatus('Applied wide circular kingdom layout');
                }
            });
        }

        const resetLayoutBtn = document.getElementById('dev-castle-reset-layout');
        if (resetLayoutBtn) {
            resetLayoutBtn.addEventListener('click', () => {
                if (this.skyCastles && confirm('Reset all castle positions to factory defaults?')) {
                    this.skyCastles.resetToDefaults();
                    this.selectedCastleIslandId = null;
                    this.renderCastleArchipelagoEditor();
                    this.showStatus('Reset castles archipelago to factory defaults');
                }
            });
        }

        // Layer Fog Deck Controls
        const layerFogToggle = document.getElementById('dev-layer-fog-toggle');
        if (layerFogToggle) {
            layerFogToggle.addEventListener('click', () => {
                if (this.skyCastles) {
                    const next = !this.skyCastles.layerFogEnabled;
                    this.skyCastles.setLayerFogEnabled(next);
                    this.renderCastleArchipelagoEditor();
                    this.showStatus(`Cloud sea deck ${next ? 'enabled' : 'disabled'}`);
                }
            });
        }

        const fogAltSlider = document.getElementById('dev-layer-fog-alt') as HTMLInputElement | null;
        const fogAltNum = document.getElementById('dev-layer-fog-alt-num') as HTMLInputElement | null;
        const fogAltVal = document.getElementById('dev-layer-fog-alt-val');
        const handleFogAlt = (v: number) => {
            if (fogAltVal) fogAltVal.textContent = `${v.toFixed(0)}m`;
            if (fogAltSlider && parseFloat(fogAltSlider.value) !== v) fogAltSlider.value = String(v);
            if (fogAltNum && parseFloat(fogAltNum.value) !== v) fogAltNum.value = String(v);
            if (this.skyCastles) this.skyCastles.setLayerFogAltitude(v);
        };
        if (fogAltSlider) fogAltSlider.addEventListener('input', () => handleFogAlt(parseFloat(fogAltSlider.value)));
        if (fogAltNum) fogAltNum.addEventListener('input', () => {
            const v = parseFloat(fogAltNum.value);
            if (!isNaN(v)) handleFogAlt(v);
        });

        const fogDensitySlider = document.getElementById('dev-layer-fog-density') as HTMLInputElement | null;
        const fogDensityVal = document.getElementById('dev-layer-fog-density-val');
        if (fogDensitySlider) {
            fogDensitySlider.addEventListener('input', () => {
                const v = parseFloat(fogDensitySlider.value);
                if (fogDensityVal) fogDensityVal.textContent = v.toFixed(2);
                if (this.skyCastles) this.skyCastles.setLayerFogDensity(v);
            });
        }

        const fogColorInp = document.getElementById('dev-layer-fog-color') as HTMLInputElement | null;
        const fogColorHex = document.getElementById('dev-layer-fog-color-hex');
        if (fogColorInp) {
            fogColorInp.addEventListener('input', () => {
                if (fogColorHex) fogColorHex.textContent = fogColorInp.value;
                if (this.skyCastles) this.skyCastles.setLayerFogColor(fogColorInp.value);
            });
        }

        const fogEmissiveInp = document.getElementById('dev-layer-fog-emissive') as HTMLInputElement | null;
        const fogEmissiveHex = document.getElementById('dev-layer-fog-emissive-hex');
        if (fogEmissiveInp) {
            fogEmissiveInp.addEventListener('input', () => {
                if (fogEmissiveHex) fogEmissiveHex.textContent = fogEmissiveInp.value;
                if (this.skyCastles) this.skyCastles.setLayerFogEmissive(fogEmissiveInp.value);
            });
        }

        // Permanent Local Disk Persistence & Clipboard Buttons
        const saveCastlesDiskBtn = document.getElementById('dev-save-castles-disk-btn');
        if (saveCastlesDiskBtn) {
            saveCastlesDiskBtn.addEventListener('click', async () => {
                if (this.skyCastles) {
                    this.skyCastles.saveToConfig();
                }
                this.showStatus('Saving configuration permanently to local disk...');
                const res = await globalConfigManager.saveConfigToDisk();
                this.showStatus(res.message);
            });
        }

        const copyCastlesJsonBtn = document.getElementById('dev-copy-castles-json-btn');
        if (copyCastlesJsonBtn) {
            copyCastlesJsonBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    this.skyCastles.saveToConfig();
                }
                const jsonStr = globalConfigManager.exportJSON();
                navigator.clipboard.writeText(jsonStr).then(() => {
                    this.showStatus('Configuration JSON copied to clipboard');
                }).catch(() => {
                    this.showStatus('Failed to copy to clipboard', true);
                });
            });
        }

        const saveCastlesBtn = document.getElementById('dev-save-castles-btn');
        if (saveCastlesBtn) {
            saveCastlesBtn.addEventListener('click', () => {
                if (this.skyCastles) {
                    this.skyCastles.saveToConfig();
                    this.showStatus('Saved Floating Castles Archipelago & Fog to browser cache');
                }
            });
        }

        // HTML5 Drag and Drop for Castle Models into World
        window.addEventListener('dragover', (e) => {
            const dragged = (window as any).__draggedCastleModel;
            if (dragged && this.skyCastles) {
                const target = e.target as HTMLElement;
                const panel = document.getElementById('dev-editor-panel');
                if (panel && panel.contains(target)) return;

                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            }
        });

        window.addEventListener('drop', (e) => {
            const dragged = (window as any).__draggedCastleModel || e.dataTransfer?.getData('text/plain');
            if (dragged && this.skyCastles) {
                const target = e.target as HTMLElement;
                const panel = document.getElementById('dev-editor-panel');
                if (panel && panel.contains(target)) return;

                e.preventDefault();
                const planeHit = this.skyCastles.raycastHorizontalPlane(e.clientX, e.clientY, this.pipeline.camera, 490);
                if (planeHit) {
                    const newIsl = this.skyCastles.addIsland({
                        modelPath: dragged,
                        x: Math.round(planeHit.x),
                        z: Math.round(planeHit.z),
                        y: 490
                    });
                    this.selectedCastleIslandId = newIsl.id;
                    this.renderCastleArchipelagoEditor();
                    this.showStatus(`Placed ${newIsl.name} at X: ${Math.round(planeHit.x)}m, Z: ${Math.round(planeHit.z)}m`);
                }
                (window as any).__draggedCastleModel = null;
            }
        });
    }
}


