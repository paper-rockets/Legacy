import * as THREE from 'three';
import { RenderPipeline } from './core/renderer';
import { TerrainSystem } from './world/terrain';
import { WaterSystem } from './world/water';
import { LightingSystem } from './world/lighting';
import { PropsSystem } from './world/props';
import { TreeSystem } from './world/trees';
import { WorldPropsSystem } from './world/worldProps';
import { SkyCastleSystem } from './world/skyCastles';
import { PlayerSystem } from './player/player';
import { ControlsManager } from './player/controls';
import { AmbientAudioEngine } from './audio/audio';
import { createHud } from './ui/hud';
import { createSettingsWindow } from './ui/settingsWindow';
import { createPhotoMode } from './ui/photoMode';
import { createEditorShell } from './ui/panel/shell';
import { buildEditorFooter } from './ui/editorFooter';
import { buildVegetationTab } from './ui/tabs/vegetationTab';
import { buildObjectsTab } from './ui/tabs/objectsTab';
import { buildCastleControls } from './ui/tabs/castlesTab';
import { buildWorldTab } from './ui/tabs/worldTab';
import { createBlueprintView, BlueprintViewController } from './ui/blueprintView';
import { castleEditorState } from './ui/castleEditorState';
import { requireEl } from './ui/panel/render';
import { TabDef } from './ui/panel/types';
import { terrainHeightJS, BIOME_LOCATIONS } from './world/noise';
import { globalConfigManager } from './core/config';

let blueprintView: BlueprintViewController | null = null;

export function setBlueprintView(view: BlueprintViewController | null) {
    blueprintView = view;
}

