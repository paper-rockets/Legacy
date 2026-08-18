export interface TrackConfig {
    name: string;
    chords: number[][];
    speed: number;
    stepSpeed: number;
    padOsc: OscillatorType;
    leadOsc: OscillatorType;
}

export const tracks: TrackConfig[] = [
    {
        name: "Spirited Winds",
        chords: [
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 349.23],
            [164.81, 196.00, 246.94, 293.66],
            [220.00, 261.63, 329.63, 392.00]
        ],
        speed: 2400, stepSpeed: 300, padOsc: 'triangle', leadOsc: 'sine'
    },
    {
        name: "Summer Clouds",
        chords: [
            [261.63, 329.63, 392.00, 493.88],
            [196.00, 246.94, 293.66, 392.00],
            [220.00, 261.63, 329.63, 392.00],
            [174.61, 220.00, 261.63, 329.63]
        ],
        speed: 3200, stepSpeed: 400, padOsc: 'sawtooth', leadOsc: 'triangle'
    },
    {
        name: "Evening Whispers",
        chords: [
            [220.00, 261.63, 329.63, 493.88],
            [174.61, 220.00, 261.63, 392.00],
            [261.63, 329.63, 392.00, 493.88],
            [164.81, 207.65, 246.94, 293.66]
        ],
        speed: 2800, stepSpeed: 350, padOsc: 'sine', leadOsc: 'sine'
    },
    {
        name: "Wandering Spirits",
        chords: [
            [261.63, 329.63, 392.00, 523.25],
            [174.61, 220.00, 261.63, 349.23],
            [196.00, 246.94, 293.66, 392.00],
            [220.00, 261.63, 329.63, 440.00]
        ],
        speed: 2000, stepSpeed: 250, padOsc: 'triangle', leadOsc: 'triangle'
    },
    {
        name: "Star Ocean",
        chords: [
            [293.66, 369.99, 440.00, 554.37],
            [220.00, 277.18, 329.63, 415.30],
            [246.94, 293.66, 369.99, 440.00],
            [196.00, 246.94, 293.66, 369.99]
        ],
        speed: 4000, stepSpeed: 500, padOsc: 'sine', leadOsc: 'triangle'
    },
    {
        name: "Autumn Leaves",
        chords: [
            [146.83, 174.61, 220.00, 261.63],
            [196.00, 246.94, 293.66, 349.23],
            [130.81, 164.81, 196.00, 246.94],
            [174.61, 220.00, 261.63, 329.63]
        ],
        speed: 3000, stepSpeed: 375, padOsc: 'triangle', leadOsc: 'sine'
    },
    {
        name: "Midnight Rain",
        chords: [
            [220.00, 261.63, 329.63, 440.00],
            [261.63, 329.63, 392.00, 523.25],
            [196.00, 246.94, 293.66, 392.00],
            [293.66, 369.99, 440.00, 587.33]
        ],
        speed: 2600, stepSpeed: 325, padOsc: 'sine', leadOsc: 'triangle'
    },
    {
        name: "Gentle Brook",
        chords: [
            [164.81, 207.65, 246.94, 311.13],
            [138.59, 164.81, 207.65, 246.94],
            [185.00, 220.00, 277.18, 329.63],
            [246.94, 311.13, 369.99, 440.00]
        ],
        speed: 3400, stepSpeed: 425, padOsc: 'sine', leadOsc: 'sine'
    },
    {
        name: "Mountain Echo",
        chords: [
            [196.00, 246.94, 293.66, 369.99],
            [246.94, 293.66, 369.99, 440.00],
            [164.81, 196.00, 246.94, 293.66],
            [261.63, 329.63, 392.00, 493.88]
        ],
        speed: 2200, stepSpeed: 275, padOsc: 'triangle', leadOsc: 'triangle'
    },
    {
        name: "Morning Dew",
        chords: [
            [174.61, 220.00, 261.63, 329.63],
            [164.81, 196.00, 246.94, 293.66],
            [146.83, 174.61, 220.00, 261.63],
            [196.00, 246.94, 293.66, 349.23]
        ],
        speed: 2800, stepSpeed: 350, padOsc: 'sawtooth', leadOsc: 'sine'
    },
    {
        name: "Crystal Caves",
        chords: [
            [130.81, 155.56, 196.00, 293.66],
            [207.65, 261.63, 311.13, 392.00],
            [155.56, 196.00, 233.08, 293.66],
            [196.00, 246.94, 293.66, 349.23]
        ],
        speed: 3600, stepSpeed: 450, padOsc: 'sine', leadOsc: 'triangle'
    },
    {
        name: "Endless Horizon",
        chords: [
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 392.00],
            [220.00, 261.63, 329.63, 440.00],
            [261.63, 329.63, 392.00, 523.25]
        ],
        speed: 3200, stepSpeed: 400, padOsc: 'triangle', leadOsc: 'sine'
    },
    {
        name: "Nomad's Dream",
        chords: [
            [146.83, 174.61, 220.00, 261.63],
            [220.00, 261.63, 329.63, 392.00],
            [164.81, 196.00, 246.94, 293.66],
            [196.00, 246.94, 293.66, 349.23]
        ],
        speed: 2800, stepSpeed: 350, padOsc: 'sine', leadOsc: 'triangle'
    },
    {
        name: "Distant Shores",
        chords: [
            [233.08, 293.66, 349.23, 440.00],
            [174.61, 220.00, 261.63, 329.63],
            [261.63, 329.63, 392.00, 523.25],
            [146.83, 174.61, 220.00, 293.66]
        ],
        speed: 3600, stepSpeed: 450, padOsc: 'sawtooth', leadOsc: 'sine'
    },
    {
        name: "Windwalker",
        chords: [
            [261.63, 329.63, 392.00, 493.88],
            [164.81, 196.00, 246.94, 293.66],
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 392.00]
        ],
        speed: 2400, stepSpeed: 300, padOsc: 'triangle', leadOsc: 'triangle'
    },
    {
        name: "Forgotten Path",
        chords: [
            [220.00, 261.63, 329.63, 440.00],
            [174.61, 220.00, 261.63, 349.23],
            [261.63, 329.63, 392.00, 523.25],
            [196.00, 246.94, 293.66, 392.00]
        ],
        speed: 3000, stepSpeed: 375, padOsc: 'sine', leadOsc: 'sine'
    },
    {
        name: "Journey's Dawn",
        chords: [
            [196.00, 246.94, 293.66, 369.99],
            [293.66, 369.99, 440.00, 587.33],
            [220.00, 277.18, 329.63, 440.00],
            [246.94, 293.66, 369.99, 493.88]
        ],
        speed: 2600, stepSpeed: 325, padOsc: 'sine', leadOsc: 'triangle'
    },
    {
        name: "Wayfarer's Song",
        chords: [
            [261.63, 329.63, 392.00, 523.25],
            [196.00, 246.94, 293.66, 392.00],
            [146.83, 174.61, 220.00, 293.66],
            [220.00, 261.63, 329.63, 440.00]
        ],
        speed: 3400, stepSpeed: 425, padOsc: 'triangle', leadOsc: 'sine'
    },
    {
        name: "Stardust Trail",
        chords: [
            [174.61, 220.00, 261.63, 329.63],
            [261.63, 329.63, 392.00, 493.88],
            [196.00, 246.94, 293.66, 392.00],
            [220.00, 261.63, 329.63, 392.00]
        ],
        speed: 2800, stepSpeed: 350, padOsc: 'sawtooth', leadOsc: 'sine'
    },
    {
        name: "Drifting Clouds",
        chords: [
            [155.56, 196.00, 233.08, 293.66],
            [233.08, 293.66, 349.23, 440.00],
            [174.61, 220.00, 261.63, 329.63],
            [130.81, 164.81, 196.00, 246.94]
        ],
        speed: 4000, stepSpeed: 500, padOsc: 'sine', leadOsc: 'sine'
    }
];

