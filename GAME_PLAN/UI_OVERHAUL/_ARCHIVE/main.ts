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
import { UIManager } from './ui/ui';
import { DeviceSimulator } from './ui/deviceSimulator';
import { terrainHeightJS, BIOME_LOCATIONS } from './world/noise';
import { globalConfigManager } from './core/config';

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

    const ui = new UIManager(pipeline, player, terrain, props, lighting, water, audio, controls, trees, worldProps, skyCastles);
    const deviceSimulator = new DeviceSimulator(pipeline, controls);
    (window as any).__game = { pipeline, player, terrain, lighting, water, props, skyCastles, trees, worldProps, ui, deviceSimulator, audio };

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
        if (player.currentBiome !== lastBiomeId) {
            lastBiomeId = player.currentBiome;
            const bCfg = globalConfigManager.getBiomeConfig(player.currentBiome);
            if (bCfg) {
                pipeline.applyBiomeBloom(bCfg.bloom, 0.12);
                props.applyBiomeCloud(bCfg.bloom);
                skyCastles.applyBiomeCloud(bCfg.bloom);
                lighting.switchBiome(player.currentBiome, pipeline.scene);
            }
        }

        lighting.update(realDt, pipeline.scene, playerPos, groundY);
        trees.updateGlow(realDt, lighting.timePhase, player.currentBiome);

        const inputState = controls.getInputState();
        const isPaused = controls.isFlightPaused || ui.isPhotoMode || (ui.devEditor?.topViewController?.isActive ?? false);
        audio.update(realDt, inputState.boost, inputState.brake, isPaused, player.velocity);

        if (!ui.isPhotoMode) {
            const isTopView = ui.devEditor?.topViewController?.isActive ?? false;

            if (!isTopView) {
                player.update(flightDt, inputState, skyCastles);

                // Sky Castle Updraft Lift
                const updraft = skyCastles.getUpdraftLift(playerPos.x, playerPos.y, playerPos.z);
                if (updraft > 0) {
                    player.playerGrp.position.y += updraft * flightDt;
                }
            } else {
                ui.devEditor?.topViewController?.update(realDt);
            }

            const focusPos = isTopView && ui.devEditor?.topViewController ? ui.devEditor.topViewController.currentCenter : playerPos;
            terrain.update(focusPos.x, focusPos.z);
            water.update(focusPos.x, focusPos.z, realDt);
            props.update(focusPos.x, focusPos.z, realDt);
            skyCastles.update(focusPos, realDt);
            trees.update(focusPos.x, focusPos.z);
            worldProps.update(realDt);
        }

        ui.updateFPS();
        pipeline.render();
    }

    animate();
}

bootstrap().catch(console.error);
