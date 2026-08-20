# Handoff - LEGACY Menu Rebuild

For the next agent picking this up cold. Read this file completely before touching anything.

Repository: `E:\GAME FINAL RUN\LEGACY`
Stack: Three.js 0.185.1, Vite 6, TypeScript 5.8, no framework.
Written: 2026-08-19, after tasks T0.1, T1.1 and T2.1 were completed and verified.

---

## 1. What this project is and what the owner asked for

A Three.js flight game. The menu system had grown unmanageable: a settings dropdown that edited the
world, a six-tab developer editor, a separate blueprint view that duplicated the editor, and a
device simulator. Controls were scattered, duplicated, and in many cases silently dead.

The owner's request, in their words, reduced to requirements:

1. **Settings should be a decoy.** Clicking Settings opens a window that does nothing. It exists so
   the game looks like a game.
2. **All real controls live under Developer Options.**
3. **The core need is vegetation:** place trees and plants, scale them, edit their colours, edit
   bloom, and make settings permanent.
4. **Fix the castle editor.** It had duplicated sections and sections that appeared cut off.

Requirement 3 is the heart of it. Everything else is in service of it.

---

## 2. Why the previous attempts failed, and what changed

Earlier attempts (including with Gemini) produced changes that compiled and ran but did not
actually work. The reason is mechanical, not a matter of effort:

Every DOM lookup in the old codebase was written as

```ts
const el = document.getElementById('dev-castle-x') as HTMLInputElement | null;
if (el) { ... }
```

A missing element throws nothing, logs nothing, and renders nothing. The control is simply absent
and the code behind it never runs. **59 element ids were bound in TypeScript with no markup at
all.** That included the entire castle transform block (21 controls), the castle colour pickers
(9), and the whole cloud-sea fog deck (10). Those are the "parts of menu cut off" the owner saw:
real headings with missing controls, failing silently.

So the work was never difficult. It was **unverifiable**. An agent edits one side, the build is
green, the game runs, the control does nothing, and nobody can tell.

Three things now make it verifiable. Do not remove them:

| Guard rail | What it proves |
| --- | --- |
| `tools/audit_dom_ids.mjs` | Every id bound in TypeScript has markup. Was 59 dangling, now **0**. |
| `tools/audit_index_ids.mjs` | Markup has not crept back into index.html. Only 10 ids allowed. |
| `window.__panelAudit()` | Every control accessor actually runs. Not yet built - it ships in T3.1. |

And the architecture removes the failure mode at the root. See section 5.

---

## 3. Current state, verified not assumed

Last verified immediately before this handoff was written:

```
npm run lint  (tsc --noEmit)                exit 0
node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs      0 dangling references
node GAME_PLAN/UI_OVERHAUL/tools/audit_index_ids.mjs    OK, 148 lines, 10 ids
```

### Done

| Task | Result |
| --- | --- |
| T0.1 | Old UI archived to `_ARCHIVE/` (9 files, md5-verified byte-identical). `BEHAVIOUR_INVENTORY.md` written: 173 checklist lines, 22 marked BROKEN, 20 marked DUPLICATE. Numeric world-state baseline captured. |
| T1.1 | `src/ui/panel/types.ts` (211 lines, byte-identical to CONTRACTS.md section 1) and `src/ui/castleEditorState.ts` (65 lines). |
| T2.1 | The clean break. `index.html` 2353 -> 148 lines. `devEditor.ts`, `topViewController.ts`, `ui.ts`, `deviceSimulator.ts` DELETED. New `hud.ts`, `photoMode.ts`, `settingsWindow.ts`, `hud.css` written. `main.ts` rewired. Dangling ids 59 -> 0. |

### Current file layout

```
index.html                     148 lines, 10 ids, nothing else
src/main.ts                    boots the world, mounts hud/settings/photoMode
src/vite-env.d.ts              vite/client types (added during handoff, see section 7)
src/ui/
  hud.ts                       top bar: pause, time phases, avatar, biome, FPS, fullscreen, cog
  hud.css
  photoMode.ts                 implemented, NO UI trigger yet - see section 8
  settingsWindow.ts            the decoy. Exactly 2 interactive controls.
  castleEditorState.ts         shared castle selection state (frozen contract)
  thumbnailGenerator.ts        untouched, works, keep
  panel/
    types.ts                   FROZEN control schema. Do not edit.
```

### Not started

T3.1 (next), T4.1, T4.2, T4.3, T5.1, T6.1, T7.1. Roughly 80% of the work by effort remains.

---

## 4. The immediate next task: T3.1

The full brief is in `TASKS.md` section E. A previous attempt at it was terminated by an API usage
limit before writing any code, so **no partial work exists** - start clean. A stray scratch file it
left (`src/ui/panel/__probe.ts`) has already been deleted.

Summary:

