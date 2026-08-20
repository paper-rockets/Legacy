// Audit: every DOM id referenced from TypeScript must exist in index.html.
// Silent null guards in devEditor.ts and topViewController.ts mean a missing
// element produces no error at all, only a control that quietly does nothing.
// Run: node GAME_PLAN/UI_OVERHAUL/tools/audit_dom_ids.mjs
// Exit code 1 when a referenced id has no markup.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const htmlPath = path.join(root, 'index.html');
const srcDir = path.join(root, 'src');

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith('.ts')) out.push(full);
    }
    return out;
}

// Union of every root-level entry HTML, so ids owned by terrain_comparison.html
// and the other demo pages are not reported against index.html.
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html')).map(f => path.join(root, f));
const htmlIds = new Set();
for (const hf of htmlFiles) {
    const text = fs.readFileSync(hf, 'utf-8');
    for (const m of text.matchAll(/id="([a-zA-Z0-9_-]+)"/g)) htmlIds.add(m[1]);
}
const html = fs.readFileSync(htmlPath, 'utf-8');
const indexIds = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

// Ids created at runtime by document.createElement + el.id = '...' are legal.
const files = walk(srcDir);
const runtimeIds = new Set();
for (const f of files) {
    const text = fs.readFileSync(f, 'utf-8');
    for (const m of text.matchAll(/\.id\s*=\s*['"]([a-zA-Z0-9_-]+)['"]/g)) runtimeIds.add(m[1]);
    for (const m of text.matchAll(/id="([a-zA-Z0-9_-]+)"/g)) runtimeIds.add(m[1]);
}

const refs = new Map();
for (const f of files) {
    const text = fs.readFileSync(f, 'utf-8');
    const rel = path.relative(root, f).split(path.sep).join('/');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
            if (!refs.has(m[1])) refs.set(m[1], []);
            refs.get(m[1]).push(rel + ':' + (i + 1));
        }
        // string-id helpers: setSliderAndLabel('a','b',..), setInputValueAndHex('a','b',..)
        for (const m of line.matchAll(/(?:setSliderAndLabel|setInputValueAndHex|bindSlider|bindColor|requireEl)\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*,\s*['"]([a-zA-Z0-9_-]+)['"]/g)) {
            for (const id of [m[1], m[2]]) {
                if (!refs.has(id)) refs.set(id, []);
                refs.get(id).push(rel + ':' + (i + 1));
            }
        }
    });
}

const missing = [...refs.keys()]
    .filter(id => !htmlIds.has(id) && !runtimeIds.has(id))
    .sort();

console.log('index.html ids:            ' + indexIds.size);
console.log('all entry html ids:        ' + htmlIds.size);
console.log('ids referenced from src:   ' + refs.size);
console.log('dangling references:       ' + missing.length);

if (missing.length) {
    console.log('');
    console.log('DANGLING - code binds these ids but no markup defines them:');
    for (const id of missing) {
        console.log('  ' + id);
        for (const site of [...new Set(refs.get(id))]) console.log('      ' + site);
    }
    process.exit(1);
}
console.log('');
console.log('OK - every referenced id has markup.');
