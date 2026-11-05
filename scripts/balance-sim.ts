// Headless pacing simulation of a focused player. The player clicks at a steady rate, catches most
// golden briefcases, wins most audits, signs contracts when ready, buys whatever pays back fastest
// (assets, upgrades, research, lobbying, world operations, finale phases) and starts a New
// Administration when progress stalls and capital would at least double. Runs until the game ends.
// Usage: npx tsx scripts/balance-sim.ts [maxHours] [clicksPerSec] [seed]
import { ASSETS, ASSET_BY_ID } from '../src/data/assets';
import { RESEARCH } from '../src/data/research';
import { CONTRACTORS, ORDERS } from '../src/data/meta';
import { GEO } from '../src/data/politics';
import { FINALE } from '../src/data/finale';
import { newState } from '../src/core/state';
import * as E from '../src/core/economy';
import { on } from '../src/core/bus';
import { contractReady, openBriefcase, resolveAudit, signContract, updateEvents } from '../src/core/events';
import { duration, money } from '../src/core/format';

const HOURS = Number(process.argv[2] ?? 4);
const CPS = Number(process.argv[3] ?? 5);
let seed = Number(process.argv[4] ?? 1);
// Deterministic Math.random so runs are comparable.
Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const STEP = 1;
const CATCH = Number(process.env.SIM_CATCH ?? 0.85);
const AUDIT_WIN = 0.75;
const STALL = 240;
const OFF = new Set((process.env.SIM_OFF ?? '').split(','));

const s = newState(0);
on('briefcase', ({ kind }) => { if (!OFF.has('brief') && Math.random() < CATCH) openBriefcase(s, kind); });
on('audit', () => resolveAudit(s, Math.random() < AUDIT_WIN));

type Cand = { label: string; cost: number; utility?: boolean; apply: () => void; undo: () => void; buy: () => boolean };

function effective(): number {
  E.invalidate();
  const m = E.mods(s);
  return m.rate + CPS * m.clickPower + m.autoClick * m.autoPower;
}

function candidates(): Cand[] {
  const out: Cand[] = [];
  for (const a of ASSETS) {
    if (!E.isAssetUnlocked(s, a)) continue;
    out.push({ label: a.short, cost: E.assetCost(s, a), apply: () => { s.owned[a.id] = (s.owned[a.id] ?? 0) + 1; }, undo: () => { s.owned[a.id]--; }, buy: () => E.buyAsset(s, a, 1) });
  }
  for (const u of E.availableUpgrades(s).slice(0, 16)) {
    out.push({ label: u.name, cost: u.cost, apply: () => { s.upgrades.push(u.id); }, undo: () => { s.upgrades.pop(); }, buy: () => E.buyUpgrade(s, u) });
  }
  for (const r of RESEARCH) {
    if (!E.canResearch(s, r)) continue;
    const unlocked = ASSETS.find(a => a.requires === r.id);
    out.push({
      label: 'R&D ' + r.name, cost: E.researchCost(s, r) + (unlocked ? unlocked.baseCost : 0), utility: true,
      apply: () => { s.research.push(r.id); if (unlocked) s.owned[unlocked.id] = (s.owned[unlocked.id] ?? 0) + 1; },
      undo: () => { s.research.pop(); if (unlocked) s.owned[unlocked.id]--; },
      buy: () => E.buyResearch(s, r),
    });
  }
  for (const c of CONTRACTORS) {
    out.push({ label: 'Lobby ' + c.name, cost: E.lobbyCost(s, c), apply: () => { s.lobby[c.id] = (s.lobby[c.id] ?? 0) + 1; }, undo: () => { s.lobby[c.id]--; }, buy: () => E.buyLobby(s, c) });
  }
  GEO.forEach((g, i) => {
    if (OFF.has('geo') || s.geo.includes(g.id) || !E.isGeoVisible(s, g, i, GEO)) return;
    out.push({ label: 'Geo ' + g.name, cost: E.geoCost(s, g), utility: true, apply: () => { s.geo.push(g.id); }, undo: () => { s.geo.pop(); }, buy: () => E.buyGeo(s, g) });
  });
  const p = FINALE[s.finale];
  if (p && E.isFinaleUnlocked(s)) {
    out.push({ label: 'Finale ' + p.name, cost: E.finaleCost(s, p), utility: true, apply: () => { s.finale++; }, undo: () => { s.finale--; }, buy: () => E.buyFinale(s) !== null });
  }
  return out;
}

