# Pre-existing defects, recorded before the rebuild

Captured from a running build at http://localhost:8085 before any rebuild task ran.
These are NOT caused by the menu rebuild. T7.1 must not report them as regressions.

## 1. Geometry merge errors in the vegetation loader

The console emits these repeatedly during tree catalog loading:

    THREE.BufferGeometryUtils: .mergeAttributes() failed.
      BufferAttribute.array must be of consistent array types across matching attributes.
    THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the normal attribute.
    (also seen for the position attribute)

Origin: `src/world/trees.ts`, the geometry merge path around lines 391-440. Some catalog .glb
models expose attributes with mismatched typed-array types, so the merge is skipped for those
models.

Out of scope for this work package: `src/world/` is frozen. Worth a separate brief later.

## 2. Bloom is set to zero and has no UI

Live values at capture: `strength 0, radius 0, threshold 0.7`.

Combined with the finding in README section 2.3 that no bloom control exists anywhere in the
product, this means bloom has never been adjustable and is currently switched off entirely. The
GLOW AND BLOOM section added in T4.1 will be the first time these values are reachable. Expect the
world to look different the first time someone raises them - that is the feature working, not a
regression.

## 3. Screenshots could not be captured in the authoring session

The browser pane did not composite frames (canvas reported 0x0), so pixel baselines were not
taken. `world_state_candyland_day.json` is a numeric substitute captured through `window.__game`:
bloom values, fog, scene background, every light, terrain shading mode, and all 9 sky island
transforms.

For T7.1, re-run the same snapshot expression and diff it against that file. A numeric diff is a
stricter check than comparing two PNGs by eye. If pixel baselines are wanted, capture them
manually with the dev server running before T2.1 lands.

## 4. Live M and O hotkeys resize the render target

`_ARCHIVE/deviceSimulator.ts:186-196` registers a global keydown handler:

- `M` calls `cycleDevice()`, which reaches `pipeline.handleResize(targetW, targetH)` at line 308
- `O` calls `setOrientation()` and resizes the same way

The simulator toolbar has no markup, so the class appears dead, but these two hotkeys are live and
have a visible effect: pressing `M` while flying resizes the canvas to a simulated phone or tablet
aspect with no visible control to undo it. The only escape is pressing `M` repeatedly until it
cycles back to fullscreen.

This is a strong candidate for part of the reported "menu is crazy" behaviour, and it is a trap
rather than a feature.

Deleting `deviceSimulator.ts` in T2.1 removes both hotkeys. That is a DELIBERATE removal, not a
regression. Do not reimplement M or O in the new UI.

Found by the T0.1 behaviour inventory sweep. A naive grep for `e.key === '...'` misses it, because
the comparison is against a local variable; this is exactly the kind of thing the inventory exists
to catch.
