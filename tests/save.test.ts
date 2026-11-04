import { beforeEach, describe, expect, it } from 'vitest';
import { newState } from '../src/core/state';
import { BACKUP_KEY, CORRUPT_KEY, decode, encode, loadLocal, migrate, SAVE_KEY, saveLocal } from '../src/core/save';

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

describe('local storage', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
  });
  it('falls back to the last good backup when the main slot is corrupt', () => {
    const s = newState(1); s.budget = 777;
    saveLocal(s);
    expect(loadLocal()?.budget).toBe(777);
    store.set(SAVE_KEY, 'ODF1.@@corrupt@@');
    expect(loadLocal()?.budget).toBe(777);
    expect(store.get(CORRUPT_KEY)).toBe('ODF1.@@corrupt@@');
    expect(store.has(BACKUP_KEY)).toBe(true);
  });
});
