/**
 * Fast, reliable thumbnail resolver for models and catalog cards.
 * Uses direct pre-rendered PNG preview images from /Assets/Previews/ and rich procedural vector icons for Candyland.
 */

const PREVIEW_MAP: Record<string, string> = {
    // Trees & Vegetation
    'veg_bigtree_1': '/Assets/Previews/veg_bigtree_1.png',
    'bigtree2_var1': '/Assets/Previews/veg_bigtree_1.png',
    'veg_bush_flowers': '/Assets/Previews/veg_bush_flowers.png',
    'bush_common_flowers': '/Assets/Previews/veg_bush_flowers.png',
    'veg_cartoon_1': '/Assets/Previews/veg_cartoon_1.png',
    'cartoon_trees_pack_tree_1': '/Assets/Previews/veg_cartoon_1.png',
    'veg_cartoon_2': '/Assets/Previews/veg_cartoon_2.png',
    'cartoon_trees_pack_tree_2': '/Assets/Previews/veg_cartoon_2.png',
    'veg_cartoon_7': '/Assets/Previews/veg_cartoon_7.png',
    'cartoon_trees_pack_tree_7': '/Assets/Previews/veg_cartoon_7.png',
    'veg_cartoon_8': '/Assets/Previews/veg_cartoon_8.png',
    'cartoon_trees_pack_tree_8': '/Assets/Previews/veg_cartoon_8.png',
    'veg_cartoon_10': '/Assets/Previews/veg_cartoon_10.png',
    'cartoon_trees_pack_tree_10': '/Assets/Previews/veg_cartoon_10.png',
    'veg_cartoon_11': '/Assets/Previews/veg_cartoon_11.png',
    'cartoon_trees_pack_tree_11': '/Assets/Previews/veg_cartoon_11.png',
    'veg_cartoon_12': '/Assets/Previews/veg_cartoon_12.png',
    'cartoon_trees_pack_tree_12': '/Assets/Previews/veg_cartoon_12.png',
    'veg_tree_broadleaf_1': '/Assets/Previews/veg_tree_broadleaf_1.png',
    'cartoon_trees_tree_1': '/Assets/Previews/veg_tree_broadleaf_1.png',
    'veg_tree_broadleaf_2': '/Assets/Previews/veg_tree_broadleaf_2.png',
    'cartoon_trees_tree_2': '/Assets/Previews/veg_tree_broadleaf_2.png',
    'veg_tree_broadleaf_3': '/Assets/Previews/veg_tree_broadleaf_3.png',
    'cartoon_trees_tree_3': '/Assets/Previews/veg_tree_broadleaf_3.png',
    'veg_clover_2': '/Assets/Previews/veg_clover_2.png',
    'clover_2': '/Assets/Previews/veg_clover_2.png',
    'veg_fantasy_jungle': '/Assets/Previews/veg_fantasy_jungle.png',
    'fantasy_jungle_tree': '/Assets/Previews/veg_fantasy_jungle.png',
    'veg_flower2_var3': '/Assets/Previews/veg_flower2_var3.png',
    'flower2_var3': '/Assets/Previews/veg_flower2_var3.png',
    'veg_flower3_group': '/Assets/Previews/veg_flower3_group.png',
    'flower_3_group': '/Assets/Previews/veg_flower3_group.png',
    'veg_flower3_single': '/Assets/Previews/veg_flower3_single.png',
    'flower_3_single': '/Assets/Previews/veg_flower3_single.png',
    'veg_flower4_single': '/Assets/Previews/veg_flower4_single.png',
    'flower_4_single': '/Assets/Previews/veg_flower4_single.png',
    'veg_flower_var4': '/Assets/Previews/veg_flower_var4.png',
    'flower_var4': '/Assets/Previews/veg_flower_var4.png',
    'veg_palm_a': '/Assets/Previews/veg_palm_a.png',
    'geo_palmtree_a': '/Assets/Previews/veg_palm_a.png',
    'veg_palm_c': '/Assets/Previews/veg_palm_c.png',
    'geo_palmtree_c': '/Assets/Previews/veg_palm_c.png',
    'veg_cherry_blossom': '/Assets/Previews/veg_cherry_blossom.png',
    'tree_tree_10': '/Assets/Previews/veg_cherry_blossom.png',
    'veg_tree_var4': '/Assets/Previews/veg_tree_var4.png',
    'tree_var4': '/Assets/Previews/veg_tree_var4.png',

    // Castles
    'fairytale_castle_high_0': '/Assets/Previews/other_castle_high.png',
    'fairytale_castle_high_1': '/Assets/Previews/other_castle_high.png',
    'fairytale_castle_high_compressed': '/Assets/Previews/other_castle_high.png',
    'fairytale_castle_med_0': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_2': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_3': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_4': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_5': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_6': '/Assets/Previews/other_castle_variant.png',
    'fairytale_castle_med_compressed': '/Assets/Previews/other_castle_variant.png',
    'caste_compressed_instanced_l1': '/Assets/Previews/other_castle_high.png',
    'caste_instanced': '/Assets/Previews/other_castle_high.png'
};