function step(): void {
  // Once the finale is open the player saves for it: other purchases would raise its price.
  if (E.isFinaleUnlocked(s)) {
    const p = FINALE[s.finale];
    if (p && E.finaleBuilding(s) <= 0 && E.finaleCost(s, p) <= s.budget) E.buyFinale(s);
    return;
  }
  for (let guard = 0; guard < 300; guard++) {
    const base = effective();
    let best: Cand | null = null, bestScore = Infinity;
    for (const c of candidates()) {
      c.apply();
      const gain = effective() - base;
      c.undo();
      // Utility nodes with no direct output are bought once they are cheap (or the finale is affordable).
      if (gain <= 0) {
        if (c.utility && (c.cost < s.budget * 0.05 || (c.label.startsWith('Finale') && c.cost <= s.budget))) { best = c; bestScore = -1; break; }
        continue;
      }
      const score = Math.max(0, c.cost - s.budget) / Math.max(base, 1e-9) + c.cost / gain;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    E.invalidate();
    if (!best || best.cost > s.budget || !best.buy()) return;
  }
}

const firstSeen: Record<string, number> = {};
const prestigeLog: string[] = [];
const finaleLog: string[] = [];
let lastReport = 0;
let lastNewTier = 0;
let bestTier = 0;
let t = 0;
for (; t < HOURS * 3600 && !s.ended; t += STEP) {
  for (let k = 0; k < CPS * STEP; k++) E.click(s);
  E.tick(s, STEP);
  updateEvents(s, STEP);
  if (!OFF.has('contract')) for (const c of CONTRACTORS) if (contractReady(s, c)) signContract(s, c);
  const finaleBefore = s.finale;
  step();
  if (s.finale > finaleBefore) finaleLog.push(`${duration(t)}: ${FINALE[s.finale - 1].name} (rate × 1 s = ${(E.mods(s).rate / ASSET_BY_ID.dyson.baseCost).toExponential(2)} Dyson base costs)`);
  const tier = ASSETS.filter(a => s.owned[a.id]).length;
  if (tier > bestTier) { bestTier = tier; lastNewTier = t; }
  for (const a of ASSETS) if ((s.owned[a.id] ?? 0) > 0 && firstSeen[a.id] === undefined) firstSeen[a.id] = t;
  const pending = E.pendingCapital(s);
  if (!s.ended && pending >= Math.max(3, s.capitalEarned) && s.runTime > 300 && t - lastNewTier > STALL && !E.isFinaleUnlocked(s)) {
    prestigeLog.push(`${duration(t)}: prestige #${s.prestiges + 1} +${pending} capital (run ${duration(s.runTime)}, best tier ${tier}, mandate ×${E.mandate(s.capitalEarned + pending).toFixed(2)})`);
    E.prestige(s);
    bestTier = 0; lastNewTier = t;
    for (const o of [...ORDERS].sort((a, b) => a.cost - b.cost)) E.buyOrder(s, o.id);
  }
  if (t - lastReport >= 300) {
    lastReport = t;
    console.log(`[${duration(t)}] rate ${money(E.mods(s).rate, true)}/s lifetime ${money(s.lifetime, true)} tier ${tier} capital ${s.capitalEarned}+${E.pendingCapital(s)} geo ${s.geo.length} rd ${s.research.length}`);
  }
}
console.log('\nFirst purchase of each tier:');
for (const a of ASSETS) console.log(`${String(a.tier).padStart(2)} ${a.short.padEnd(16)} ${firstSeen[a.id] !== undefined ? duration(firstSeen[a.id]) : '-'}   cost ${money(a.baseCost, true)}`);
console.log('\n' + prestigeLog.join('\n'));
console.log('\n' + finaleLog.join('\n'));
console.log(`\nFinal: ${s.ended ? `GAME COMPLETE at ${duration(s.ended.time)}` : `not finished after ${duration(t)}`}; ${s.research.length} research, ${s.geo.length}/${GEO.length} world ops, orders ${s.orders.length}/${ORDERS.length}, medals ${s.achievements.length}`);
