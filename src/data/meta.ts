// Contractors, branches, ranks and executive orders.
import type { BranchId } from './assets';
import type { Effect } from './upgrades';

export interface ContractorDef { id: string; name: string; motto: string; tags: string[]; color: string; baseCost: number }

export const CONTRACTORS: ContractorDef[] = [
  { id: 'boondoggle', name: 'Boondoggle Aeronautics', motto: 'Fighters, and the excuses for them.', tags: ['fighter', 'trainer', 'attack'], color: '#5c7fa8', baseCost: 2e3 },
  { id: 'costplus', name: 'Cost-Plus Rotorcraft', motto: 'Every rotation is billable.', tags: ['helo', 'tiltrotor'], color: '#7f8f52', baseCost: 8e3 },
  { id: 'porkbarrel', name: 'Pork Barrel Shipbuilding', motto: 'A shipyard in every congressional district.', tags: ['ship', 'sub'], color: '#2a4a8a', baseCost: 4e4 },
  { id: 'overrun', name: 'Overrun Land Systems', motto: 'Late, heavy and worth every penny.', tags: ['vehicle', 'infantry', 'artillery'], color: '#c2a874', baseCost: 1e3 },
  { id: 'solesource', name: 'Sole-Source Missile Works', motto: 'The only bid you will ever need.', tags: ['missile', 'air-defense'], color: '#c8322d', baseCost: 5e5 },
  { id: 'revolving', name: 'Revolving Door Strategic Systems', motto: 'Staffed entirely by former customers.', tags: ['bomber', 'support', 'transport', 'drone', 'space'], color: '#8a5cc8', baseCost: 2e5 },
];

export const LOBBY_GROWTH = 9;
export const LOBBY_BONUS = 0.25;
export const CONTRACT_COOLDOWN = 300;

export interface BranchDef { id: BranchId; name: string; color: string; emblem: string }

export const BRANCHES: BranchDef[] = [
  { id: 'army', name: 'Army', color: '#c9b27c', emblem: 'emb_army' },
  { id: 'navy', name: 'Navy', color: '#2a4a8a', emblem: 'emb_navy' },
  { id: 'af', name: 'Air Force', color: '#5c7fa8', emblem: 'emb_af' },
  { id: 'marines', name: 'Marine Corps', color: '#c8322d', emblem: 'emb_marines' },
  { id: 'space', name: 'Space Force', color: '#8a5cc8', emblem: 'emb_space' },
];

/** Branch level from branch spending: level 1 at $1,000, then one level per ×4. */
export function branchLevel(xp: number): number {
  return xp < 1000 ? 0 : Math.floor(Math.log(xp / 1000) / Math.log(4)) + 1;
}
export function branchXpFor(level: number): number {
  return level <= 0 ? 0 : 1000 * 4 ** (level - 1);
}
export const BRANCH_BONUS_PER_LEVEL = 0.04;

export type Insignia = { kind: 'chevron'; n: number } | { kind: 'bar'; n: number } | { kind: 'leaf' } | { kind: 'eagle' } | { kind: 'star'; n: number } | { kind: 'cosmic'; n: number };

export interface RankDef { name: string; at: number; insignia: Insignia }

export const RANKS: RankDef[] = [
  { name: 'Private', at: 0, insignia: { kind: 'chevron', n: 0 } },
  { name: 'Private First Class', at: 1e3, insignia: { kind: 'chevron', n: 1 } },
  { name: 'Corporal', at: 1e4, insignia: { kind: 'chevron', n: 2 } },
  { name: 'Sergeant', at: 1e5, insignia: { kind: 'chevron', n: 3 } },
  { name: 'Staff Sergeant', at: 1e6, insignia: { kind: 'chevron', n: 4 } },
  { name: 'Master Sergeant', at: 1e7, insignia: { kind: 'chevron', n: 5 } },
  { name: 'Sergeant Major', at: 1e8, insignia: { kind: 'chevron', n: 6 } },
  { name: 'Second Lieutenant', at: 1e9, insignia: { kind: 'bar', n: 1 } },
  { name: 'First Lieutenant', at: 1e10, insignia: { kind: 'bar', n: 1 } },
  { name: 'Captain', at: 1e11, insignia: { kind: 'bar', n: 2 } },
  { name: 'Major', at: 1e12, insignia: { kind: 'leaf' } },
  { name: 'Lieutenant Colonel', at: 1e13, insignia: { kind: 'leaf' } },
  { name: 'Colonel', at: 1e14, insignia: { kind: 'eagle' } },
  { name: 'Brigadier General', at: 1e16, insignia: { kind: 'star', n: 1 } },
  { name: 'Major General', at: 1e18, insignia: { kind: 'star', n: 2 } },
  { name: 'Lieutenant General', at: 1e20, insignia: { kind: 'star', n: 3 } },
  { name: 'General', at: 1e22, insignia: { kind: 'star', n: 4 } },
  { name: 'Chairman of the Joint Chiefs', at: 1e25, insignia: { kind: 'star', n: 5 } },
  { name: 'Secretary of Everything', at: 1e29, insignia: { kind: 'cosmic', n: 1 } },
  { name: 'Supreme Galactic Procurement Officer', at: 1e34, insignia: { kind: 'cosmic', n: 2 } },
  { name: 'Emperor of the Military-Industrial Complex', at: 1e40, insignia: { kind: 'cosmic', n: 3 } },
];

