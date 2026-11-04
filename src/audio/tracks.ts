// Original compositions for the chiptune sequencer.
// Each channel lists one event per `every` sixteenth-steps; '.' is a rest, 'A4+C5' is a chord.
// Drum events: K kick, S snare, r roll tap, H hat, C crash. Channels with a higher `layer`
// join in as spending intensity rises (0 = always, 3 = maximum).

export interface Channel {
  wave: 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'sawtooth' | 'drum';
  every: number;
  notes: string[];
  vol: number;
  layer: number;
  gate?: number;
  vibrato?: number;
  swing?: boolean;
}

export interface Track { id: string; name: string; bpm: number; bars: number; channels: Channel[] }

const r = (s: string) => s.trim().split(/\s+/);

/** Repeats a one-bar pattern n times. */
const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join(' ');

const march: Track = {
  id: 'march', name: 'Appropriations March', bpm: 116, bars: 8,
  channels: [
    // Bass: root-fifth quarter notes. C F G C | Am F G G
    { wave: 'triangle', every: 4, vol: 0.42, layer: 0, gate: 0.7, notes: r(`
      C2 G2 C2 G2  F2 C3 F2 C3  G2 D3 G2 D3  C2 G2 C2 E2
      A2 E3 A2 E3  F2 C3 F2 C3  G2 D3 G2 D3  G2 B2 D3 G2`) },
    // Snare-driven march drums.
    { wave: 'drum', every: 1, vol: 0.32, layer: 0, notes: r(
      rep('K . . . S . . r K . K . S . r r', 7) + ' K . . . S . . r K . S r S r S r') },
    // Lead melody, eighth notes.
    { wave: 'pulse25', every: 2, vol: 0.13, layer: 1, vibrato: 1, notes: r(`
      G4 . C5 . C5 D5 E5 .   F5 . E5 D5 C5 . A4 .
      B4 . D5 . G5 . F5 E5   E5 . C5 . G4 . . .
      A4 . C5 E5 A5 . G5 E5  F5 . A5 . F5 E5 D5 C5
      D5 . B4 G4 D5 . E5 F5  G5 . . . G4 . . .`) },
    // Harmony arpeggio, sixteenths.
    { wave: 'pulse12', every: 1, vol: 0.05, layer: 2, gate: 0.5, notes: r(`
      ${rep('C4 E4 G4 C5', 4)} ${rep('F4 A4 C5 F5', 4)} ${rep('G4 B4 D5 G5', 4)} ${rep('C4 E4 G4 C5', 4)}
      ${rep('A3 C4 E4 A4', 4)} ${rep('F4 A4 C5 F5', 4)} ${rep('G4 B4 D5 G5', 4)} ${rep('G4 B4 D5 F5', 4)}`) },
    // Counter-melody brass stabs.
    { wave: 'pulse50', every: 4, vol: 0.06, layer: 3, gate: 0.5, notes: r(`
      E4+G4 . E4+G4 .  F4+A4 . F4+A4 .  D4+G4 . D4+B4 .  E4+G4 . C4+E4 .
      C4+E4 . C4+A4 .  C4+F4 . A3+F4 .  D4+G4 . B3+D4 .  D4+G4 . D4+B4 .`) },
    { wave: 'drum', every: 1, vol: 0.18, layer: 3, notes: r(rep('H . H H H . H H H . H H H . H H', 8)) },
  ],
};

const warroom: Track = {
  id: 'warroom', name: 'War Room Briefing', bpm: 96, bars: 4,
  channels: [
    { wave: 'triangle', every: 2, vol: 0.4, layer: 0, gate: 0.6, notes: r(`
      A2 . A2 A2 C3 . A2 .  F2 . F2 F2 A2 . F2 .  G2 . G2 G2 B2 . G2 .  E2 . E2 E2 G#2 . E2 .`) },
    { wave: 'drum', every: 1, vol: 0.28, layer: 0, notes: r(rep('K . . . . . K . S . . . . . . r', 4)) },
    { wave: 'pulse12', every: 1, vol: 0.05, layer: 1, gate: 0.4, notes: r(`
      ${rep('A4 E5 A5 E5', 4)} ${rep('F4 C5 F5 C5', 4)} ${rep('G4 D5 G5 D5', 4)} ${rep('E4 B4 E5 G#5', 4)}`) },
    { wave: 'pulse50', every: 4, vol: 0.1, layer: 2, vibrato: 2, gate: 0.95, notes: r(`
      E5 . . D5  C5 . . A4  B4 . . D5  E5 . . .`) },
    { wave: 'drum', every: 1, vol: 0.16, layer: 3, notes: r(rep('H . H . H . H . H . H . H . H H', 4)) },
  ],
};

const frenzy: Track = {
  id: 'frenzy', name: 'Emergency Supplemental', bpm: 160, bars: 4,
  channels: [
    { wave: 'triangle', every: 2, vol: 0.42, layer: 0, gate: 0.5, notes: r(`
      D2 D3 D2 D3 D2 D3 F2 G2  A#1 A#2 A#1 A#2 A#1 A#2 C2 D2  C2 C3 C2 C3 C2 C3 E2 F2  A1 A2 A1 A2 C#2 E2 A2 C#3`) },
    { wave: 'drum', every: 1, vol: 0.3, layer: 0, notes: r(rep('K . H . S . H K K . H . S . H H', 3) + ' K . S . S . S r S r S r S r S r') },
    { wave: 'pulse25', every: 2, vol: 0.13, layer: 0, vibrato: 1, notes: r(`
      D5 F5 A5 . G5 F5 E5 F5  D5 . A#4 D5 F5 . E5 D5
      E5 G5 C6 . A#5 A5 G5 A5  A5 . . . C#6 . E6 .`) },
    { wave: 'pulse12', every: 1, vol: 0.04, layer: 1, gate: 0.4, notes: r(`
      ${rep('D5 F5 A5 D6', 4)} ${rep('A#4 D5 F5 A#5', 4)} ${rep('C5 E5 G5 C6', 4)} ${rep('A4 C#5 E5 A5', 4)}`) },
  ],
};

const fanfare: Track = {
  id: 'fanfare', name: 'New Administration Fanfare', bpm: 104, bars: 4,
  channels: [
    { wave: 'triangle', every: 4, vol: 0.4, layer: 0, notes: r('C2 C2 G2 G2  F2 F2 C2 C2  A#1 A#1 F2 F2  G2 G2 G2 G2') },
    { wave: 'drum', every: 1, vol: 0.3, layer: 0, notes: r(rep('K . r r S . r r K . r r S r r r', 3) + ' S r S r S r S r S r S r C . . .') },
    { wave: 'pulse50', every: 2, vol: 0.12, layer: 0, vibrato: 1, gate: 0.9, notes: r(`
      C5 . C5 C5 G5 . . .  F5 . E5 . C5 . . .  A#4 . A#4 C5 D5 . F5 .  G5 . . . G5 . . .`) },
    { wave: 'pulse25', every: 2, vol: 0.07, layer: 1, notes: r(`
      E4 . E4 E4 E4 . . .  A4 . G4 . E4 . . .  D4 . D4 E4 F4 . A4 .  B4 . . . D5 . . .`) },
  ],
};

export const TRACKS: Record<string, Track> = { march, warroom, frenzy, fanfare };
export const JUKEBOX = [{ id: 'auto', name: 'Automatic' }, ...Object.values(TRACKS).map(t => ({ id: t.id, name: t.name }))];
