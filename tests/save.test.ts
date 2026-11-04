import { describe, expect, it } from 'vitest';
import { newState } from '../src/core/state';
import { decode, encode, migrate } from '../src/core/save';

describe('save', () => {
  it('round-trips through the export string', () => {
    const s = newState(123);
    s.budget = 4.2e30; s.owned.f35 = 12; s.achievements.push('a'); s.settings.music = 0.1;
    expect(decode(encode(s))).toEqual(s);
  });
  it('fills fields missing from older saves', () => {
    const s = migrate({ budget: 5, owned: { recruit: 3 } } as never);
    expect(s.owned.recruit).toBe(3);
    expect(s.stats.briefcases).toBe(0);
    expect(s.settings.sfx).toBeGreaterThan(0);
    expect(s.branchXp.space).toBe(0);
  });
  it('rejects garbage', () => {
    expect(() => decode('not a save')).toThrow();
    expect(() => migrate({} as never)).toThrow();
  });
});
