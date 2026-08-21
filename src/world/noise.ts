// Pure procedural noise and elevation calculation engine

const perm = new Uint8Array(512);
const gradX = new Float32Array(512);
const gradZ = new Float32Array(512);

// Deterministic pseudo-random seed for coherent infinite terrain
for (let i = 0; i < 512; i++) {
    const val = ((i * 137 + 43) ^ (i * 31)) & 255;
    perm[i] = val;
    const gi = val % 12;
    gradX[i] = gi > 5 ? 1.0 : -1.0;
    gradZ[i] = gi % 2 === 0 ? 1.0 : -1.0;
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

    const gi0 = ii + perm[jj];
    const gi1 = ii + i1 + perm[jj + j1];
    const gi2 = ii + 1 + perm[jj + 1];

    let t0 = 0.5 - x0 * x0 - z0 * z0;
    if (t0 > 0) {
        t0 *= t0;
        n0 = t0 * t0 * (x0 * gradX[gi0] + z0 * gradZ[gi0]);
    }

    let t1 = 0.5 - x1 * x1 - z1 * z1;
    if (t1 > 0) {
        t1 *= t1;
        n1 = t1 * t1 * (x1 * gradX[gi1] + z1 * gradZ[gi1]);
    }

    let t2 = 0.5 - x2 * x2 - z2 * z2;
    if (t2 > 0) {
        t2 *= t2;
        n2 = t2 * t2 * (x2 * gradX[gi2] + z2 * gradZ[gi2]);
    }

    return 70.0 * (n0 + n1 + n2);
}

export type BiomeId = 'candyland' | 'meadow' | 'archipelago' | 'geothermal' | 'fishing_village' | 'redwood' | 'sky_citadel';

export interface BiomeWeights {
    candyland: number;
    meadow: number;
    archipelago: number;
    geothermal: number;
    fishing_village: number;
    redwood: number;
    sky_citadel?: number;
}

export interface BiomeLocation {
    id: BiomeId;
    name: string;
    description: string;
    x: number;
    z: number;
    y?: number;
}

export const BIOME_LOCATIONS: BiomeLocation[] = [
    {
        id: 'candyland',
        name: 'Candyland',
        description: '',
        x: 0,
        z: 0
    },
    {
        id: 'meadow',
        name: 'Meadow',
        description: '',
        x: 0,
        z: 2560
    },
    {
        id: 'archipelago',
        name: 'Archipelago',
        description: '',
        x: 3200,
        z: 3200
    },
    {
        id: 'geothermal',
        name: 'Geothermal',
        description: '',
        x: 3200,
        z: -3200
    },
    {
        id: 'fishing_village',
        name: 'Fishing Village',
        description: '',
        x: -3200,
        z: 3200
    },
    {
        id: 'redwood',
        name: 'Redwood',
        description: '',
        x: -3200,
        z: -3200
    },
    {
        id: 'sky_citadel',
        name: 'Citadel',
        description: '',
        x: 0,
        z: -200,
        y: 650
    }
];

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function getBiomeWeights(x: number, z: number): BiomeWeights {
    const distOrigin = Math.hypot(x, z);
    const originCandy = smoothstep(1520, 1040, distOrigin);

    // Meadow channel in the +Z direction
    const distMeadow = Math.hypot(x, z - 2560);
    const meadowWeight = smoothstep(1440, 880, distMeadow) * (1.0 - originCandy);

    // Region weights based on coordinates with smooth 400m blend border around axes
    const blendRange = 400;
    const wxPositive = smoothstep(-blendRange, blendRange, x);
    const wxNegative = 1.0 - wxPositive;
    const wzPositive = smoothstep(-blendRange, blendRange, z);
    const wzNegative = 1.0 - wzPositive;

    const remainingOuter = (1.0 - originCandy) * (1.0 - meadowWeight);

    let wArch = wxPositive * wzPositive * remainingOuter;
    let wGeoth = wxPositive * wzNegative * remainingOuter;
    let wFish = wxNegative * wzPositive * remainingOuter;
    let wRed = wxNegative * wzNegative * remainingOuter;
    let wMeadow = meadowWeight;
    let wCandy = originCandy;

    const total = wCandy + wMeadow + wArch + wGeoth + wFish + wRed + 0.00001;
    return {
        candyland: wCandy / total,
        meadow: wMeadow / total,
        archipelago: wArch / total,
        geothermal: wGeoth / total,
        fishing_village: wFish / total,
        redwood: wRed / total
    };
}

