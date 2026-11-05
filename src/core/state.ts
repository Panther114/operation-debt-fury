import type { BranchId, Domain } from '../data/assets';

export interface Buff {
  id: string;
  label: string;
  /** Game time (seconds) at which the buff expires. */
  until: number;
  duration: number;
  rate?: number;
  click?: number;
  cost?: number;
  domain?: Domain;
  tags?: string[];
  good: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  labels: boolean;
  bulk: number;
  shortNumbers: boolean;
  reducedMotion: boolean;
}

export interface Stats {
  briefcases: number;
  toilets: number;
  audits: number;
  auditsFailed: number;
  contracts: number;
  underBudget: number;
  tickerClicks: number;
  bestRate: number;
  wargames: number;
  muteToggles: number;
  posts: number;
  potusClicks: number;
  geoOps: number;
  /** Assets bought (cumulative across administrations). */
  bought: number;
}

/** Snapshot taken when the final phase of Big Bang 2 is funded. The game cannot continue after it. */
export interface EndRecord {
  /** Total play time in seconds at the end. */
  time: number;
  at: number;
  lifetime: number;
  clicks: number;
  prestiges: number;
  achievements: number;
  research: number;
  bestRate: number;
}

export interface GameState {
  v: number;
  created: number;
  lastSaved: number;
  /** Total play time in seconds across all administrations. */
  time: number;
  /** Play time in the current administration. */
  runTime: number;
  budget: number;
  /** Dollars spent in the current administration. */
  spent: number;
  /** Dollars spent across all administrations. */
  lifetime: number;
  clicks: number;
  clickSpent: number;
  owned: Record<string, number>;
  upgrades: string[];
  research: string[];
  orders: string[];
  /** Completed world operations (reset each administration). */
  geo: string[];
  lobby: Record<string, number>;
  contractReadyAt: Record<string, number>;
  branchXp: Record<BranchId, number>;
  achievements: string[];
  capital: number;
  capitalEarned: number;
  prestiges: number;
  buffs: Buff[];
  stats: Stats;
  settings: Settings;
  nextBriefcaseAt: number;
  nextAuditAt: number;
  nextWargameAt: number;
  nextPostAt: number;
  /** Phases of Big Bang 2 funded this administration (0-5). */
  finale: number;
  /** Game time at which the current finale phase finishes construction. */
  finaleReadyAt: number;
  /** Set when the game has been completed. */
  ended: EndRecord | null;
}

export const SAVE_VERSION = 1;

export function newStats(): Stats {
  return { briefcases: 0, toilets: 0, audits: 0, auditsFailed: 0, contracts: 0, underBudget: 0, tickerClicks: 0, bestRate: 0, wargames: 0, muteToggles: 0, posts: 0, potusClicks: 0, geoOps: 0, bought: 0 };
}

export function newSettings(): Settings {
  return { music: 0.5, sfx: 0.7, muted: false, labels: false, bulk: 1, shortNumbers: false, reducedMotion: false };
}

export function newState(now = Date.now()): GameState {
  return {
    v: SAVE_VERSION,
    created: now,
    lastSaved: now,
    time: 0,
    runTime: 0,
    budget: 15,
    spent: 0,
    lifetime: 0,
    clicks: 0,
    clickSpent: 0,
    owned: {},
    upgrades: [],
    research: [],
    orders: [],
    geo: [],
    lobby: {},
    contractReadyAt: {},
    branchXp: { army: 0, navy: 0, af: 0, marines: 0, space: 0 },
    achievements: [],
    capital: 0,
    capitalEarned: 0,
    prestiges: 0,
    buffs: [],
    stats: newStats(),
    settings: newSettings(),
    nextBriefcaseAt: 90,
    nextAuditAt: 420,
    nextWargameAt: 300,
    nextPostAt: 150,
    finale: 0,
    finaleReadyAt: 0,
    ended: null,
  };
}
