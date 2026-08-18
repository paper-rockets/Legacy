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
        scale: 1.0
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
        id: 'monarch_butterfly',
        name: 'Monarch Butterfly',
        file: 'Assets/Flight/idl_flight_on_spot.glb',
        preferredAnim: 'Take 001',
        scale: 1.0
    },
    {
        id: 'seaplane',
        name: 'Porco Rosso Seaplane',
        file: 'Assets/Flight/porco_rosso_-_seaplane.glb',
        preferredAnim: 'PropellerAction',
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
        id: 'parrot_classic',
        name: 'Classic Parrot',
        file: 'Assets/Flight/parrot.glb',
        preferredAnim: 'Take 001',
        scale: 1.0
    },
    {
        id: 'parrot_tropical',
        name: 'Tropical Parrot',
        file: 'Assets/Flight/parrot_ai.glb',
        preferredAnim: 'Object_0',
        scale: 1.0
    }
];