- **Create** `src/ui/panel/render.ts`, `src/ui/panel/panel.css`, `src/ui/panel/shell.ts`,
  `src/ui/editorFooter.ts`
- **Modify** `src/main.ts` only, to mount the shell and point F2 and `Developer Options` at it
  (they currently hit a placeholder that logs `[editor] not implemented until T3.1`)
- Implement `renderPanel(host, defs): PanelHandle` covering all 13 control kinds in `types.ts`
- Build the editor frame: header, biome strip, 4 tabs, scrolling body, **fixed footer**
- Build the save footer, visible on every tab

Two requirements in T3.1 are load-bearing and easy to get wrong:

1. **`refresh()` must update elements in place and must never recreate a slider input.** Recreating
   one mid-drag drops pointer capture and the slider stops following the cursor. Also skip
   overwriting a slider's own `.value` while it is being dragged, or the thumb fights the pointer.
   The brief requires proving this by object identity: hold a reference to the input node, run
   `refresh()` in a loop during a drag, and assert it is the same node afterwards.
2. **`window.__panelAudit()`** must be implemented. When `import.meta.env.DEV`, wrap the first call
   of every `get()`, `visible()` and `disabled()` in try/catch and return the ones that throw. Every
   later task uses this to prove its controls are wired. Without it, later tasks fall back to
   "it compiles", which is exactly how this codebase broke.

---

## 5. The architecture, and why it prevents a relapse

**Controls are declared once, as data, in TypeScript. The DOM is generated from that data.**

```ts
{ kind: 'slider', label: 'Tree scale', min: 0.5, max: 30, step: 0.1, unit: 'x',
  get: () => veg().treeScale,
  set: v => trees.setBiomeTreeScale(biomeId(), v) }
```

There is no id and no markup. A control cannot be half-wired, because the label, the read path and
the write path are one literal the compiler checks. Adding a control means adding one object.

This is why `index.html` is capped at 10 ids and 200 lines, enforced by `audit_index_ids.mjs`.
**If you find yourself adding an id to index.html, you are building markup that should be a schema
entry instead.** That instinct is the exact thing that produced the original 59 dead controls.

---

## 6. Rules that must not be broken

From `README.md` section 6. A task violating one is rejected regardless of how well it otherwise
works.

1. **No icons, emojis, or unicode symbols.** Anywhere. Code, UI text, comments, reports. ASCII only.
2. **Do not tune world values.** Lighting, sun offsets, colour constants, material settings are
   protected. This package builds a menu. Every default a control shows is read from
   `globalConfigManager` at runtime, never hard-coded into a schema.
3. **Do not touch `package.json`, `vite.config.ts`, or `tsconfig.json`.** No new dependencies. The
   panel runtime is plain DOM.
4. **Do not modify `src/world/`, `src/core/`, `src/player/`, `src/audio/`.** Exactly one exception
   exists in the whole package: T4.1 deletes five dead glow aliases from `trees.ts`.
5. **`src/ui/panel/types.ts` is frozen.** It is byte-identical to CONTRACTS.md section 1. If a task
   seems to need a field that is not there, STOP and report it. Do not invent one.
6. **`npm run lint` must exit 0 after every task**, and both audits must keep passing.
7. **The world must render identically when the editor is closed.**

`RULES.md` rule 1 (2-5 line changes) is suspended for `index.html`, `src/main.ts` and `src/ui/`,
and only those.

---

## 7. Environment gotchas that cost real time

These are not theoretical. Each one burned turns during this session.

- **A dev server may already be running on port 8085.** Check before starting another. The launch
  config lives at the REPO ROOT (`E:\GAME FINAL RUN\.claude\launch.json`), entry name `LEGACY`, not
  in the LEGACY folder.
- **Screenshots do not work in this environment.** The browser pane does not composite; the canvas
  reports 0x0 and screenshot calls time out after 5s. Verify with `read_page`,
  `read_console_messages` and `javascript_tool` instead. This is a limitation of the tooling
  session, not the game.
- **`javascript_tool` shares one scope across calls.** Declaring `const g` twice throws
  `Identifier 'g' has already been declared`. Always wrap snippets in an IIFE:
  `(function(){ ... return JSON.stringify(x); })();`
- **Avoid `getComputedStyle` and `innerText` in browser probes.** They force layout on a heavy WebGL
  page and reliably time out at 30s. Use `textContent`, `className`, `offsetWidth`. If you truly
  need computed style, do it on one element in an otherwise tiny snippet.
- **The tab reports `document.hidden = true`, so Chromium suspends `requestAnimationFrame`.**
  Anything driven by the render loop will not tick. Call update methods directly to test them.
- **`curl` to localhost fails from the Bash tool** (sandbox restriction), even when the server is
  fine. Use the browser tools to check the server, not curl.
- **`npx tsc --noEmit` can take 2-4 minutes** on this machine. Give it a generous timeout. A
  120s default will time out and look like a failure.
