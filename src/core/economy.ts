import { GEO_BY_ID, type GeoOp } from '../data/politics';
import { BUILD, FINALE, type FinalePhase } from '../data/finale';
import { ASSETS, ASSET_BY_ID, type AssetDef } from '../data/assets';
import { UPGRADE_BY_ID, type Effect, type Unlock, type UpgradeDef, UPGRADES } from '../data/upgrades';
import { RESEARCH_BY_ID, type ResearchDef } from '../data/research';
import { BRANCHES, BRANCH_BONUS_PER_LEVEL, CONTRACTORS, LOBBY_BONUS, LOBBY_GROWTH, MANDATE_PER_CAPITAL, ORDERS, PRESTIGE_DIV, branchLevel, type ContractorDef } from '../data/meta';
import type { GameState } from './state';

export const COST_GROWTH = 1.15;
export const ACHIEVEMENT_BONUS = 0.01;
/** Share of the "% of $/s" click bonus that intern (automatic) clicks receive. */
export const INTERN_RATE_SHARE = 0.25;
/** Maximum combined multiplier from temporary rate buffs on any one asset. */
export const BUFF_CAP = 10;

export interface Mods {
  /** Per-asset multiplier, aligned with ASSETS, including global multipliers and active buffs. */
  asset: number[];
  global: number;
  clickMult: number;
  clickRatePct: number;
  autoClick: number;
  eventFreq: number;
  eventDur: number;
  costMult: number;
  researchCost: number;
  lobbyCost: number;
  branchBonus: number;
  auditImmune: boolean;
  startBudget: number;
  startAssets: { count: number; tiers: number } | null;
  /** Per-asset $/s with everything applied. */
  rates: number[];
  rate: number;
  clickPower: number;
  /** Value of one automatic (intern) click. */
  autoPower: number;
  /** $/s with temporary buffs excluded. */
  steadyRate: number;
}

const ORDER_BY_ID = Object.fromEntries(ORDERS.map(o => [o.id, o]));

let cacheKey = -1;
let cache: Mods | null = null;
let generation = 0;

/** Marks derived values stale. Call after any state change that affects production. */
export function invalidate(): void {
  generation++;
}

const targetCache = new WeakMap<Effect, number[]>();
/** Indices of the assets an effect applies to, cached per effect object. */
function targets(e: Effect, pred: (a: AssetDef) => boolean): number[] {
  let t = targetCache.get(e);
  if (!t) { t = ASSETS.flatMap((a, i) => (pred(a) ? [i] : [])); targetCache.set(e, t); }
  return t;
}

function activeEffects(s: GameState): Effect[] {
  const out: Effect[] = [];
  for (const id of s.upgrades) out.push(...(UPGRADE_BY_ID[id]?.effects ?? []));
  for (const id of s.research) out.push(...(RESEARCH_BY_ID[id]?.effects ?? []));
  for (const id of s.orders) out.push(...(ORDER_BY_ID[id]?.effects ?? []));
  for (const id of s.geo) out.push(...(GEO_BY_ID[id]?.effects ?? []));
  for (let i = 0; i < s.finale; i++) out.push(...(FINALE[i]?.effects ?? []));
  return out;
}

