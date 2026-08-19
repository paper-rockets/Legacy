export interface FlightModelDef {
    id: string;
    name: string;
    file: string;
    preferredAnim?: string;
    scale?: number;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    offsetY?: number;
}

export const FLIGHT_MODELS: FlightModelDef[] = [
    {
        id: 'animated_parrot',
        name: 'Scarlet Macaw',
        file: 'Assets/Flight/animated_parrot.glb',
        preferredAnim: '02-flying',
        scale: 1.0,
        offsetY: -1.6
    },
    {
        id: 'american_robin',
        name: 'American Robin',
        file: 'Assets/Flight/american_robin_-_in_flight.glb',
        preferredAnim: 'Wings Flapping',
        scale: 1.0
    },
    {
        id: 'wood_pewee',
        name: 'Eastern Wood-Pewee',
        file: 'Assets/Flight/eastern_wood-pewee_-_in_flight.glb',
        preferredAnim: 'Wings Flapping',
        scale: 1.0
    },

    {
        id: 'blue_butterfly',
        name: 'Blue Morpho Butterfly',
        file: 'Assets/Flight/borboleta_azul_-_butterfly.glb',
        preferredAnim: 'ArmatureAction.001',
        scale: 1.0
    },
    {
        id: 'birds_flock',
        name: 'Flock of Birds',
        file: 'Assets/Flight/birds.glb',
        preferredAnim: 'Scene',
        scale: 1.0
    },
    {
        id: 'parrot_tropical',
        name: 'Tropical Parrot',
        file: 'Assets/Flight/parrot_ai.glb',
        preferredAnim: 'Object_0',
        scale: 1.0
    },
    {
        id: 'mitsubishi_b2m2',
        name: 'Mitsubishi B2M2',
        file: 'Assets/Flight/mitsubishi_b2m2_-_game_art_1_stylized_plane.glb',
        preferredAnim: 'Flying',
        scale: 0.22,
        rotY: Math.PI,
        offsetY: -0.15
    }
];
