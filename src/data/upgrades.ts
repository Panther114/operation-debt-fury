import { ASSETS, ASSET_BY_ID, type BranchId, type Domain } from './assets';

export type Effect =
  | { type: 'assetMult'; asset: string; mult: number }
  | { type: 'tagMult'; tag: string; mult: number }
  | { type: 'domainMult'; domain: Domain; mult: number }
  | { type: 'branchMult'; branch: BranchId; mult: number }
  | { type: 'globalMult'; mult: number }
  | { type: 'clickMult'; mult: number }
  | { type: 'clickRate'; pct: number }
  | { type: 'autoClick'; perSec: number }
  /** Each owned `source` asset (or every asset when '*') adds `pct` % to assets carrying `tag` ('*' = all). */
  | { type: 'synergy'; source: string; tag: string; pct: number }
  | { type: 'eventFreq'; mult: number }
  | { type: 'eventDur'; mult: number }
  | { type: 'costMult'; mult: number }
  | { type: 'researchCost'; mult: number }
  | { type: 'lobbyCost'; mult: number }
  | { type: 'branchBonus'; mult: number }
  | { type: 'startBudget'; amount: number }
  | { type: 'startAssets'; count: number; tiers: number }
  | { type: 'auditImmunity' }
  | { type: 'unlock' };

export type Unlock =
  | { owned: [string, number] }
  | { spent: number }
  | { clicks: number }
  | { allOwned: string[] };

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  unlock: Unlock;
  effects: Effect[];
  kind: 'asset' | 'click' | 'synergy';
  /** For asset tier upgrades: which tier (0-6) this is, used to pick the board variant. */
  level?: number;
  asset?: string;
  icon: string;
}

const THRESHOLDS = [1, 5, 25, 50, 100, 150, 200];
const COST_FACTOR = [10, 50, 500, 5e4, 5e6, 5e8, 5e11];

const assetUpgrades: UpgradeDef[] = ASSETS.flatMap(a =>
  THRESHOLDS.map((n, level) => {
    const names = [a.mods[0], a.mods[1], a.mods[2], 'Service Life Extension Program', 'Cost-Plus Sustainment Contract', `Gold-Plated ${a.short}`, `${a.short} Appreciation Month`];
    const flavour = [
      'A modest enhancement that is somehow a separate line item.',
      'Unlocks the low-visibility paint scheme on the board.',
      'Requested by nobody. Approved by everybody.',
      'Unlocks the special livery. Extends service life by decades, and the invoices by centuries.',
      'Guaranteed profit on every dollar. Patriotism has never been so lucrative.',
      'Every unit is now plated in gold. Radar return: dazzling.',
      'A month of parades, commemorative coins and a tasteful gala.',
    ][level];
    return {
      id: `${a.id}_${level}`,
      name: names[level],
      desc: `${a.name} output ×2. ${flavour}`,
      cost: a.baseCost * COST_FACTOR[level],
      unlock: { owned: [a.id, n] as [string, number] },
      effects: [{ type: 'assetMult', asset: a.id, mult: 2 } as Effect],
      kind: 'asset' as const,
      level,
      asset: a.id,
      icon: a.id,
    };
  }),
);

const CLICK_ROWS: [string, string, number, Effect][] = [
  ['Second Wallet', 'A second wallet, for spending with both hands. Click power ×2.', 1e2, { type: 'clickMult', mult: 2 }],
  ['Forklift Certification', 'Moves cash by the pallet instead of by the fistful. Click power ×2.', 5e3, { type: 'clickMult', mult: 2 }],
  ['Pallet Jack', 'Clicks now spend 1% of your $/s as well.', 1e5, { type: 'clickRate', pct: 1 }],
  ['Wheelbarrow of Cash', 'Click power ×2.', 5e6, { type: 'clickMult', mult: 2 }],
  ['Leaf Blower Dispersal', 'Clicks spend an additional 1% of $/s.', 2e8, { type: 'clickRate', pct: 1 }],
  ['Cash Cannon', 'Clicks spend an additional 1% of $/s.', 1e10, { type: 'clickRate', pct: 1 }],
  ['C-130 Pallet Drop', 'Clicks spend an additional 1% of $/s.', 1e12, { type: 'clickRate', pct: 1 }],
  ['Helicopter Money (Literal)', 'Clicks spend an additional 1% of $/s.', 1e14, { type: 'clickRate', pct: 1 }],
  ['Quantitative Easing Hose', 'Clicks spend an additional 1% of $/s.', 1e17, { type: 'clickRate', pct: 1 }],
  ['Money Printer Go Brrr', 'Click power ×5 and clicks spend an additional 2% of $/s.', 1e20, { type: 'clickMult', mult: 5 }],
];

