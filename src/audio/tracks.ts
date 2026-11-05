// The score: every track is a variation on The Star-Spangled Banner (public domain).
//
// The melody and harmony follow the traditional setting note for note, in C major and 3/4 time
// (12 sixteenth-steps per measure, 32 measures). Each track takes a passage of it and gives it its
// own arrangement: a brass-band march for the main game, a minor-key mutation for the war room,
// a double-time "rocket's red glare" for spending frenzies, the "land of the free" cadence as the
// inauguration fanfare, and dedicated cues for the closing film.
//
// Each channel lists one event per `every` sixteenth-steps; '.' is a rest, '-' holds the previous
// note, 'A4+C5' is a chord. Drum events: K kick, S snare, r roll tap, H hat, O open hat, C crash.
// Channels with a higher `layer` join in as spending intensity rises (0 = always, 3 = maximum).

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

/** Expands "note:steps" tokens (r = rest) into one event per step, holding with '-'. */
const line = (s: string) => r(s).flatMap(tok => {
  const [n, d] = tok.split(':');
  const len = Number(d);
  return [n === 'r' ? '.' : n, ...Array.from({ length: len - 1 }, () => (n === 'r' ? '.' : '-'))];
});

// ---------- The theme ----------

const STEPS = 12;
const VERSE = `
  C4:4 E4:4 G4:4      C5:8 E5:3 D5:1      C5:4 E4:4 F#4:4     G4:8 G4:3 G4:1
  E5:6 D5:2 C5:4      B4:8 A4:3 B4:1      C5:4 C5:4 G4:4`;
/** The melody, one measure per line; the "O-oh" pickup sits at the end of measure 32. */
const MELODY = line(`${VERSE}  E4:4 C4:4 G4:3 E4:1
  ${VERSE}  E4:4 C4:4 E5:2 E5:2
  E5:4 F5:4 G5:4      G5:8 F5:2 E5:2      D5:4 E5:4 F5:4      F5:8 F5:4
  E5:6 D5:2 C5:4      B4:8 A4:3 B4:1      C5:4 E4:4 F#4:4     G4:8 G4:4
  C5:4 C5:4 C5:2 B4:2 A4:4 A4:4 A4:4      D5:4 F5:2 E5:2 D5:2 C5:2  C5:4 B4:4 G4:3 G4:1
  C5:4 D5:2 E5:2 F5:4 G5:8 C5:2 D5:2      E5:6 F5:2 D5:4      C5:8 G4:3 E4:1`);
const SECTION_A = 'C C D7 G C G Am C';
/** One chord per measure. */
const CHORDS = r(`${SECTION_A} ${SECTION_A} C C G7 Dm C G D7 G C F G7 G C C G C`);

interface Chord { bass: string; pad: string; arp: string[] }
const MAJOR: Record<string, Chord> = {
  C: { bass: 'C2', pad: 'C4+E4+G4', arp: ['C5', 'E5', 'G5', 'E5'] },
  D7: { bass: 'D2', pad: 'D4+F#4+C5', arp: ['D5', 'F#5', 'A5', 'C6'] },
  G: { bass: 'G1', pad: 'B3+D4+G4', arp: ['B4', 'D5', 'G5', 'D5'] },
  G7: { bass: 'G1', pad: 'B3+D4+F4', arp: ['B4', 'D5', 'F5', 'D5'] },
  Am: { bass: 'A1', pad: 'A3+C4+E4', arp: ['A4', 'C5', 'E5', 'C5'] },
  Dm: { bass: 'D2', pad: 'D4+F4+A4', arp: ['D5', 'F5', 'A5', 'F5'] },
  F: { bass: 'F1', pad: 'A3+C4+F4', arp: ['A4', 'C5', 'F5', 'C5'] },
};
/** The mutation into C harmonic minor: E and A are flattened, the leading tone B is kept. */
const MINOR: Record<string, Chord> = {
  ...MAJOR,
  C: { bass: 'C2', pad: 'C4+D#4+G4', arp: ['C5', 'D#5', 'G5', 'D#5'] },
  D7: { bass: 'D2', pad: 'D4+F#4+C5', arp: ['D5', 'F#5', 'C6', 'F#5'] },
  Am: { bass: 'G#1', pad: 'G#3+C4+D#4', arp: ['G#4', 'C5', 'D#5', 'C5'] },
  Dm: { bass: 'D2', pad: 'D4+F4+G#4', arp: ['D5', 'F5', 'G#5', 'F5'] },
  F: { bass: 'F1', pad: 'G#3+C4+F4', arp: ['G#4', 'C5', 'F5', 'C5'] },
};
const toMinor = (n: string) => n.replace(/^E(\d)$/, 'D#$1').replace(/^A(\d)$/, 'G#$1');
const shift = (n: string, oct: number) => (n === '.' || n === '-' ? n : n.replace(/(\d)$/, d => String(Number(d) + oct)));