const arpPatterns = [
    [0, 1, 2, 3, 2, 1],
    [0, 2, 1, 3, 2, 3],
    [0, 1, 2, 1],
    [1, 2, 3, 2]
];

export class AmbientAudioEngine {
    private audioCtx: AudioContext | null = null;
    private musicGain: GainNode | null = null;
    public isMusicPlaying = false;
    public currentTrack = 0;
    private nextNoteTime = 0;
    private musicTimerID: any = null;
    private chordIndex = 0;
    private sequenceTime = 0;
    private arpIndex = 0;

    public initAudio() {
        if (this.audioCtx) return;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.audioCtx = new AudioCtx();
    }

    public toggleMusic(): boolean {
        this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (!this.musicGain && this.audioCtx) {
            this.musicGain = this.audioCtx.createGain();
            this.musicGain.gain.value = 0.5;
            this.musicGain.connect(this.audioCtx.destination);
        }

        this.isMusicPlaying = !this.isMusicPlaying;
        if (this.isMusicPlaying) {
            this.sequenceTime = 0;
            this.chordIndex = 0;
            this.arpIndex = 0;
            if (this.audioCtx) {
                this.nextNoteTime = this.audioCtx.currentTime + 0.1;
            }
            this.scheduleNotes();
        } else {
            clearTimeout(this.musicTimerID);
        }
        return this.isMusicPlaying;
    }