export function mods(s: GameState): Mods {
  if (cache && cacheKey === generation) return cache;
  const n = ASSETS.length;
  const mult = new Array<number>(n).fill(1);
  const synergy = new Array<number>(n).fill(0);
  const m: Mods = {
    asset: mult, global: 1, clickMult: 1, clickRatePct: 0, autoClick: 0, eventFreq: 1, eventDur: 1,
    costMult: 1, researchCost: 1, lobbyCost: 1, branchBonus: 1, auditImmune: false, startBudget: 0, startAssets: null,
    rates: new Array<number>(n).fill(0), rate: 0, clickPower: 1, autoPower: 1, steadyRate: 0,
  };
  const totalOwned = ASSETS.reduce((t, a) => t + (s.owned[a.id] ?? 0), 0);
  const applyTo = (pred: (a: AssetDef) => boolean, k: number) => ASSETS.forEach((a, i) => { if (pred(a)) mult[i] *= k; });
  const applyIdx = (e: Effect, pred: (a: AssetDef) => boolean, k: number) => { for (const i of targets(e, pred)) mult[i] *= k; };

  for (const e of activeEffects(s)) {
    switch (e.type) {
      case 'assetMult': applyIdx(e, a => a.id === e.asset, e.mult); break;
      case 'tagMult': applyIdx(e, a => a.tags.includes(e.tag), e.mult); break;
      case 'domainMult': applyIdx(e, a => a.domain === e.domain, e.mult); break;
      case 'branchMult': applyIdx(e, a => a.branch === e.branch, e.mult); break;
      case 'globalMult': m.global *= e.mult; break;
      case 'clickMult': m.clickMult *= e.mult; break;
      case 'clickRate': m.clickRatePct += e.pct; break;
      case 'autoClick': m.autoClick += e.perSec; break;
      case 'synergy': {
        const count = e.source === '*' ? totalOwned : s.owned[e.source] ?? 0;
        ASSETS.forEach((a, i) => { if (e.tag === '*' || a.tags.includes(e.tag)) synergy[i] += (e.pct / 100) * count; });
        break;
      }
      case 'eventFreq': m.eventFreq *= e.mult; break;
      case 'eventDur': m.eventDur *= e.mult; break;
      case 'costMult': m.costMult *= e.mult; break;
      case 'researchCost': m.researchCost *= e.mult; break;
      case 'lobbyCost': m.lobbyCost *= e.mult; break;
      case 'branchBonus': m.branchBonus *= e.mult; break;
      case 'auditImmunity': m.auditImmune = true; break;
      case 'startBudget': m.startBudget += e.amount; break;
      case 'startAssets': m.startAssets = { count: e.count, tiers: e.tiers }; break;
      case 'unlock': break;
    }
  }
  ASSETS.forEach((_, i) => { mult[i] *= 1 + synergy[i]; });

  // Contractor lobbying levels.
  for (const c of CONTRACTORS) {
    const lvl = s.lobby[c.id] ?? 0;
    if (lvl) applyTo(a => a.tags.some(t => c.tags.includes(t)), 1 + LOBBY_BONUS * lvl);
  }
  // Branch levels.
  for (const b of BRANCHES) {
    const lvl = branchLevel(s.branchXp[b.id] ?? 0);
    if (lvl) applyTo(a => a.branch === b.id, 1 + BRANCH_BONUS_PER_LEVEL * lvl * m.branchBonus);
  }
  // Achievements (morale) and political capital (mandate).
  m.global *= 1 + ACHIEVEMENT_BONUS * s.achievements.length;
  m.global *= mandate(s.capitalEarned);

  // Temporary buffs. Rate buffs stack multiplicatively but are capped per asset, so that
  // overlapping frenzies, contracts and war games cannot compound into a runaway spike.
  const buffMult = new Array<number>(n).fill(1);
  for (const b of s.buffs) {
    if (b.cost) m.costMult *= b.cost;
    if (b.click) m.clickMult *= b.click;
    if (!b.rate) continue;
    ASSETS.forEach((a, i) => {
      if ((!b.domain || a.domain === b.domain) && (!b.tags || a.tags.some(t => b.tags!.includes(t)))) buffMult[i] *= b.rate!;
    });
  }

  ASSETS.forEach((a, i) => {
    mult[i] *= m.global;
    m.steadyRate += a.baseRate * (s.owned[a.id] ?? 0) * mult[i];
    mult[i] *= Math.min(BUFF_CAP, buffMult[i]);
    m.rates[i] = a.baseRate * (s.owned[a.id] ?? 0) * mult[i];
    m.rate += m.rates[i];
  });
  m.clickPower = m.clickMult + (m.rate * m.clickRatePct) / 100;
  m.autoPower = m.clickMult + (m.rate * m.clickRatePct * INTERN_RATE_SHARE) / 100;
  cache = m;
  cacheKey = generation;
  return m;
}

// ---------- Costs and purchases ----------

export function assetCost(s: GameState, a: AssetDef, count = 1): number {
  const o = s.owned[a.id] ?? 0;
  const first = a.baseCost * mods(s).costMult * COST_GROWTH ** o;
  return (first * (COST_GROWTH ** count - 1)) / (COST_GROWTH - 1);
}

export function maxAffordable(s: GameState, a: AssetDef): number {
  const o = s.owned[a.id] ?? 0;
  const first = a.baseCost * mods(s).costMult * COST_GROWTH ** o;
  if (s.budget < first) return 0;
  return Math.floor(Math.log((s.budget * (COST_GROWTH - 1)) / first + 1) / Math.log(COST_GROWTH));
}

export function isAssetUnlocked(s: GameState, a: AssetDef): boolean {
  return !a.requires || s.research.includes(a.requires);
}

/** Assets are revealed once the previous tier is owned or the player can nearly afford them. */
export function isAssetVisible(s: GameState, a: AssetDef): boolean {
  if ((s.owned[a.id] ?? 0) > 0 || a.tier === 0) return true;
  const prev = ASSETS[a.tier - 1];
  return (s.owned[prev.id] ?? 0) > 0 || s.lifetime >= a.baseCost * 0.5;
}