// ---------- Arrangement styles ----------

const DRUMS: Record<string, { beat: string; fill: string; hat: string }> = {
  march: { beat: 'K . . . S . r r S . . .', fill: 'S r S r S r S r S S S S', hat: '. . H . . . H . . . H .' },
  rock: { beat: 'K . . . S . . K S . . .', fill: 'K . . . S . S . S S S S', hat: '. . H . . . H . . . O .' },
  drive: { beat: 'K . S . K K S . K . S .', fill: 'S S S S S S S S S r S r', hat: 'H H H H H H H H H H H H' },
  tick: { beat: 'K . . . . . r . . . r .', fill: 'K . . . r . r . r r r r', hat: 'H . . . H . . . H . . .' },
  grand: { beat: 'K . . . S . . . S . . .', fill: 'r r r r r r r r S S S S', hat: '. . H . . . H . . . H .' },
};

interface Variation {
  id: string; name: string; bpm: number;
  /** First and last measure (1-based, inclusive); the count must be a multiple of 4. */
  from: number; to: number;
  minor?: boolean;
  drums?: keyof typeof DRUMS;
  /** Replaces the last beat of the melody so the loop leads back into its first measure. */
  tail?: string;
  bass: 'octave' | 'drive' | 'held';
  lead: { wave: Channel['wave']; vol: number; oct?: number; layer?: number; gate?: number };
  /** Intensity layer of a sawtooth brass voice in unison with the lead, which gives the tune a band timbre. */
  brass?: number;
  /** Volume of the off-beat chord stabs (default 0.045). */
  stabVol?: number;
  /** Intensity layers for the optional parts; omitted parts are left out. */
  stabs?: number; arp?: number; double?: number; pad?: number; hats?: number;
  crashEvery?: number;
}

function variation(v: Variation): Track {
  const measures = Array.from({ length: v.to - v.from + 1 }, (_, i) => v.from - 1 + i);
  const chordSet = v.minor ? MINOR : MAJOR;
  const chords = measures.map(m => chordSet[CHORDS[m]]);
  let melody = measures.flatMap(m => MELODY.slice(m * STEPS, (m + 1) * STEPS));
  if (v.tail) melody = [...melody.slice(0, -4), ...line(v.tail)];
  melody = melody.map(n => shift(v.minor ? toMinor(n) : n, v.lead.oct ?? 0));
  const ch: Channel[] = [];
  ch.push({
    wave: 'triangle', every: 2, vol: 0.42, layer: 0, gate: v.bass === 'held' ? 1 : 0.6, side: v.bass !== 'held',
    notes: chords.flatMap(c => {
      const b = c.bass, up = shift(b, 1);
      if (v.bass === 'held') return [b, '-', '-', '-', '-', '-'];
      return v.bass === 'drive' ? [b, b, up, b, b, up] : [b, up, b, up, b, up];
    }),
  });
  if (v.drums) {
    const d = DRUMS[v.drums];
    ch.push({ wave: 'drum', every: 1, vol: 0.3, layer: 0, notes: measures.flatMap((_, i) => r(i % 8 === 7 ? d.fill : d.beat)) });
    if (v.hats !== undefined) ch.push({ wave: 'drum', every: 1, vol: 0.12, layer: v.hats, notes: measures.flatMap(() => r(d.hat)) });
    ch.push({ wave: 'drum', every: STEPS, vol: 0.26, layer: 0, notes: measures.map((_, i) => (i % (v.crashEvery ?? 16) === 0 ? 'C' : '.')) });
  }
  if (v.stabs !== undefined) ch.push({ wave: 'pulse50', every: 4, vol: v.stabVol ?? 0.045, layer: v.stabs, gate: 0.4, pan: -0.25, notes: chords.flatMap(c => ['.', c.pad, c.pad]) });
  if (v.pad !== undefined) ch.push({ wave: 'pulse12', every: STEPS, vol: 0.03, layer: v.pad, gate: 0.98, attack: 0.06, side: true, pan: -0.15, notes: chords.map(c => c.pad) });
  if (v.arp !== undefined) ch.push({ wave: 'pulse12', every: 1, vol: 0.024, layer: v.arp, gate: 0.4, echo: 0.45, pan: -0.4, notes: chords.flatMap(c => [...c.arp, ...c.arp, ...c.arp]) });
  if (v.brass !== undefined) ch.push({ wave: 'sawtooth', every: 1, vol: 0.022, layer: v.brass, gate: v.lead.gate ?? 0.75, vibrato: 1, attack: 0.02, pan: -0.1, echo: 0.1, notes: melody });
  ch.push({ wave: v.lead.wave, every: 1, vol: v.lead.vol, layer: v.lead.layer ?? 0, gate: v.lead.gate ?? 0.75, vibrato: 1, detune: 7, pan: 0.1, echo: 0.15, notes: melody });
  if (v.double !== undefined) ch.push({ wave: 'pulse12', every: 1, vol: 0.035, layer: v.double, gate: 0.75, echo: 0.5, pan: 0.3, notes: melody.map(n => shift(n, 1)) });
  return { id: v.id, name: v.name, bpm: v.bpm, bars: (measures.length * STEPS) / 16, channels: ch };
}

