import * as THREE from 'three';
import { RenderPipeline } from './core/renderer';
import { TerrainSystem } from './world/terrain';
import { WaterSystem } from './world/water';
import { LightingSystem } from './world/lighting';
import { PropsSystem } from './world/props';
import { TreeSystem } from './world/trees';
import { PlayerSystem } from './player/player';
import { ControlsManager } from './player/controls';
import { AmbientAudioEngine } from './audio/audio';
import { UIManager } from './ui/ui';
import { terrainHeightJS } from './world/noise';
import { globalConfigManager } from './core/config';

async function bootstrap() {
    const container = document.getElementById('app');
    if (!container) throw new Error('App container not found');

    const pipeline = new RenderPipeline(container);
    await pipeline.init();

    const lighting = new LightingSystem(pipeline.scene);
    const terrain = new TerrainSystem(pipeline.scene);
    const water = new WaterSystem(pipeline.scene);
    const props = new PropsSystem(pipeline.scene);
    const trees = new TreeSystem(pipeline.scene);
    trees.init().catch(console.error);

    // Initial Biome Bloom and Cloud configuration
    const initialBiome = globalConfigManager.getActiveBiomeConfig();
    pipeline.applyBiomeBloom(initialBiome.bloom);
    props.applyBiomeCloud(initialBiome.bloom);

    const player = new PlayerSystem(pipeline.scene, pipeline.camera);
    const controls = new ControlsManager();
    const audio = new AmbientAudioEngine();
    const ui = new UIManager(pipeline, player, terrain, props, lighting, water, audio, controls, trees);
    (window as any).__game = { pipeline, player, terrain, lighting, water, props, trees, ui };

    const clock = new THREE.Clock();
    let lastBiomeId = player.currentBiome;

    // Interaction triggers for audio unlocking
    const unlockAudio = () => audio.initAudio();
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
            }
        }

        lighting.update(realDt, pipeline.scene, playerPos, groundY);
        trees.updateGlow(realDt, lighting.timePhase, player.currentBiome);

        if (!ui.isPhotoMode) {
            const inputState = controls.getInputState();
            player.update(flightDt, inputState);
            terrain.update(playerPos.x, playerPos.z);
            water.update(playerPos.x, playerPos.z, realDt);
            props.update(playerPos.x, playerPos.z, realDt);
            trees.update(playerPos.x, playerPos.z);
        }

        ui.updateFPS();
        pipeline.render();
    }

    animate();
}

bootstrap().catch(console.error);
