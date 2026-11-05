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
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
  /** Send level into the tempo-synced echo. */
  echo?: number;
  /** Detuned pair spread in cents (chorus). */
  detune?: number;
  /** Attack time in seconds (pads). */
  attack?: number;
  /** Ducks under the kick drum (sidechain pump). */
  side?: boolean;
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

// ---------- Closing film score ----------
// One continuous score in A minor that resolves to its relative major, C, at the Big Bang.
// Each cue starts from its first bar when the film calls for it, so phrases line up with the cuts.

/** Establishing shot: night over Washington. A low pad and a bell figure in the echo. */
const night: Track = {
  id: 'night', name: 'Night Over Washington', bpm: 120, bars: 2,
  channels: [
    { wave: 'triangle', every: 16, vol: 0.34, layer: 0, gate: 1, attack: 0.08, notes: r('A1 F1') },
    { wave: 'triangle', every: 16, vol: 0.09, layer: 0, gate: 1, attack: 0.4, pan: -0.2, notes: r('A3+C4+E4 F3+A3+C4+E4') },
    { wave: 'pulse12', every: 2, vol: 0.05, layer: 0, gate: 0.7, echo: 0.55, pan: 0.3, notes: r(`
      E5 . A5 . B5 . C6 -  - - B5 . A5 . E5 .`) },
  ],
};

/** The Oval Office: a restrained, ticking briefing over Am | F | Dm | E. */
const brief: Track = {
  id: 'brief', name: 'Two Minutes to Midnight', bpm: 112, bars: 4,
  channels: [
    { wave: 'triangle', every: 2, vol: 0.4, layer: 0, gate: 0.6, side: true, notes: r(`
      A1 . A2 . A1 . A2 A1  F1 . F2 . F1 . F2 F1  D2 . D3 . D2 . D3 D2  E2 . E3 . E2 . G#2 B2`) },
    { wave: 'drum', every: 1, vol: 0.26, layer: 0, notes: r(
      rep('K . . . S . . K . . K . S . . .', 3) + ' K . . . S . . K S . S r S r S r') },
    { wave: 'drum', every: 1, vol: 0.12, layer: 0, notes: r(rep('H . H . H . H . H . H . H . O .', 4)) },
    { wave: 'pulse12', every: 1, vol: 0.03, layer: 0, gate: 0.5, echo: 0.4, pan: -0.35, notes: r(`
      ${rep('A4 C5 E5 C5', 4)} ${rep('F4 A4 C5 A4', 4)} ${rep('D4 F4 A4 F4', 4)} ${rep('E4 G#4 B4 G#4', 4)}`) },
    { wave: 'pulse50', every: 2, vol: 0.085, layer: 0, gate: 0.9, vibrato: 1, detune: 8, echo: 0.35, pan: 0.2, notes: r(`
      E5 - - - - - D5 E5  C5 - - - - - A4 C5  D5 - - - F5 - E5 D5  E5 - - - - - . .`) },
  ],
};

/** The button and the collapse: driving A minor at 150 bpm, Am | F | G | E. */
const launch: Track = {
  id: 'launch', name: 'Launch Authority', bpm: 150, bars: 4,
  channels: [
    { wave: 'triangle', every: 2, vol: 0.42, layer: 0, gate: 0.55, side: true, notes: r(`
      A1 A2 A1 A2 A1 A2 A1 A2  F1 F2 F1 F2 F1 F2 F1 F2  G1 G2 G1 G2 G1 G2 G1 G2  E1 E2 E1 E2 G#1 G#2 B1 B2`) },
    { wave: 'drum', every: 1, vol: 0.3, layer: 0, notes: r(
      rep('K . . . S . . K . . K . S . K .', 3) + ' K . . . S . . . S . S . S S S S') },
    { wave: 'drum', every: 1, vol: 0.1, layer: 0, notes: r(rep('H . H H', 16)) },
    { wave: 'pulse50', every: 2, vol: 0.045, layer: 0, gate: 0.35, side: true, pan: -0.25, notes: r(`
      ${rep('. A3+C4+E4', 4)} ${rep('. A3+C4+F4', 4)} ${rep('. B3+D4+G4', 4)} ${rep('. B3+E4+G#4', 4)}`) },
    { wave: 'pulse25', every: 2, vol: 0.1, layer: 0, gate: 0.85, vibrato: 0.6, detune: 10, echo: 0.3, pan: 0.15, notes: r(`
      A4 - E5 - A5 - G5 E5  F5 - - - E5 - C5 -  D5 - G5 - B5 - A5 G5  G#5 - - - E5 - B4 -`) },
  ],
};

// ---------- The Star-Spangled Banner (public domain), remixed ----------
// The melody and harmony follow the traditional setting note for note, in C major and 3/4 time
// (12 sixteenth-steps per measure, 32 measures). The arrangement is new: a pumping octave bass,
// rock-waltz drums, a chorused square lead with an echoed octave double, pads and arpeggios.

/** Expands "note:steps" tokens (r = rest) into one event per step, holding with '-'. */
const line = (s: string) => s.trim().split(/\s+/).flatMap(tok => {
  const [n, d] = tok.split(':');
  const len = Number(d);
  return [n === 'r' ? '.' : n, ...Array.from({ length: len - 1 }, () => (n === 'r' ? '.' : '-'))];
});