// ---------- Game tracks ----------

/**
 * The main game: the whole anthem as a brass-band march; parts join as spending rises. The tune is
 * kept in front of the band: a slightly broader tempo, a legato lead doubled by a brass voice from
 * the first bar, and quieter accompaniment stabs.
 */
const march = variation({
  id: 'march', name: 'Appropriations March', bpm: 108, from: 1, to: 32, drums: 'march', bass: 'octave',
  lead: { wave: 'pulse50', vol: 0.115, gate: 0.9 }, brass: 0, stabs: 0, stabVol: 0.03, double: 1, arp: 2, hats: 3, pad: 3,
});
/** Audits and bad news: the first half of the anthem mutated into C minor, slow and ticking. */
const warroom = variation({
  id: 'warroom', name: 'War Room Briefing', bpm: 88, from: 1, to: 16, minor: true, drums: 'tick', bass: 'held',
  lead: { wave: 'pulse25', vol: 0.085 }, pad: 0, arp: 1, hats: 2, double: 3,
});
/** Spending frenzies: "And the rocket's red glare" to the end, in double time. */
const frenzy = variation({
  id: 'frenzy', name: 'Emergency Supplemental', bpm: 168, from: 17, to: 32, drums: 'drive', bass: 'drive', tail: 'E5:2 E5:2',
  lead: { wave: 'pulse25', vol: 0.095 }, stabs: 0, hats: 0, arp: 1, double: 2, crashEvery: 8,
});
/** Inaugurations: "O'er the land of the free and the home of the brave", broad and grand. */
const fanfare = variation({
  id: 'fanfare', name: 'New Administration Fanfare', bpm: 92, from: 29, to: 32, drums: 'grand', bass: 'octave', tail: 'G4:3 G4:1',
  lead: { wave: 'pulse50', vol: 0.1 }, stabs: 0, pad: 0, double: 0, hats: 1, crashEvery: 4,
});

// ---------- Closing film cues ----------

/** Establishing shot: the opening phrase as a slow music box over a held bass. */
const night = variation({
  id: 'night', name: 'Night Over Washington', bpm: 76, from: 1, to: 4, bass: 'held', tail: 'G4:3 E4:1',
  lead: { wave: 'pulse12', vol: 0.06, oct: 1 }, pad: 0,
});
/** The Oval Office: the opening verse in minor, ticking. */
const brief = variation({
  id: 'brief', name: 'Two Minutes to Midnight', bpm: 104, from: 1, to: 8, minor: true, drums: 'tick', bass: 'octave',
  lead: { wave: 'pulse25', vol: 0.085 }, pad: 0, arp: 0, hats: 0,
});
/** The button and the collapse: "the rocket's red glare" in minor, driving. */
const launch = variation({
  id: 'launch', name: 'Launch Authority', bpm: 156, from: 17, to: 24, minor: true, drums: 'drive', bass: 'drive', tail: 'E5:2 E5:2',
  lead: { wave: 'pulse25', vol: 0.1 }, stabs: 0, hats: 0, arp: 0, double: 0, crashEvery: 8,
});
/** Big Bang 2, Universe 2, the credits and the closing title: the whole anthem, full band. */
const anthem = variation({
  id: 'anthem', name: 'The Star-Spangled Banner (Debt Fury Remix)', bpm: 112, from: 1, to: 32, drums: 'rock', bass: 'octave',
  lead: { wave: 'pulse50', vol: 0.1 }, pad: 0, arp: 0, double: 0, hats: 0,
});

/** Step offsets into the anthem used by the closing film. */
export const ANTHEM_ROCKETS = 15 * STEPS + 8; // "And the rocket's red glare"
export const ANTHEM_TOP = 31 * STEPS + 8; // "O say can you see", from the pickup

export const TRACKS: Record<string, Track> = { march, warroom, frenzy, fanfare, night, brief, launch, anthem };
/** Tracks offered in the jukebox; the film-only cues are excluded except the anthem. */
export const JUKEBOX = [{ id: 'auto', name: 'Automatic' }, ...[march, warroom, frenzy, fanfare, anthem].map(t => ({ id: t.id, name: t.name }))];
