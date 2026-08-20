// Lightweight procedural music synthesizer for web flight game.
// Generates fun, upbeat chiptune/synthwave tracks with dynamic tempo modulation on boost.
import { FlightModelDef } from '../player/FlightModels';

export interface StepData {
    kick?: boolean;
    snare?: boolean;
    hat?: boolean;
    openHat?: boolean;
    bass?: string | number | null;
    chord?: (string | number)[] | null;
    lead?: string | number | null;
}

export interface FunTrackConfig {
    name: string;
    bpm: number;
    stepsPerBeat: number;
    padOsc: OscillatorType;
    leadOsc: OscillatorType;
    bassOsc: OscillatorType;
    bars: StepData[][]; // Array of 16-step bars
}

export interface TrackConfig {
    name: string;
    chords: number[][];
    speed: number;
    stepSpeed: number;
    padOsc: OscillatorType;
    leadOsc: OscillatorType;
}

// Note name to frequency helper
const NOTE_MAP: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export function noteFreq(note: string | number): number {
    if (typeof note === 'number') return note;
    const match = note.match(/^([A-Ga-g][#b]?)([0-8])$/);
    if (!match) return 440;
    const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const semitone = NOTE_MAP[noteName] ?? 0;
    const octave = parseInt(match[2], 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// 7 melodic, relaxing procedural tracks with lyrical phrasing and boost beat enhancement
export const funTracks: FunTrackConfig[] = [
    {
        name: "Skyline Breeze",
        bpm: 88,
        stepsPerBeat: 4,
        padOsc: 'triangle',
        leadOsc: 'sine',
        bassOsc: 'triangle',
        bars: [
            // Bar 1: C Major (C4 - E4 - G4 - B4)
            [
                { kick: true, hat: true, bass: 'C2', chord: ['C4', 'E4', 'G4', 'B4'], lead: 'C5' },
                { hat: true },
                { hat: true, bass: 'C3', lead: 'E5' },
                { hat: true, lead: 'G5' },
                { snare: true, hat: true, bass: 'C2', lead: 'B5' },
                { hat: true },
                { hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, openHat: true, lead: 'E5' },
                { kick: true, hat: true, bass: 'C2', lead: 'C5' },
                { hat: true },
                { hat: true, bass: 'C3', lead: 'D5' },
                { hat: true, lead: 'E5' },
                { snare: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true },
                { kick: true, hat: true, bass: 'C2', lead: 'A5' },
                { hat: true, openHat: true, lead: 'B5' }
            ],
            // Bar 2: G Major (G3 - B3 - D4 - F#4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4', 'F#4'], lead: 'D5' },
                { hat: true },
                { hat: true, bass: 'G3', lead: 'B4' },
                { hat: true, lead: 'G4' },
                { snare: true, hat: true, bass: 'G2', lead: 'B4' },
                { hat: true },
                { hat: true, bass: 'D3', lead: 'D5' },
                { hat: true, openHat: true, lead: 'G5' },
                { kick: true, hat: true, bass: 'G2', lead: 'F#5' },
                { hat: true },
                { hat: true, bass: 'G3', lead: 'D5' },
                { hat: true, lead: 'B4' },
                { snare: true, hat: true, bass: 'D3', lead: 'A4' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'B4' },
                { hat: true, openHat: true, lead: 'D5' }
            ],
            // Bar 3: A Minor (A3 - C4 - E4 - G4)
            [
                { kick: true, hat: true, bass: 'A2', chord: ['A3', 'C4', 'E4', 'G4'], lead: 'E5' },
                { hat: true },
                { hat: true, bass: 'A3', lead: 'C5' },
                { hat: true, lead: 'A4' },
                { snare: true, hat: true, bass: 'A2', lead: 'C5' },
                { hat: true },
                { hat: true, bass: 'E3', lead: 'E5' },
                { hat: true, openHat: true, lead: 'A5' },
                { kick: true, hat: true, bass: 'A2', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'A3', lead: 'E5' },
                { hat: true, lead: 'C5' },
                { snare: true, hat: true, bass: 'E3', lead: 'B4' },
                { hat: true },
                { kick: true, hat: true, bass: 'A2', lead: 'C5' },
                { hat: true, openHat: true, lead: 'E5' }
            ],
            // Bar 4: F Major (F3 - A3 - C4 - E4)
            [
                { kick: true, hat: true, bass: 'F2', chord: ['F3', 'A3', 'C4', 'E4'], lead: 'A5' },
                { hat: true },
                { hat: true, bass: 'F3', lead: 'F5' },
                { hat: true, lead: 'C5' },
                { snare: true, hat: true, bass: 'F2', lead: 'F5' },
                { hat: true },
                { hat: true, bass: 'C3', lead: 'A5' },
                { hat: true, openHat: true, lead: 'C6' },
                { kick: true, hat: true, bass: 'F2', lead: 'B5' },
                { hat: true },
                { hat: true, bass: 'F3', lead: 'A5' },
                { hat: true, lead: 'G5' },
                { snare: true, hat: true, bass: 'C3', lead: 'F5' },
                { hat: true },
                { kick: true, hat: true, bass: 'F2', lead: 'G5' },
                { hat: true, openHat: true, lead: 'B5' }
            ]
        ]
    },
    {
        name: "Glider Groove",
        bpm: 92,
        stepsPerBeat: 4,
        padOsc: 'sawtooth',
        leadOsc: 'triangle',
        bassOsc: 'sawtooth',
        bars: [
            // Bar 1: D Minor 7 (D3 - F3 - A3 - C4)
            [
                { kick: true, hat: true, bass: 'D2', chord: ['D3', 'F3', 'A3', 'C4'], lead: 'D4' },
                { hat: true },
                { kick: true, hat: true, bass: 'D2', lead: 'F4' },
                { hat: true, openHat: true, chord: ['D3', 'F3', 'A3', 'C4'], lead: 'A4' },
                { snare: true, hat: true, bass: 'D3', lead: 'C5' },
                { hat: true },
                { hat: true, bass: 'A2', lead: 'A4' },
                { kick: true, hat: true, lead: 'F4' },
                { kick: true, hat: true, bass: 'D2', chord: ['D3', 'F3', 'A3', 'C4'], lead: 'D5' },
                { hat: true },
                { hat: true, bass: 'D3', lead: 'C5' },
                { hat: true, openHat: true, chord: ['D3', 'F3', 'A3', 'C4'], lead: 'A4' },
                { snare: true, hat: true, bass: 'F2', lead: 'G4' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'A4' },
                { hat: true, openHat: true, lead: 'C5' }
            ],
            // Bar 2: G Dominant 7 (G3 - B3 - D4 - F4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4', 'F4'], lead: 'B4' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'D5' },
                { hat: true, openHat: true, chord: ['G3', 'B3', 'D4', 'F4'], lead: 'F5' },
                { snare: true, hat: true, bass: 'G3', lead: 'D5' },
                { hat: true },
                { hat: true, bass: 'D3', lead: 'B4' },
                { kick: true, hat: true, lead: 'G4' },
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4', 'F4'], lead: 'F5' },
                { hat: true },
                { hat: true, bass: 'G3', lead: 'D5' },
                { hat: true, openHat: true, chord: ['G3', 'B3', 'D4', 'F4'], lead: 'B4' },
                { snare: true, hat: true, bass: 'D3', lead: 'A4' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'B4' },
                { hat: true, openHat: true, lead: 'D5' }
            ],
            // Bar 3: C Major 7 (C3 - E3 - G3 - B3)
            [
                { kick: true, hat: true, bass: 'C2', chord: ['C3', 'E3', 'G3', 'B3'], lead: 'E5' },
                { hat: true },
                { kick: true, hat: true, bass: 'C2', lead: 'G5' },
                { hat: true, openHat: true, chord: ['C3', 'E3', 'G3', 'B3'], lead: 'B5' },
                { snare: true, hat: true, bass: 'C3', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'G2', lead: 'E5' },
                { kick: true, hat: true, lead: 'C5' },
                { kick: true, hat: true, bass: 'C2', chord: ['C3', 'E3', 'G3', 'B3'], lead: 'B5' },
                { hat: true },
                { hat: true, bass: 'C3', lead: 'G5' },
                { hat: true, openHat: true, chord: ['C3', 'E3', 'G3', 'B3'], lead: 'E5' },
                { snare: true, hat: true, bass: 'E2', lead: 'D5' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'E5' },
                { hat: true, openHat: true, lead: 'G5' }
            ],
            // Bar 4: A Minor 7 (A3 - C4 - E4 - G4)
            [
                { kick: true, hat: true, bass: 'A2', chord: ['A3', 'C4', 'E4', 'G4'], lead: 'C5' },
                { hat: true },
                { kick: true, hat: true, bass: 'A2', lead: 'E5' },
                { hat: true, openHat: true, chord: ['A3', 'C4', 'E4', 'G4'], lead: 'A5' },
                { snare: true, hat: true, bass: 'A3', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'E2', lead: 'E5' },
                { kick: true, hat: true, lead: 'C5' },
                { kick: true, hat: true, bass: 'A2', chord: ['A3', 'C4', 'E4', 'G4'], lead: 'A5' },
                { hat: true },
                { hat: true, bass: 'A3', lead: 'G5' },
                { hat: true, openHat: true, chord: ['A3', 'C4', 'E4', 'G4'], lead: 'E5' },
                { snare: true, hat: true, bass: 'G2', lead: 'D5' },
                { hat: true },
                { kick: true, hat: true, bass: 'E2', lead: 'C5' },
                { hat: true, openHat: true, lead: 'D5' }
            ]
        ]
    },
    {
        name: "Starbound Serenade",
        bpm: 90,
        stepsPerBeat: 4,
        padOsc: 'sawtooth',
        leadOsc: 'square',
        bassOsc: 'sawtooth',
        bars: [
            // Bar 1: B Minor (B3 - D4 - F#4)
            [
                { kick: true, hat: true, bass: 'B2', chord: ['B3', 'D4', 'F#4'], lead: 'B4' },
                { hat: true, bass: 'B2', lead: 'D5' },
                { hat: true, bass: 'B3', lead: 'F#5' },
                { hat: true, bass: 'B2', lead: 'B5' },
                { snare: true, hat: true, bass: 'B2', lead: 'F#5' },
                { hat: true, bass: 'B2', lead: 'D5' },
                { hat: true, bass: 'F#2', lead: 'B4' },
                { hat: true, openHat: true, bass: 'B2', lead: 'F#5' },
                { kick: true, hat: true, bass: 'B2', lead: 'A5' },
                { hat: true, bass: 'B2', lead: 'F#5' },
                { hat: true, bass: 'B3', lead: 'D5' },
                { hat: true, bass: 'B2', lead: 'F#5' },
                { snare: true, hat: true, bass: 'B2', lead: 'B5' },
                { hat: true, bass: 'B2', lead: 'C#6' },
                { kick: true, hat: true, bass: 'F#2', lead: 'D6' },
                { hat: true, openHat: true, bass: 'B2', lead: 'B5' }
            ],
            // Bar 2: G Major (G3 - B3 - D4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4'], lead: 'G5' },
                { hat: true, bass: 'G2', lead: 'B5' },
                { hat: true, bass: 'G3', lead: 'D6' },
                { hat: true, bass: 'G2', lead: 'B5' },
                { snare: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, bass: 'G2', lead: 'D5' },
                { hat: true, bass: 'D2', lead: 'B4' },
                { hat: true, openHat: true, bass: 'G2', lead: 'D5' },
                { kick: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, bass: 'G2', lead: 'A5' },
                { hat: true, bass: 'G3', lead: 'B5' },
                { hat: true, bass: 'G2', lead: 'D6' },
                { snare: true, hat: true, bass: 'G2', lead: 'B5' },
                { hat: true, bass: 'G2', lead: 'A5' },
                { kick: true, hat: true, bass: 'D2', lead: 'G5' },
                { hat: true, openHat: true, bass: 'G2', lead: 'F#5' }
            ],
            // Bar 3: D Major (D3 - F#3 - A3)
            [
                { kick: true, hat: true, bass: 'D2', chord: ['D3', 'F#3', 'A3'], lead: 'F#5' },
                { hat: true, bass: 'D2', lead: 'A5' },
                { hat: true, bass: 'D3', lead: 'D6' },
                { hat: true, bass: 'D2', lead: 'A5' },
                { snare: true, hat: true, bass: 'D2', lead: 'F#5' },
                { hat: true, bass: 'D2', lead: 'D5' },
                { hat: true, bass: 'A2', lead: 'A4' },
                { hat: true, openHat: true, bass: 'D2', lead: 'D5' },
                { kick: true, hat: true, bass: 'D2', lead: 'F#5' },
                { hat: true, bass: 'D2', lead: 'G5' },
                { hat: true, bass: 'D3', lead: 'A5' },
                { hat: true, bass: 'D2', lead: 'F#5' },
                { snare: true, hat: true, bass: 'D2', lead: 'E5' },
                { hat: true, bass: 'D2', lead: 'D5' },
                { kick: true, hat: true, bass: 'A2', lead: 'C#5' },
                { hat: true, openHat: true, bass: 'D2', lead: 'D5' }
            ],
            // Bar 4: A Major (A3 - C#4 - E4)
            [
                { kick: true, hat: true, bass: 'A2', chord: ['A3', 'C#4', 'E4'], lead: 'E5' },
                { hat: true, bass: 'A2', lead: 'A5' },
                { hat: true, bass: 'A3', lead: 'C#6' },
                { hat: true, bass: 'A2', lead: 'A5' },
                { snare: true, hat: true, bass: 'A2', lead: 'E5' },
                { hat: true, bass: 'A2', lead: 'C#5' },
                { hat: true, bass: 'E2', lead: 'A4' },
                { hat: true, openHat: true, bass: 'A2', lead: 'C#5' },
                { kick: true, hat: true, bass: 'A2', lead: 'E5' },
                { hat: true, bass: 'A2', lead: 'F#5' },
                { hat: true, bass: 'A3', lead: 'E5' },
                { hat: true, bass: 'A2', lead: 'C#5' },
                { snare: true, hat: true, bass: 'A2', lead: 'B4' },
                { hat: true, bass: 'A2', lead: 'A4' },
                { kick: true, hat: true, bass: 'E2', lead: 'C#5' },
                { hat: true, openHat: true, bass: 'A2', lead: 'E5' }
            ]
        ]
    },
    {
        name: "Sunny Meadows",
        bpm: 84,
        stepsPerBeat: 4,
        padOsc: 'triangle',
        leadOsc: 'triangle',
        bassOsc: 'triangle',
        bars: [
            // Bar 1: G Major (G3 - B3 - D4 - G4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4', 'G4'], lead: 'G4' },
                { hat: true },
                { hat: true, bass: 'G2', lead: 'B4' },
                { hat: true, lead: 'D5' },
                { snare: true, hat: true, bass: 'D3', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'G2', lead: 'E5' },
                { hat: true, openHat: true, lead: 'D5' },
                { kick: true, hat: true, bass: 'G2', lead: 'B4' },
                { hat: true },
                { hat: true, bass: 'D3', lead: 'A4' },
                { hat: true, lead: 'B4' },
                { snare: true, hat: true, bass: 'G2', lead: 'D5' },
                { hat: true },
                { kick: true, hat: true, bass: 'B2', lead: 'E5' },
                { hat: true, openHat: true, lead: 'G5' }
            ],
            // Bar 2: D Major (D3 - F#3 - A3 - D4)
            [
                { kick: true, hat: true, bass: 'D2', chord: ['D3', 'F#3', 'A3', 'D4'], lead: 'A5' },
                { hat: true },
                { hat: true, bass: 'D2', lead: 'F#5' },
                { hat: true, lead: 'D5' },
                { snare: true, hat: true, bass: 'A2', lead: 'E5' },
                { hat: true },
                { hat: true, bass: 'D2', lead: 'F#5' },
                { hat: true, openHat: true, lead: 'A5' },
                { kick: true, hat: true, bass: 'D2', lead: 'F#5' },
                { hat: true },
                { hat: true, bass: 'A2', lead: 'D5' },
                { hat: true, lead: 'B4' },
                { snare: true, hat: true, bass: 'D2', lead: 'A4' },
                { hat: true },
                { kick: true, hat: true, bass: 'F#2', lead: 'D5' },
                { hat: true, openHat: true, lead: 'F#5' }
            ],
            // Bar 3: E Minor (E3 - G3 - B3 - E4)
            [
                { kick: true, hat: true, bass: 'E2', chord: ['E3', 'G3', 'B3', 'E4'], lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'E2', lead: 'E5' },
                { hat: true, lead: 'B4' },
                { snare: true, hat: true, bass: 'B2', lead: 'E5' },
                { hat: true },
                { hat: true, bass: 'E2', lead: 'G5' },
                { hat: true, openHat: true, lead: 'B5' },
                { kick: true, hat: true, bass: 'E2', lead: 'A5' },
                { hat: true },
                { hat: true, bass: 'B2', lead: 'G5' },
                { hat: true, lead: 'E5' },
                { snare: true, hat: true, bass: 'E2', lead: 'D5' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'E5' },
                { hat: true, openHat: true, lead: 'G5' }
            ],
            // Bar 4: C Major (C3 - E3 - G3 - C4)
            [
                { kick: true, hat: true, bass: 'C2', chord: ['C3', 'E3', 'G3', 'C4'], lead: 'E5' },
                { hat: true },
                { hat: true, bass: 'C2', lead: 'G5' },
                { hat: true, lead: 'C6' },
                { snare: true, hat: true, bass: 'G2', lead: 'B5' },
                { hat: true },
                { hat: true, bass: 'C2', lead: 'A5' },
                { hat: true, openHat: true, lead: 'G5' },
                { kick: true, hat: true, bass: 'C2', lead: 'E5' },
                { hat: true },
                { hat: true, bass: 'G2', lead: 'D5' },
                { hat: true, lead: 'C5' },
                { snare: true, hat: true, bass: 'C2', lead: 'D5' },
                { hat: true },
                { kick: true, hat: true, bass: 'E2', lead: 'G5' },
                { hat: true, openHat: true, lead: 'B5' }
            ]
        ]
    },
    {
        name: "Cloud Hopper",
        bpm: 88,
        stepsPerBeat: 4,
        padOsc: 'triangle',
        leadOsc: 'square',
        bassOsc: 'triangle',
        bars: [
            // Bar 1: Eb Major (Eb3 - G3 - Bb3 - Eb4)
            [
                { kick: true, hat: true, bass: 'Eb2', chord: ['Eb3', 'G3', 'Bb3', 'Eb4'], lead: 'Eb5' },
                { hat: true },
                { hat: true, bass: 'Eb3', lead: 'G5' },
                { kick: true, hat: true, lead: 'Bb5' },
                { snare: true, hat: true, bass: 'Eb2', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'Bb2', lead: 'Eb5' },
                { hat: true, openHat: true, lead: 'Bb4' },
                { kick: true, hat: true, bass: 'Eb2', lead: 'Eb5' },
                { hat: true },
                { hat: true, bass: 'Eb3', lead: 'F5' },
                { kick: true, hat: true, lead: 'G5' },
                { snare: true, hat: true, bass: 'Bb2', lead: 'Bb5' },
                { hat: true },
                { kick: true, hat: true, bass: 'G2', lead: 'C6' },
                { hat: true, openHat: true, lead: 'Bb5' }
            ],
            // Bar 2: F Major (F3 - A3 - C4 - F4)
            [
                { kick: true, hat: true, bass: 'F2', chord: ['F3', 'A3', 'C4', 'F4'], lead: 'A5' },
                { hat: true },
                { hat: true, bass: 'F3', lead: 'F5' },
                { kick: true, hat: true, lead: 'C5' },
                { snare: true, hat: true, bass: 'F2', lead: 'F5' },
                { hat: true },
                { hat: true, bass: 'C3', lead: 'A5' },
                { hat: true, openHat: true, lead: 'C6' },
                { kick: true, hat: true, bass: 'F2', lead: 'Bb5' },
                { hat: true },
                { hat: true, bass: 'F3', lead: 'A5' },
                { kick: true, hat: true, lead: 'G5' },
                { snare: true, hat: true, bass: 'C3', lead: 'F5' },
                { hat: true },
                { kick: true, hat: true, bass: 'A2', lead: 'G5' },
                { hat: true, openHat: true, lead: 'A5' }
            ],
            // Bar 3: G Minor (G3 - Bb3 - D4 - G4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'Bb3', 'D4', 'G4'], lead: 'Bb5' },
                { hat: true },
                { hat: true, bass: 'G3', lead: 'G5' },
                { kick: true, hat: true, lead: 'D5' },
                { snare: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true },
                { hat: true, bass: 'D3', lead: 'Bb5' },
                { hat: true, openHat: true, lead: 'D6' },
                { kick: true, hat: true, bass: 'G2', lead: 'C6' },
                { hat: true },
                { hat: true, bass: 'G3', lead: 'Bb5' },
                { kick: true, hat: true, lead: 'A5' },
                { snare: true, hat: true, bass: 'D3', lead: 'G5' },
                { hat: true },
                { kick: true, hat: true, bass: 'Bb2', lead: 'F5' },
                { hat: true, openHat: true, lead: 'G5' }
            ],
            // Bar 4: Bb Major (Bb3 - D4 - F4 - Bb4)
            [
                { kick: true, hat: true, bass: 'Bb2', chord: ['Bb3', 'D4', 'F4', 'Bb4'], lead: 'F5' },
                { hat: true },
                { hat: true, bass: 'Bb3', lead: 'D5' },
                { kick: true, hat: true, lead: 'Bb4' },
                { snare: true, hat: true, bass: 'Bb2', lead: 'D5' },
                { hat: true },
                { hat: true, bass: 'F2', lead: 'F5' },
                { hat: true, openHat: true, lead: 'Bb5' },
                { kick: true, hat: true, bass: 'Bb2', lead: 'D6' },
                { hat: true },
                { hat: true, bass: 'Bb3', lead: 'C6' },
                { kick: true, hat: true, lead: 'Bb5' },
                { snare: true, hat: true, bass: 'F2', lead: 'A5' },
                { hat: true },
                { kick: true, hat: true, bass: 'D2', lead: 'Bb5' },
                { hat: true, openHat: true, lead: 'D6' }
            ]
        ]
    },
    {
        name: "Rainbow Drift",
        bpm: 94,
        stepsPerBeat: 4,
        padOsc: 'sawtooth',
        leadOsc: 'sawtooth',
        bassOsc: 'sawtooth',
        bars: [
            // Bar 1: E Minor (E3 - G3 - B3 - E4)
            [
                { kick: true, hat: true, bass: 'E2', chord: ['E3', 'G3', 'B3', 'E4'], lead: 'E5' },
                { hat: true, bass: 'E2' },
                { kick: true, hat: true, bass: 'E3', lead: 'G5' },
                { hat: true, openHat: true, chord: ['E3', 'G3', 'B3', 'E4'] },
                { kick: true, snare: true, hat: true, bass: 'E2', lead: 'B5' },
                { hat: true, bass: 'E2' },
                { kick: true, hat: true, bass: 'B2', lead: 'E6' },
                { hat: true, openHat: true, chord: ['E3', 'G3', 'B3', 'E4'] },
                { kick: true, hat: true, bass: 'E2', lead: 'D6' },
                { hat: true, bass: 'E2' },
                { kick: true, hat: true, bass: 'E3', lead: 'B5' },
                { hat: true, openHat: true, chord: ['E3', 'G3', 'B3', 'E4'] },
                { kick: true, snare: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, bass: 'E2' },
                { kick: true, hat: true, bass: 'B2', lead: 'A5' },
                { hat: true, openHat: true, lead: 'B5' }
            ],
            // Bar 2: C Major (C3 - E3 - G3 - C4)
            [
                { kick: true, hat: true, bass: 'C2', chord: ['C3', 'E3', 'G3', 'C4'], lead: 'C6' },
                { hat: true, bass: 'C2' },
                { kick: true, hat: true, bass: 'C3', lead: 'G5' },
                { hat: true, openHat: true, chord: ['C3', 'E3', 'G3', 'C4'] },
                { kick: true, snare: true, hat: true, bass: 'C2', lead: 'E5' },
                { hat: true, bass: 'C2' },
                { kick: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, openHat: true, chord: ['C3', 'E3', 'G3', 'C4'] },
                { kick: true, hat: true, bass: 'C2', lead: 'C6' },
                { hat: true, bass: 'C2' },
                { kick: true, hat: true, bass: 'C3', lead: 'D6' },
                { hat: true, openHat: true, chord: ['C3', 'E3', 'G3', 'C4'] },
                { kick: true, snare: true, hat: true, bass: 'E2', lead: 'E6' },
                { hat: true, bass: 'C2' },
                { kick: true, hat: true, bass: 'G2', lead: 'D6' },
                { hat: true, openHat: true, lead: 'C6' }
            ],
            // Bar 3: G Major (G3 - B3 - D4 - G4)
            [
                { kick: true, hat: true, bass: 'G2', chord: ['G3', 'B3', 'D4', 'G4'], lead: 'B5' },
                { hat: true, bass: 'G2' },
                { kick: true, hat: true, bass: 'G3', lead: 'D6' },
                { hat: true, openHat: true, chord: ['G3', 'B3', 'D4', 'G4'] },
                { kick: true, snare: true, hat: true, bass: 'G2', lead: 'G5' },
                { hat: true, bass: 'G2' },
                { kick: true, hat: true, bass: 'D2', lead: 'B4' },
                { hat: true, openHat: true, chord: ['G3', 'B3', 'D4', 'G4'] },
                { kick: true, hat: true, bass: 'G2', lead: 'D5' },
                { hat: true, bass: 'G2' },
                { kick: true, hat: true, bass: 'G3', lead: 'G5' },
                { hat: true, openHat: true, chord: ['G3', 'B3', 'D4', 'G4'] },
                { kick: true, snare: true, hat: true, bass: 'B2', lead: 'B5' },
                { hat: true, bass: 'G2' },
                { kick: true, hat: true, bass: 'D2', lead: 'C6' },
                { hat: true, openHat: true, lead: 'D6' }
            ],
            // Bar 4: D Major (D3 - F#3 - A3 - D4)
            [
                { kick: true, hat: true, bass: 'D2', chord: ['D3', 'F#3', 'A3', 'D4'], lead: 'A5' },
                { hat: true, bass: 'D2' },
                { kick: true, hat: true, bass: 'D3', lead: 'F#5' },
                { hat: true, openHat: true, chord: ['D3', 'F#3', 'A3', 'D4'] },
                { kick: true, snare: true, hat: true, bass: 'D2', lead: 'D5' },
                { hat: true, bass: 'D2' },
                { kick: true, hat: true, bass: 'A2', lead: 'F#5' },
                { hat: true, openHat: true, chord: ['D3', 'F#3', 'A3', 'D4'] },
                { kick: true, hat: true, bass: 'D2', lead: 'A5' },
                { hat: true, bass: 'D2' },
                { kick: true, hat: true, bass: 'D3', lead: 'B5' },
                { hat: true, openHat: true, chord: ['D3', 'F#3', 'A3', 'D4'] },
                { kick: true, snare: true, hat: true, bass: 'F#2', lead: 'A5' },
                { hat: true, bass: 'D2' },
                { kick: true, hat: true, bass: 'A2', lead: 'F#5' },
                { hat: true, openHat: true, lead: 'D5' }
            ]
        ]
    },
    {
        name: "Candy Carnival",
        bpm: 92,
        stepsPerBeat: 4,
        padOsc: 'triangle',
        leadOsc: 'sine',
        bassOsc: 'triangle',
        bars: [
            // Bar 1: F Major Bouncy Chimes (F4 - A4 - C5 - F5)
            [
                { kick: true, hat: true, bass: 'F2', chord: ['F4', 'A4', 'C5', 'F5'], lead: 'F5' },
                { hat: true, lead: 'A5' },
                { hat: true, bass: 'C3', lead: 'C6' },
                { hat: true, lead: 'A5' },
                { snare: true, hat: true, bass: 'F2', lead: 'F6' },
                { hat: true, lead: 'E6' },
                { hat: true, bass: 'A2', lead: 'C6' },
                { hat: true, openHat: true, lead: 'A5' },
                { kick: true, hat: true, bass: 'F2', lead: 'F5' },
                { hat: true, lead: 'G5' },
                { hat: true, bass: 'C3', lead: 'A5' },
                { hat: true, lead: 'C6' },
                { snare: true, hat: true, bass: 'F2', lead: 'D6' },
                { hat: true, lead: 'C6' },
                { kick: true, hat: true, bass: 'C3', lead: 'A5' },
                { hat: true, openHat: true, lead: 'G5' }
            ],
            // Bar 2: Bb Major Sugar Bells (Bb3 - D4 - F4 - Bb4)
            [
                { kick: true, hat: true, bass: 'Bb2', chord: ['Bb3', 'D4', 'F4', 'Bb4'], lead: 'D6' },
                { hat: true, lead: 'F6' },
                { hat: true, bass: 'F2', lead: 'D6' },
                { hat: true, lead: 'Bb5' },
                { snare: true, hat: true, bass: 'Bb2', lead: 'F6' },
                { hat: true, lead: 'G6' },
                { hat: true, bass: 'D3', lead: 'F6' },
                { hat: true, openHat: true, lead: 'D6' },
                { kick: true, hat: true, bass: 'Bb2', lead: 'Bb5' },
                { hat: true, lead: 'C6' },
                { hat: true, bass: 'F2', lead: 'D6' },
                { hat: true, lead: 'F6' },
                { snare: true, hat: true, bass: 'Bb2', lead: 'G6' },
                { hat: true, lead: 'F6' },
                { kick: true, hat: true, bass: 'F2', lead: 'D6' },
                { hat: true, openHat: true, lead: 'C6' }
            ],
            // Bar 3: C Major Marshmallow Bounce (C4 - E4 - G4 - C5)
            [
                { kick: true, hat: true, bass: 'C2', chord: ['C4', 'E4', 'G4', 'C5'], lead: 'E6' },
                { hat: true, lead: 'G6' },
                { hat: true, bass: 'G2', lead: 'E6' },
                { hat: true, lead: 'C6' },
                { snare: true, hat: true, bass: 'C2', lead: 'G6' },
                { hat: true, lead: 'A6' },
                { hat: true, bass: 'E3', lead: 'G6' },
                { hat: true, openHat: true, lead: 'E6' },
                { kick: true, hat: true, bass: 'C2', lead: 'C6' },
                { hat: true, lead: 'D6' },
                { hat: true, bass: 'G2', lead: 'E6' },
                { hat: true, lead: 'G6' },
                { snare: true, hat: true, bass: 'C2', lead: 'A6' },
                { hat: true, lead: 'G6' },
                { kick: true, hat: true, bass: 'G2', lead: 'E6' },
                { hat: true, openHat: true, lead: 'D6' }
            ],
            // Bar 4: D Minor Sweet Swirl (D4 - F4 - A4 - D5)
            [
                { kick: true, hat: true, bass: 'D2', chord: ['D4', 'F4', 'A4', 'D5'], lead: 'D6' },
                { hat: true, lead: 'F6' },
                { hat: true, bass: 'A2', lead: 'A6' },
                { hat: true, lead: 'F6' },
                { snare: true, hat: true, bass: 'D2', lead: 'D6' },
                { hat: true, lead: 'C6' },
                { hat: true, bass: 'F2', lead: 'Bb5' },
                { hat: true, openHat: true, lead: 'A5' },
                { kick: true, hat: true, bass: 'C2', lead: 'G5' },
                { hat: true, lead: 'A5' },
                { hat: true, bass: 'G2', lead: 'Bb5' },
                { hat: true, lead: 'C6' },
                { snare: true, hat: true, bass: 'C2', lead: 'E6' },
                { hat: true, lead: 'D6' },
                { kick: true, hat: true, bass: 'C2', lead: 'C6' },
                { hat: true, openHat: true, lead: 'E6' }
            ]
        ]
    }
];

