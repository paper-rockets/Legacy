import { CASTLE_MODEL_CATALOG } from '../world/skyCastles';

export type CastleEditorListener = () => void;

export interface CastleEditorState {
    /** Island id, or null when the archipelago is empty. */
    readonly selectedIslandId: string | null;
    /** Sets selection and notifies every listener exactly once. No-op if unchanged. */
    select(id: string | null): void;
    /** Castle model path staged for click-to-place on the blueprint grid. */
    readonly pendingModelPath: string;
    setPendingModel(path: string): void;
    /** True while the blueprint grid is in click-to-place mode. */
    readonly placementMode: boolean;
    setPlacementMode(active: boolean): void;
    /** Notify listeners without changing anything. Call after any island mutation. */
    notify(): void;
    subscribe(listener: CastleEditorListener): () => void;
}

let _selectedIslandId: string | null = null;
let _pendingModelPath: string = CASTLE_MODEL_CATALOG[0].path;
let _placementMode: boolean = false;
const listeners: CastleEditorListener[] = [];

function notify(): void {
    for (const listener of listeners.slice()) {
        listener();
    }
}

export const castleEditorState: CastleEditorState = {
    get selectedIslandId(): string | null {
        return _selectedIslandId;
    },
    select(id: string | null): void {
        if (_selectedIslandId === id) return;
        _selectedIslandId = id;
        notify();
    },
    get pendingModelPath(): string {
        return _pendingModelPath;
    },
    setPendingModel(path: string): void {
        _pendingModelPath = path;
        notify();
    },
    get placementMode(): boolean {
        return _placementMode;
    },
    setPlacementMode(active: boolean): void {
        _placementMode = active;
        notify();
    },
    notify(): void {
        notify();
    },
    subscribe(listener: CastleEditorListener): () => void {
        listeners.push(listener);
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }
};