/** Records spending: adds to score totals and to the spending branch's XP. Congress refunds burn spending into the budget. */
export function recordSpend(s: GameState, amount: number, branch?: keyof GameState['branchXp']): void {
  s.spent += amount;
  s.lifetime += amount;
  if (branch) s.branchXp[branch] += amount;
}

export function buyAsset(s: GameState, a: AssetDef, count: number): boolean {
  if (!isAssetUnlocked(s, a) || count <= 0) return false;
  const cost = assetCost(s, a, count);
  if (cost > s.budget) return false;
  s.budget -= cost;
  recordSpend(s, cost, a.branch);
  s.owned[a.id] = (s.owned[a.id] ?? 0) + count;
  s.stats.bought += count;
  invalidate();
  return true;
}

export function checkUnlock(s: GameState, u: Unlock): boolean {
  if ('owned' in u) return (s.owned[u.owned[0]] ?? 0) >= u.owned[1];
  if ('spent' in u) return s.lifetime >= u.spent;
  if ('clicks' in u) return s.clicks >= u.clicks;
  return u.allOwned.every(id => (s.owned[id] ?? 0) > 0);
}

export function availableUpgrades(s: GameState): UpgradeDef[] {
  const have = new Set(s.upgrades);
  return UPGRADES.filter(u => !have.has(u.id) && checkUnlock(s, u.unlock)).sort((a, b) => a.cost - b.cost);
}

export function buyUpgrade(s: GameState, u: UpgradeDef): boolean {
  if (s.upgrades.includes(u.id) || u.cost > s.budget || !checkUnlock(s, u.unlock)) return false;
  s.budget -= u.cost;
  recordSpend(s, u.cost, u.asset ? ASSET_BY_ID[u.asset].branch : undefined);
  s.upgrades.push(u.id);
  invalidate();
  return true;
}

export function researchCost(s: GameState, r: ResearchDef): number {
  return r.cost * mods(s).researchCost;
}

export function canResearch(s: GameState, r: ResearchDef): boolean {
  return !s.research.includes(r.id) && r.requires.every(id => s.research.includes(id));
}

export function buyResearch(s: GameState, r: ResearchDef): boolean {
  const cost = researchCost(s, r);
  if (!canResearch(s, r) || cost > s.budget) return false;
  s.budget -= cost;
  recordSpend(s, cost);
  s.research.push(r.id);
  invalidate();
  return true;
}

export function lobbyCost(s: GameState, c: ContractorDef): number {
  return c.baseCost * LOBBY_GROWTH ** (s.lobby[c.id] ?? 0) * mods(s).lobbyCost;
}

export function buyLobby(s: GameState, c: ContractorDef): boolean {
  const cost = lobbyCost(s, c);
  if (cost > s.budget) return false;
  s.budget -= cost;
  recordSpend(s, cost);
  s.lobby[c.id] = (s.lobby[c.id] ?? 0) + 1;
  invalidate();
  return true;
}

/** Board variant (0-3) for an asset, from how many of its tier upgrades are owned. */
export function assetVariant(s: GameState, assetId: string): number {
  let lvl = -1;
  for (let i = 6; i >= 0; i--) if (s.upgrades.includes(`${assetId}_${i}`)) { lvl = i; break; }
  return lvl >= 5 ? 3 : lvl >= 3 ? 2 : lvl >= 1 ? 1 : 0;
}

// ---------- Clicking and ticking ----------

export function click(s: GameState): number {
  const p = mods(s).clickPower;
  s.clicks++;
  s.clickSpent += p;
  s.budget += p;
  recordSpend(s, p);
  return p;
}

/** Advances the simulation by dt seconds. Returns true if buffs expired (UI may need a refresh). */
export function tick(s: GameState, dt: number): boolean {
  if (s.ended) return false;
  s.time += dt;
  s.runTime += dt;
  let expired = false;
  if (s.buffs.some(b => b.until <= s.time)) {
    s.buffs = s.buffs.filter(b => b.until > s.time);
    expired = true;
    invalidate();
  }
  const m = mods(s);
  const auto = m.autoClick * dt * m.autoPower;
  if (auto) { s.clickSpent += auto; s.budget += auto; recordSpend(s, auto); }
  ASSETS.forEach((a, i) => {
    const amt = m.rates[i] * dt;
    if (!amt) return;
    s.budget += amt;
    recordSpend(s, amt, a.branch);
  });
  if (m.rate > s.stats.bestRate) s.stats.bestRate = m.rate;
  // Branch XP changes levels slowly; re-derive multipliers about once per second.
  if (Math.floor(s.time) !== Math.floor(s.time - dt)) invalidate();
  return expired;
}

