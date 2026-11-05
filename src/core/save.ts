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
  if (typeof s.finale !== 'number' || !Number.isFinite(s.finale)) s.finale = 0;
  if (!Number.isFinite(s.finaleReadyAt)) s.finaleReadyAt = 0;
  if (!s.ended || typeof s.ended !== 'object' || !Number.isFinite(s.ended.time)) s.ended = null;
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

/**
 * Progress epoch. Raising it resets every player's progress once on their next visit: saves written
 * under an older epoch (or before epochs existed) are discarded. The Hall of Fame is kept.
 */
export const EPOCH_KEY = SAVE_KEY + '-epoch';
export const RESET_EPOCH = 2;

/** Discards saves from an older progress epoch. Returns true if a reset happened. */
export function applyResetEpoch(): boolean {
  try {
    if (localStorage.getItem(EPOCH_KEY) === String(RESET_EPOCH)) return false;
    const had = localStorage.getItem(SAVE_KEY) !== null || localStorage.getItem(BACKUP_KEY) !== null;
    for (const k of [SAVE_KEY, BACKUP_KEY, CORRUPT_KEY]) localStorage.removeItem(k);
    localStorage.setItem(EPOCH_KEY, String(RESET_EPOCH));
    return had;
  } catch {
    return false;
  }
}

/** Writes the save. Returns false if storage is unavailable or full. */
export function saveLocal(s: GameState): boolean {
  s.lastSaved = Date.now();
  try {
    localStorage.setItem(EPOCH_KEY, String(RESET_EPOCH));
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
  applyResetEpoch();
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

// ---------- Hall of Fame ----------

/** Best completion records. Kept in their own key so that a restart or a wipe never erases them. */
export const HOF_KEY = SAVE_KEY + '-hall-of-fame';

export interface HofEntry { time: number; at: number; lifetime: number; clicks: number; prestiges: number; grade: string }

export function loadHallOfFame(): HofEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HOF_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(e => e && Number.isFinite(e.time)) : [];
  } catch {
    return [];
  }
}

/** Adds a completion (once per completion timestamp) and returns the list sorted by time, best first. */
export function recordHallOfFame(e: HofEntry): HofEntry[] {
  const list = loadHallOfFame();
  if (!list.some(x => x.at === e.at)) list.push(e);
  list.sort((a, b) => a.time - b.time);
  try { localStorage.setItem(HOF_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* storage unavailable */ }
  return list;
}