export function getDominantBiome(x: number, z: number, y?: number): BiomeId {
    if (y !== undefined && y >= 250) {
        return 'sky_citadel';
    }
    const w = getBiomeWeights(x, z);
    let maxW = w.candyland;
    let dominant: BiomeId = 'candyland';
    if (w.meadow > maxW) { maxW = w.meadow; dominant = 'meadow'; }
    if (w.archipelago > maxW) { maxW = w.archipelago; dominant = 'archipelago'; }
    if (w.geothermal > maxW) { maxW = w.geothermal; dominant = 'geothermal'; }
    if (w.fishing_village > maxW) { maxW = w.fishing_village; dominant = 'fishing_village'; }
    if (w.redwood > maxW) { maxW = w.redwood; dominant = 'redwood'; }
    return dominant;
}

export function getDominantBiomeName(x: number, z: number, y?: number): string {
    const id = getDominantBiome(x, z, y);
    switch (id) {
        case 'candyland': return 'Candyland';
        case 'meadow': return 'Meadow';
        case 'archipelago': return 'Archipelago';
        case 'geothermal': return 'Geothermal';
        case 'fishing_village': return 'Fishing Village';
        case 'redwood': return 'Redwood';
        case 'sky_citadel': return 'Citadel';
    }
}

// 0. Candyland: Pillowy marshmallow rolling hills, soft mounds, puffy sugar dunes
function heightCandyland(x: number, z: number): number {
    const broadPuff = snoise(x * 0.0035, z * 0.0035);
    const moundShape = Math.sin(broadPuff * Math.PI) * 16.0 + 15.0;
    const puff1 = Math.pow(Math.max(0, snoise(x * 0.008 + 100, z * 0.008 + 100)), 1.5) * 8.0;
    const puff2 = Math.pow(Math.max(0, snoise(x * 0.015 - 50, z * 0.015 - 50)), 1.8) * 3.5;
    let y = moundShape + puff1 + puff2;
    return Math.max(3.8, y);
}

// 1. Lush Meadow: Gentle rolling hills, soft valleys, flower paths
function heightMeadow(x: number, z: number): number {
    let y = snoise(x * 0.003, z * 0.003) * 26.0 + 16.0;
    y += snoise(x * 0.012, z * 0.012) * 5.5;
    return Math.max(3.5, y);
}

// 2. Floating Archipelago: Smooth soaring island mountains, gentle plateaus, and rolling ocean knolls
function heightArchipelago(x: number, z: number): number {
    // Smooth broad mountain domes and gentle peaks
    const mountainRaw = Math.max(0, snoise(x * 0.0032 + 250, z * 0.0032 - 250));
    const smoothMountains = Math.pow(mountainRaw, 1.75) * 85.0;

    // Gentle rolling plateaus
    const plateauBase = snoise(x * 0.0020 + 500, z * 0.0020 + 500);
    const plateau = smoothstep(0.08, 0.60, plateauBase) * 42.0;

    // Soft rolling secondary swells (smooth low-frequency, no sharp crags)
    const softSwell = snoise(x * 0.006, z * 0.006) * 4.5;
    let y = 3.5 + smoothMountains + plateau + softSwell;
    return Math.max(2.8, y);
}

// 3. Geothermal Ridge: Rolling volcanic ridges, smooth basalt crests, and gentle sunken caldera valleys
function heightGeothermal(x: number, z: number): number {
    const broad = snoise(x * 0.0025, z * 0.0025) * 44.0 + 36.0;
    const ridgeNoise = snoise(x * 0.006 + 200, z * 0.006 - 200) * 12.0;
    const smoothDetail = snoise(x * 0.012, z * 0.012) * 3.5;

    let y = broad + ridgeNoise + smoothDetail;

    const calderaNoise = snoise(x * 0.0018 + 700, z * 0.0018 - 700);
    if (calderaNoise < -0.22) {
        const calderaDepth = smoothstep(-0.22, -0.65, calderaNoise) * 28.0;
        y -= calderaDepth;
    }
    return Math.max(3.0, y);
}