export class ThumbnailGenerator {
    private static cache: Map<string, string> = new Map();

    public static async getModelThumbnail(modelPath: string, previewUrl?: string): Promise<string> {
        if (this.cache.has(modelPath)) {
            return this.cache.get(modelPath)!;
        }

        // Special procedural candyland icons
        if (modelPath.includes('candy_cotton_cloud') || modelPath.includes('cotton_candy')) {
            const url = this.generateCottonCandySVG();
            this.cache.set(modelPath, url);
            return url;
        }
        if (modelPath.includes('candy_lollipop_spiral') || modelPath.includes('lollipop_spiral') || modelPath.includes('swirl_lollipop')) {
            const url = this.generateSwirlLollipopSVG();
            this.cache.set(modelPath, url);
            return url;
        }
        if (modelPath.includes('candy_lollipop_sphere') || modelPath.includes('round_pop')) {
            const url = this.generateSpherePopSVG();
            this.cache.set(modelPath, url);
            return url;
        }
        if (modelPath.includes('candy_cane')) {
            const url = this.generateCandyCaneSVG();
            this.cache.set(modelPath, url);
            return url;
        }
        if (modelPath.includes('candy_gummy_flower') || modelPath.includes('gummy')) {
            const url = this.generateGummyFlowerSVG();
            this.cache.set(modelPath, url);
            return url;
        }

        if (previewUrl && !previewUrl.includes('placeholder')) {
            this.cache.set(modelPath, previewUrl);
            return previewUrl;
        }

        // 1. Try exact map match
        const cleanPath = modelPath.toLowerCase();
        for (const [key, url] of Object.entries(PREVIEW_MAP)) {
            if (cleanPath.includes(key)) {
                this.cache.set(modelPath, url);
                return url;
            }
        }

        // 2. Fallback procedural SVG if not in map
        const dataUrl = this.generateFallbackSVG(modelPath);
        this.cache.set(modelPath, dataUrl);
        return dataUrl;
    }

    private static generateCottonCandySVG(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <defs>
                <linearGradient id="stick" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="50%" stop-color="#fce7f3"/>
                    <stop offset="100%" stop-color="#cbd5e1"/>
                </linearGradient>
                <radialGradient id="cloud1" cx="40%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="#fbcfe8"/>
                    <stop offset="60%" stop-color="#f472b6"/>
                    <stop offset="100%" stop-color="#db2777"/>
                </radialGradient>
                <radialGradient id="cloud2" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#bae6fd"/>
                    <stop offset="65%" stop-color="#38bdf8"/>
                    <stop offset="100%" stop-color="#0284c7"/>
                </radialGradient>
                <radialGradient id="cloud3" cx="40%" cy="30%" r="60%">
                    <stop offset="0%" stop-color="#fef08a"/>
                    <stop offset="70%" stop-color="#facc15"/>
                    <stop offset="100%" stop-color="#eab308"/>
                </radialGradient>
            </defs>
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.08)"/>
            
            <!-- Treat Stick -->
            <line x1="80" y1="75" x2="80" y2="148" stroke="url(#stick)" stroke-width="8" stroke-linecap="round"/>
            <line x1="80" y1="80" x2="80" y2="142" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4 6"/>

            <!-- Fluffy Cotton Candy Clouds -->
            <circle cx="58" cy="72" r="26" fill="url(#cloud2)"/>
            <circle cx="102" cy="72" r="26" fill="url(#cloud1)"/>
            <circle cx="64" cy="50" r="25" fill="url(#cloud1)"/>
            <circle cx="96" cy="48" r="25" fill="url(#cloud2)"/>
            <circle cx="80" cy="36" r="24" fill="url(#cloud3)"/>
            <circle cx="80" cy="58" r="28" fill="url(#cloud1)" opacity="0.95"/>
            
            <!-- Sparkles -->
            <circle cx="70" cy="38" r="3" fill="#ffffff" opacity="0.8"/>
            <circle cx="92" cy="56" r="2.5" fill="#ffffff" opacity="0.8"/>
            <circle cx="56" cy="65" r="2" fill="#ffffff" opacity="0.8"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    private static generateSwirlLollipopSVG(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <defs>
                <linearGradient id="stick" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="100%" stop-color="#e2e8f0"/>
                </linearGradient>
                <radialGradient id="popbg" cx="45%" cy="45%" r="55%">
                    <stop offset="0%" stop-color="#ff77a9"/>
                    <stop offset="60%" stop-color="#f43f5e"/>
                    <stop offset="100%" stop-color="#be123c"/>
                </radialGradient>
            </defs>
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.08)"/>
            
            <!-- Stick -->
            <line x1="80" y1="85" x2="80" y2="148" stroke="url(#stick)" stroke-width="8" stroke-linecap="round"/>

