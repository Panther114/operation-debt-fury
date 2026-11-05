import { ASSETS } from './assets';
import { RESEARCH } from './research';
import { RANKS, rankIndex } from './meta';
import { GEO } from './politics';
import type { GameState } from '../core/state';
import type { Mods } from '../core/economy';
import { money } from '../core/format';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  secret?: boolean;
  check: (s: GameState, m: Mods) => boolean;
}

const SPENT: [number, string][] = [
  [1e3, 'Pocket Change'], [1e5, 'Petty Cash'], [1e6, 'Discretionary Fund'], [1e7, 'Line Item'],
  [1e8, 'Earmark'], [1e9, 'Billion-Dollar Baby'], [1e10, 'Rounding Error'], [1e11, 'Supplemental Request'],
  [1e12, 'Trillion-Dollar Club'], [1e13, 'National Debt Enthusiast'], [1e14, 'Fiscal Cliff Diver'], [1e15, 'Quadrillionaire (Negative)'],
  [1e17, 'GDP of Several Planets'], [1e19, 'Unauditable'], [1e21, 'Sextillion Spree'], [1e24, 'Septillion Splurge'],
  [1e27, 'Octillion Overrun'], [1e30, 'Nonillion Nonchalance'], [1e33, 'Decillion Dollar Defense'], [1e39, 'Budget Event Horizon'],
  [3e40, 'Heat Death of the Treasury'], [1e41, 'Beyond Appropriation'],
];

const RATE: [number, string][] = [
  [10, 'Burn Rate'], [1e3, 'Thousand-Dollar Hammer'], [1e6, 'Million a Second'], [1e9, 'Billion a Second'],
  [1e12, 'Trillion a Second'], [1e15, 'Hyperspending'], [1e18, 'Quintillion Velocity'], [1e21, 'Sextillion Velocity'],
  [1e24, 'Relativistic Expenditure'], [1e30, 'Spending at Light Speed'],
];

const CLICKS: [number, string][] = [[100, 'Hands-On Management'], [1000, 'Click Fatigue'], [10_000, 'Repetitive Strain Appropriation'], [50_000, 'Mouse Replacement Request'], [100_000, 'Carpal Tunnel Medal']];