const clickUpgrades: UpgradeDef[] = CLICK_ROWS.map(([name, desc, cost, eff], i) => ({
  id: `click_${i}`, name, desc, cost, kind: 'click', icon: 'pallet',
  unlock: { spent: cost / 4 },
  effects: i === CLICK_ROWS.length - 1 ? [eff, { type: 'clickRate', pct: 2 }] : [eff],
}));

const SYN: [string, string, string, number, string, string][] = [
  // id, name, source, pct, tag, flavour
  ['syn_cas', 'Close Air Support Doctrine', 'recruit', 0.5, 'attack', 'Each Recruit adds +0.5% to attack aircraft and helicopters. The grunts call, the Warthogs answer.'],
  ['syn_drill', 'Drill Sergeant Program', 'stryker', 3, 'infantry', 'Each Stryker adds +3% to Recruits. Push-ups are now billable.'],
  ['syn_littoral', 'Littoral Dominance', 'lcs', 8, 'small', 'Each LCS adds +8% to patrol boats. Somebody finally found a mission for it.'],
  ['syn_armor', 'Combined Arms Maneuver', 'himars', 2, 'armor', 'Each HIMARS adds +2% to armored vehicles.'],
  ['syn_tanker', 'Aerial Refueling Doctrine', 'kc46', 2, 'fighter', 'Each KC-46 adds +2% to all fighters. Gas, grass or cash: nobody flies for free.'],
  ['syn_awacs', 'Airborne Early Warning', 'e7', 3, 'jet', 'Each E-7 adds +3% to all jets.'],
  ['syn_airlift', 'Strategic Airlift', 'c17', 2, 'vehicle', 'Each C-17 adds +2% to all ground vehicles, which now travel business class.'],
  ['syn_iamd', 'Integrated Air and Missile Defense', 'ddg', 3, 'air-defense', 'Each destroyer adds +3% to Patriot and THAAD batteries.'],
  ['syn_triad', 'Nuclear Triad Modernization', 'sentinel', 4, 'nuclear', 'Each Sentinel adds +4% to every nuclear asset. Three legs, three budgets.'],
  ['syn_wing', 'Carrier Air Wing', 'cvn', 10, 'carrier', 'Each Ford-class carrier adds +10% to carrier-capable assets.'],
  ['syn_jadc2', 'Joint All-Domain Command and Control', '*', 0.05, '*', 'Every asset you own adds +0.05% to every other asset. Nobody knows what JADC2 is, which is why it works.'],
  ['syn_space', 'Space Superiority', 'shield', 5, 'space', 'Each Orbital Missile Shield adds +5% to all space assets.'],
];

const synergyUpgrades: UpgradeDef[] = SYN.map(([id, name, source, pct, tag, desc]) => {
  const src = source === '*' ? ASSET_BY_ID.f35 : ASSET_BY_ID[source];
  return {
    id, name, desc, kind: 'synergy', icon: src.id,
    cost: src.baseCost * 200,
    unlock: { owned: [src.id, 10] as [string, number] },
    effects: [{ type: 'synergy', source, tag, pct }],
  };
});

export const UPGRADES: UpgradeDef[] = [...clickUpgrades, ...synergyUpgrades, ...assetUpgrades];
export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
