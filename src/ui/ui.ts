import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderPipeline } from '../core/renderer';
import { PlayerSystem } from '../player/player';
import { TerrainSystem } from '../world/terrain';
import { PropsSystem } from '../world/props';
import { LightingSystem } from '../world/lighting';
import { WaterSystem } from '../world/water';
import { AmbientAudioEngine } from '../audio/audio';
import { ControlsManager } from '../player/controls';
import { TreeSystem } from '../world/trees';
import { DevEditor } from './devEditor';
import { BIOME_LOCATIONS } from '../world/noise';
import { globalConfigManager } from '../core/config';

export class UIManager {
    public isPhotoMode = false;
    public isDebugOpen = false;
    public isSettingsOpen = false;
    public devEditor: DevEditor | null = null;

    private photoControls: OrbitControls | null = null;
    private fpsFrames = 0;
    private fpsPrevTime = performance.now();
    private fpsDisplay: HTMLElement | null;
    private biomeDisplay: HTMLElement | null;

    constructor(
        private pipeline: RenderPipeline,
        private player: PlayerSystem,
        private terrain: TerrainSystem,
        private props: PropsSystem,
        private lighting: LightingSystem,
        private water: WaterSystem,
        private audio: AmbientAudioEngine,
        private controls: ControlsManager,
        private trees?: TreeSystem
    ) {
        this.fpsDisplay = document.getElementById('fps-counter');
        this.biomeDisplay = document.getElementById('biome-select-btn');
        if (this.trees) {
            this.devEditor = new DevEditor(
                this.pipeline,
                this.lighting,
                this.props,
                this.trees,
                this.water,
                this.terrain,
                this.player
            );
        }
        this.setupButtons();
        this.setupPhotoMode();
        this.setupDebugPanel();
    }