const total = (s: GameState) => ASSETS.reduce((t, a) => t + (s.owned[a.id] ?? 0), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  ...SPENT.map(([n, name], i) => ({ id: `spent_${i}`, name, desc: `Spend ${money(n)} in total.`, check: (s: GameState) => s.lifetime >= n })),
  ...RATE.map(([n, name], i) => ({ id: `rate_${i}`, name, desc: `Spend ${money(n)} per second.`, check: (_: GameState, m: Mods) => m.rate >= n })),
  ...CLICKS.map(([n, name], i) => ({ id: `click_${i}`, name, desc: `Click the pallet ${n.toLocaleString('en-US')} times.`, check: (s: GameState) => s.clicks >= n })),
  ...ASSETS.map(a => ({ id: `own_${a.id}`, name: `Acquired: ${a.short}`, desc: `Buy your first ${a.name}.`, check: (s: GameState) => (s.owned[a.id] ?? 0) >= 1 })),
  ...[100, 500, 1000, 2500].map((n, i) => ({ id: `total_${i}`, name: ['Battalion', 'Brigade', 'Division', 'Army Group'][i], desc: `Own ${n} assets at once.`, check: (s: GameState) => total(s) >= n })),
  { id: 'brief_1', name: 'Taking Meetings', desc: 'Open a lobbyist briefcase.', check: s => s.stats.briefcases >= 1 },
  { id: 'brief_10', name: 'Well Connected', desc: 'Open 10 lobbyist briefcases.', check: s => s.stats.briefcases >= 10 },
  { id: 'brief_50', name: 'K Street Regular', desc: 'Open 50 lobbyist briefcases.', check: s => s.stats.briefcases >= 50 },
  { id: 'brief_150', name: 'Registered Foreign Agent of Fun', desc: 'Open 150 lobbyist briefcases.', check: s => s.stats.briefcases >= 150 },
  { id: 'audit_1', name: 'Clean Opinion (Allegedly)', desc: 'Survive a congressional audit.', check: s => s.stats.audits - s.stats.auditsFailed >= 1 },
  { id: 'audit_10', name: 'Shredder Ace', desc: 'Survive 10 congressional audits.', check: s => s.stats.audits - s.stats.auditsFailed >= 10 },
  { id: 'audit_fail', name: 'Material Weakness', desc: 'Fail a congressional audit. A proud tradition.', check: s => s.stats.auditsFailed >= 1 },
  { id: 'contract_1', name: 'Sole Source', desc: 'Sign a defense contract.', check: s => s.stats.contracts >= 1 },
  { id: 'contract_10', name: 'Indefinite Delivery', desc: 'Sign 10 defense contracts.', check: s => s.stats.contracts >= 10 },
  { id: 'underbudget', name: 'Statistical Anomaly', desc: 'Have a contract delivered on time and under budget.', check: s => s.stats.underBudget >= 1 },
  { id: 'research_1', name: 'Black Budget', desc: 'Complete a research project.', check: s => s.research.length >= 1 },
  { id: 'research_20', name: 'Skunk Works Regular', desc: 'Complete 20 research projects in one administration.', check: s => s.research.length >= 20 },
  { id: 'research_all', name: 'Area 51 Alumni', desc: 'Complete every research project in one administration.', check: s => s.research.length >= RESEARCH.length },
  { id: 'prestige_1', name: 'Peaceful Transfer of Power', desc: 'Start a New Administration.', check: s => s.prestiges >= 1 },
  { id: 'prestige_5', name: 'Term Limits Are Suggestions', desc: 'Start 5 New Administrations.', check: s => s.prestiges >= 5 },
  { id: 'prestige_10', name: 'Career Politician', desc: 'Start 10 New Administrations.', check: s => s.prestiges >= 10 },
  { id: 'prestige_25', name: 'Permanent Government', desc: 'Start 25 New Administrations.', check: s => s.prestiges >= 25 },
  { id: 'world_5', name: 'Gunboat Diplomat', desc: 'Complete 5 world operations in one administration.', check: s => s.geo.length >= 5 },
  { id: 'world_15', name: 'Manifest Destiny (International Edition)', desc: 'Complete 15 world operations in one administration.', check: s => s.geo.length >= 15 },
  { id: 'world_all', name: 'Leader of the Free World (and the Rest)', desc: 'Complete every world operation in one administration.', check: s => s.geo.length >= GEO.length },
  { id: 'sequel', name: 'Greenlit', desc: 'Fund the first phase of Big Bang 2: The Sequel.', check: s => s.finale >= 1 },
  { id: 'wargame_5', name: 'Exercise Enthusiast', desc: 'Take part in 5 war games.', check: s => s.stats.wargames >= 5 },
  { id: 'chairman', name: 'Top Brass', desc: `Reach the rank of ${RANKS[17].name}.`, check: s => rankIndex(s.lifetime) >= 17 },
  { id: 'emperor', name: 'Ascended Procurement', desc: `Reach the rank of ${RANKS[RANKS.length - 1].name}.`, check: s => rankIndex(s.lifetime) >= RANKS.length - 1 },
  { id: 'gold_1', name: 'Gilded', desc: 'Gold-plate any asset line.', check: s => s.upgrades.some(u => u.endsWith('_5')) },
  { id: 'gold_10', name: 'Fort Knox Air Wing', desc: 'Gold-plate 10 asset lines.', check: s => s.upgrades.filter(u => /^[a-z0-9]+_5$/.test(u)).length >= 10 },
  { id: 'csg_10', name: 'Freedom of Navigation', desc: 'Own 10 Carrier Strike Groups.', check: s => (s.owned.csg ?? 0) >= 10 },
  { id: 'toilet', name: 'Throne of Oversight', desc: 'Click the $10,000 toilet seat.', secret: true, check: s => s.stats.toilets >= 1 },
  { id: 'ticker', name: 'Media Literacy', desc: 'Click the news ticker 10 times.', secret: true, check: s => s.stats.tickerClicks >= 10 },
  { id: 'mute', name: 'Strategic Silence', desc: 'Toggle the music 5 times.', secret: true, check: s => s.stats.muteToggles >= 5 },
  { id: 'hour', name: 'Continuing Resolution', desc: 'Play for one hour.', secret: true, check: s => s.time >= 3600 },
  { id: 'broke', name: 'Fiscal Responsibility', desc: 'Have less than $1 of budget left after a purchase.', secret: true, check: s => s.budget < 1 && s.spent > 100 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