async function bootstrap() {
    const container = document.getElementById('app');
    if (!container) throw new Error('App container not found');

    const pipeline = new RenderPipeline(container);
    await pipeline.init();
    await globalConfigManager.syncFromDisk();

    const lighting = new LightingSystem(pipeline.scene);
    const terrain = new TerrainSystem(pipeline.scene, 128);
    const water = new WaterSystem(pipeline.scene);
    const props = new PropsSystem(pipeline.scene);
    const skyCastles = new SkyCastleSystem(pipeline.scene);
    const trees = new TreeSystem(pipeline.scene);
    trees.init().catch(console.error);
    const worldProps = new WorldPropsSystem(pipeline.scene);

    // Initial Biome Bloom and Cloud configuration
    const initialBiome = globalConfigManager.getActiveBiomeConfig();
    pipeline.applyBiomeBloom(initialBiome.bloom);
    props.applyBiomeCloud(initialBiome.bloom);
    skyCastles.applyBiomeCloud(initialBiome.bloom);

    const player = new PlayerSystem(pipeline.scene, pipeline.camera);
    const initialLoc = BIOME_LOCATIONS.find(b => b.id === initialBiome.id);
    if (initialLoc) {
        player.teleportTo(initialLoc.x, initialLoc.z, 50, initialLoc.y);
    }

    const controls = new ControlsManager();
    const audio = new AmbientAudioEngine();

    // Register audio listener for plane model sound
    player.addModelChangeListener((def) => {
        audio.onFlightModelChanged(def);
    });
    audio.onFlightModelChanged(player.getCurrentModelDef());

    let onBlueprintExit: (() => void) | undefined;
    const blueprint = createBlueprintView({
        pipeline,
        skyCastles,
        player,
        lighting,
        onPlaceCastle: (modelPath, x, z) => {
            const isl = skyCastles.addIsland({ modelPath, x, z, y: 490 });
            castleEditorState.select(isl.id);
        },
        onExit: () => {
            onBlueprintExit?.();
        }
    });
    setBlueprintView(blueprint);

    const editorTabs: TabDef[] = [
        {
            id: 'vegetation',
            label: 'Vegetation',
            build: () => buildVegetationTab({
                trees,
                props,
                terrain,
                pipeline,
                worldProps,
                biomeId: () => player.currentBiome,
                status: (msg, isErr) => editorShell.status(msg, isErr),
                rebuild: () => editorShell.rebuild()
            })
        },
        /* Objects tab hidden per request
        {
            id: 'objects',
            label: 'Objects',
            build: () => buildObjectsTab({
                worldProps,
                player,
                pipeline,
                status: (msg, isErr) => editorShell.status(msg, isErr),
                rebuild: () => editorShell.rebuild()
            })
        },
        */
        {
            id: 'castles',
            label: 'Castles',
            build: () => buildCastleControls({
                skyCastles,
                variant: 'panel',
                onEnterBlueprint: () => {
                    editorShell.close();
                    blueprint.enter();
                },
                status: (msg, isErr) => editorShell.status(msg, isErr)
            })
        },
        {
            id: 'world',
            label: 'World',
            build: () => buildWorldTab({
                terrain,
                water,
                lighting,
                pipeline,
                audio,
                photoMode,
                biomeId: () => player.currentBiome,
                onTimePhaseChanged: (phase) => {
                    // Update lighting phase
                },
                status: (msg, isErr) => editorShell.status(msg, isErr),
                rebuild: () => editorShell.rebuild()
            })
        }
    ];

    const editorRoot = requireEl('editor-root');
    const editorShell = createEditorShell({
        mount: editorRoot,
        title: 'DEVELOPER OPTIONS',
        subtitle: () => player.currentBiomeName.toUpperCase(),
        biomeStrip: {
            options: () => BIOME_LOCATIONS.map(b => ({ value: b.id, text: b.name })),
            get: () => player.currentBiome,
            set: (bId: string) => {
                const loc = BIOME_LOCATIONS.find(b => b.id === bId);
                if (loc) {
                    player.teleportTo(loc.x, loc.z, 50, loc.y);
                    const pos = player.playerGrp.position;
                    terrain.update(pos.x, pos.z);
                    trees.update(pos.x, pos.z);
                    props.update(pos.x, pos.z, 0.016);
                    water.update(pos.x, pos.z, 0.016);
                    skyCastles.update(pos, 0.016);

                    globalConfigManager.config.activeBiomeId = bId as any;
                    const bCfg = globalConfigManager.getBiomeConfig(bId as any);
                    if (bCfg) {
                        pipeline.applyBiomeBloom(bCfg.bloom);
                        props.applyBiomeCloud(bCfg.bloom);
                        skyCastles.applyBiomeCloud(bCfg.bloom);
                        lighting.switchBiome(bId as any, pipeline.scene);
                    }
                }
            }
        },
        tabs: editorTabs,
        footer: () => buildEditorFooter({
            biomeId: () => player.currentBiome,
            status: (msg, isErr) => editorShell.status(msg, isErr),
            rebuild: () => editorShell.rebuild()
        }),
        headerActions: [
            {
                kind: 'button',
                text: 'Teleport',
                tone: 'default',
                onClick: () => {
                    const loc = BIOME_LOCATIONS.find(b => b.id === player.currentBiome);
                    if (loc) {
                        player.teleportTo(loc.x, loc.z, 50, loc.y);
                        editorShell.status(`Teleported to ${loc.name}`);
                    }
                }
            },
            {
                kind: 'button',
                text: 'Close',
                tone: 'default',
                onClick: () => {
                    editorShell.close();
                }
            }
        ]
    });
    onBlueprintExit = () => {
        editorShell.open();
    };

    const savedSound = localStorage.getItem('settings_sound_enabled') !== 'false';
    audio.setMuted(!savedSound);

    const savedGraphics = (localStorage.getItem('settings_graphics_profile') as 'high_performance' | 'regular') || 'high_performance';
    pipeline.setGraphicsProfile(savedGraphics);
    trees.setGraphicsProfile(savedGraphics);
    terrain.setGraphicsProfile(savedGraphics);

    const settingsWindow = createSettingsWindow({
        onOpenDeveloper: () => {
            settingsWindow.close();
            editorShell.open();
        },
        onToggleSound: (enabled: boolean) => {
            audio.setMuted(!enabled);
        },
        onChangeGraphics: (profile: 'high_performance' | 'regular') => {
            pipeline.setGraphicsProfile(profile);
            trees.setGraphicsProfile(profile);
            terrain.setGraphicsProfile(profile);
        },
        onChangeFlightModel: (index: number) => {
            player.setModel(index);
            audio.onFlightModelChanged(player.getCurrentModelDef());
        },
        getSoundEnabled: () => !audio.getMuted(),
        getGraphicsProfile: () => trees.graphicsProfile,
        getCurrentFlightModel: () => player.currentModelIndex
    });
    const hud = createHud({
        pipeline, player, controls, lighting, terrain, water, props, trees, skyCastles, audio,
        onOpenSettings: () => settingsWindow.toggle()
    });
    const photoMode = createPhotoMode({ pipeline, player, hud, settingsWindow });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            editorShell.toggle();
        }
    });

    (window as any).__game = {
        pipeline, player, terrain, lighting, water, props, skyCastles, trees, worldProps, audio,
        hud, settingsWindow, photoMode, editorShell, setBlueprintView
    };

    const clock = new THREE.Clock();
    let lastBiomeId = player.currentBiome;

    // Interaction triggers for audio unlocking
    const unlockAudio = () => {
        audio.initAudio();
        audio.onFlightModelChanged(player.getCurrentModelDef());
    };
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    function animate() {
        requestAnimationFrame(animate);

        const realDt = Math.min(clock.getDelta(), 0.1);
        const flightDt = controls.isFlightPaused ? 0 : realDt;

        const playerPos = player.playerGrp.position;
        const groundY = terrainHeightJS(playerPos.x, playerPos.z);

        // Biome flight traversal detection & bloom interpolation
        const bCfg = globalConfigManager.getBiomeConfig(player.currentBiome);
        if (bCfg) {
            pipeline.applyBiomeBloom(bCfg.bloom, 0.08, lighting.timePhase);
        }

        if (player.currentBiome !== lastBiomeId) {
            lastBiomeId = player.currentBiome;
            if (bCfg) {
                props.applyBiomeCloud(bCfg.bloom);
                skyCastles.applyBiomeCloud(bCfg.bloom);
                lighting.switchBiome(player.currentBiome, pipeline.scene);
            }
        }

        lighting.update(realDt, pipeline.scene, playerPos, groundY);
        trees.updateGlow(realDt, lighting.timePhase, player.currentBiome);

        const inputState = controls.getInputState();
        const isPaused = controls.isFlightPaused || photoMode.isActive || (blueprintView?.isActive ?? false);
        audio.update(realDt, inputState.boost, inputState.brake, isPaused, player.velocity);

        if (!photoMode.isActive) {
            const isTopView = blueprintView?.isActive ?? false;

            if (!isTopView) {
                player.update(flightDt, inputState, skyCastles);

                // Sky Castle Updraft Lift
                const updraft = skyCastles.getUpdraftLift(playerPos.x, playerPos.y, playerPos.z);
                if (updraft > 0) {
                    player.playerGrp.position.y += updraft * flightDt;
                }
            } else {
                blueprintView?.update(realDt);
            }

            const focusPos = isTopView && blueprintView ? blueprintView.currentCenter : playerPos;
            terrain.update(focusPos.x, focusPos.z);
            water.update(focusPos.x, focusPos.z, realDt);
            props.update(focusPos.x, focusPos.z, realDt);
            skyCastles.update(focusPos, realDt, lighting.timePhase);
            trees.update(focusPos.x, focusPos.z);
            worldProps.update(realDt);
        }

        hud.update(realDt);
        pipeline.render();
    }

    animate();
}

bootstrap().catch(console.error);
