import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/audio/tracks';
import { freq } from '../src/audio/audio';

describe('tracks', () => {
  for (const tr of Object.values(TRACKS)) {
    it(`${tr.id}: every channel fills its bars exactly and every note is valid`, () => {
      tr.channels.forEach(ch => {
        expect(ch.notes.length * ch.every).toBe(tr.bars * 16);
        expect(ch.notes[0]).not.toBe('-');
        for (const ev of ch.notes) {
          if (ev === '.' || ev === '-' || ch.wave === 'drum') continue;
          for (const n of ev.split('+')) expect(freq(n), `${tr.id} ${n}`).toBeGreaterThan(0);
        }
      });
    });
  }
});