- **Known pre-existing console errors, not yours.** Repeated
  `THREE.BufferGeometryUtils: .mergeAttributes() failed` / `.mergeGeometries() failed` from the
  vegetation loader. Do not chase these. Documented in `baseline/PRE_EXISTING_DEFECTS.md`.
- **`import.meta.env.DEV` did not type-check** because `tsconfig.json` never referenced
  `vite/client`, and tsconfig is frozen. Resolved during this handoff by adding `src/vite-env.d.ts`
  with a triple-slash reference. Verified: it now compiles with exit 0. **This previously blocked an
  agent mid-task.**

---

## 8. Open items and deliberate decisions

- **Photo mode has no UI trigger.** `src/ui/photoMode.ts` is fully implemented but reachable only
  via `window.__game.photoMode.enter()`. This is intentional: the decoy Settings window cannot hold
  real controls. It gets its home in T4.3, in the WORLD tab's SESSION TOOLS section. Do not wire it
  anywhere else.
- **Bloom is currently `strength 0, radius 0`** and has never had any UI. When T4.1 adds the GLOW
  AND BLOOM controls, raising these will visibly change the world. That is the feature working, not
  a regression.
- **The `M` and `O` hotkeys are gone, deliberately.** The deleted device simulator registered global
  handlers where `M` called `pipeline.handleResize()` and distorted the viewport with no visible way
  to undo it. Do not reimplement them.
- **There are 7 biomes, not 8.** A biome named Prism Sanctum was deleted from the project by the
  owner because it looked bad. `BIOME_LOCATIONS` in `src/world/noise.ts` is the source of truth.
  **Always iterate that array. Never hard-code a biome count or list.**
- **`package.json` is still named `react-example`.** Leftover scaffolding. Cosmetic. Do not fix it;
  `package.json` is frozen.

---

## 9. Safety - read before deleting anything

**There are two nested git repositories. Know which one you are in.**

```
E:\GAME FINAL RUN\           outer repo - does NOT track LEGACY/src/
E:\GAME FINAL RUN\LEGACY\    LEGACY's own repo - DOES track src/, this is the one that matters
```

Running `git ls-files LEGACY/src/` from the outer repo returns nothing, which makes it look like
the source was never committed. That is misleading. **Always run git commands from inside
`LEGACY/`.** All four deleted UI files are in LEGACY's history and can be recovered:

```bash
git -C "E:/GAME FINAL RUN/LEGACY" log --oneline -- src/ui/devEditor.ts
git -C "E:/GAME FINAL RUN/LEGACY" checkout <commit> -- src/ui/devEditor.ts
```

There are therefore two recovery paths, and they are not equivalent:

1. **git history** - the last committed state of a file.
2. **`GAME_PLAN/UI_OVERHAUL/_ARCHIVE/`** - 9 files, md5-verified byte-identical to the WORKING TREE
   at the moment of archiving. Several were dirty relative to HEAD, so the archive holds
   uncommitted edits that git history does not. Prefer the archive when restoring, precisely
   because it captures that later state.

Current work is committed on branch `menu-rebuild-snapshot` (commit `7a37c3a`), covering phases
T0.1, T1.1 and T2.1. Note that the outer repo also has roughly 1300 untracked files including
several hundred MB of `.glb` assets; do NOT run `git add -A` there, as git retains large blobs
permanently.

---

## 10. Remaining task order

Full briefs are in `TASKS.md`. Give an agent the preamble in TASKS.md section A plus exactly one
brief. Do not hand out two briefs at once.

| Task | What | Parallel? |
| --- | --- | --- |
| **T3.1** | Panel runtime, editor shell, save footer | no - blocks everything |
| T4.1 | VEGETATION tab - the owner's core requirement | yes, with T4.2 and T4.3 |
| T4.2 | OBJECTS tab - structure and vessel placement | yes |
| T4.3 | WORLD tab - terrain, water, sky, performance, session tools | yes |
| T5.1 | CASTLES tab + rewritten blueprint view | no - depends on all of Phase 4 |
| T6.1 | Layout, responsive, touch | no |
| T7.1 | Acceptance sweep against `BEHAVIOUR_INVENTORY.md` | no |

T4.1, T4.2 and T4.3 touch different files and are the only genuine parallelism available.

---

## 11. How to know a task is actually done

Not "it compiles". The bar for every task from here:

```bash
npm run lint                                            # exit 0
npm run build                                           # succeeds
node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs      # 0 dangling
node GAME_PLAN/UI_OVERHAUL/tools/audit_index_ids.mjs    # OK
```

plus, in a browser with the dev server running:

- `window.__panelAudit()` returns `[]` with the relevant tab open
- **every control the task touched has been observed changing the world**, reported one line each

That last point is the whole discipline. A described observation per control is the deliverable.
The reason this rebuild exists is 59 controls that compiled, ran, and did nothing.
