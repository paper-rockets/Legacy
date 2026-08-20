import { ControlDef } from '../panel/types';
import { TreeSystem, TREE_CATALOG, TreeCatalogItem } from '../../world/trees';
import { PropsSystem } from '../../world/props';
import { TerrainSystem } from '../../world/terrain';
import { RenderPipeline } from '../../core/renderer';
import { WorldPropsSystem } from '../../world/worldProps';
import { ThumbnailGenerator } from '../thumbnailGenerator';
import { globalConfigManager } from '../../core/config';
import { BiomeId } from '../../world/noise';

export interface VegetationTabContext {
    trees: TreeSystem;
    props: PropsSystem;
    terrain: TerrainSystem;
    pipeline: RenderPipeline;
    worldProps?: WorldPropsSystem;
    /** Read fresh on every call. The user can change biome without rebuilding the tab. */
    biomeId: () => BiomeId;
    status: (message: string, isError?: boolean) => void;
    rebuild?: () => void;
}

/** Tab-local UI state. */
interface TabState {
    search: string;
    category: 'all' | 'trees' | 'flowers';
    inspectedId: string | null;
}

export function buildVegetationTab(ctx: VegetationTabContext): ControlDef[] {
    const state: TabState = {
        search: '',
        category: 'all',
        inspectedId: null
    };

    const veg = () => globalConfigManager.getBiomeConfig(ctx.biomeId()).vegetation;
    const bloom = () => globalConfigManager.getBiomeConfig(ctx.biomeId()).bloom;

    function getFilteredCatalog(): TreeCatalogItem[] {
        const customItems = Array.from(ctx.trees.catalogModelMap.values()).map(e => e.item);
        const map = new Map<string, TreeCatalogItem>();
        for (const item of TREE_CATALOG) {
            if (item.category === 'Trees' || item.category === 'Flowers & Flora') {
                map.set(item.id, item);
            }
        }
        for (const item of customItems) map.set(item.id, item);
        const fullCatalog = Array.from(map.values());
        const q = state.search.trim().toLowerCase();

        return fullCatalog.filter((item) => {
            // Category filter
            if (state.category === 'trees' && item.category !== 'Trees') return false;
            if (state.category === 'flowers' && item.category !== 'Flowers & Flora') return false;

            // Search filter
            if (q) {
                const matchName = item.name.toLowerCase().includes(q);
                const matchCat = item.category?.toLowerCase().includes(q);
                const matchDesc = item.description?.toLowerCase().includes(q);
                if (!matchName && !matchCat && !matchDesc) return false;
            }

            return true;
        });
    }

    function getAllVegetationItems(): TreeCatalogItem[] {
        const customItems = Array.from(ctx.trees.catalogModelMap.values()).map(e => e.item);
        const map = new Map<string, TreeCatalogItem>();
        for (const item of TREE_CATALOG) {
            if (item.category === 'Trees' || item.category === 'Flowers & Flora') {
                map.set(item.id, item);
            }
        }
        for (const item of customItems) map.set(item.id, item);
        return Array.from(map.values());
    }

    function currentInspectedId(): string {
        if (state.inspectedId) return state.inspectedId;
        const selectedIds = veg().selectedTreeModelIds;
        if (selectedIds && selectedIds.length > 0) {
            return selectedIds[0];
        }
        const full = getAllVegetationItems();
        return full[0]?.id || 'candy_lollipop_spiral';
    }

    function getModelName(id: string): string {
        const full = getAllVegetationItems();
        const found = full.find(m => m.id === id);
        return found?.name || id;
    }

    const model = () => ctx.trees.getModelConfig(ctx.biomeId(), currentInspectedId());

    return [
        // ── 1. CATALOG ────────────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'CATALOG & SELECTION',
            children: [
                {
                    kind: 'search',
                    placeholder: 'Filter vegetation models...',
                    get: () => state.search,
                    set: (query: string) => {
                        state.search = query;
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Category',
                    options: [
                        { value: 'all', text: 'All' },
                        { value: 'trees', text: 'Trees' },
                        { value: 'flowers', text: 'Flowers' }
                    ],
                    get: () => state.category,
                    set: (cat) => {
                        state.category = cat as 'all' | 'trees' | 'flowers';
                    }
                },
                {
                    kind: 'buttonRow',
                    buttons: [
                        {
                            kind: 'button',
                            text: 'Select All',
                            tone: 'default',
                            onClick: () => {
                                const list = getFilteredCatalog();
                                for (const m of list) {
                                    ctx.trees.setBiomeTreeModelSelected(ctx.biomeId(), m.id, true);
                                }
                                ctx.status(`Selected ${list.length} models`);
                            }
                        },
                        {
                            kind: 'button',
                            text: 'Unselect All',
                            tone: 'default',
                            onClick: () => {
                                const list = getFilteredCatalog();
                                for (const m of list) {
                                    ctx.trees.setBiomeTreeModelSelected(ctx.biomeId(), m.id, false);
                                }
                                ctx.status(`Unselected ${list.length} models`);
                            }
                        }
                    ]
                },
                {
                    kind: 'cardGrid',
                    items: () => {
                        const filtered = getFilteredCatalog();
                        const selectedIds = veg().selectedTreeModelIds || [];
                        const activeInspected = currentInspectedId();

                        return filtered.map((item) => ({
                            id: item.id,
                            name: item.name,
                            meta: item.category,
                            thumbnail: () => ThumbnailGenerator.getModelThumbnail(item.path, item.previewImage),
                            state: () => (selectedIds.includes(item.id) ? 'ON' : 'OFF'),
                            active: () => selectedIds.includes(item.id),
                            selected: () => activeInspected === item.id
                        }));
                    },
                    onSelect: (id: string) => {
                        state.inspectedId = id;
                    },
                    onToggle: (id: string) => {
                        const selectedIds = veg().selectedTreeModelIds || [];
                        const isCurrentlySelected = selectedIds.includes(id);
                        ctx.trees.setBiomeTreeModelSelected(ctx.biomeId(), id, !isCurrentlySelected);
                    },
                    emptyText: 'No matching vegetation models found'
                },
                {
                    kind: 'custom',
                    mount: (host: HTMLElement) => {
                        const wrap = document.createElement('div');
                        wrap.className = 'dev-btn-row';

                        const btn = document.createElement('button');
                        btn.className = 'dev-btn';
                        btn.textContent = 'Upload Custom .GLB';

                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = '.glb,.gltf';
                        fileInput.style.display = 'none';

                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            fileInput.click();
                        });

                        fileInput.addEventListener('change', async () => {
                            const file = fileInput.files?.[0];
                            if (file) {
                                try {
                                    const buffer = await file.arrayBuffer();
                                    const loaded = await ctx.trees.loadCustomTreeModel(file.name, buffer, 1.0);
                                    state.inspectedId = loaded.id;
                                    ctx.status(`Uploaded and selected "${loaded.name}"`);
                                } catch (err: any) {
                                    ctx.status(`Upload error: ${err.message}`, true);
                                }
                            }
                        });

                        wrap.appendChild(btn);
                        wrap.appendChild(fileInput);
                        host.appendChild(wrap);
                    }
                }
            ]
        },

        // ── 2. SELECTED MODEL INSPECTOR ─────────────────────────────────────────
        {
            kind: 'section',
            title: 'SELECTED MODEL INSPECTOR',
            tag: () => getModelName(currentInspectedId()).toUpperCase(),
            children: [
                {
                    kind: 'select',
                    label: 'Inspect Model',
                    options: () => getAllVegetationItems().map(item => ({
                        value: item.id,
                        text: item.name
                    })),
                    get: () => currentInspectedId(),
                    set: (id: string) => {
                        state.inspectedId = id;
                    }
                },
                {
                    kind: 'toggle',
                    label: 'Status in Biome',
                    onLabel: 'Active (ON)',
                    offLabel: 'Inactive (OFF)',
                    get: () => {
                        const selectedIds = veg().selectedTreeModelIds || [];
                        return selectedIds.includes(currentInspectedId());
                    },
                    set: (active: boolean) => {
                        ctx.trees.setBiomeTreeModelSelected(ctx.biomeId(), currentInspectedId(), active);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Model scale',
                    min: 0.1,
                    max: 30.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    get: () => model().scale,
                    set: (v: number) => {
                        ctx.trees.setModelScale(ctx.biomeId(), currentInspectedId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Model density',
                    min: 0,
                    max: 800,
                    step: 5,
                    precision: 0,
                    numeric: true,
                    get: () => model().density,
                    set: (v: number) => {
                        ctx.trees.setModelDensity(ctx.biomeId(), currentInspectedId(), v);
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Model Texture Style',
                    hint: 'Shader texture styling applied to this specific model.',
                    options: [
                        { value: 'original', text: 'Original' },
                        { value: 'candy', text: 'Candy Gloss' },
                        { value: 'cotton_candy', text: 'Cotton Candy' },
                        { value: 'flutter', text: 'Flutter' },
                        { value: 'crystal', text: 'Crystal' },
                        { value: 'woodland', text: 'Woodland' },
                        { value: 'velvet', text: 'Velvet' }
                    ],
                    get: () => model().textureStyle || (model().useOriginalColors ? 'original' : 'candy'),
                    set: (val: string) => {
                        ctx.trees.setModelTextureStyle(ctx.biomeId(), currentInspectedId(), val as any);
                    }
                },
                {
                    kind: 'segmented',
                    label: 'Texture / Color Mode',
                    options: [
                        { value: 'original', text: 'Original Textures' },
                        { value: 'custom', text: 'Custom Colors' }
                    ],
                    get: () => (model().useOriginalColors ? 'original' : 'custom'),
                    set: (val: string) => {
                        ctx.trees.setModelColorMode(ctx.biomeId(), currentInspectedId(), val === 'original');
                    }
                },
                {
                    kind: 'swatchList',
                    label: 'Canopy Swatches',
                    visible: () => !model().useOriginalColors,
                    get: () => model().canopyColors || [],
                    set: (colors: string[]) => {
                        ctx.trees.setModelCanopyColors(ctx.biomeId(), currentInspectedId(), colors);
                    }
                },
                {
                    kind: 'swatchList',
                    label: 'Leaf Swatches',
                    visible: () => !model().useOriginalColors,
                    get: () => model().leafColors || [],
                    set: (colors: string[]) => {
                        ctx.trees.setModelLeafColors(ctx.biomeId(), currentInspectedId(), colors);
                    }
                },
                {
                    kind: 'swatchList',
                    label: 'Trunk Swatches',
                    visible: () => !model().useOriginalColors,
                    get: () => model().trunkColors || [],
                    set: (colors: string[]) => {
                        ctx.trees.setModelTrunkColors(ctx.biomeId(), currentInspectedId(), colors);
                    }
                }
            ]
        },

        // ── 3. BIOME GLOBAL VEGETATION ──────────────────────────────────────────
        {
            kind: 'section',
            title: 'BIOME GLOBAL VEGETATION',
            children: [
                {
                    kind: 'slider',
                    label: 'Overall Tree scale',
                    hint: 'Master scale multiplier for all trees in this biome.',
                    min: 0.2,
                    max: 25.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    get: () => veg().treeScale ?? 1.0,
                    set: (v: number) => {
                        ctx.trees.setBiomeTreeScale(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Overall Tree density',
                    hint: 'Master density multiplier for all trees in this biome.',
                    min: 0,
                    max: 800,
                    step: 10,
                    precision: 0,
                    numeric: true,
                    get: () => veg().treeDensity ?? 200,
                    set: (v: number) => {
                        ctx.trees.setBiomeTreeDensity(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bush scale',
                    min: 0.1,
                    max: 5.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    get: () => veg().bushScale ?? 1.0,
                    set: (v: number) => {
                        ctx.trees.setBiomeBushScale(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bush density',
                    min: 0,
                    max: 800,
                    step: 10,
                    precision: 0,
                    numeric: true,
                    get: () => veg().bushDensity ?? 100,
                    set: (v: number) => {
                        ctx.trees.setBiomeBushDensity(ctx.biomeId(), v);
                    }
                }
            ]
        },

        // ── 4. GLOW AND BLOOM ──────────────────────────────────────────────────
        {
            kind: 'section',
            title: 'GLOW AND BLOOM',
            children: [
                {
                    kind: 'toggle',
                    label: 'Dusk & Twilight Glow Sticks',
                    hint: 'Illuminates a subset of trees like vibrant neon glow sticks at dusk and twilight.',
                    onLabel: 'Glow Active (ON)',
                    offLabel: 'Glow Inactive (OFF)',
                    get: () => veg().glowStickEnabled !== false,
                    set: (v: boolean) => {
                        ctx.trees.setBiomeGlowStickEnabled(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Glow tree ratio',
                    hint: 'Percentage of trees in the biome that light up as glow sticks.',
                    min: 5,
                    max: 60,
                    step: 5,
                    unit: '%',
                    precision: 0,
                    numeric: true,
                    visible: () => veg().glowStickEnabled !== false,
                    get: () => Math.round((veg().glowStickRatio ?? 0.18) * 100),
                    set: (v: number) => {
                        ctx.trees.setBiomeGlowStickRatio(ctx.biomeId(), v / 100);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Glow stick intensity',
                    hint: 'Emissive neon brightness during dusk and twilight phases.',
                    min: 0.5,
                    max: 5.0,
                    step: 0.1,
                    unit: 'x',
                    numeric: true,
                    visible: () => veg().glowStickEnabled !== false,
                    get: () => veg().glowStickIntensity ?? 2.8,
                    set: (v: number) => {
                        ctx.trees.setBiomeGlowStickIntensity(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Master foliage glow',
                    hint: 'Baseline bioluminescent glow for all foliage in this biome.',
                    min: 0,
                    max: 100,
                    step: 5,
                    unit: '%',
                    precision: 0,
                    get: () => Math.round((veg().bioluminescence ?? 0.8) * 100),
                    set: (v: number) => {
                        ctx.trees.setBioluminescence(v / 100, ctx.biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bloom strength',
                    min: 0,
                    max: 3.0,
                    step: 0.05,
                    get: () => bloom().globalStrength ?? 0.0,
                    set: (v: number) => {
                        ctx.pipeline.setBloomStrength(v, ctx.biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bloom radius',
                    min: 0,
                    max: 2.0,
                    step: 0.05,
                    get: () => bloom().globalRadius ?? 0.0,
                    set: (v: number) => {
                        ctx.pipeline.setBloomRadius(v, ctx.biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Bloom threshold',
                    min: 0,
                    max: 1.0,
                    step: 0.05,
                    get: () => bloom().globalThreshold ?? 0.0,
                    set: (v: number) => {
                        ctx.pipeline.setBloomThreshold(v, ctx.biomeId());
                    }
                },
                {
                    kind: 'slider',
                    label: 'Cloud bloom',
                    min: 0,
                    max: 3.0,
                    step: 0.05,
                    get: () => bloom().cloudBloom ?? 0.0,
                    set: (v: number) => {
                        ctx.props.setBiomeCloud(ctx.biomeId(), { cloudBloom: v });
                    }
                },
                {
                    kind: 'slider',
                    label: 'Shoreline bloom',
                    min: 0,
                    max: 3.0,
                    step: 0.05,
                    get: () => bloom().shoreBloom ?? 0.0,
                    set: (v: number) => {
                        ctx.terrain.setShoreBloom(v, undefined, undefined, ctx.biomeId());
                    }
                }
            ]
        },

        // ── 5. CANDY & SHADER MATERIAL QUALITIES ────────────────────────────────
        {
            kind: 'section',
            title: 'CANOPY TEXTURES & SHADER QUALITIES',
            children: [
                {
                    kind: 'segmented',
                    label: 'Biome Texture Style',
                    hint: 'Master shader texture styling for all trees and vegetation in this biome.',
                    options: [
                        { value: 'original', text: 'Original Textures' },
                        { value: 'candy', text: 'Candy Gloss' },
                        { value: 'cotton_candy', text: 'Cotton Candy' },
                        { value: 'flutter', text: 'Foliage Flutter' },
                        { value: 'crystal', text: 'Prismatic Crystal' },
                        { value: 'woodland', text: 'Woodland Moss' },
                        { value: 'velvet', text: 'Velvet Bloom' }
                    ],
                    get: () => veg().textureStyle || 'candy',
                    set: (val: string) => {
                        ctx.trees.setBiomeTextureStyle(ctx.biomeId(), val as any);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Candy Gloss & Reflectivity',
                    hint: 'Glossy specular reflection and clearcoat shine on lollipop and candy surfaces.',
                    min: 0.0,
                    max: 3.0,
                    step: 0.05,
                    unit: 'x',
                    numeric: true,
                    get: () => veg().candyGloss ?? 1.35,
                    set: (v: number) => {
                        ctx.trees.setBiomeCandyGloss(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Sugar Crystal Sparkle',
                    hint: 'Crystalline glint and micro sugar facet sparkle on surfaces.',
                    min: 0.0,
                    max: 3.0,
                    step: 0.05,
                    unit: 'x',
                    numeric: true,
                    get: () => veg().sugarSparkle ?? 0.85,
                    set: (v: number) => {
                        ctx.trees.setBiomeSugarSparkle(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Candy Translucency',
                    hint: 'Subsurface jelly translucency and backlit candy transmission.',
                    min: 0.0,
                    max: 2.0,
                    step: 0.05,
                    unit: 'x',
                    numeric: true,
                    get: () => veg().candyTranslucency ?? 0.70,
                    set: (v: number) => {
                        ctx.trees.setBiomeCandyTranslucency(ctx.biomeId(), v);
                    }
                },
                {
                    kind: 'toggle',
                    label: 'Floating Candy Planets',
                    hint: 'Floating hard candy planets with spinning crystalline sugar rings.',
                    onLabel: 'Planets Active (ON)',
                    offLabel: 'Planets Inactive (OFF)',
                    visible: () => ctx.biomeId() === 'candyland',
                    get: () => veg().floatingPlanetsEnabled !== false,
                    set: (v: boolean) => {
                        ctx.worldProps?.setFloatingPlanetsEnabled(v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Planet Float Altitude',
                    hint: 'Elevation height of floating candy planets above terrain.',
                    min: 5.0,
                    max: 40.0,
                    step: 1.0,
                    unit: 'm',
                    numeric: true,
                    visible: () => ctx.biomeId() === 'candyland' && veg().floatingPlanetsEnabled !== false,
                    get: () => veg().floatingPlanetAltitude ?? 14.0,
                    set: (v: number) => {
                        ctx.worldProps?.setFloatingPlanetAltitude(v);
                    }
                },
                {
                    kind: 'slider',
                    label: 'Floating Planet Count',
                    hint: 'Number of floating hard candy planets spawned in Candyland.',
                    min: 1,
                    max: 3,
                    step: 1,
                    precision: 0,
                    numeric: true,
                    visible: () => ctx.biomeId() === 'candyland' && veg().floatingPlanetsEnabled !== false,
                    get: () => veg().floatingPlanetCount ?? 3,
                    set: (v: number) => {
                        ctx.worldProps?.setFloatingPlanetCount(v);
                    }
                }
            ]
        }
    ];
}