export const tracks = funTracks;

export class BiplaneEngineAudio {
    private audioCtx: AudioContext;
    private outputNode: AudioNode;
    private noiseBuffer: AudioBuffer | null;

    // Gain stages
    private masterGain: GainNode;
    private cylinderGain: GainNode;
    private noiseGain: GainNode;
    private subGain: GainNode;

    // Filter stages
    private cylinderFilter: BiquadFilterNode;
    private noiseFilter: BiquadFilterNode;

    // Oscillators and sound sources
    private osc1: OscillatorNode | null = null;
    private osc2: OscillatorNode | null = null;
    private subOsc: OscillatorNode | null = null;
    private lfoOsc: OscillatorNode | null = null;
    private lfoGain: GainNode | null = null;
    private noiseSource: AudioBufferSourceNode | null = null;

    public isRunning = false;
    private isActive = false;
    private targetFade = 0.0;
    private currentFade = 0.0;
    private currentRpm = 0.35;
    public volume = 0.042; // Very faint, subtle baseline volume

    constructor(audioCtx: AudioContext, outputNode: AudioNode, noiseBuffer: AudioBuffer | null) {
        this.audioCtx = audioCtx;
        this.outputNode = outputNode;
        this.noiseBuffer = noiseBuffer;

        // Master gain for engine sound (starts muted)
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.masterGain.connect(this.outputNode);

        // Lowpass filter for warm, muffled vintage radial engine tone
        this.cylinderFilter = this.audioCtx.createBiquadFilter();
        this.cylinderFilter.type = 'lowpass';
        this.cylinderFilter.frequency.setValueAtTime(200, this.audioCtx.currentTime);
        this.cylinderFilter.Q.setValueAtTime(1.8, this.audioCtx.currentTime);

        // Pulse gain node (modulated by LFO)
        this.cylinderGain = this.audioCtx.createGain();
        this.cylinderGain.gain.setValueAtTime(0.65, this.audioCtx.currentTime);

        // Propeller air turbulence filter
        this.noiseFilter = this.audioCtx.createBiquadFilter();
        this.noiseFilter.type = 'bandpass';
        this.noiseFilter.frequency.setValueAtTime(240, this.audioCtx.currentTime);
        this.noiseFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);