// Melody, one measure per line. "O say can you see" opens the loop from the pickup at the end of m32.
const VERSE = `
  C4:4 E4:4 G4:4      C5:8 E5:3 D5:1      C5:4 E4:4 F#4:4     G4:8 G4:3 G4:1
  E5:6 D5:2 C5:4      B4:8 A4:3 B4:1      C5:4 C5:4 G4:4`;
const MELODY = `${VERSE}  E4:4 C4:4 G4:3 E4:1
  ${VERSE}  E4:4 C4:4 E5:2 E5:2
  E5:4 F5:4 G5:4      G5:8 F5:2 E5:2      D5:4 E5:4 F5:4      F5:8 F5:4
  E5:6 D5:2 C5:4      B4:8 A4:3 B4:1      C5:4 E4:4 F#4:4     G4:8 G4:4
  C5:4 C5:4 C5:2 B4:2 A4:4 A4:4 A4:4      D5:4 F5:2 E5:2 D5:2 C5:2  C5:4 B4:4 G4:3 G4:1
  C5:4 D5:2 E5:2 F5:4 G5:8 C5:2 D5:2      E5:6 F5:2 D5:4      C5:8 G4:3 E4:1`;
const octaveUp = (n: string) => n === '.' || n === '-' ? n : n.replace(/(\d)$/, d => String(Number(d) + 1));

// One chord per measure.
const SECTION_A = 'C C D7 G C G Am C';
const CHORDS = r(`${SECTION_A} ${SECTION_A} C C G7 Dm C G D7 G C F G7 G C C G C`);
const CHORD: Record<string, { bass: string; pad: string; arp: string[] }> = {
  C: { bass: 'C2', pad: 'C4+E4+G4', arp: ['C5', 'E5', 'G5', 'E5'] },
  D7: { bass: 'D2', pad: 'D4+F#4+C5', arp: ['D5', 'F#5', 'A5', 'C6'] },
  G: { bass: 'G1', pad: 'B3+D4+G4', arp: ['B4', 'D5', 'G5', 'D5'] },
  G7: { bass: 'G1', pad: 'B3+D4+F4', arp: ['B4', 'D5', 'F5', 'D5'] },
  Am: { bass: 'A1', pad: 'A3+C4+E4', arp: ['A4', 'C5', 'E5', 'C5'] },
  Dm: { bass: 'D2', pad: 'D4+F4+A4', arp: ['D5', 'F5', 'A5', 'F5'] },
  F: { bass: 'F1', pad: 'A3+C4+F4', arp: ['A4', 'C5', 'F5', 'C5'] },
};
const lead = line(MELODY);

const anthem: Track = {
  id: 'anthem', name: 'The Star-Spangled Banner (Debt Fury Remix)', bpm: 112, bars: 24,
  channels: [
    // Bass: root and octave in eighths, pumping under the kick.
    { wave: 'triangle', every: 2, vol: 0.42, layer: 0, gate: 0.6, side: true, notes: CHORDS.flatMap(c => {
      const b = CHORD[c].bass, up = octaveUp(b);
      return [b, up, b, up, b, up];
    }) },
    // Rock-waltz drums with a fill at the end of every eight measures.
    { wave: 'drum', every: 1, vol: 0.3, layer: 0, notes: CHORDS.flatMap((_, m) => r(
      m % 8 === 7 ? 'K . . . S . S . S S S S' : 'K . . . S . . K S . . .')) },
    { wave: 'drum', every: 1, vol: 0.12, layer: 0, notes: CHORDS.flatMap(() => r('. . H . . . H . . . O .')) },
    { wave: 'drum', every: 12, vol: 0.26, layer: 0, notes: CHORDS.map((_, m) => (m === 0 || m === 16 ? 'C' : '.')) },
    // Pads and arpeggios.
    { wave: 'pulse12', every: 12, vol: 0.03, layer: 0, gate: 0.98, attack: 0.06, side: true, pan: -0.15, notes: CHORDS.map(c => CHORD[c].pad) },
    { wave: 'pulse12', every: 1, vol: 0.024, layer: 0, gate: 0.4, echo: 0.45, pan: -0.4, notes: CHORDS.flatMap(c => [...CHORD[c].arp, ...CHORD[c].arp, ...CHORD[c].arp]) },
    // The melody: a chorused square lead, doubled an octave up into the echo.
    { wave: 'pulse50', every: 1, vol: 0.1, layer: 0, gate: 0.75, vibrato: 1, detune: 7, pan: 0.1, notes: lead },
    { wave: 'pulse12', every: 1, vol: 0.035, layer: 0, gate: 0.75, echo: 0.5, pan: 0.3, notes: lead.map(octaveUp) },
  ],
};
/** Step offsets into the anthem used by the closing film. */
export const ANTHEM_ROCKETS = 15 * 12 + 8; // "And the rocket's red glare"
export const ANTHEM_TOP = 31 * 12 + 8; // "O say can you see", from the pickup

export const TRACKS: Record<string, Track> = { march, warroom, frenzy, fanfare, night, brief, launch, anthem };
/** Tracks offered in the jukebox; the film-only cues are excluded except the anthem. */
export const JUKEBOX = [{ id: 'auto', name: 'Automatic' }, ...[march, warroom, frenzy, fanfare, anthem].map(t => ({ id: t.id, name: t.name }))];