            <!-- Big Swirl Wheel -->
            <circle cx="80" cy="56" r="42" fill="url(#popbg)" stroke="#ffffff" stroke-width="2"/>
            
            <!-- Spiral Stripes -->
            <path d="M80,56 Q95,30 112,42 T118,72 Q105,98 80,98 Q52,98 42,75 Q35,50 56,30 Q80,14 105,25 Q125,38 120,68" 
                  fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
            <path d="M80,56 Q68,42 62,56 Q60,70 75,76 Q90,80 98,68 Q102,52 88,44" 
                  fill="none" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
            
            <!-- Center Button -->
            <circle cx="80" cy="56" r="8" fill="#ffffff"/>
            <circle cx="80" cy="56" r="5" fill="#f43f5e"/>
            
            <!-- Bow -->
            <polygon points="80,95 68,103 80,100 92,103" fill="#a855f7"/>
            <circle cx="80" cy="98" r="3" fill="#ffffff"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    private static generateSpherePopSVG(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <defs>
                <radialGradient id="sphere" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="25%" stop-color="#c084fc"/>
                    <stop offset="70%" stop-color="#9333ea"/>
                    <stop offset="100%" stop-color="#581c87"/>
                </radialGradient>
            </defs>
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.08)"/>
            
            <!-- Stick -->
            <line x1="80" y1="85" x2="80" y2="148" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>

            <!-- Round Sphere Pop -->
            <circle cx="80" cy="55" r="36" fill="url(#sphere)"/>
            
            <!-- Collar Ring -->
            <ellipse cx="80" cy="88" rx="14" ry="5" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>

            <!-- Specular Highlight -->
            <ellipse cx="68" cy="42" rx="10" ry="6" fill="#ffffff" opacity="0.65" transform="rotate(-30 68 42)"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    private static generateCandyCaneSVG(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <defs>
                <linearGradient id="cane" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="100%" stop-color="#f1f5f9"/>
                </linearGradient>
            </defs>
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.08)"/>
            
            <!-- Left Cane -->
            <path d="M60,140 L60,50 A20,20 0 0,1 100,50 L100,65" fill="none" stroke="url(#cane)" stroke-width="14" stroke-linecap="round"/>
            <path d="M60,140 L60,50 A20,20 0 0,1 100,50 L100,65" fill="none" stroke="#ef4444" stroke-width="14" stroke-dasharray="10 12" stroke-linecap="round"/>

            <!-- Right Mini Cane -->
            <path d="M95,140 L95,75 A15,15 0 0,1 125,75 L125,85" fill="none" stroke="url(#cane)" stroke-width="10" stroke-linecap="round"/>
            <path d="M95,140 L95,75 A15,15 0 0,1 125,75 L125,85" fill="none" stroke="#10b981" stroke-width="10" stroke-dasharray="8 10" stroke-linecap="round"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    private static generateGummyFlowerSVG(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <defs>
                <radialGradient id="petal" cx="40%" cy="30%" r="70%">
                    <stop offset="0%" stop-color="#fde047"/>
                    <stop offset="60%" stop-color="#fbbf24"/>
                    <stop offset="100%" stop-color="#d97706"/>
                </radialGradient>
                <radialGradient id="center" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#ff77a9"/>
                    <stop offset="70%" stop-color="#f43f5e"/>
                    <stop offset="100%" stop-color="#9f1239"/>
                </radialGradient>
            </defs>
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.08)"/>
            
            <!-- Stem -->
            <line x1="80" y1="80" x2="80" y2="145" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>

            <!-- 5 Petals -->
            <circle cx="80" cy="40" r="16" fill="url(#petal)"/>
            <circle cx="102" cy="54" r="16" fill="url(#petal)"/>
            <circle cx="94" cy="78" r="16" fill="url(#petal)"/>
            <circle cx="66" cy="78" r="16" fill="url(#petal)"/>
            <circle cx="58" cy="54" r="16" fill="url(#petal)"/>

            <!-- Center Gumdrop -->
            <circle cx="80" cy="60" r="14" fill="url(#center)"/>
            <circle cx="76" cy="55" r="3" fill="#ffffff" opacity="0.75"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    private static generateFallbackSVG(path: string): string {
        const basename = path.split('/').pop()?.replace('.glb', '').toLowerCase() || 'model';
        const cleanTitle = basename.replace(/_/g, ' ').toUpperCase();

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
            <rect width="160" height="160" fill="#0f172a" rx="8" stroke="rgba(255,255,255,0.1)"/>
            <polygon points="80,45 115,70 80,95 45,70" fill="#10b981"/>
            <polygon points="45,70 80,95 80,120 45,95" fill="#059669"/>
            <polygon points="80,95 115,70 115,95 80,120" fill="#34d399"/>
            <text x="80" y="145" fill="#94a3b8" font-size="9" font-weight="700" font-family="sans-serif" text-anchor="middle">${cleanTitle.slice(0, 16)}</text>
        </svg>`;

        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
}
