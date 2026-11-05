// The final level: Big Bang 2: The Sequel. Five funded phases after the Dyson Sphere; the last one ends the game.
import { ASSET_BY_ID } from './assets';
import type { Effect } from './upgrades';

export interface FinalePhase {
  id: string;
  name: string;
  desc: string;
  /** Effect summary shown on the card. */
  effect: string;
  /** Price in seconds of the player's steady spending rate (temporary buffs excluded). */
  seconds: number;
  /** Minimum price, as a multiple of the Dyson Sphere's base cost. */
  floor: number;
  effects: Effect[];
  post: string;
}

/**
 * Phase prices are a number of seconds of steady spending, so each phase takes a predictable time
 * whatever multipliers the player has accumulated. The boosts only make the numbers bigger.
 */
const SECONDS = [60, 80, 100, 120, 150];
/** Construction time in seconds after each phase is funded, before the next can be funded. */
export const BUILD = [40, 50, 60, 70];
/** Status lines shown while a phase is under construction, one list per phase. */
export const BUILD_STATUS: string[][] = [
  ['Printing the script on gold-leaf paper', 'Casting a stunt double for the Sun', 'Filing an environmental impact statement for the old universe', 'Negotiating sequel rights with the void'],
  ['Physicists arguing over the last whiteboard marker', 'Billing for thinking time (rounded up to the nearest decade)', 'Proving the budget is infinite, with diagrams', 'Teaching one intern string theory, at union rates'],
  ['Repealing gravity (committee stage)', 'Lifting the speed limit on light', 'Placing entropy on administrative leave', 'Adding a cost-plus clause to the second law of thermodynamics'],
  ['Unboxing dimension eleven of seventeen', 'Assembling dimensions with an Allen key', 'Assigning dimension fourteen to carrier parking', 'Declassifying dimension nine (denied)'],
];

const ROWS: Omit<FinalePhase, 'seconds' | 'floor'>[] = [
  { id: 'bb1', name: 'Greenlight the Sequel',
    desc: 'The first Big Bang ran 13.8 billion years over schedule and never delivered a single fighter jet. Congress approves a sequel on the condition that it is bigger, louder and filmed in a key swing state.',
    effect: 'All spending ×4', effects: [{ type: 'globalMult', mult: 4 }],
    post: 'The first Big Bang was LOW ENERGY. Very weak. Ours will be the BIGGEST bang. People will cry. Physicists will cry.' },
  { id: 'bb2', name: 'Hire 40,000 Physicists (Union Rates)',
    desc: 'Each physicist receives a whiteboard, a security clearance and a $9,000 dry-erase marker. Eleven of them are working on the problem; the rest are working on the invoice.',
    effect: 'All spending ×4', effects: [{ type: 'globalMult', mult: 4 }],
    post: 'We hired the best physicists. Einstein level. Maybe better, Einstein never even got a defense contract. Sad!' },
  { id: 'bb3', name: 'Renegotiate the Laws of Physics',
    desc: 'Gravity is converted to a sole-source contract. The speed of light is raised so that it can keep up with the speed of spending. Entropy files a formal protest and is placed on administrative leave.',
    effect: 'All spending ×4', effects: [{ type: 'globalMult', mult: 4 }],
    post: 'Old physics: TOTAL DISASTER, made by the previous universe. New physics: money goes faster than light. Approved!' },
  { id: 'bb4', name: 'Pre-Order Seventeen Dimensions',
    desc: 'Eleven dimensions were judged insufficient for a country of this size. Seventeen are procured: three for living in, two classified, and twelve reserved for parking the carrier fleet.',
    effect: 'All spending ×4', effects: [{ type: 'globalMult', mult: 4 }],
    post: 'Other universes have 3 dimensions. Pathetic. We have SEVENTEEN. Nobody has ever seen so many dimensions.' },
  { id: 'bb5', name: 'Press the Big Red Button',
    desc: 'Every dollar in existence is spent simultaneously. The resulting singularity is described by the GAO as "technically not an audit failure, because there is no longer anything to audit".',
    effect: 'Ends the universe (and the game)', effects: [],
    post: 'OK. Ready? 3... 2... I am pressing it. BIGGEST BUTTON EVER. Thank you, taxpayer. You will be reassembled from stardust and billed.' },
];

export const FINALE: FinalePhase[] = ROWS.map((r, i) => ({ ...r, seconds: SECONDS[i], floor: ASSET_BY_ID.dyson.baseCost * 10 * (i + 1) }));

/** One-line summaries of how the universe ended, chosen by playthrough time (seconds). */
export const VERDICTS: [number, string, string][] = [
  [45 * 60, 'S', 'Fiscal Event Horizon. The GAO has requested a time machine to audit the playthrough.'],
  [60 * 60, 'A', 'Distinguished Overspender. Two separate universes have named a deficit after this administration.'],
  [80 * 60, 'B', 'Competent Waste. The money was spent quickly, though some of it briefly paused at a red light.'],
  [110 * 60, 'C', 'Leisurely Appropriator. Several taxpayers noticed before the end. They have been reassured.'],
  [Infinity, 'D', 'Continuing Resolution. The universe ended mostly of old age, but the paperwork was impeccable.'],
];

export const EPILOGUE: string[] = [
  'Universe 1 was decommissioned at 100% of budget, which the Pentagon describes as its first-ever accurate forecast.',
  'The American taxpayer has been reassembled from stardust and already owes $47 in late fees.',
  'The Dyson Sphere was salvaged and re-sold to the new universe at a 4,000% mark-up.',
  'The President has announced a run for a third term in the new universe, on the grounds that it is technically a first term.',
  'The national debt of Universe 2 opens at $0.00. Analysts expect this to last approximately one click.',
];