    public nextTrack(): string {
        this.currentTrack = (this.currentTrack + 1) % tracks.length;
        this.sequenceTime = 0;
        this.chordIndex = 0;
        this.arpIndex = 0;
        if (this.audioCtx) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }
        return tracks[this.currentTrack].name;
    }

    private playNote(freq: number, time: number, duration: number, oscType: OscillatorType, isPad = false) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const env = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = oscType;
        osc.frequency.value = freq;
        filter.type = 'lowpass';

        if (isPad) {
            filter.frequency.value = 600;
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.04, time + duration * 0.4);
            env.gain.linearRampToValueAtTime(0.001, time + duration);
        } else {
            filter.frequency.setValueAtTime(1200, time);
            filter.frequency.exponentialRampToValueAtTime(400, time + duration);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.1, time + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    private scheduleNotes() {
        if (!this.isMusicPlaying || !this.audioCtx) return;
        const track = tracks[this.currentTrack];

        if (this.nextNoteTime < this.audioCtx.currentTime - 0.5) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }

        while (this.nextNoteTime < this.audioCtx.currentTime + 0.2) {
            if (this.sequenceTime % track.speed === 0) {
                const chord = track.chords[this.chordIndex % track.chords.length];
                chord.forEach(freq => {
                    this.playNote(freq / 2, this.nextNoteTime, (track.speed / 1000) * 1.5, track.padOsc, true);
                });
            }

            const chord = track.chords[this.chordIndex % track.chords.length];
            const pattern = arpPatterns[this.chordIndex % arpPatterns.length];

            if (this.sequenceTime % track.stepSpeed === 0) {
                const arpFreq = chord[pattern[this.arpIndex % pattern.length]] * 2;
                this.playNote(arpFreq, this.nextNoteTime, (track.stepSpeed / 1000) * 2.0, track.leadOsc, false);
                this.arpIndex++;

                if (Math.random() > 0.7) {
                    const melFreq = chord[Math.floor(Math.random() * chord.length)] * 4;
                    this.playNote(melFreq, this.nextNoteTime, (track.speed / 1000) * 0.8, track.leadOsc, false);
                }
            }

            this.nextNoteTime += track.stepSpeed / 1000;
            this.sequenceTime += track.stepSpeed;

            if (this.sequenceTime >= track.speed) {
                this.sequenceTime = 0;
                this.chordIndex++;
                this.arpIndex = 0;
            }
        }
        this.musicTimerID = setTimeout(() => this.scheduleNotes(), 50);
    }
}
