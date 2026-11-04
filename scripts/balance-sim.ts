// Headless pacing simulation. A greedy player buys whatever pays back fastest,
// clicks at a steady rate, and starts a New Administration when capital would at least double.
// Usage: npx tsx scripts/balance-sim.ts [hours] [clicksPerSec]
import { ASSETS, ASSET_BY_ID } from '../src/data/assets';
import { RESEARCH } from '../src/data/research';
import { CONTRACTORS, ORDERS } from '../src/data/meta';
import { newState, type GameState } from '../src/core/state';
import * as E from '../src/core/economy';
import { duration, money } from '../src/core/format';

const HOURS = Number(process.argv[2] ?? 4);
const CPS = Number(process.argv[3] ?? 5);
const STEP = 5;

type Cand = { label: string; cost: number; apply: () => void; undo: () => void; buy: () => boolean };

function effective(s: GameState): number {
  E.invalidate();
  const m = E.mods(s);
  return m.rate + (CPS + m.autoClick) * m.clickPower;
}

function candidates(s: GameState): Cand[] {
  const out: Cand[] = [];
  for (const a of ASSETS) {
    if (!E.isAssetUnlocked(s, a)) continue;
    out.push({ label: a.short, cost: E.assetCost(s, a), apply: () => { s.owned[a.id] = (s.owned[a.id] ?? 0) + 1; }, undo: () => { s.owned[a.id]--; }, buy: () => E.buyAsset(s, a, 1) });
  }
  for (const u of E.availableUpgrades(s).slice(0, 12)) {
    out.push({ label: u.name, cost: u.cost, apply: () => { s.upgrades.push(u.id); }, undo: () => { s.upgrades.pop(); }, buy: () => E.buyUpgrade(s, u) });
  }
  for (const r of RESEARCH) {
    if (!E.canResearch(s, r)) continue;
    const unlocked = ASSETS.find(a => a.requires === r.id);
    out.push({
      label: 'R&D ' + r.name, cost: E.researchCost(s, r) + (unlocked ? unlocked.baseCost : 0),
      apply: () => { s.research.push(r.id); if (unlocked) s.owned[unlocked.id] = (s.owned[unlocked.id] ?? 0) + 1; },
      undo: () => { s.research.pop(); if (unlocked) s.owned[unlocked.id]--; },
      buy: () => E.buyResearch(s, r),
    });
  }
  for (const c of CONTRACTORS) {
    out.push({ label: 'Lobby ' + c.name, cost: E.lobbyCost(s, c), apply: () => { s.lobby[c.id] = (s.lobby[c.id] ?? 0) + 1; }, undo: () => { s.lobby[c.id]--; }, buy: () => E.buyLobby(s, c) });
  }
  return out;
}

function step(s: GameState): void {
  // Buy greedily until the best option is not affordable.
  for (let guard = 0; guard < 200; guard++) {
    const base = effective(s);
    let best: Cand | null = null, bestScore = Infinity;
    for (const c of candidates(s)) {
      c.apply();
      const gain = effective(s) - base;
      c.undo();
      // Pure unlocks and utility nodes have no direct output; buy them once they are cheap.
      if (gain <= 0) { if (c.label.startsWith('R&D') && c.cost < s.budget * 0.05) { best = c; bestScore = -1; break; } continue; }
      const score = Math.max(0, c.cost - s.budget) / Math.max(base, 1e-9) + c.cost / gain;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    E.invalidate();
    if (!best || best.cost > s.budget || !best.buy()) return;
  }
}

const s = newState(0);
const firstSeen: Record<string, number> = {};
const prestigeLog: string[] = [];
let lastReport = 0;
for (let t = 0; t < HOURS * 3600; t += STEP) {
  for (let k = 0; k < CPS * STEP; k++) E.click(s);
  E.tick(s, STEP);
  step(s);
  for (const a of ASSETS) if ((s.owned[a.id] ?? 0) > 0 && firstSeen[a.id] === undefined) firstSeen[a.id] = t;
  const pending = E.pendingCapital(s);
  if (pending >= Math.max(4, s.capitalEarned) && s.runTime > 300) {
    prestigeLog.push(`${duration(t)}: prestige #${s.prestiges + 1} +${pending} capital (run ${duration(s.runTime)}, best tier ${ASSETS.filter(a => s.owned[a.id]).length})`);
    E.prestige(s);
    for (const o of [...ORDERS].sort((a, b) => a.cost - b.cost)) E.buyOrder(s, o.id);
  }
  if (t - lastReport >= 600) {
    lastReport = t;
    console.log(`[${duration(t)}] rate ${money(E.mods(s).rate, true)}/s lifetime ${money(s.lifetime, true)} capital ${s.capitalEarned}+${E.pendingCapital(s)}`);
  }
}
console.log('\nFirst purchase of each tier:');
for (const a of ASSETS) console.log(`${String(a.tier).padStart(2)} ${a.short.padEnd(16)} ${firstSeen[a.id] !== undefined ? duration(firstSeen[a.id]) : '-'}   cost ${money(a.baseCost, true)}`);
console.log('\n' + prestigeLog.join('\n'));
console.log(`\nFinal: ${s.research.length} research, orders ${s.orders.length}/${ORDERS.length}, ${ASSET_BY_ID.dyson && s.owned.dyson ? 'Dyson owned' : 'no Dyson'}`);
