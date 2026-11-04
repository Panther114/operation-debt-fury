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

/** Copy of the last save that decoded successfully, used if the main slot is ever unreadable. */
export const BACKUP_KEY = SAVE_KEY + '-backup';
/** Raw contents of a main slot that failed to decode, kept so it is never silently overwritten. */
export const CORRUPT_KEY = SAVE_KEY + '-corrupt';

/** Writes the save. Returns false if storage is unavailable or full. */
export function saveLocal(s: GameState): boolean {
  s.lastSaved = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, encode(s));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the save. If the main slot cannot be decoded, its raw contents are preserved under
 * CORRUPT_KEY and the last known-good backup is used instead. A successful load refreshes the backup.
 */
export function loadLocal(): GameState | null {
  let main: string | null = null;
  try { main = localStorage.getItem(SAVE_KEY); } catch { return null; }
  if (main) {
    try {
      const s = decode(main);
      try { localStorage.setItem(BACKUP_KEY, main); } catch { /* storage full */ }
      return s;
    } catch {
      try { localStorage.setItem(CORRUPT_KEY, main); } catch { /* storage full */ }
    }
  }
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    return backup ? decode(backup) : null;
  } catch {
    return null;
  }
}

export function wipeLocal(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch { /* storage unavailable */ }
}