    private setupButtons() {
        // Pause Flight button with Pause/Play Icon
        const pauseBtn = document.getElementById('pause-flight-btn');
        const pauseIcon = document.getElementById('pause-icon');
        const playIcon = document.getElementById('play-icon');

        const updatePauseUI = () => {
            if (this.controls.isFlightPaused) {
                if (pauseIcon) pauseIcon.style.display = 'none';
                if (playIcon) playIcon.style.display = 'block';
                if (pauseBtn) {
                    pauseBtn.setAttribute('aria-label', 'Resume Flight');
                    pauseBtn.setAttribute('title', 'Resume Flight');
                    pauseBtn.classList.add('paused');
                }
            } else {
                if (pauseIcon) pauseIcon.style.display = 'block';
                if (playIcon) playIcon.style.display = 'none';
                if (pauseBtn) {
                    pauseBtn.setAttribute('aria-label', 'Pause Flight');
                    pauseBtn.setAttribute('title', 'Pause Flight');
                    pauseBtn.classList.remove('paused');
                }
            }
        };

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.controls.isFlightPaused = !this.controls.isFlightPaused;
                updatePauseUI();
            });
            updatePauseUI();
        }

        // Day / Dusk / Twilight segmented selector
        const dayBtn = document.getElementById('time-day-btn');
        const duskBtn = document.getElementById('time-dusk-btn');
        const twilightBtn = document.getElementById('time-twilight-btn');
        const timeButtons = [
            { el: dayBtn, phase: 0 },
            { el: duskBtn, phase: 1 },
            { el: twilightBtn, phase: 2 }
        ];

        const setTimeActive = (phase: number) => {
            this.lighting.setTimePhase(phase);
            timeButtons.forEach(item => {
                if (item.el) {
                    if (item.phase === phase) {
                        item.el.classList.add('active');
                        item.el.setAttribute('aria-checked', 'true');
                    } else {
                        item.el.classList.remove('active');
                        item.el.setAttribute('aria-checked', 'false');
                    }
                }
            });
            if (this.devEditor && this.devEditor.isOpen) {
                this.devEditor.activeEnvPhase = phase;
                this.devEditor.refreshUI();
            }
        };

        timeButtons.forEach(item => {
            if (item.el) {
                item.el.addEventListener('click', () => {
                    setTimeActive(item.phase);
                });
            }
        });

        setTimeActive(this.lighting.timePhase || 0);

        // Model Selector in Top Bar
        const modelBtn = document.getElementById('model-select-btn');
        const modelDropdown = document.getElementById('model-dropdown');
        const models = this.player.getModelList();

        if (modelBtn && modelDropdown) {
            modelDropdown.innerHTML = '';
            models.forEach((m, idx) => {
                const optBtn = document.createElement('button');
                optBtn.className = 'model-option-btn' + (idx === this.player.currentModelIndex ? ' active' : '');
                optBtn.innerText = m.name;
                optBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.player.setModel(idx);
                    modelDropdown.style.display = 'none';
                });
                modelDropdown.appendChild(optBtn);
            });

            const updateModelBtnUI = (curDef = this.player.getCurrentModelDef()) => {
                modelBtn.innerText = curDef.name;
                const buttons = modelDropdown.querySelectorAll('.model-option-btn');
                buttons.forEach((btn, idx) => {
                    if (idx === this.player.currentModelIndex) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            };

            this.player.onModelChanged = (def) => {
                updateModelBtnUI(def);
            };

            modelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = modelDropdown.style.display === 'flex';
                modelDropdown.style.display = isOpen ? 'none' : 'flex';
            });

            document.addEventListener('click', (e) => {
                if (modelDropdown.style.display === 'flex' && !modelDropdown.contains(e.target as Node) && e.target !== modelBtn) {
                    modelDropdown.style.display = 'none';
                }
            });

            updateModelBtnUI();
        }

        // Biome Selector in Top Bar
        const biomeBtn = document.getElementById('biome-select-btn');
        const biomeDropdown = document.getElementById('biome-dropdown');

        if (biomeBtn && biomeDropdown) {
            biomeDropdown.innerHTML = '';
            BIOME_LOCATIONS.forEach((loc) => {
                const optBtn = document.createElement('button');
                optBtn.className = 'biome-option-btn' + (loc.id === this.player.currentBiome ? ' active' : '');
                optBtn.innerHTML = `
                    <div style="font-weight: 700;">${loc.name}</div>
                    <div class="biome-option-subtitle">${loc.description}</div>
                `;
                optBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.travelToBiome(loc.x, loc.z);
                    biomeDropdown.style.display = 'none';
                });
                biomeDropdown.appendChild(optBtn);
            });

            biomeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = biomeDropdown.style.display === 'flex';
                if (modelDropdown) modelDropdown.style.display = 'none';
                const settingsMenu = document.getElementById('settings-menu');
                if (settingsMenu) settingsMenu.style.display = 'none';

                biomeDropdown.style.display = isOpen ? 'none' : 'flex';
            });

            document.addEventListener('click', (e) => {
                if (biomeDropdown.style.display === 'flex' && !biomeDropdown.contains(e.target as Node) && e.target !== biomeBtn) {
                    biomeDropdown.style.display = 'none';
                }
            });
        }

        // Fullscreen toggle
        const fullscreenBtn = document.getElementById('fullscreen-toggle');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.error(`Fullscreen error: ${err.message}`);
                    });
                } else {
                    document.exitFullscreen().catch(err => {
                        console.error(`Exit fullscreen error: ${err.message}`);
                    });
                }
            });
        }

        // Cogwheel Settings Menu Toggle
        const settingsBtn = document.getElementById('settings-btn');
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsBtn && settingsMenu) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isSettingsOpen = !this.isSettingsOpen;
                settingsMenu.style.display = this.isSettingsOpen ? 'flex' : 'none';
            });

            document.addEventListener('click', (e) => {
                if (this.isSettingsOpen && !settingsMenu.contains(e.target as Node) && e.target !== settingsBtn) {
                    this.isSettingsOpen = false;
                    settingsMenu.style.display = 'none';
                }
            });
        }

        // Music & Track Toggles inside Cogwheel Menu
        const musicBtn = document.getElementById('music-toggle');
        const trackBtn = document.getElementById('track-toggle');
        if (musicBtn && trackBtn) {
            musicBtn.addEventListener('click', () => {
                const playing = this.audio.toggleMusic();
                musicBtn.innerText = playing ? 'Pause Music' : 'Music';
                trackBtn.style.display = playing ? 'block' : 'none';
            });

            trackBtn.addEventListener('click', () => {
                const trackName = this.audio.nextTrack();
                trackBtn.innerText = 'Track: ' + trackName;
            });
        }

        // Dev Editor menu item in settings
        const devMenuBtn = document.getElementById('dev-menu-toggle');
        if (devMenuBtn) {
            devMenuBtn.addEventListener('click', () => {
                this.isSettingsOpen = false;
                if (settingsMenu) settingsMenu.style.display = 'none';
                this.devEditor?.open();
            });
        }

        // Vegetation Preset Buttons
        const presetBtns = document.querySelectorAll('.menu-preset-btn');
        presetBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const presetKey = target.getAttribute('data-preset') as any;
                if (presetKey && this.trees) {
                    this.trees.setPreset(presetKey);
                    presetBtns.forEach((b) => b.classList.remove('active'));
                    target.classList.add('active');
                }
            });
        });

        // Glow & Bloom Editor Sliders
        const treeBloomSlider = document.getElementById('tree-bloom-slider') as HTMLInputElement | null;
        const treeBloomVal = document.getElementById('tree-bloom-val');
        const treeBloomDebugSlider = document.getElementById('tree-bloom-debug-slider') as HTMLInputElement | null;
        const treeBloomDebugVal = document.getElementById('tree-bloom-debug-val');

        const syncTreeBloom = (intensity: number) => {
            if (this.trees) {
                this.trees.setTreeBloomIntensity(intensity);
            }
            if (treeBloomSlider) {
                treeBloomSlider.value = Math.round(intensity * 100).toString();
            }
            if (treeBloomVal) {
                treeBloomVal.innerText = `${Math.round(intensity * 100)}%`;
            }
            if (treeBloomDebugSlider) {
                treeBloomDebugSlider.value = intensity.toFixed(2);
            }
            if (treeBloomDebugVal) {
                treeBloomDebugVal.textContent = intensity.toFixed(2);
            }
        };

        const activeBiome = globalConfigManager.getActiveBiomeConfig();
        if (treeBloomSlider && this.trees) {
            syncTreeBloom(activeBiome.bloom.treeBloom);
            treeBloomSlider.addEventListener('input', (e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                syncTreeBloom(val);
            });
        }

        if (treeBloomDebugSlider && this.trees) {
            treeBloomDebugSlider.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                syncTreeBloom(val);
            });
        }

        const canopyGlowSlider = document.getElementById('canopy-glow-slider') as HTMLInputElement | null;
        const canopyGlowVal = document.getElementById('canopy-glow-val');
        if (canopyGlowSlider && this.trees) {
            canopyGlowSlider.value = Math.round(activeBiome.bloom.treeCanopyGlow * 100).toString();
            if (canopyGlowVal) canopyGlowVal.innerText = `${Math.round(activeBiome.bloom.treeCanopyGlow * 100)}%`;

            canopyGlowSlider.addEventListener('input', (e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                this.trees?.setCanopyGlowMultiplier(val / 100);
                if (canopyGlowVal) canopyGlowVal.innerText = `${val}%`;
            });
        }

        const trunkGlowSlider = document.getElementById('trunk-glow-slider') as HTMLInputElement | null;
        const trunkGlowVal = document.getElementById('trunk-glow-val');
        if (trunkGlowSlider && this.trees) {
            trunkGlowSlider.value = Math.round(activeBiome.bloom.treeTrunkGlow * 100).toString();
            if (trunkGlowVal) trunkGlowVal.innerText = `${Math.round(activeBiome.bloom.treeTrunkGlow * 100)}%`;

            trunkGlowSlider.addEventListener('input', (e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                this.trees?.setTrunkGlowMultiplier(val / 100);
                if (trunkGlowVal) trunkGlowVal.innerText = `${val}%`;
            });
        }

        // Vegetation Editor Sliders: Trees
        const scaleSlider = document.getElementById('tree-scale-slider') as HTMLInputElement | null;
        const scaleVal = document.getElementById('tree-scale-val');
        const densitySlider = document.getElementById('tree-density-slider') as HTMLInputElement | null;
        const densityVal = document.getElementById('tree-density-val');

        if (scaleSlider && this.trees) {
            scaleSlider.value = activeBiome.vegetation.treeScale.toString();
            if (scaleVal) scaleVal.innerText = `${Math.round(activeBiome.vegetation.treeScale * 100)}%`;

            scaleSlider.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                this.trees?.setScale(val);
                if (scaleVal) scaleVal.innerText = `${Math.round(val * 100)}%`;
            });
        }

        if (densitySlider && this.trees) {
            densitySlider.value = activeBiome.vegetation.treeDensity.toString();
            if (densityVal) densityVal.innerText = activeBiome.vegetation.treeDensity.toString();

            densitySlider.addEventListener('input', (e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                this.trees?.setDensity(val);
                if (densityVal) densityVal.innerText = val.toString();
            });
        }

        // Vegetation Editor Sliders: Bushes (Independent)
        const bushScaleSlider = document.getElementById('bush-scale-slider') as HTMLInputElement | null;
        const bushScaleVal = document.getElementById('bush-scale-val');
        const bushDensitySlider = document.getElementById('bush-density-slider') as HTMLInputElement | null;
        const bushDensityVal = document.getElementById('bush-density-val');

        if (bushScaleSlider && this.trees) {
            bushScaleSlider.value = activeBiome.vegetation.bushScale.toString();
            if (bushScaleVal) bushScaleVal.innerText = `${Math.round(activeBiome.vegetation.bushScale * 100)}%`;

            bushScaleSlider.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                this.trees?.setBushScale(val);
                if (bushScaleVal) bushScaleVal.innerText = `${Math.round(val * 100)}%`;
            });
        }

        if (bushDensitySlider && this.trees) {
            bushDensitySlider.value = activeBiome.vegetation.bushDensity.toString();
            if (bushDensityVal) bushDensityVal.innerText = activeBiome.vegetation.bushDensity.toString();

            bushDensitySlider.addEventListener('input', (e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                this.trees?.setBushDensity(val);
                if (bushDensityVal) bushDensityVal.innerText = val.toString();
            });
        }
    }

    private setupPhotoMode() {
        const photoToggle = document.getElementById('photo-toggle');
        const photoExit = document.getElementById('photo-exit');
        const photoCapture = document.getElementById('photo-capture');
        const photoUi = document.getElementById('photo-mode-ui');
        const topBar = document.getElementById('top-bar');
        const topRightBar = document.getElementById('top-right-bar');
        const settingsMenu = document.getElementById('settings-menu');
        const debugPanel = document.getElementById('debug-panel');
        const devPanel = document.getElementById('dev-editor-panel');
        const touch = document.getElementById('touch-controls');

        if (photoToggle && photoExit && photoCapture && photoUi) {
            photoToggle.addEventListener('click', () => {
                this.isPhotoMode = true;
                this.isSettingsOpen = false;
                if (settingsMenu) settingsMenu.style.display = 'none';
                if (topBar) topBar.style.display = 'none';
                if (topRightBar) topRightBar.style.display = 'none';
                if (debugPanel) debugPanel.style.display = 'none';
                if (devPanel) devPanel.style.display = 'none';
                if (touch) touch.style.display = 'none';
                photoUi.style.display = 'flex';

                if (!this.photoControls) {
                    this.photoControls = new OrbitControls(this.pipeline.camera, this.pipeline.renderer.domElement);
                }
                this.photoControls.enabled = true;
                this.photoControls.target.copy(this.player.playerGrp.position);
                this.photoControls.update();
            });

            photoExit.addEventListener('click', () => {
                this.isPhotoMode = false;
                if (topBar) topBar.style.display = 'flex';
                if (topRightBar) topRightBar.style.display = 'flex';
                if (this.isDebugOpen && debugPanel) debugPanel.style.display = 'block';
                if (this.devEditor && this.devEditor.isOpen && devPanel) devPanel.style.display = 'flex';
                if (touch) touch.style.display = '';
                photoUi.style.display = 'none';

                this.pipeline.camera.fov = 60;
                this.pipeline.camera.position.set(0, 3.2, 12);
                this.pipeline.camera.rotation.set(-Math.atan2(3.2 - 0.5, 12), 0, 0);
                this.player.cameraPivot.rotation.set(0, 0, 0);
                this.pipeline.camera.updateProjectionMatrix();

                if (this.photoControls) {
                    this.photoControls.enabled = false;
                }
            });

            photoCapture.addEventListener('click', () => {
                photoUi.style.display = 'none';
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.pipeline.render();
                        const dataURL = this.pipeline.renderer.domElement.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = 'GhibliFlight_Screenshot.png';
                        link.href = dataURL;
                        link.click();
                        photoUi.style.display = 'flex';
                    });
                });
            });
        }
    }

    private setupDebugPanel() {
        const debugToggle = document.getElementById('debug-toggle');
        const debugClose = document.getElementById('debug-close-btn');
        const debugPanel = document.getElementById('debug-panel');

        if (debugToggle && debugPanel) {
            debugToggle.addEventListener('click', () => {
                this.isDebugOpen = !this.isDebugOpen;
                debugToggle.innerText = this.isDebugOpen ? 'Debug: ON' : 'Debug: OFF';
                debugPanel.style.display = this.isDebugOpen ? 'block' : 'none';
            });
        }

        if (debugClose && debugPanel) {
            debugClose.addEventListener('click', () => {
                this.isDebugOpen = false;
                if (debugToggle) debugToggle.innerText = 'Debug: OFF';
                debugPanel.style.display = 'none';
            });
        }

        const treeBloomDebugSlider = document.getElementById('tree-bloom-debug-slider') as HTMLInputElement | null;
        const treeBloomDebugVal = document.getElementById('tree-bloom-debug-val');

        if (treeBloomDebugSlider && this.trees) {
            const currentTreeBloom = globalConfigManager.getActiveBiomeConfig().bloom.treeBloom;
            treeBloomDebugSlider.value = currentTreeBloom.toFixed(2);
            if (treeBloomDebugVal) treeBloomDebugVal.textContent = currentTreeBloom.toFixed(2);

            treeBloomDebugSlider.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                this.trees?.setTreeBloomIntensity(val);
                if (treeBloomDebugVal) treeBloomDebugVal.textContent = val.toFixed(2);
                const mainSlider = document.getElementById('tree-bloom-slider') as HTMLInputElement | null;
                const mainVal = document.getElementById('tree-bloom-val');
                if (mainSlider) mainSlider.value = Math.round(val * 100).toString();
                if (mainVal) mainVal.innerText = `${Math.round(val * 100)}%`;
            });
        }

        const bloomSlider = document.getElementById('bloom-slider') as HTMLInputElement | null;
        const bloomVal = document.getElementById('bloom-val');

        if (bloomSlider) {
            bloomSlider.value = this.pipeline.bloomPass.strength.toString();
            if (bloomVal) bloomVal.textContent = Number(this.pipeline.bloomPass.strength).toFixed(2);

            bloomSlider.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                this.pipeline.bloomPass.strength = val;
                if (bloomVal) bloomVal.textContent = val.toFixed(2);
            });
        }

        const btnTerrain = document.getElementById('toggle-terrain');
        const btnProps = document.getElementById('toggle-props');
        const btnDpi = document.getElementById('toggle-dpi');
        const btnShadows = document.getElementById('toggle-shadows');
        const btnWater = document.getElementById('toggle-water');
        const btnMaster = document.getElementById('toggle-all');

        let isTerrainFast = false;
        let isPropsFast = false;
        let isDpiFast = false;
        let isShadowsFast = false;
        let isWaterFast = false;

        const updateDebugUI = () => {
            if (btnTerrain) {
                btnTerrain.className = 'debug-btn ' + (isTerrainFast ? 'on' : 'off');
                btnTerrain.innerText = isTerrainFast ? '128x128 (Fast)' : '256x256 (Slow)';
            }
            if (btnProps) {
                btnProps.className = 'debug-btn ' + (isPropsFast ? 'on' : 'off');
                btnProps.innerText = isPropsFast ? 'Culled 1.1k (Fast)' : 'Full Density';
            }
            if (btnDpi) {
                btnDpi.className = 'debug-btn ' + (isDpiFast ? 'on' : 'off');
                btnDpi.innerText = isDpiFast ? '1.25x DPI (Fast)' : '2.0x DPI (Slow)';
            }
            if (btnShadows) {
                btnShadows.className = 'debug-btn ' + (isShadowsFast ? 'on' : 'off');
                btnShadows.innerText = isShadowsFast ? '1024 Tight (Fast)' : '2048 Wide';
            }
            if (btnWater) {
                btnWater.className = 'debug-btn ' + (isWaterFast ? 'on' : 'off');
                btnWater.innerText = isWaterFast ? 'MeshToon (Fast)' : 'MeshPhysical';
            }
            if (bloomSlider) {
                bloomSlider.value = this.pipeline.bloomPass.strength.toString();
                if (bloomVal) bloomVal.textContent = Number(this.pipeline.bloomPass.strength).toFixed(2);
            }
            if (treeBloomDebugSlider && this.trees) {
                const currentTreeBloom = globalConfigManager.getActiveBiomeConfig().bloom.treeBloom;
                treeBloomDebugSlider.value = currentTreeBloom.toFixed(2);
                if (treeBloomDebugVal) treeBloomDebugVal.textContent = currentTreeBloom.toFixed(2);
            }
            if (btnMaster) {
                const allOn = isTerrainFast && isPropsFast && isDpiFast && isShadowsFast && isWaterFast;
                btnMaster.innerText = allOn ? 'RESET ALL TO DEFAULTS' : 'ENABLE ALL (60 FPS MODE)';
                btnMaster.style.background = allOn ? 'rgba(211, 47, 47, 0.8)' : 'rgba(255, 255, 255, 0.12)';
            }
        };

        if (btnTerrain) {
            btnTerrain.addEventListener('click', () => {
                isTerrainFast = !isTerrainFast;
                if (isTerrainFast) {
                    this.terrain.setResolution(128, 12.5, this.player.playerGrp.position.x, this.player.playerGrp.position.z);
                } else {
                    this.terrain.setResolution(256, 6.25, this.player.playerGrp.position.x, this.player.playerGrp.position.z);
                }
                updateDebugUI();
            });
        }

        if (btnProps) {
            btnProps.addEventListener('click', () => {
                isPropsFast = !isPropsFast;
                this.props.setOptimizedMode(isPropsFast);
                updateDebugUI();
            });
        }

        if (btnDpi) {
            btnDpi.addEventListener('click', () => {
                isDpiFast = !isDpiFast;
                this.pipeline.setPixelRatioCap(isDpiFast ? 1.25 : 2.0);
                this.pipeline.bloomPass.strength = isDpiFast ? 0.22 : 0.35;
                this.pipeline.bloomPass.radius = isDpiFast ? 0.35 : 0.45;
                updateDebugUI();
            });
        }

        if (btnShadows) {
            btnShadows.addEventListener('click', () => {
                isShadowsFast = !isShadowsFast;
                this.lighting.shadowTuned = isShadowsFast;
                this.lighting.setShadowResolution(isShadowsFast ? 1024 : 2048);
                updateDebugUI();
            });
        }

        if (btnWater) {
            btnWater.addEventListener('click', () => {
                isWaterFast = !isWaterFast;
                this.water.setToonMode(isWaterFast);
                updateDebugUI();
            });
        }

        if (btnMaster) {
            btnMaster.addEventListener('click', () => {
                const allOn = isTerrainFast && isPropsFast && isDpiFast && isShadowsFast && isWaterFast;
                const target = !allOn;
                isTerrainFast = target;
                isPropsFast = target;
                isDpiFast = target;
                isShadowsFast = target;
                isWaterFast = target;

                if (isTerrainFast) {
                    this.terrain.setResolution(128, 12.5, this.player.playerGrp.position.x, this.player.playerGrp.position.z);
                } else {
                    this.terrain.setResolution(256, 6.25, this.player.playerGrp.position.x, this.player.playerGrp.position.z);
                }

                this.props.setOptimizedMode(isPropsFast);
                this.pipeline.setPixelRatioCap(isDpiFast ? 1.25 : 2.0);
                this.pipeline.bloomPass.strength = isDpiFast ? 0.22 : 0.35;
                this.pipeline.bloomPass.radius = isDpiFast ? 0.35 : 0.45;
                this.lighting.shadowTuned = isShadowsFast;
                this.lighting.setShadowResolution(isShadowsFast ? 1024 : 2048);
                this.water.setToonMode(isWaterFast);

                updateDebugUI();
            });
        }
    }


    public travelToBiome(x: number, z: number) {
        this.player.teleportTo(x, z, 50);
        const pos = this.player.playerGrp.position;
        this.terrain.update(pos.x, pos.z);
        if (this.trees) this.trees.update(pos.x, pos.z);
        this.props.update(pos.x, pos.z, 0.016);
        this.water.update(pos.x, pos.z, 0.016);
    }

    public updateFPS() {
        this.fpsFrames++;
        const now = performance.now();
        if (now >= this.fpsPrevTime + 200) {
            const currentFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsPrevTime));
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = currentFps + ' FPS';
            }
            if (this.biomeDisplay) {
                let status = this.player.currentBiomeName;
                if (this.player.isSkimmingWater) {
                    status += ' (Skimming)';
                } else if (this.player.isUpdraftLift) {
                    status += ' (Updraft)';
                }
                if (this.biomeDisplay.textContent !== status) {
                    this.biomeDisplay.textContent = status;
                }
                const biomeDropdown = document.getElementById('biome-dropdown');
                if (biomeDropdown) {
                    const buttons = biomeDropdown.querySelectorAll('.biome-option-btn');
                    BIOME_LOCATIONS.forEach((loc, idx) => {
                        if (buttons[idx]) {
                            if (loc.id === this.player.currentBiome) {
                                buttons[idx].classList.add('active');
                            } else {
                                buttons[idx].classList.remove('active');
                            }
                        }
                    });
                }
            }
            this.fpsFrames = 0;
            this.fpsPrevTime = now;
        }
    }
}