// ---------- Prestige ----------

/** Global multiplier from political capital ever earned. */
export function mandate(capitalEarned: number): number {
  return 1 + MANDATE_PER_CAPITAL * Math.sqrt(capitalEarned);
}

/**
 * Political capital for a lifetime total: the square of the spending magnitude (orders of magnitude
 * past $100 million). Capital tracks progress through the tiers rather than the raw dollar figure,
 * which spans more than thirty orders of magnitude, so a New Administration is a steady step up
 * instead of a runaway.
 */
export function capitalFor(lifetime: number): number {
  if (lifetime < PRESTIGE_DIV) return 0;
  return Math.floor((Math.log10(lifetime) - 8) ** 2);
}

export function pendingCapital(s: GameState): number {
  return Math.max(0, capitalFor(s.lifetime) - s.capitalEarned);
}

/** Lifetime spending needed for the next point of political capital. */
export function nextCapitalAt(s: GameState): number {
  const target = Math.max(capitalFor(s.lifetime), s.capitalEarned) + 1;
  return Math.max(PRESTIGE_DIV, 10 ** (8 + Math.sqrt(target)));
}

export function prestige(s: GameState): number {
  const gain = pendingCapital(s);
  s.capitalEarned += gain;
  s.capital += gain;
  s.prestiges++;
  s.runTime = 0;
  s.spent = 0;
  s.owned = {};
  s.upgrades = [];
  s.research = [];
  s.geo = [];
  s.lobby = {};
  s.contractReadyAt = {};
  s.branchXp = { army: 0, navy: 0, af: 0, marines: 0, space: 0 };
  s.buffs = [];
  s.finale = 0;
  s.finaleReadyAt = 0;
  invalidate();
  const m = mods(s);
  s.budget = 15 + m.startBudget;
  if (m.startAssets) for (const a of ASSETS.slice(0, m.startAssets.tiers)) s.owned[a.id] = m.startAssets.count;
  invalidate();
  return gain;
}

export function buyOrder(s: GameState, id: string): boolean {
  const o = ORDER_BY_ID[id];
  if (!o || s.orders.includes(id) || s.capital < o.cost) return false;
  s.capital -= o.cost;
  s.orders.push(id);
  invalidate();
  return true;
}

// ---------- World operations ----------

export function isGeoVisible(s: GameState, g: GeoOp, index: number, all: GeoOp[]): boolean {
  return s.geo.includes(g.id) || index === 0 || s.lifetime >= g.cost * 0.02 || s.geo.includes(all[index - 1].id);
}

export function geoCost(s: GameState, g: GeoOp): number {
  return g.cost * mods(s).costMult;
}

export function buyGeo(s: GameState, g: GeoOp): boolean {
  const cost = geoCost(s, g);
  if (s.geo.includes(g.id) || cost > s.budget) return false;
  s.budget -= cost;
  recordSpend(s, cost);
  s.geo.push(g.id);
  s.stats.geoOps++;
  invalidate();
  return true;
}

// ---------- Finale: Big Bang 2 ----------

/** The finale opens once a Dyson Sphere is owned. */
export function isFinaleUnlocked(s: GameState): boolean {
  return (s.owned.dyson ?? 0) > 0;
}

/** Seconds until the current finale phase finishes construction (0 when the next can be funded). */
export function finaleBuilding(s: GameState): number {
  return Math.max(0, s.finaleReadyAt - s.time);
}

/** Price of a finale phase: a fixed number of seconds of steady spending, with a floor. */
export function finaleCost(s: GameState, p: FinalePhase): number {
  return Math.max(p.floor, p.seconds * mods(s).steadyRate);
}

/** Funds the next finale phase. Funding the last phase ends the game and records the playthrough. */
export function buyFinale(s: GameState): FinalePhase | null {
  const p = FINALE[s.finale];
  if (!p || s.ended || !isFinaleUnlocked(s)) return null;
  const cost = finaleCost(s, p);
  if (cost > s.budget || finaleBuilding(s) > 0) return null;
  s.budget -= cost;
  recordSpend(s, cost, 'space');
  s.finaleReadyAt = s.time + (BUILD[s.finale] ?? 0);
  s.finale++;
  if (s.finale >= FINALE.length) {
    s.ended = {
      time: s.time, at: Date.now(), lifetime: s.lifetime, clicks: s.clicks, prestiges: s.prestiges,
      achievements: s.achievements.length, research: s.research.length, bestRate: s.stats.bestRate,
    };
    s.buffs = [];
  }
  invalidate();
  return p;
}
