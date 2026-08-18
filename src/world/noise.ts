// Pure procedural noise and elevation calculation engine

const perm = new Uint8Array(512);
// Deterministic pseudo-random seed for coherent infinite terrain
for (let i = 0; i < 512; i++) {
    perm[i] = ((i * 137 + 43) ^ (i * 31)) & 255;
}

export function snoise(x: number, z: number): number {
    let n0 = 0.0, n1 = 0.0, n2 = 0.0;
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (x + z) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(z + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Z0 = j - t;
    const x0 = x - X0;
    const z0 = z - Z0;
    let i1 = 0, j1 = 0;
    if (x0 > z0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const z1 = z0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const z2 = z0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    let t0 = 0.5 - x0 * x0 - z0 * z0;
    if (t0 < 0) n0 = 0.0;
    else {
        t0 *= t0;
        n0 = t0 * t0 * (x0 * (gi0 > 5 ? 1 : -1) + z0 * (gi0 % 2 === 0 ? 1 : -1));
    }

    let t1 = 0.5 - x1 * x1 - z1 * z1;
    if (t1 < 0) n1 = 0.0;
    else {
        t1 *= t1;
        n1 = t1 * t1 * (x1 * (gi1 > 5 ? 1 : -1) + z1 * (gi1 % 2 === 0 ? 1 : -1));
    }

    let t2 = 0.5 - x2 * x2 - z2 * z2;
    if (t2 < 0) n2 = 0.0;
    else {
        t2 *= t2;
        n2 = t2 * t2 * (x2 * (gi2 > 5 ? 1 : -1) + z2 * (gi2 % 2 === 0 ? 1 : -1));
    }

    return 70.0 * (n0 + n1 + n2);
}

export function terrainHeightJS(x: number, z: number): number {
    let y = snoise(x * 0.003, z * 0.003) * 55.0;
    y += snoise(x * 0.015, z * 0.015) * 10.0;
    if (y < 12) {
        y = (y - 12) * 0.2 + 12;
    }
    return y * 1.1;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const l2 = (ax - bx) ** 2 + (az - bz) ** 2;
    if (l2 === 0) return Math.hypot(px - ax, pz - az);
    let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
}

export const villageHousePositions: { x: number; z: number }[] = [];

export function getPathStrength(x: number, z: number): number {
    const scale = 0.002;
    const n1 = snoise(x * scale, z * scale);
    const n2 = snoise(x * scale * 2 + 1000, z * scale * 2 + 1000) * 0.3;
    const path = Math.abs(n1 + n2);
    const mask = smoothstep(0.15, 0.0, path);

    let vPath = 0;
    if (Math.abs(x) < 200 && Math.abs(z) < 200) {
        for (let i = 0; i < villageHousePositions.length; i++) {
            const p = villageHousePositions[i];
            const d = distToSegment(x, z, p.x, p.z, 0, 0);
            if (d < 5) {
                vPath = Math.max(vPath, smoothstep(5, 1.5, d));
            }
        }
    }

    return Math.max(mask, vPath);
}
