# Frozen Contracts

These interfaces are written once, in task T1.1, and then treated as immutable. Every other task
imports from `src/game/types.ts` and codes against exactly these shapes.

Rule for delegated agents: if a contract below does not give you a field you think you need, you
do NOT add it. Stop and report the gap. Changing a contract silently breaks every parallel agent.

All code in this document is the intended final content of the named files. Copy it verbatim.

---

## 1. src/game/types.ts

```ts
import * as THREE from 'three';
import { BiomeId } from '../world/noise';

/** Built once per frame by GameDirector and passed to every subsystem. Read only. */
export interface GameContext {
    /** Flight delta time. Zero while the flight is paused. */
    dt: number;
    /** Real delta time. Never zero. Use for UI and effect animation. */
    realDt: number;
    /** Seconds since the game layer started. */
    elapsed: number;
    /** Live reference to the player position. Never mutate directly. */
    playerPos: THREE.Vector3;
    /** Live reference to the player orientation. Never mutate directly. */
    playerQuat: THREE.Quaternion;
    /** Player forward speed in metres per second. */
    playerSpeed: number;
    /** Player position on the previous frame, for swept collision tests. */
    prevPlayerPos: THREE.Vector3;
    /** Current dominant biome, already accounts for the sky citadel altitude rule. */
    biomeId: BiomeId;
    /** 0 day, 1 dusk, 2 twilight. Mirrors LightingSystem.timePhase. */
    timePhase: number;
    /** True while the flight is paused, in photo mode, or in top view. */
    isPaused: boolean;
}

export type ObjectiveKind =
    | 'collect_dust'
    | 'start_rings'
    | 'next_ring'
    | 'open_bridge'
    | 'ride_bridge'
    | 'wake_castle'
    | 'free_flight';

/** What the HUD line and the guide trail are currently pointing at. */
export interface Objective {
    kind: ObjectiveKind;
    /** One short line of child friendly text. Present tense. No icons. */
    text: string;
    /** World position the guide trail points at, or null for no target. */
    target: THREE.Vector3 | null;
    /** 0 to 1 progress for objectives that have a measurable amount. */
    progress: number;
}

/** Per biome tuning. Every field is optional in a registry entry; the default fills the gaps. */
export interface BiomeGameplayDef {
    /** Height above terrain at which dust motes float. Default 34. */
    dustAltitude: number;
    /** Motes per 200 metre cell, 0 to 3. Default 2. */
    dustPerCell: number;
    /** Radius of a rainbow ring in metres. Default 26. */
    ringRadius: number;
    /** Height above terrain for the ring chain. Default 55. */
    ringAltitude: number;
    /** Number of rings in the chain. Default 8. */
    ringCount: number;
    /** Radius in metres of the loop the ring chain traces around the biome centre. Default 420. */
    ringSpread: number;
    /** Accent colour for this biome dust and rings. Default 0xfff0a8. */
    accentColor: number;
    /** If true, rings sit just above water level rather than above terrain. Default false. */
    followsWater: boolean;
}

export interface CastleProgress {
    /** Matches SkyCastleIslandDef.id. */
    castleId: string;
    claimed: boolean;
    /** Key into CASTLE_COLOR_PRESETS chosen by the player after claiming. */
    dressUpPreset: string | null;
}

export interface SaveDataV1 {
    schema: 1;
    /** Lifetime dust collected. */
    dust: number;
    /** Current Rainbow Meter charge, 0 to meterMax. */
    meter: number;
    /** Meter capacity. Grows by one tier per castle claimed. */
    meterTier: number;
    /** Biome ids whose ring chain has been completed at least once. */
    feathers: string[];
    /** Biome ids whose Rainbow Bridge has been opened at least once. */
    bridges: string[];
    /** Per castle progress, keyed by castle id. Unknown ids are ignored on load. */
    castles: Record<string, CastleProgress>;
    /** FlightModels ids the player has unlocked. */
    friends: string[];
    /** True once all castles are claimed. */
    skySovereign: boolean;
    /** Epoch millis of the last successful save. */
    savedAt: number;
}

export type GameEventName =
    | 'dust'          // payload: { amount: number; combo: number; pos: THREE.Vector3 }
    | 'combo'         // payload: { combo: number }
    | 'meterFull'     // payload: {}
    | 'ringPassed'    // payload: { index: number; total: number }
    | 'featherEarned' // payload: { biomeId: string }
    | 'bridgeOpened'  // payload: { biomeId: string }
    | 'castleWoken'   // payload: { castleId: string }
    | 'friendUnlocked'// payload: { modelId: string }
    | 'sovereign'     // payload: {}
    | 'objective';    // payload: Objective

export interface GameSubsystem {
    /** Called once per frame with the shared context. */
    update(ctx: GameContext): void;
    /** Release geometry, materials and DOM. Called on teardown only. */
    dispose(): void;
}
```

