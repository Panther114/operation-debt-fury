import { beforeEach, describe, expect, it } from 'vitest';
import { ASSETS, ASSET_BY_ID } from '../src/data/assets';
import { UPGRADE_BY_ID } from '../src/data/upgrades';
import { RESEARCH_BY_ID } from '../src/data/research';
import { newState, type GameState } from '../src/core/state';
import * as E from '../src/core/economy';

let s: GameState;
beforeEach(() => { s = newState(0); E.invalidate(); });

describe('asset costs', () => {
  it('grow by 15% per unit owned', () => {
    const a = ASSET_BY_ID.recruit;
    expect(E.assetCost(s, a)).toBeCloseTo(15);
    s.owned.recruit = 1; E.invalidate();
    expect(E.assetCost(s, a)).toBeCloseTo(15 * 1.15);
  });
  it('bulk cost equals the sum of single costs', () => {
    const a = ASSET_BY_ID.humvee;
    s.owned.humvee = 7;
    let sum = 0;
    for (let i = 0; i < 10; i++) { sum += E.assetCost(s, a); s.owned.humvee++; }
    s.owned.humvee = 7;
    expect(E.assetCost(s, a, 10)).toBeCloseTo(sum, 6);
  });
  it('max affordable never exceeds the budget', () => {
    const a = ASSET_BY_ID.recruit;
    s.budget = 12_345;
    const n = E.maxAffordable(s, a);
    expect(E.assetCost(s, a, n)).toBeLessThanOrEqual(s.budget);
    expect(E.assetCost(s, a, n + 1)).toBeGreaterThan(s.budget);
  });
  it('tiers are strictly increasing in cost and rate', () => {
    for (let i = 1; i < ASSETS.length; i++) {
      expect(ASSETS[i].baseCost).toBeGreaterThan(ASSETS[i - 1].baseCost);
      expect(ASSETS[i].baseRate).toBeGreaterThan(ASSETS[i - 1].baseRate);
    }
  });
});

describe('spending', () => {
  it('buying counts as spending and costs budget', () => {
    s.budget = 100;
    expect(E.buyAsset(s, ASSET_BY_ID.recruit, 1)).toBe(true);
    expect(s.budget).toBeCloseTo(85);
    expect(s.spent).toBeCloseTo(15);
    expect(s.branchXp.army).toBeCloseTo(15);
  });
  it('refuses purchases it cannot afford', () => {
    s.budget = 1;
    expect(E.buyAsset(s, ASSET_BY_ID.recruit, 1)).toBe(false);
    expect(s.owned.recruit).toBeUndefined();
  });
  it('clicks add to budget and spent', () => {
    const p = E.click(s);
    expect(p).toBe(1);
    expect(s.budget).toBe(16);
    expect(s.spent).toBe(1);
  });
  it('ticks burn money at the production rate', () => {
    s.owned.recruit = 10; E.invalidate();
    const rate = E.mods(s).rate;
    E.tick(s, 2);
    expect(s.spent).toBeCloseTo(rate * 2);
  });
  it('locked assets cannot be bought until researched', () => {
    s.budget = 1e60;
    const f47 = ASSET_BY_ID.f47;
    expect(E.buyAsset(s, f47, 1)).toBe(false);
    s.research.push(f47.requires!); E.invalidate();
    expect(E.buyAsset(s, f47, 1)).toBe(true);
  });
});

describe('multipliers', () => {
  it('asset upgrades double output', () => {
    s.owned.recruit = 1; E.invalidate();
    const before = E.mods(s).rate;
    s.upgrades.push('recruit_0'); E.invalidate();
    expect(E.mods(s).rate).toBeCloseTo(before * 2);
  });
  it('synergies scale with the source count', () => {
    s.owned.f16 = 1; s.owned.kc46 = 10; E.invalidate();
    const i = ASSETS.findIndex(a => a.id === 'f16');
    const before = E.mods(s).rates[i];
    s.upgrades.push('syn_tanker'); E.invalidate();
    expect(E.mods(s).rates[i]).toBeCloseTo(before * 1.2);
  });
  it('research prerequisites are enforced', () => {
    expect(E.canResearch(s, RESEARCH_BY_ID.st2)).toBe(false);
    s.research.push('st1');
    expect(E.canResearch(s, RESEARCH_BY_ID.st2)).toBe(true);
  });
  it('variants follow tier upgrades', () => {
    expect(E.assetVariant(s, 'f16')).toBe(0);
    s.upgrades.push('f16_1');
    expect(E.assetVariant(s, 'f16')).toBe(1);
    s.upgrades.push('f16_5');
    expect(E.assetVariant(s, 'f16')).toBe(3);
    expect(UPGRADE_BY_ID.f16_5.name).toContain('Gold-Plated');
  });
});
