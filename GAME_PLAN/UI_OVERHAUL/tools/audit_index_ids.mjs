// Audit: index.html may contain ONLY the ids in the frozen markup contract.
//
// The rebuild's core idea is that controls are declared as data in TypeScript and the DOM is
// generated from that data. Every id that creeps back into index.html is a control that can be
// half-wired again, which is the exact defect this package exists to remove.
//
// CONTRACTS.md section 9 freezes the allowed list. This tool enforces it.
// Run: node GAME_PLAN/UI_OVERHAUL/tools/audit_index_ids.mjs
// Exit code 1 when index.html carries an id outside the contract.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const htmlPath = path.join(root, 'index.html');

// Frozen by CONTRACTS.md section 9. Do not extend this list to make the audit pass.
// If a task genuinely needs a new mount point, the owner amends the contract first.
const ALLOWED = new Set([
    // required by code outside src/ui/
    'app',              // src/main.ts, renderer mount
    'touch-controls',   // src/player/controls.ts
    'joystick-zone',    // CSS only hit area
    'joystick-base',    // controls.ts toggles .resting / .active
    'joystick-knob',    // moved by transform
    'boost-btn',        // controls.ts toggles .active
    // mount points owned by the new UI, filled entirely from TypeScript
    'hud-root',
    'settings-root',
    'editor-root',
    'blueprint-root'
]);

if (!fs.existsSync(htmlPath)) {
    console.error('index.html not found at ' + htmlPath);
    process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const found = [...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]);
const unique = [...new Set(found)].sort();

const extra = unique.filter(id => !ALLOWED.has(id));
const missing = [...ALLOWED].filter(id => !unique.includes(id)).sort();
const lineCount = html.split('\n').length;

console.log('index.html lines:      ' + lineCount);
console.log('ids present:           ' + unique.length);
console.log('ids allowed:           ' + ALLOWED.size);
console.log('ids outside contract:  ' + extra.length);
console.log('contract ids missing:  ' + missing.length);

let bad = false;

if (extra.length) {
    bad = true;
    console.log('');
    console.log('OUTSIDE CONTRACT - these ids must not be in index.html.');
    console.log('Build them from TypeScript as a control schema instead:');
    for (const id of extra) console.log('  ' + id);
}

if (missing.length) {
    bad = true;
    console.log('');
    console.log('MISSING - the markup contract requires these and they are absent.');
    console.log('Removing one of these breaks code outside src/ui/:');
    for (const id of missing) console.log('  ' + id);
}

// Ceiling rationale: the markup is about 20 lines and the touch-control CSS block copied
// verbatim from the old index.html is about 93. That mandatory block plus a minimal reset puts
// an honest floor near 140, so 200 leaves headroom without letting the old 2353-line file creep
// back. Never lower this to the point where it pressures someone into rewriting the touch CSS -
// that block is behavioural and must stay verbatim. See CONTRACTS.md section 9.
if (lineCount > 200) {
    bad = true;
    console.log('');
    console.log('TOO LONG - index.html is ' + lineCount + ' lines, the ceiling is 200.');
    console.log('Markup or CSS that belongs in a TypeScript module has leaked back in.');
    console.log('Do NOT trim the touch-control CSS to get under this. Move other CSS to hud.css.');
}

if (bad) process.exit(1);

console.log('');
console.log('OK - index.html matches the frozen markup contract.');