---

## 2. src/game/GameState.ts public surface

Implementation is task T1.2. Only this surface may be relied on by other tasks.

```ts
export class GameState {
    /** Live save data. Treat as read only outside GameState. */
    readonly data: SaveDataV1;

    /** Meter capacity for the current tier. */
    get meterMax(): number;

    /** Adds dust with the current combo applied. Emits 'dust' and possibly 'meterFull'. */
    addDust(baseAmount: number, pos: THREE.Vector3): void;

    /** Current combo multiplier, 1 to 5. */
    get combo(): number;

    /** Advances or decays the combo window. Called by GameDirector every frame. */
    tickCombo(realDt: number): void;

    hasFeather(biomeId: string): boolean;
    grantFeather(biomeId: string): void;

    isBridgeOpen(biomeId: string): boolean;
    openBridge(biomeId: string): void;

    isCastleClaimed(castleId: string): boolean;
    claimCastle(castleId: string): void;

    getDressUp(castleId: string): string | null;
    setDressUp(castleId: string, presetKey: string): void;

    isFriendUnlocked(modelId: string): boolean;

    /** Subscribe. Returns an unsubscribe function. */
    on(event: GameEventName, fn: (payload: any) => void): () => void;

    /** Emit. Internal use plus GameDirector. */
    emit(event: GameEventName, payload: any): void;

    /** Debounced write to localStorage. Never throws. */
    save(): void;

    /** Wipes progress. Only reachable from the developer editor, never from the child UI. */
    reset(): void;
}
```

Save behaviour requirements, non negotiable:

- Load never throws. A malformed or absent value produces a fresh default save.
- A save that fails to parse is preserved under `wanderlust.save.v1.broken` before being replaced.
- Unknown biome ids and castle ids in a loaded save are kept in the object but ignored by logic,
  so removing and re adding a biome does not lose progress.
- Writes are debounced to at most one per two seconds, plus one on `visibilitychange` to hidden.

---

## 3. src/game/GameDirector.ts public surface

Implementation is task T1.3.

```ts
export class GameDirector {
    readonly state: GameState;
    /** Master switch used for performance measurement. Default true. */
    enabled: boolean;

    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        player: PlayerSystem,
        skyCastles: SkyCastleSystem,
        audio: AmbientAudioEngine,
        lighting: LightingSystem
    );

    /** Called once per frame from main.ts. flightDt is zero while paused. */
    update(flightDt: number, realDt: number): void;

    /** The only sanctioned way for a subsystem to add altitude to the player. */
    applyLift(metresPerSecond: number): void;

    /** The only sanctioned way for a subsystem to slow the player. factor is 0 to 1. */
    applyDrag(factor: number): void;

    /** Current objective, mirrored to the HUD. */
    readonly objective: Objective;

    dispose(): void;
}
```

`GameDirector` construction order is fixed: state, audio, then subsystems in the order dust,
rings, cloud deck, bridge, crown trials, then the effect systems, then the HUD last so it can
subscribe to every event.

---

## 4. src/game/BiomeGameplay.ts

Implementation is task T1.6. This file is the single extension point for future biomes.

```ts
import { BiomeId } from '../world/noise';
import { BiomeGameplayDef } from './types';

export const DEFAULT_BIOME_GAMEPLAY: BiomeGameplayDef = {
    dustAltitude: 34,
    dustPerCell: 2,
    ringRadius: 26,
    ringAltitude: 55,
    ringCount: 8,
    ringSpread: 420,
    accentColor: 0xfff0a8,
    followsWater: false
};

/** Optional per biome flavour. A missing entry is legal and uses the default. */
export const BIOME_GAMEPLAY: Partial<Record<BiomeId, Partial<BiomeGameplayDef>>> = {
    candyland:   { accentColor: 0xffb3d9, dustAltitude: 28, ringSpread: 340 },
    meadow:      { accentColor: 0xbdf7a8, dustAltitude: 30 },
    archipelago: { accentColor: 0xa8e6ff, dustAltitude: 55, ringAltitude: 90, ringSpread: 520 },
    geothermal:  { accentColor: 0xffc48a, dustAltitude: 45, ringAltitude: 75 },
    estuary:     { accentColor: 0x9df5e0, dustAltitude: 22, ringAltitude: 26, followsWater: true },
    redwood:     { accentColor: 0xffe9a8, dustAltitude: 60, ringAltitude: 95 },
    sky_citadel: { accentColor: 0xfff6ea, dustPerCell: 1, ringCount: 0 }
};

/** Always use this. Never index BIOME_GAMEPLAY directly. */
export function getBiomeGameplay(id: BiomeId): BiomeGameplayDef {
    return { ...DEFAULT_BIOME_GAMEPLAY, ...(BIOME_GAMEPLAY[id] ?? {}) };
}
```

