import { newSettings, newState, newStats, SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'operation-debt-fury-save';

export function encode(s: GameState): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'ODF1.' + btoa(bin);
}

/** Decodes a save string, filling any fields missing from older versions with defaults. */
export function decode(str: string): GameState {
  const body = str.trim().replace(/^ODF\d+\./, '');
  const bin = atob(body);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const raw = JSON.parse(new TextDecoder().decode(bytes));
  return migrate(raw);
}

export function migrate(raw: Partial<GameState>): GameState {
  if (typeof raw !== 'object' || raw === null || typeof raw.budget !== 'number') throw new Error('Not a valid save.');
  const base = newState(raw.created ?? Date.now());
  const s: GameState = { ...base, ...raw } as GameState;
  s.stats = { ...newStats(), ...(raw.stats ?? {}) };
  s.settings = { ...newSettings(), ...(raw.settings ?? {}) };
  s.branchXp = { ...base.branchXp, ...(raw.branchXp ?? {}) };
  for (const k of ['budget', 'spent', 'lifetime', 'capital', 'capitalEarned'] as const) {
    if (!Number.isFinite(s[k])) s[k] = base[k];
  }
  s.v = SAVE_VERSION;
  return s;
}

export function saveLocal(s: GameState): void {
  s.lastSaved = Date.now();
  try { localStorage.setItem(SAVE_KEY, encode(s)); } catch { /* storage unavailable */ }
}

export function loadLocal(): GameState | null {
  try {
    const str = localStorage.getItem(SAVE_KEY);
    return str ? decode(str) : null;
  } catch {
    return null;
  }
}

export function wipeLocal(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