// 4. Fishing Village: Expansive coastal ocean, sweeping bays, smooth sandy beachfronts, and emerald coastal bluffs
function heightFishingVillage(x: number, z: number): number {
    // Harbor center in scaled coordinates
    const dx = x - (-2000);
    const dz = z - 2000;
    const distToHarbor = Math.hypot(dx, dz);

    // Natural harbor basin around center: broad sheltered bay of open water
    const harborBasin = smoothstep(650, 180, distToHarbor) * -0.45;

    // Broad continental ocean / bay landmass mask (low frequency for smooth natural bays & open sea)
    const oceanShape = snoise(x * 0.0016 + 240, z * 0.0016 - 240);
    const bayNoise = snoise(x * 0.0032 + 500, z * 0.0032 + 120) * 0.35;
    const landMass = oceanShape + bayNoise + harborBasin;

    // Coastal hills & bluffs
    const hillsNoise = snoise(x * 0.0024 + 120, z * 0.0024 - 120);
    const hillHeight = Math.pow(Math.max(0, hillsNoise + 0.22), 1.6) * 26.0;
    const bluffTerrace = snoise(x * 0.0048 + 320, z * 0.0048 - 280) * 3.2;

    // Smooth shoreline beach transition:
    // Submerged seabed floor when landMass <= 0.0
    // Sloping beach across the y = 2.5m water plane into lush hills
    const beachT = smoothstep(-0.08, 0.38, landMass);
    const oceanFloor = -2.5 + Math.sin(x * 0.0015 + z * 0.0015) * 1.2;
    const landY = 1.2 + beachT * (hillHeight + bluffTerrace + 4.8);

    const y = oceanFloor * (1.0 - beachT) + landY * beachT;
    return Math.max(-5.0, Math.min(32.0, y));
}

// 5. Colossal Redwood: Towering grand mountain massifs (110m), deep valleys, monolithic slopes
function heightRedwood(x: number, z: number): number {
    const mountains = snoise(x * 0.0018, z * 0.0018) * 65.0 + 42.0;
    const ridges = (1.0 - Math.abs(snoise(x * 0.005 + 100, z * 0.005 - 100))) * 28.0;
    const detail = snoise(x * 0.014, z * 0.014) * 8.0;

    let y = mountains + ridges + detail;
    if (y < 12.0) {
        y = (y - 12.0) * 0.3 + 12.0;
    }
    return Math.max(3.5, y);
}

export function terrainHeightWithWeights(x: number, z: number, w: BiomeWeights): number {
    const sx = x * 0.625;
    const sz = z * 0.625;
    return heightCandyland(sx, sz) * w.candyland +
           heightMeadow(sx, sz) * w.meadow +
           heightArchipelago(sx, sz) * w.archipelago +
           heightGeothermal(sx, sz) * w.geothermal +
           heightFishingVillage(sx, sz) * w.fishing_village +
           heightRedwood(sx, sz) * w.redwood;
}

export function terrainHeightJS(x: number, z: number): number {
    const w = getBiomeWeights(x, z);
    return terrainHeightWithWeights(x, z, w);
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
    const scale = 0.00125;
    const n1 = snoise(x * scale, z * scale);
    const n2 = snoise(x * scale * 2 + 1000, z * scale * 2 + 1000) * 0.3;
    const path = Math.abs(n1 + n2);
    const mask = smoothstep(0.15, 0.0, path);

    let vPath = 0;
    if (Math.abs(x) < 320 && Math.abs(z) < 320) {
        for (let i = 0; i < villageHousePositions.length; i++) {
            const p = villageHousePositions[i];
            const d = distToSegment(x, z, p.x, p.z, 0, 0);
            if (d < 8) {
                vPath = Math.max(vPath, smoothstep(8, 2.4, d));
            }
        }
    }

    return Math.max(mask, vPath);
}
