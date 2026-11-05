import { describe, expect, it } from 'vitest';
import { newState } from '../src/core/state';
import * as E from '../src/core/economy';
import { PRESTIGE_DIV } from '../src/data/meta';

describe('prestige', () => {
  it('capital is the square of the spending magnitude past $100 million', () => {
    expect(E.capitalFor(PRESTIGE_DIV / 10)).toBe(0);
    expect(E.capitalFor(1e9)).toBe(1);
    expect(E.capitalFor(1e12)).toBe(16);
    expect(E.capitalFor(1e28)).toBe(400);
  });
  it('next capital threshold is consistent with the curve', () => {
    const s = newState(0);
    s.lifetime = 1e12;
    const next = E.nextCapitalAt(s);
    expect(E.capitalFor(next * 1.0001)).toBe(17);
    expect(E.capitalFor(next * 0.999)).toBe(16);
  });
  it('resets the run but keeps meta progress', () => {
    const s = newState(0);
    s.lifetime = 1e12;
    s.owned.recruit = 50; s.upgrades.push('recruit_0'); s.research.push('st1'); s.finale = 2;
    s.achievements.push('spent_0');
    const gain = E.prestige(s);
    expect(gain).toBe(16);
    expect(s.capital).toBe(16);
    expect(s.owned).toEqual({});
    expect(s.upgrades).toEqual([]);
    expect(s.research).toEqual([]);
    expect(s.finale).toBe(0);
    expect(s.achievements).toEqual(['spent_0']);
    expect(E.pendingCapital(s)).toBe(0);
  });
  it('mandate grows with the square root of capital', () => {
    expect(E.mandate(0)).toBe(1);
    expect(E.mandate(100)).toBeCloseTo(2);
  });
  it('executive orders cost capital and apply on reset', () => {
    const s = newState(0);
    s.capital = 30;
    expect(E.buyOrder(s, 'eo_start')).toBe(true);
    expect(E.buyOrder(s, 'eo_omnibus')).toBe(true);
    expect(s.capital).toBe(21);
    E.prestige(s);
    expect(s.budget).toBe(15 + 5e4);
    expect(s.owned.recruit).toBe(10);
  });
});
