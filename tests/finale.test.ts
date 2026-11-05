import { beforeEach, describe, expect, it } from 'vitest';
import { newState, type GameState } from '../src/core/state';
import * as E from '../src/core/economy';
import { BUILD, FINALE } from '../src/data/finale';

let s: GameState;
beforeEach(() => { s = newState(0); E.invalidate(); });

describe('temporary buffs', () => {
  it('stacked rate buffs are capped per asset', () => {
    s.owned.recruit = 10; E.invalidate();
    const base = E.mods(s).rate;
    s.buffs.push({ id: 'a', label: 'a', until: 99, duration: 99, rate: 7, good: true }, { id: 'b', label: 'b', until: 99, duration: 99, rate: 7, good: true });
    E.invalidate();
    expect(E.mods(s).rate).toBeCloseTo(base * E.BUFF_CAP);
    expect(E.mods(s).steadyRate).toBeCloseTo(base);
  });
  it('interns receive only part of the % of $/s click bonus', () => {
    s.owned.recruit = 100; s.upgrades.push('click_2'); E.invalidate();
    const m = E.mods(s);
    expect(m.autoPower - m.clickMult).toBeCloseTo((m.clickPower - m.clickMult) * E.INTERN_RATE_SHARE);
  });
});

describe('Big Bang 2', () => {
  it('is locked until a Dyson Sphere is owned', () => {
    s.budget = 1e300;
    expect(E.buyFinale(s)).toBeNull();
    s.owned.dyson = 1; E.invalidate();
    expect(E.buyFinale(s)?.id).toBe('bb1');
  });
  it('enforces construction time between phases and ends the game on the last phase', () => {
    s.owned.dyson = 1; s.budget = 1e300; s.time = 1000; E.invalidate();
    for (let i = 0; i < FINALE.length; i++) {
      expect(E.buyFinale(s)).not.toBeNull();
      if (i < FINALE.length - 1) {
        expect(E.buyFinale(s)).toBeNull();
        s.time += BUILD[i];
      }
    }
    expect(s.finale).toBe(FINALE.length);
    expect(s.ended?.time).toBe(s.time);
    expect(E.buyFinale(s)).toBeNull();
    const spent = s.lifetime;
    E.tick(s, 10);
    expect(s.lifetime).toBe(spent);
  });
  it('prices phases in seconds of steady spending', () => {
    s.owned.dyson = 50; E.invalidate();
    const m = E.mods(s);
    expect(E.finaleCost(s, FINALE[0])).toBeCloseTo(Math.max(FINALE[0].floor, FINALE[0].seconds * m.steadyRate));
  });
});
