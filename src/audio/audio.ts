// Procedural chiptune engine: square/triangle/noise voices, a look-ahead step sequencer,
// original tracks with intensity layers, and synthesised sound effects.
//
// Mix bus: every track channel has its own bus (pan, sidechain pump, echo send). The music bus
// feeds a tempo-synced dotted-eighth echo and a short generated room reverb, so the square waves
// sit in a space instead of sounding dry.
import { TRACKS, type Track } from './tracks';

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

export function freq(note: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(note);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

export type Sfx = 'click' | 'buy' | 'upgrade' | 'research' | 'golden' | 'goldenOpen' | 'achievement' | 'audit' | 'error' | 'jet' | 'boom' | 'horn' | 'prestige' | 'rank' | 'tick' | 'explosion' | 'boomFar' | 'deploy' | 'drumroll' | 'combo'
  | 'blip' | 'blipLow' | 'whoosh' | 'heart' | 'riser' | 'impact' | 'shimmer' | 'sting' | 'alarm' | 'thud';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private pulse: Record<string, PeriodicWave> = {};
  private echoIn!: GainNode;
  private echoDelay!: DelayNode;
  private buses = new Map<string, { gain: GainNode; side: boolean }>();
  private track: Track = TRACKS.march;
  private wanted = 'march';
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  intensity = 0;
  private vol = { music: 0.5, sfx: 0.7, muted: false };

  get started(): boolean { return !!this.ctx; }

  /** Creates the audio graph. Must be called from a user gesture. */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    // Echo: dotted-eighth delay with a darkening feedback loop, returned into the music bus.
    this.echoIn = ctx.createGain();
    this.echoDelay = ctx.createDelay(2);
    this.echoDelay.delayTime.value = 0.36;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass'; echoTone.frequency.value = 2600;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.36;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.55;
    this.echoIn.connect(this.echoDelay).connect(echoTone).connect(feedback).connect(this.echoDelay);
    echoTone.connect(echoOut).connect(this.music);
    // Room: a generated stereo impulse response (decaying noise, about 1.6 s).
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    const room = ctx.createConvolver();
    room.buffer = ir;
    const roomSend = ctx.createGain(), roomTone = ctx.createBiquadFilter();
    roomSend.gain.value = 0.2;
    roomTone.type = 'highpass'; roomTone.frequency.value = 220;
    this.music.connect(roomTone).connect(roomSend).connect(room).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const duty of [0.125, 0.25, 0.5]) this.pulse[duty] = this.makePulse(duty);
    this.applyVolume();
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private makePulse(duty: number): PeriodicWave {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return this.ctx!.createPeriodicWave(re, im);
  }

  setVolume(music: number, sfx: number, muted: boolean): void {
    this.vol = { music, sfx, muted };
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : 0.8, t, 0.05);
    this.music.gain.setTargetAtTime(this.ducked ? 0 : this.vol.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx * 0.6, t, 0.02);
  }

  private ducked = false;
  /** Fades the music out (true) or back in (false), e.g. for cinematics. */
  duck(on: boolean): void {
    this.ducked = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(on ? 0 : this.vol.music * 0.55, t, on ? 0.15 : 0.4);
  }

  /** Requests a track; it switches at the next bar line. */
  setTrack(name: string): void {
    if (TRACKS[name]) this.wanted = name;
  }

  /** Starts a track right now, from its first step or from `from`, and brings the music back in (cinematics). */
  playNow(name: string, from = 0): void {
    if (!TRACKS[name]) return;
    this.wanted = name;
    this.enter(TRACKS[name]);
    this.step = Math.max(0, Math.floor(from));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.nextTime = t + 0.03;
    this.ducked = false;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.03);
  }

  private enter(tr: Track): void {
    this.track = tr;
    this.step = 0;
    if (this.ctx) this.echoDelay.delayTime.setTargetAtTime((60 / tr.bpm) * 0.75, this.ctx.currentTime, 0.02);
  }

  /** The persistent bus of one channel of a track: pan, echo send and sidechain gain. */
  private bus(tr: Track, i: number): GainNode {
    const key = tr.id + ':' + i;
    let b = this.buses.get(key);
    if (!b) {
      const ctx = this.ctx!, ch = tr.channels[i];
      const gain = ctx.createGain();
      let out: AudioNode = gain;
      if (ch.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = ch.pan;
        out = gain.connect(p);
      }
      out.connect(this.music);
      if (ch.echo) {
        const send = ctx.createGain();
        send.gain.value = ch.echo;
        out.connect(send).connect(this.echoIn);
      }
      b = { gain, side: !!ch.side };
      this.buses.set(key, b);
    }
    return b.gain;
  }

  /** Sidechain pump: channels marked `side` dip under every kick of the current track. */
  private pump(when: number): void {
    const tr = this.track;
    tr.channels.forEach((ch, i) => {
      if (!ch.side) return;
      const g = this.bus(tr, i).gain;
      g.cancelScheduledValues(when);
      g.setValueAtTime(0.35, when);
      g.setTargetAtTime(1, when + 0.02, 0.07);
    });
  }

  get trackName(): string { return this.track.name; }

  private schedule(): void {
    const ctx = this.ctx!;
    if (this.vol.muted || this.vol.music <= 0) { this.nextTime = ctx.currentTime + 0.05; return; }
    while (this.nextTime < ctx.currentTime + 0.12) {
      const tr = this.track;
      const stepDur = 60 / tr.bpm / 4;
      const len = tr.bars * 16;
      const st = this.step % len;
      if (st % 16 === 0 && this.wanted !== tr.id) {
        this.enter(TRACKS[this.wanted]);
        continue;
      }
      tr.channels.forEach((ch, i) => {
        if (ch.layer > this.intensity || st % ch.every !== 0) return;
        const idx = Math.floor(st / ch.every) % ch.notes.length;
        const ev = ch.notes[idx];
        if (!ev || ev === '.' || ev === '-') return;
        // Each '-' after a note holds it for another `every` steps.
        let hold = 0;
        while (idx + hold + 1 < ch.notes.length && ch.notes[idx + hold + 1] === '-') hold++;
        const when = this.nextTime + (ch.swing && (st / ch.every) % 2 === 1 ? stepDur * 0.15 : 0);
        const dur = stepDur * ch.every * (hold + (ch.gate ?? 0.8));
        const dest = this.bus(tr, i);
        if (ch.wave === 'drum') this.drum(ev, when, ch.vol, dest);
        else for (const n of ev.split('+')) this.tone(ch.wave, freq(n), when, dur, ch.vol, dest, ch.vibrato, 0, ch.detune, ch.attack);
      });
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private tone(wave: string, f: number, when: number, dur: number, vol: number, dest: AudioNode, vibrato = 0, slideTo = 0, detune = 0, attack = 0.005): void {
    if (!f) return;
    const ctx = this.ctx!;
    const g = ctx.createGain();
    // A detuned pair (in cents) gives a chorused voice; each oscillator is scaled to keep the level.
    const voices = detune ? [-detune / 2, detune / 2] : [0];
    const lvl = detune ? vol * 0.62 : vol;
    for (const cents of voices) {
      const o = ctx.createOscillator();
      if (wave.startsWith('pulse')) o.setPeriodicWave(this.pulse[{ pulse12: 0.125, pulse25: 0.25, pulse50: 0.5 }[wave] ?? 0.5]);
      else o.type = wave as OscillatorType;
      o.frequency.setValueAtTime(f, when);
      if (cents) o.detune.value = cents;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
      if (vibrato) {
        // Delayed vibrato: short notes stay clean and held notes begin to sing.
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, when);
        lg.gain.linearRampToValueAtTime(f * 0.006 * vibrato, when + Math.min(0.35, dur * 0.6));
        lfo.connect(lg).connect(o.frequency);
        lfo.start(when); lfo.stop(when + dur + 0.05);
      }
      o.connect(g);
      o.start(when);
      o.stop(when + dur + 0.15);
    }
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(lvl, when + attack);
    g.gain.setTargetAtTime(lvl * 0.6, when + attack + 0.015, 0.05 + attack);
    g.gain.setTargetAtTime(0, when + dur, 0.02);
    g.connect(dest);
  }

  private noiseHit(when: number, dur: number, vol: number, filterFreq: number, type: BiquadFilterType, dest: AudioNode, sweepTo = 0): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(filterFreq, when);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(when, Math.random() * 0.5);
    src.stop(when + dur + 0.05);
  }

  private drum(kind: string, when: number, vol: number, dest: AudioNode = this.music): void {
    const ctx = this.ctx!;
    if (kind === 'K') {
      // A pitch-swept sine body with a short click; it also drives the sidechain pump.
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      g.gain.setValueAtTime(vol * 1.6, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
      o.connect(g).connect(dest);
      o.start(when); o.stop(when + 0.26);
      this.noiseHit(when, 0.012, vol * 0.35, 3500, 'highpass', dest);
      this.pump(when);
    } else if (kind === 'S') {
      this.noiseHit(when, 0.16, vol * 0.9, 1900, 'bandpass', dest);
      this.noiseHit(when, 0.09, vol * 0.45, 6000, 'highpass', dest);
      this.tone('triangle', 210, when, 0.06, vol * 0.55, dest, 0, 140);
    } else if (kind === 'r') {
      this.noiseHit(when, 0.06, vol * 0.55, 2200, 'bandpass', dest);
    } else if (kind === 'H') {
      this.noiseHit(when, 0.035, vol * 0.45, 8000, 'highpass', dest);
    } else if (kind === 'O') {
      this.noiseHit(when, 0.2, vol * 0.35, 7500, 'highpass', dest);
    } else if (kind === 'C') {
      this.noiseHit(when, 1.1, vol * 0.5, 5000, 'highpass', dest);
    }
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.vol.muted || this.vol.sfx <= 0) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfx;
    const seq = (notes: string[], gap: number, wave = 'pulse25', vol = 0.25, dur = gap * 0.9) =>
      notes.forEach((n, i) => this.tone(wave, freq(n), t + i * gap, dur, vol, out));
    switch (name) {
      case 'click': {
        const f = 700 + Math.random() * 300;
        this.tone('pulse12', f, t, 0.04, 0.12, out, 0, f * 1.6);
        this.noiseHit(t, 0.05, 0.08, 4000, 'highpass', out);
        break;
      }
      case 'tick': this.tone('pulse12', 1400, t, 0.02, 0.05, out); break;
      case 'buy': seq(['C5', 'G5'], 0.06, 'pulse25', 0.2); this.noiseHit(t + 0.08, 0.12, 0.08, 5000, 'highpass', out); break;
      case 'upgrade': seq(['C5', 'E5', 'G5', 'C6'], 0.05, 'pulse25', 0.18); break;
      case 'research': seq(['A4', 'E5', 'A5', 'C#6', 'E6'], 0.06, 'triangle', 0.3); break;
      case 'golden': seq(['E6', 'B6', 'E7'], 0.07, 'pulse12', 0.1, 0.2); break;
      case 'goldenOpen': seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.04, 'pulse25', 0.2, 0.15); this.noiseHit(t, 0.4, 0.1, 6000, 'highpass', out); break;
      case 'achievement': seq(['G5', 'C6', 'E6', 'G6'], 0.08, 'pulse50', 0.15, 0.2); this.tone('triangle', freq('C4'), t + 0.24, 0.5, 0.3, out); break;
      case 'rank': seq(['C5', 'C5', 'C5', 'G5', 'E5', 'G5', 'C6'], 0.09, 'pulse50', 0.15, 0.12); break;
      case 'prestige': seq(['C4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.09, 'pulse25', 0.2, 0.4); this.drum('C', t, 0.5, out); break;
      case 'audit':
        for (let i = 0; i < 4; i++) this.tone('pulse50', 660, t + i * 0.3, 0.15, 0.15, out, 0, 880);
        break;
      case 'error': this.tone('pulse50', 110, t, 0.12, 0.2, out, 0, 80); break;
      case 'jet': this.noiseHit(t, 1.1, 0.25, 600, 'bandpass', out, 3500); break;
      case 'boom':
        this.noiseHit(t, 0.5, 0.35, 900, 'lowpass', out, 80);
        this.tone('triangle', 90, t, 0.2, 0.35, out, 0, 40);
        break;
      case 'explosion':
        this.noiseHit(t, 1.4, 0.55, 1400, 'lowpass', out, 60);
        this.tone('triangle', 110, t, 0.5, 0.5, out, 0, 30);
        this.tone('sawtooth', 70, t, 0.3, 0.15, out, 0, 25);
        break;
      case 'boomFar': this.noiseHit(t, 0.9, 0.18, 400, 'lowpass', out, 50); break;
      case 'deploy':
        // Brass stinger over a timpani hit.
        this.tone('triangle', 55, t, 0.9, 0.5, out, 0, 40);
        this.noiseHit(t, 0.8, 0.3, 700, 'lowpass', out, 80);
        ['C4+G4+C5', 'D#4+A#4+D#5', 'F4+C5+F5'].forEach((ch, i) => ch.split('+').forEach(n => this.tone('pulse50', freq(n), t + 0.15 + i * 0.22, i === 2 ? 0.9 : 0.18, 0.12, out, i === 2 ? 1.5 : 0)));
        break;
      case 'drumroll':
        for (let i = 0; i < 24; i++) this.noiseHit(t + i * 0.07, 0.07, 0.08 + i * 0.008, 2000, 'bandpass', out);
        break;
      case 'combo': seq(['E5', 'G5', 'B5', 'E6'], 0.04, 'pulse12', 0.16, 0.1); break;
      case 'horn': this.tone('pulse50', freq('A2'), t, 0.6, 0.2, out, 1); this.tone('pulse50', freq('E3'), t, 0.6, 0.12, out, 1); break;
      // ---------- Cinematic effects ----------
      case 'blip': this.tone('pulse25', 880 + Math.random() * 60, t, 0.025, 0.06, out); break;
      case 'blipLow': this.tone('pulse50', 330 + Math.random() * 30, t, 0.03, 0.07, out); break;
      case 'whoosh': this.noiseHit(t, 0.45, 0.22, 400, 'bandpass', out, 4000); break;
      case 'heart':
        this.tone('triangle', 60, t, 0.12, 0.5, out, 0, 35);
        this.tone('triangle', 55, t + 0.22, 0.14, 0.4, out, 0, 32);
        break;
      case 'riser': this.noiseHit(t, 2.6, 0.18, 200, 'bandpass', out, 6000); this.tone('sawtooth', 60, t, 2.6, 0.06, out, 0, 480); break;
      case 'impact':
        this.noiseHit(t, 2.2, 0.7, 2400, 'lowpass', out, 40);
        this.tone('triangle', 80, t, 1.4, 0.6, out, 0, 22);
        this.tone('sawtooth', 45, t, 0.9, 0.2, out, 0, 20);
        this.noiseHit(t, 0.3, 0.3, 6000, 'highpass', out);
        break;
      case 'shimmer': seq(['C6', 'G6', 'E6', 'C7', 'G6', 'E7'], 0.05, 'pulse12', 0.07, 0.3); break;
      case 'sting':
        // Studio ident: a brass fanfare over a timpani roll.
        for (let i = 0; i < 10; i++) this.noiseHit(t + i * 0.05, 0.06, 0.05 + i * 0.01, 300, 'lowpass', out);
        [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['C5', 'E5', 'G5', 'C6']].forEach((ch, i) =>
          ch.forEach(n => this.tone('pulse50', freq(n), t + 0.5 + i * 0.28, i === 3 ? 1.6 : 0.24, 0.07, out, i === 3 ? 2 : 0)));
        this.tone('triangle', 65, t + 1.34, 1.2, 0.4, out, 0, 50);
        break;
      case 'alarm': for (let i = 0; i < 3; i++) this.tone('sawtooth', 520, t + i * 0.5, 0.35, 0.07, out, 0, 760); break;
      case 'thud': this.tone('triangle', 120, t, 0.12, 0.4, out, 0, 50); this.noiseHit(t, 0.12, 0.2, 800, 'lowpass', out); break;
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
  }
}

export const audio = new AudioEngine();
