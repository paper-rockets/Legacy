// Paste into the browser console with the game running to produce a world-state
// fingerprint in the same shape as world_state_candyland_day.json.
// T7.1 diffs the result against that file to prove the rebuild did not move the render.
// Capture with the same biome and time phase as the baseline: candyland, phase 0.
(function () {
  const gm = window.__game;
  const r = (n) => (typeof n === 'number' ? Number(n.toFixed(4)) : n);
  const snap = {
    bloom: {
      strength: r(gm.pipeline.bloomPass.strength),
      radius: r(gm.pipeline.bloomPass.radius),
      threshold: r(gm.pipeline.bloomPass.threshold)
    },
    timePhase: gm.lighting.timePhase,
    fog: gm.pipeline.scene.fog
      ? { color: '#' + gm.pipeline.scene.fog.color.getHexString(), near: r(gm.pipeline.scene.fog.near), far: r(gm.pipeline.scene.fog.far) }
      : null,
    background: (gm.pipeline.scene.background && gm.pipeline.scene.background.getHexString)
      ? '#' + gm.pipeline.scene.background.getHexString()
      : null,
    lights: gm.pipeline.scene.children.filter(o => o.isLight).map(l => ({
      type: l.type, color: '#' + l.color.getHexString(), intensity: r(l.intensity)
    })),
    terrainToon: gm.terrain.isToonMode,
    biome: gm.player.currentBiome,
    islandCount: gm.skyCastles.getIslands().length,
    islands: gm.skyCastles.getIslands().map(i => ({
      id: i.id, x: r(i.x), y: r(i.y), z: r(i.z), rot: r(i.rotationY), scale: r(i.scale),
      model: String(i.modelPath).split('/').pop()
    }))
  };
  return JSON.stringify(snap, null, 1);
})();
