import { describe, expect, it } from 'vitest';
import { newState } from '../src/core/state';
import * as E from '../src/core/economy';
import { PRESTIGE_DIV } from '../src/data/meta';

describe('prestige', () => {
  it('capital follows a cube-root curve', () => {
    expect(E.capitalFor(PRESTIGE_DIV * 8)).toBe(2);
    expect(E.capitalFor(PRESTIGE_DIV * 1000)).toBe(10);
  });
  it('resets the run but keeps meta progress', () => {
    const s = newState(0);
    s.lifetime = PRESTIGE_DIV * 125;
    s.owned.recruit = 50; s.upgrades.push('recruit_0'); s.research.push('st1');
    s.achievements.push('spent_0');
    const gain = E.prestige(s);
    expect(gain).toBe(5);
    expect(s.capital).toBe(5);
    expect(s.owned).toEqual({});
    expect(s.upgrades).toEqual([]);
    expect(s.research).toEqual([]);
    expect(s.achievements).toEqual(['spent_0']);
    expect(E.pendingCapital(s)).toBe(0);
  });
  it('mandate grows with the square root of capital', () => {
    expect(E.mandate(0)).toBe(1);
    expect(E.mandate(100)).toBeCloseTo(2);
  });
  it('executive orders cost capital and apply on reset', () => {
    const s = newState(0);
    s.capital = 10;
    expect(E.buyOrder(s, 'eo_start')).toBe(true);
    expect(E.buyOrder(s, 'eo_omnibus')).toBe(true);
    expect(s.capital).toBe(1);
    E.prestige(s);
    expect(s.budget).toBe(15 + 5e4);
    expect(s.owned.recruit).toBe(10);
  });
});