        this.noiseGain = this.audioCtx.createGain();
        this.noiseGain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);

        // Sub bass gain
        this.subGain = this.audioCtx.createGain();
        this.subGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

        // Node connections
        this.cylinderFilter.connect(this.cylinderGain);
        this.cylinderGain.connect(this.masterGain);

        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);

        this.subGain.connect(this.masterGain);
    }

    public setNoiseBuffer(buffer: AudioBuffer) {
        this.noiseBuffer = buffer;
    }

    public setActive(active: boolean) {
        this.isActive = active;
        this.targetFade = active ? 1.0 : 0.0;
        if (active && !this.isRunning) {
            this.startNodes();
        }
    }

    public getIsActive(): boolean {
        return this.isActive;
    }

    private startNodes() {
        if (this.isRunning) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const t = this.audioCtx.currentTime;

        // 1. Primary fundamental oscillator (Sawtooth)
        this.osc1 = this.audioCtx.createOscillator();
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.setValueAtTime(62, t);

        // 2. Harmonic detuned oscillator (Triangle)
        this.osc2 = this.audioCtx.createOscillator();
        this.osc2.type = 'triangle';
        this.osc2.frequency.setValueAtTime(63.2, t);

        // 3. Sub-bass oscillator (Sine)
        this.subOsc = this.audioCtx.createOscillator();
        this.subOsc.type = 'sine';
        this.subOsc.frequency.setValueAtTime(31, t);

        this.osc1.connect(this.cylinderFilter);
        this.osc2.connect(this.cylinderFilter);
        this.subOsc.connect(this.subGain);

        // 4. Cylinder pulse LFO (modulates cylinderGain to produce "chug-chug-chug" cadence)
        this.lfoOsc = this.audioCtx.createOscillator();
        this.lfoOsc.type = 'sine';
        this.lfoOsc.frequency.setValueAtTime(28, t);

        this.lfoGain = this.audioCtx.createGain();
        this.lfoGain.gain.setValueAtTime(0.35, t);

        this.cylinderGain.gain.setValueAtTime(0.65, t);
        this.lfoOsc.connect(this.lfoGain);
        this.lfoGain.connect(this.cylinderGain.gain);

        // 5. Propeller air wash noise
        if (this.noiseBuffer) {
            this.noiseSource = this.audioCtx.createBufferSource();
            this.noiseSource.buffer = this.noiseBuffer;
            this.noiseSource.loop = true;
            this.noiseSource.connect(this.noiseFilter);
            this.noiseSource.start(t);
        }

        this.osc1.start(t);
        this.osc2.start(t);
        this.subOsc.start(t);
        this.lfoOsc.start(t);

        this.isRunning = true;
    }

    private stopNodes() {
        if (!this.isRunning) return;
        const t = this.audioCtx.currentTime;
        try {
            this.osc1?.stop(t);
            this.osc2?.stop(t);
            this.subOsc?.stop(t);
            this.lfoOsc?.stop(t);
            this.noiseSource?.stop(t);
        } catch (e) {
            // ignore
        }
        try {
            this.osc1?.disconnect();
            this.osc2?.disconnect();
            this.subOsc?.disconnect();
            this.lfoOsc?.disconnect();
            this.lfoGain?.disconnect();
            this.noiseSource?.disconnect();
        } catch (e) {
            // ignore
        }
        this.osc1 = null;
        this.osc2 = null;
        this.subOsc = null;
        this.lfoOsc = null;
        this.lfoGain = null;
        this.noiseSource = null;
        this.isRunning = false;
    }

    public update(dt: number, isBoosting: boolean, isBraking: boolean, isPaused: boolean, speed?: number) {
        if (!this.isActive && this.currentFade <= 0.001) {
            if (this.isRunning) {
                this.stopNodes();
            }
            return;
        }

        if (this.audioCtx.state === 'suspended' && this.isActive) {
            this.audioCtx.resume().catch(() => {});
        }

        // Smooth fade in / out
        const fadeRate = this.isActive ? 1.5 : 2.5;
        this.currentFade += (this.targetFade - this.currentFade) * Math.min(dt * fadeRate, 1.0);

        if (!this.isRunning && this.currentFade > 0.01) {
            this.startNodes();
        }

        // Determine target RPM (0.05 = idle/brake, 0.35 = cruise, 1.0 = boost)
        let targetRpm = 0.35;
        if (isPaused) {
            targetRpm = 0.05;
        } else if (isBraking) {
            targetRpm = 0.05;
        } else if (isBoosting) {
            targetRpm = 1.0;
        } else if (speed !== undefined) {
            const speedFactor = Math.max(0.0, Math.min(1.0, (speed - 5) / 25));
            targetRpm = 0.15 + speedFactor * 0.4;
        }

        const rpmLerpRate = isBoosting ? 4.5 : 2.5;
        this.currentRpm += (targetRpm - this.currentRpm) * Math.min(dt * rpmLerpRate, 1.0);

        if (!this.isRunning) return;

        const t = this.audioCtx.currentTime;
        const smooth = 0.06;

        // Frequencies mapped across RPM:
        // Idle (0.05): ~48 Hz engine, ~21 Hz pulse
        // Cruise (0.35): ~64 Hz engine, ~28 Hz pulse
        // Boost (1.0): ~98 Hz engine, ~44 Hz pulse
        const engineFreq = 46 + this.currentRpm * 52;
        const pulseFreq = 20 + this.currentRpm * 24;
        const subFreq = engineFreq * 0.5;
        const filterCutoff = 170 + this.currentRpm * 110;
        const noiseCutoff = 210 + this.currentRpm * 110;

        if (this.osc1) this.osc1.frequency.setTargetAtTime(engineFreq, t, smooth);
        if (this.osc2) this.osc2.frequency.setTargetAtTime(engineFreq * 1.018 + 0.4, t, smooth);
        if (this.subOsc) this.subOsc.frequency.setTargetAtTime(subFreq, t, smooth);
        if (this.lfoOsc) this.lfoOsc.frequency.setTargetAtTime(pulseFreq, t, smooth);

        this.cylinderFilter.frequency.setTargetAtTime(filterCutoff, t, smooth);
        this.noiseFilter.frequency.setTargetAtTime(noiseCutoff, t, smooth);

        // Faint, subtle master volume (modulated by fade factor and pause)
        const pauseMultiplier = isPaused ? 0.15 : 1.0;
        const dynamicGain = (0.030 + this.currentRpm * 0.025) * (this.volume / 0.042);
        const targetGain = dynamicGain * this.currentFade * pauseMultiplier;

        this.masterGain.gain.setTargetAtTime(targetGain, t, smooth);
    }
}

