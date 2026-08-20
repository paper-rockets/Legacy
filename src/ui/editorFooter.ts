import { ControlDef } from './panel/types';
import { globalConfigManager } from '../core/config';

export interface EditorFooterContext {
    biomeId: () => string;
    status: (message: string, isError?: boolean) => void;
    rebuild: () => void;
}

export function buildEditorFooter(ctx: EditorFooterContext): ControlDef[] {
    return [
        {
            kind: 'buttonRow',
            buttons: [
                {
                    kind: 'button',
                    text: 'Save this biome',
                    tone: 'default',
                    onClick: () => {
                        const bId = ctx.biomeId();
                        globalConfigManager.saveBiomeDefault(bId as any);
                        ctx.status(`Saved defaults for ${bId.toUpperCase()}`);
                    }
                },
                {
                    kind: 'button',
                    text: 'Save all biomes',
                    tone: 'default',
                    onClick: () => {
                        globalConfigManager.saveGlobalDefaults();
                        ctx.status('Saved defaults for ALL biomes');
                    }
                }
            ]
        },
        {
            kind: 'buttonRow',
            buttons: [
                {
                    kind: 'button',
                    text: 'SAVE PERMANENTLY TO DISK',
                    tone: 'success',
                    onClick: async () => {
                        ctx.status('Saving configuration to disk...');
                        const res = await globalConfigManager.saveConfigToDisk();
                        ctx.status(res.message, !res.success);
                    }
                },
                {
                    kind: 'button',
                    text: 'Reset',
                    tone: 'danger',
                    onClick: () => {
                        const bId = ctx.biomeId();
                        if (window.confirm(`Reset biome "${bId}" to its default saved settings?`)) {
                            globalConfigManager.resetBiomeDefaults(bId as any);
                            ctx.rebuild();
                            ctx.status(`Reset ${bId.toUpperCase()} to defaults`);
                        }
                    }
                }
            ]
        }
    ];
}