A `ringCount` of 0 means the biome has no ring chain, which is correct for `sky_citadel`
because the castles themselves are the content up there.

---

## 5. Subsystem constructor signatures

Fixed so that T1.3 can be written before the subsystems exist.

```ts
new DustField(scene: THREE.Scene, state: GameState);
new RingCourse(scene: THREE.Scene, state: GameState);
new CloudDeck(state: GameState, skyCastles: SkyCastleSystem, director: GameDirector);
new RainbowBridge(scene: THREE.Scene, state: GameState, director: GameDirector);
new CrownTrials(scene: THREE.Scene, state: GameState, skyCastles: SkyCastleSystem);
new SparkleBurst(scene: THREE.Scene);
new GuideTrail(scene: THREE.Scene);
new GameAudio(audio: AmbientAudioEngine);
new GameHUD(state: GameState, director: GameDirector);
new CastleDressUp(state: GameState, skyCastles: SkyCastleSystem);
```

All of them implement `GameSubsystem`. `SparkleBurst` additionally exposes
`burst(pos: THREE.Vector3, color: number, count: number): void`, and `GuideTrail` exposes
`setTarget(pos: THREE.Vector3 | null, color: number): void`.

---

## 6. Rendering conventions for the game layer

After Phase 0 the renderer is `WebGPURenderer`. All game visuals therefore follow these rules:

- Import materials from `three/webgpu`, never `three`. Use `MeshBasicNodeMaterial` for glowing
  game objects and `MeshToonNodeMaterial` if a game object needs scene lighting.
- Import shader helpers from `three/tsl`.
- Import math, geometry, `Object3D`, `InstancedMesh` and so on from `three` as before.
- Every game visual is one `InstancedMesh`. No per object meshes, ever.
- Glow comes from bloom picking up an emissive colour above 1.0, not from extra passes.
- Game objects set `frustumCulled = false` because instance positions move independently of the
  mesh origin, and instead cull by writing a zero scale matrix to unused instances.
- No game object casts or receives shadows.

Reference pattern for an animated instanced glow material:

```ts
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, instanceIndex, time, sin, float, vec3, mix } from 'three/tsl';

const uAccent = uniform(new THREE.Color(0xfff0a8));
const uPulse  = uniform(1.0);

const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
const phase = instanceIndex.toFloat().mul(0.7);
const wave  = sin(time.mul(2.2).add(phase)).mul(0.5).add(0.5);
mat.colorNode = vec3(uAccent).mul(float(1.4).add(wave.mul(uPulse)));
mat.opacityNode = float(0.55).add(wave.mul(0.35));
```

The exact node names available in Three 0.185.1 can be confirmed against the working sibling
project at `E:\GAME FINAL RUN\WEBGPU\src\shaders`, which already imports from `three/tsl`.

---

## 7. HUD markup contract

`index.html` gains exactly one block, appended after the existing `#touch-controls` element.
No existing element is modified. Task T1.5 owns this.

```html
<div id="game-hud">
  <div id="game-hud-left">
    <div id="hud-meter-track"><div id="hud-meter-fill"></div></div>
    <div id="hud-dust">0</div>
    <div id="hud-combo"></div>
  </div>
  <div id="game-hud-objective"></div>
  <div id="game-hud-crowns"></div>
</div>
```

Styling rules for the target player: minimum 18 px numerals, high contrast on a translucent dark
pill consistent with the existing `#top-bar` treatment, no icons, no emoji, no decorative glyphs.
The HUD must be hidden whenever `#photo-mode-ui` is active, matching the existing photo mode
behaviour in `src/ui/ui.ts`.