export function rankIndex(lifetime: number): number {
  let i = 0;
  while (i + 1 < RANKS.length && lifetime >= RANKS[i + 1].at) i++;
  return i;
}

export interface OrderDef { id: string; name: string; desc: string; cost: number; effects: Effect[] }

export const ORDERS: OrderDef[] = [
  { id: 'eo_start', name: 'Continuing Resolution', desc: 'Start each administration with $50,000 already appropriated.', cost: 1, effects: [{ type: 'startBudget', amount: 5e4 }] },
  { id: 'eo_click', name: 'Executive Privilege', desc: 'Click power ×3.', cost: 2, effects: [{ type: 'clickMult', mult: 3 }] },
  { id: 'eo_auto', name: 'Presidential Intern Program', desc: 'Interns click the pallet 3 times per second.', cost: 3, effects: [{ type: 'autoClick', perSec: 3 }] },
  { id: 'eo_gold1', name: 'Lobbyist Hotline', desc: 'Golden briefcases appear 25% more often.', cost: 5, effects: [{ type: 'eventFreq', mult: 1.25 }] },
  { id: 'eo_omnibus', name: 'Omnibus Spending Bill', desc: 'Start each administration with 10 of each of the first five assets.', cost: 8, effects: [{ type: 'startAssets', count: 10, tiers: 5 }] },
  { id: 'eo_cost', name: 'Bulk Procurement Waiver', desc: 'All asset prices ×0.9.', cost: 12, effects: [{ type: 'costMult', mult: 0.9 }] },
  { id: 'eo_gold2', name: 'K Street Express Lane', desc: 'Event effects last 30% longer.', cost: 18, effects: [{ type: 'eventDur', mult: 1.3 }] },
  { id: 'eo_research', name: 'Black Budget Expansion', desc: 'Research costs ×0.5.', cost: 25, effects: [{ type: 'researchCost', mult: 0.5 }] },
  { id: 'eo_lobby', name: 'Revolving Door Policy', desc: 'Lobbying costs ×0.5.', cost: 35, effects: [{ type: 'lobbyCost', mult: 0.5 }] },
  { id: 'eo_emergency', name: 'National Emergency Declaration', desc: 'Everything ×1.5.', cost: 50, effects: [{ type: 'globalMult', mult: 1.5 }] },
  { id: 'eo_branch', name: 'Joint Chiefs Fan Club', desc: 'Branch level bonuses ×2.', cost: 70, effects: [{ type: 'branchBonus', mult: 2 }] },
  { id: 'eo_ig', name: 'Inspector General Sabbatical', desc: 'Congressional audits always end in your favour.', cost: 90, effects: [{ type: 'auditImmunity' }] },
  { id: 'eo_useit', name: 'Use It or Lose It', desc: 'Everything ×2.', cost: 120, effects: [{ type: 'globalMult', mult: 2 }] },
  { id: 'eo_blank', name: 'Blank Check', desc: 'Everything ×2.5.', cost: 180, effects: [{ type: 'globalMult', mult: 2.5 }] },
  { id: 'eo_glitch', name: 'Infinite Money Glitch', desc: 'Everything ×3.', cost: 280, effects: [{ type: 'globalMult', mult: 3 }] },
];

/** Mandate bonus: global multiplier is 1 + MANDATE_PER_CAPITAL × sqrt(capital ever earned). */
export const MANDATE_PER_CAPITAL = 0.1;
/** Lifetime spending at which political capital starts to accrue (see capitalFor). */
export const PRESTIGE_DIV = 1e9;