export class AmbientAudioEngine {
    private audioCtx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private drumGain: GainNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;
    private biplaneAudio: BiplaneEngineAudio | null = null;
    private pendingPlaneModelDef: FlightModelDef | null = null;

    public isMusicPlaying = false;
    public currentTrack = 0;
    
    // Dynamic tempo boost
    private boostFactor = 0.0; // 0.0 to 1.0

    // Step scheduler state
    private nextStepTime = 0;
    private currentBar = 0;
    private currentStep = 0;
    private schedulerTimerId: any = null;

    public initAudio() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.createNoiseBuffer();
        this.setupGainNodes();

        if (!this.biplaneAudio && this.audioCtx && this.masterGain) {
            this.biplaneAudio = new BiplaneEngineAudio(this.audioCtx, this.masterGain, this.noiseBuffer);
            if (this.pendingPlaneModelDef) {
                this.onFlightModelChanged(this.pendingPlaneModelDef);
                this.pendingPlaneModelDef = null;
            }
        }
    }

    private createNoiseBuffer() {
        if (!this.audioCtx) return;
        if (this.noiseBuffer) return;
        const sampleRate = this.audioCtx.sampleRate;
        const bufferSize = sampleRate * 1.0;
        this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        if (this.biplaneAudio) {
            this.biplaneAudio.setNoiseBuffer(this.noiseBuffer);
        }
    }

    private setupGainNodes() {
        if (!this.audioCtx) return;
        if (!this.masterGain) {
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.audioCtx.destination);
        }
        if (!this.musicGain) {
            this.musicGain = this.audioCtx.createGain();
            this.musicGain.gain.value = 0.5;
            this.musicGain.connect(this.masterGain);
        }
        if (!this.drumGain) {
            this.drumGain = this.audioCtx.createGain();
            this.drumGain.gain.value = 0.45;
            this.drumGain.connect(this.masterGain);
        }
    }

    public onFlightModelChanged(def: FlightModelDef | null) {
        if (!def) return;
        if (!this.biplaneAudio) {
            this.pendingPlaneModelDef = def;
            return;
        }
        const isPlane = Boolean(def.isPlane);
        this.biplaneAudio.setActive(isPlane);
    }

    public setPlaneEngineActive(active: boolean) {
        this.initAudio();
        this.biplaneAudio?.setActive(active);
    }

    private isSoundMuted: boolean = false;

    public setMuted(muted: boolean) {
        this.isSoundMuted = muted;
        if (this.masterGain && this.audioCtx) {
            this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.6, this.audioCtx.currentTime, 0.05);
        }
    }

    public getMuted(): boolean {
        return this.isSoundMuted;
    }

    public getBiplaneEngineAudio(): BiplaneEngineAudio | null {
        return this.biplaneAudio;
    }

    public toggleMusic(): boolean {
        this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        this.setupGainNodes();

        this.isMusicPlaying = !this.isMusicPlaying;
        if (this.isMusicPlaying) {
            this.currentBar = 0;
            this.currentStep = 0;
            if (this.audioCtx) {
                this.nextStepTime = this.audioCtx.currentTime + 0.05;
            }
            this.schedule();
        } else {
            clearTimeout(this.schedulerTimerId);
        }
        return this.isMusicPlaying;
    }

    public nextTrack(): string {
        this.currentTrack = (this.currentTrack + 1) % funTracks.length;
        this.currentBar = 0;
        this.currentStep = 0;
        if (this.audioCtx) {
            this.nextStepTime = this.audioCtx.currentTime + 0.05;
        }
        return funTracks[this.currentTrack].name;
    }

    public prevTrack(): string {
        this.currentTrack = (this.currentTrack - 1 + funTracks.length) % funTracks.length;
        this.currentBar = 0;
        this.currentStep = 0;
        if (this.audioCtx) {
            this.nextStepTime = this.audioCtx.currentTime + 0.05;
        }
        return funTracks[this.currentTrack].name;
    }

    public selectTrack(index: number): string {
        this.currentTrack = Math.max(0, Math.min(funTracks.length - 1, index));
        this.currentBar = 0;
        this.currentStep = 0;
        if (this.audioCtx) {
            this.nextStepTime = this.audioCtx.currentTime + 0.05;
        }
        return funTracks[this.currentTrack].name;
    }

    public getAllTracks(): { name: string; bpm: number }[] {
        return funTracks.map(t => ({ name: t.name, bpm: t.bpm }));
    }

    public getCurrentTrackIndex(): number {
        return this.currentTrack;
    }

    public getCurrentTrackName(): string {
        return funTracks[this.currentTrack]?.name ?? "Track";
    }

    public update(dt: number, isBoosting: boolean, isBraking = false, isPaused = false, speed = 18) {
        const targetBoost = isBoosting ? 1.0 : 0.0;
        const boostSpeed = isBoosting ? 4.5 : 2.5;
        this.boostFactor += (targetBoost - this.boostFactor) * Math.min(dt * boostSpeed, 1.0);

        if (this.isMusicPlaying && this.audioCtx && this.nextStepTime < this.audioCtx.currentTime + 0.12) {
            this.schedule();
        }

        if (this.biplaneAudio) {
            this.biplaneAudio.update(dt, isBoosting, isBraking, isPaused, speed);
        }
    }

    private playKick(time: number) {
        if (!this.audioCtx || !this.drumGain) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);

        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

        osc.connect(gain);
        gain.connect(this.drumGain);

        osc.start(time);
        osc.stop(time + 0.14);
    }

    private playSnare(time: number) {
        if (!this.audioCtx || !this.drumGain || !this.noiseBuffer) return;

        // Tone body
        const osc = this.audioCtx.createOscillator();
        const oscGain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(70, time + 0.06);
        oscGain.gain.setValueAtTime(0.2, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
        osc.connect(oscGain);
        oscGain.connect(this.drumGain);
        osc.start(time);
        osc.stop(time + 0.08);

        // Noise snap
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 1.2;

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.18, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.drumGain);
        noise.start(time);
        noise.stop(time + 0.1);
    }

    private playHat(time: number, isOpen = false) {
        if (!this.audioCtx || !this.drumGain || !this.noiseBuffer) return;
        const duration = isOpen ? 0.12 : 0.04;
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7500;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(isOpen ? 0.08 : 0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumGain);
        noise.start(time);
        noise.stop(time + duration + 0.01);
    }

    private playBass(freq: number, time: number, duration: number, oscType: OscillatorType) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const filter = this.audioCtx.createBiquadFilter();
        const env = this.audioCtx.createGain();

        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const cutoff = 350 + this.boostFactor * 250;
        filter.frequency.setValueAtTime(cutoff, time);

        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.22, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    private playChordNote(freq: number, time: number, duration: number, oscType: OscillatorType) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const filter = this.audioCtx.createBiquadFilter();
        const env = this.audioCtx.createGain();

        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const cutoff = 900 + this.boostFactor * 600;
        filter.frequency.setValueAtTime(cutoff, time);

        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.06, time + 0.04);
        env.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    private playLead(freq: number, time: number, duration: number, oscType: OscillatorType) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const filter = this.audioCtx.createBiquadFilter();
        const env = this.audioCtx.createGain();

        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const baseCutoff = 1600;
        const boostCutoff = baseCutoff + this.boostFactor * 1800;
        filter.frequency.setValueAtTime(boostCutoff, time);
        filter.frequency.exponentialRampToValueAtTime(600, time + duration);

        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.14, time + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    private schedule() {
        if (!this.isMusicPlaying || !this.audioCtx) return;
        const track = funTracks[this.currentTrack];
        if (!track || !track.bars || track.bars.length === 0) return;

        // Steady melodic BPM with NO tempo jumps or speed changes
        const currentBpm = track.bpm;
        const secondsPerBeat = 60 / currentBpm;
        const stepDuration = secondsPerBeat / track.stepsPerBeat;

        // Catch up if audio context was suspended or lagged
        if (this.nextStepTime < this.audioCtx.currentTime - 0.2) {
            this.nextStepTime = this.audioCtx.currentTime + 0.05;
        }

        // Lookahead window of 160ms
        while (this.nextStepTime < this.audioCtx.currentTime + 0.16) {
            const barData = track.bars[this.currentBar % track.bars.length];
            const stepData = barData[this.currentStep % barData.length];

            if (stepData) {
                const noteTime = this.nextStepTime;
                const isBoosted = this.boostFactor > 0.15;

                // Base Drums
                if (stepData.kick) this.playKick(noteTime);
                if (stepData.snare) this.playSnare(noteTime);
                if (stepData.hat) this.playHat(noteTime, Boolean(stepData.openHat));

                // Dynamic Boost Beat Modifications (adds driving rhythmic syncopation while tempo stays steady)
                if (isBoosted) {
                    // 1. Offbeat 16th-note shimmer hi-hats for groove subdivision
                    if (this.boostFactor > 0.22 && (this.currentStep % 2 === 1) && !stepData.hat) {
                        this.playHat(noteTime, false);
                    }
                    // 2. Syncopated groove kick accents on steps 6 & 14
                    if (this.boostFactor > 0.38 && (this.currentStep === 6 || this.currentStep === 14) && !stepData.kick) {
                        this.playKick(noteTime);
                    }
                    // 3. Subtle syncopated ghost snare accent on step 11
                    if (this.boostFactor > 0.55 && this.currentStep === 11 && !stepData.snare) {
                        this.playSnare(noteTime);
                    }
                }

                // Bass
                if (stepData.bass) {
                    const bFreq = noteFreq(stepData.bass);
                    this.playBass(bFreq, noteTime, stepDuration * 2.0, track.bassOsc);
                }

                // Chord Pads (warm, sustaining harmonies)
                if (stepData.chord && Array.isArray(stepData.chord)) {
                    stepData.chord.forEach(cNote => {
                        const cFreq = noteFreq(cNote);
                        this.playChordNote(cFreq, noteTime, stepDuration * 3.8, track.padOsc);
                    });
                }

                // Lead Melody (soaring, expressive)
                if (stepData.lead) {
                    const lFreq = noteFreq(stepData.lead);
                    this.playLead(lFreq, noteTime, stepDuration * 1.8, track.leadOsc);
                }
            }

            this.nextStepTime += stepDuration;
            this.currentStep++;
            if (this.currentStep >= 16) {
                this.currentStep = 0;
                this.currentBar = (this.currentBar + 1) % track.bars.length;
            }
        }

        // Set safety timer for background scheduling
        clearTimeout(this.schedulerTimerId);
        this.schedulerTimerId = setTimeout(() => this.schedule(), 40);
    }
}
