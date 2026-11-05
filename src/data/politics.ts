// Political and geographical content: foreign-policy operations on the world map,
// presidential posts, opportunity costs, congressional districts and taxpayer statistics.
import type { Effect } from './upgrades';
import { ASSETS } from './assets';

// ---------- Taxpayers and the national debt ----------

/** Approximate number of individual US income-tax returns filed per year. */
export const TAXPAYERS = 161e6;
/** Starting national debt shown on the debt clock (approximate, late 2026). */
export const BASE_DEBT = 38.9e12;
/** Baseline debt growth unrelated to the player, in dollars per second (about $2 trillion per year). */
export const DEBT_DRIFT = 2e12 / (365 * 86400);

export interface TaxpayerMood { at: number; sprite: string; mood: string; note: string }

/** Moods by the player's lifetime spending per taxpayer. */
export const TAXPAYER_MOODS: TaxpayerMood[] = [
  { at: 0, sprite: 'taxpayer0', mood: 'Blissfully Unaware', note: 'Still believes the budget is spent on roads.' },
  { at: 0.01, sprite: 'taxpayer1', mood: 'Mildly Concerned', note: 'Has noticed a line item called "Miscellaneous (Jets)".' },
  { at: 100, sprite: 'taxpayer2', mood: 'Openly Weeping', note: 'Pockets have been turned out by order of Congress.' },
  { at: 1e6, sprite: 'taxpayer3', mood: 'Wearing a Barrel', note: 'The barrel was also procured at a cost of $40,000.' },
];

export function taxpayerMood(perTaxpayer: number): TaxpayerMood {
  let m = TAXPAYER_MOODS[0];
  for (const x of TAXPAYER_MOODS) if (perTaxpayer >= x.at) m = x;
  return m;
}

/** What the same money could have bought instead: [label, unit cost in dollars]. */
export const OPPORTUNITY: [string, number][] = [
  ['potholes filled', 50],
  ['school lunches', 3.5],
  ['vials of insulin', 35],
  ['public-school teachers for a year', 72000],
  ['Pell Grants', 7395],
  ['years of a VA nurse', 95000],
  ['library books', 25],
  ['miles of new highway', 10e6],
  ['rural hospitals', 40e6],
  ['bridge repairs', 25e6],
  ['starter homes', 320000],
  ['years of the entire National Park Service', 3.5e9],
  ['Apollo programmes (inflation-adjusted)', 280e9],
  ['copies of the Constitution, actually read', 1],
];

// ---------- Congressional districts ----------

/** Where each asset is built, for the pork-barrel briefing. Locations follow public reporting where one exists. */
export const DISTRICTS: Record<string, string> = {
  recruit: 'Fort Bragg, North Carolina', humvee: 'Mishawaka, Indiana', t6: 'Wichita, Kansas', mq9: 'Poway, California',
  uh60: 'Stratford, Connecticut', mk6: 'New Orleans, Louisiana', stryker: 'Anniston, Alabama', ah64: 'Mesa, Arizona',
  a10: 'Hagerstown, Maryland', f16: 'Greenville, South Carolina', abrams: 'Lima, Ohio', himars: 'Camden, Arkansas',
  ch47: 'Ridley Park, Pennsylvania', f18: 'St. Louis, Missouri', lcs: 'Marinette, Wisconsin', c130: 'Marietta, Georgia',
  f15ex: 'St. Louis, Missouri', patriot: 'Andover, Massachusetts', mv22: 'Amarillo, Texas', ddg: 'Bath, Maine',
  kc46: 'Everett, Washington', e7: 'Seattle, Washington', f35: 'Fort Worth, Texas (plus suppliers in 45 states)', c17: 'Long Beach, California',
  ssn: 'Groton, Connecticut', thaad: 'Troy, Alabama', f22: 'Marietta, Georgia', b52: 'Oklahoma City, Oklahoma',
  lha: 'Pascagoula, Mississippi', b2: 'Palmdale, California', ssbn: 'Groton, Connecticut', sentinel: 'Roy, Utah',
  b21: 'Palmdale, California', cvn: 'Newport News, Virginia', f47: 'St. Louis, Missouri', csg: 'Norfolk, Virginia',
  shield: 'Huntsville, Alabama', orbcarrier: 'Cape Canaveral, Florida', lunar: 'Sea of Tranquility (statehood pending)', dyson: 'Palm Beach, Florida',
};

// ---------- World operations ----------

export interface GeoOp {
  id: string;
  name: string;
  place: string;
  /** Map position in degrees. Positions outside the map (Mars) are drawn in the corner. */
  lon: number;
  lat: number;
  cost: number;
  effects: Effect[];
  /** Short effect summary shown on the card. */
  effect: string;
  desc: string;
  /** The presidential post published when the operation is launched. */
  post: string;
  /** Map label drawn once the operation is complete, if any. */
  label?: string;
}

type GeoRow = Omit<GeoOp, 'cost'> & { tier: number };

const GEO_ROWS: GeoRow[] = [
  { id: 'parade', name: 'Birthday Military Parade', place: 'Washington, D.C.', lon: -77, lat: 38.9, tier: 2,
    effects: [{ type: 'domainMult', domain: 'ground', mult: 2 }], effect: 'Ground ×2',
    desc: 'Seventy-ton tanks roll down Constitution Avenue. The road repairs are a separate appropriation.',
    post: 'The GREATEST parade in the history of parades. The tanks were crying. The road was crying. Beautiful!' },
  { id: 'gulf', name: 'Rename the Gulf', place: 'Gulf of Mexico', lon: -90, lat: 25.5, tier: 4,
    effects: [{ type: 'domainMult', domain: 'sea', mult: 2 }], effect: 'Sea ×2', label: 'GULF OF AMERICA',
    desc: 'Every map, chart and textbook in federal service is reprinted. The fish have not been informed.',
    post: 'It is now the GULF OF AMERICA. Much nicer name. The water is warmer already, people are saying.' },
  { id: 'wall', name: 'Border Wall, Phase IX', place: 'Southern border', lon: -106, lat: 31.5, tier: 6,
    effects: [{ type: 'clickMult', mult: 3 }], effect: 'Click power ×3',
    desc: 'A wall paid for by another country, according to the press release. The invoice arrived here anyway.',
    post: 'The wall is going up, BIG and BEAUTIFUL. Someone else is paying. (Taxpayers.)' },
  { id: 'panama', name: 'Take Back the Canal', place: 'Panama Canal', lon: -79.7, lat: 9, tier: 8,
    effects: [{ type: 'tagMult', tag: 'ship', mult: 3 }], effect: 'Ships ×3',
    desc: 'A destroyer squadron is parked at both ends of the canal to check toll receipts.',
    post: 'We built that canal. We are taking it back. Ships go through FREE. Ours, anyway.' },
  { id: 'canada', name: 'The 51st State Initiative', place: 'Canada', lon: -103, lat: 58, tier: 10,
    effects: [{ type: 'branchMult', branch: 'army', mult: 3 }], effect: 'Army ×3', label: '51ST STATE?',
    desc: 'Canada politely declines. A tariff on maple syrup is imposed regardless, to show there are no hard feelings.',
    post: 'Canada would make a WONDERFUL 51st state. Governor Canada will agree. Tremendous hockey.' },
  { id: 'greenland', name: 'Purchase Greenland', place: 'Greenland', lon: -41, lat: 73, tier: 12,
    effects: [{ type: 'globalMult', mult: 1.5 }], effect: 'All spending ×1.5', label: 'SOLD',
    desc: 'Denmark says it is not for sale. The offer is raised from "a lot" to "a very big amount, maybe the biggest".',
    post: 'Greenland is a BIG beautiful piece of real estate. I know real estate. Denmark will come around.' },
  { id: 'nato', name: 'Five Percent NATO Invoice', place: 'Brussels', lon: 4.4, lat: 50.8, tier: 14,
    effects: [{ type: 'domainMult', domain: 'air', mult: 3 }], effect: 'Air ×3',
    desc: 'Allies are invoiced 5% of their GDP. They spend it on American jets. The money comes home, minus shipping.',
    post: 'NATO is finally paying! 5 percent! They are buying OUR jets with it. Genius. Some say the best deal ever.' },
  { id: 'tariff', name: 'Tariffs on Everything', place: 'Beijing', lon: 116.4, lat: 39.9, tier: 16,
    effects: [{ type: 'costMult', mult: 0.85 }], effect: 'Asset prices ×0.85',
    desc: 'A 145% tariff is placed on imported bolts. Foreign countries pay it, according to everyone except economists.',
    post: 'TARIFFS are the most beautiful word in the dictionary. China pays. Believe me, China pays.' },
  { id: 'iran', name: 'Bunker-Buster Weekend', place: 'Persian Gulf', lon: 53, lat: 32, tier: 18,
    effects: [{ type: 'tagMult', tag: 'bomber', mult: 4 }], effect: 'Bombers ×4',
    desc: 'Thirty-thousand-pound bombs are delivered with a 37-hour round trip. Each refuelling is itemised.',
    post: 'Perfect mission. PERFECT. The B-2s were magnificent. Nobody has ever seen planes so expensive.' },
  { id: 'taiwan', name: 'Strait Freedom Cruise', place: 'Taiwan Strait', lon: 120.5, lat: 24, tier: 20,
    effects: [{ type: 'tagMult', tag: 'carrier', mult: 3 }], effect: 'Carrier assets ×3',
    desc: 'A carrier group sails the strait to demonstrate freedom of navigation and freedom of appropriation.',
    post: 'Our carriers are the BIGGEST carriers. Everybody watching. Very respectful. Very costly. Very good.' },
  { id: 'dmz', name: 'Love-Letter Diplomacy', place: 'Korean DMZ', lon: 127, lat: 38, tier: 22,
    effects: [{ type: 'eventFreq', mult: 1.35 }], effect: 'Golden events ×1.35 frequency',
    desc: 'Beautiful letters are exchanged across the border. So are missile tests. The stationery budget triples.',
    post: 'We fell in love. Wonderful letters. Then he tested a missile. We will be buying more missiles too.' },
  { id: 'caribbean', name: 'Caribbean Gunboat Diplomacy', place: 'Caribbean Sea', lon: -67, lat: 13, tier: 24,
    effects: [{ type: 'branchMult', branch: 'navy', mult: 3 }], effect: 'Navy ×3',
    desc: 'Destroyers are stationed offshore indefinitely. The fuel bill is also indefinite.',
    post: 'Very big ships. Lots of ships. Sitting there, looking strong. Sitting costs money and that is fine!' },
  { id: 'minerals', name: 'Minerals-for-Missiles Deal', place: 'Kyiv', lon: 30.5, lat: 50.4, tier: 26,
    effects: [{ type: 'tagMult', tag: 'missile', mult: 3 }], effect: 'Missile assets ×3',
    desc: 'Rare earths are exchanged for interceptors, which require rare earths. The loop is described as "circular, but strong".',
    post: 'Great deal. Rare earth. Very rare. Like my deals. We get the minerals, they get the missiles, everybody pays.' },
  { id: 'alaska', name: 'Peace Summit in Alaska', place: 'Anchorage', lon: -150, lat: 61.2, tier: 28,
    effects: [{ type: 'globalMult', mult: 1.5 }], effect: 'All spending ×1.5',
    desc: 'The summit ends with a red carpet, a flypast of B-2s and no agreement. The flypast was the expensive part.',
    post: 'Fantastic meeting. We flew the B-2s over his head. He was impressed. The taxpayers were also impressed, I think.' },
  { id: 'dome', name: 'Golden Dome Groundbreaking', place: 'Colorado Springs', lon: -104.8, lat: 38.8, tier: 30,
    effects: [{ type: 'domainMult', domain: 'space', mult: 4 }], effect: 'Space ×4', label: 'GOLDEN DOME',
    desc: 'The missile shield will cover the entire nation. It will be gold. It is unclear whether gold helps.',
    post: 'GOLDEN DOME. Gold! Like the Romans but better. Only $175 billion, which is CHEAP, I got a great price.' },
  { id: 'mars', name: 'Plant the Flag on Mars', place: 'Mars', lon: 999, lat: 999, tier: 34,
    effects: [{ type: 'globalMult', mult: 2 }], effect: 'All spending ×2',
    desc: 'The first American flag on Mars is delivered by a $90 billion rocket. Mars is subsequently declared a congressional district.',
    post: 'We planted the FLAG on MARS. Big flag. The biggest. Martians love us. They are paying for it (they are not).' },
  { id: 'qatar', name: 'Accept a Free Flying Palace', place: 'Doha', lon: 51.5, lat: 25.3, tier: 3,
    effects: [{ type: 'domainMult', domain: 'air', mult: 2 }], effect: 'Air ×2',
    desc: 'A foreign government gifts the President a used 747. Refitting it as Air Force One costs more than buying a new one, which is described as "the best free plane ever".',
    post: 'They gave us a PLANE. Free! Very generous. We are spending only $1 billion to make it nice. Free planes are the most expensive kind.' },
  { id: 'mexico', name: 'Cartel Drone Patrol', place: 'Mexico City', lon: -99.1, lat: 19.4, tier: 7,
    effects: [{ type: 'tagMult', tag: 'drone', mult: 3 }, { type: 'tagMult', tag: 'helo', mult: 3 }], effect: 'Drones and helicopters ×3',
    desc: 'Reaper drones and helicopters circle overhead on a permanent basis. Mexico is invoiced for the airspace, the fuel and the noise complaints.',
    post: 'Our drones are flying over Mexico. Very quiet drones. Mexico will pay for the drones. They said no. That means maybe!' },
  { id: 'london', name: 'State Visit by Golden Carriage', place: 'London', lon: -0.1, lat: 51.5, tier: 11,
    effects: [{ type: 'globalMult', mult: 1.25 }], effect: 'All spending ×1.25',
    desc: 'The President arrives at the banquet in a golden carriage and asks whether it is available in a larger size. A twenty-one-gun salute is billed per gun.',
    post: 'The King is a GREAT guy. Big castle, very old, needs a ballroom. Gold one. I offered to build it. On the taxpayer. Our taxpayer.' },
  { id: 'aukus', name: 'AUKUS Submarine Layaway Plan', place: 'Canberra', lon: 149.1, lat: -35.3, tier: 15,
    effects: [{ type: 'tagMult', tag: 'sub', mult: 4 }], effect: 'Submarines ×4',
    desc: 'Australia pays for nuclear submarines today and receives them in the 2040s. It is assured that this is how layaway works, and that the submarines are very nice in the brochure.',
    post: 'Australia is buying our submarines. They pay NOW and get them LATER. Like a gift card. Best deal in the history of oceans.' },
  { id: 'tokyo', name: 'Tokyo Interceptor Sales Tour', place: 'Tokyo', lon: 139.7, lat: 35.7, tier: 19,
    effects: [{ type: 'tagMult', tag: 'air-defense', mult: 4 }], effect: 'Air defence ×4',
    desc: 'A trade delegation sells interceptor batteries to an ally, then tariffs the parts the ally needs to maintain them. Both transactions are recorded as wins.',
    post: 'Japan bought Patriots and THAADs. Beautiful batteries. Then we put a tariff on the batteries. Two wins in one day!' },
  { id: 'suez', name: 'Suez Convoy Toll Rebate', place: 'Suez Canal', lon: 32.3, lat: 30.6, tier: 23,
    effects: [{ type: 'tagMult', tag: 'transport', mult: 3 }, { type: 'tagMult', tag: 'support', mult: 3 }], effect: 'Transport and support ×3',
    desc: 'American convoys transit the canal free of charge "in recognition of past favours". The escort fleet required to enforce this costs more than the tolls ever did.',
    post: 'Our ships go through the Suez FREE now. Totally free. It only costs four destroyers and a tanker per ship. Free!' },
  { id: 'oslo', name: 'Peace Prize Lobbying Campaign', place: 'Oslo', lon: 10.7, lat: 59.9, tier: 27,
    effects: [{ type: 'globalMult', mult: 1.5 }], effect: 'All spending ×1.5',
    desc: 'A 400-page nomination letter is hand-delivered to the committee by a B-52 flypast. The committee describes the delivery as "loud" and the letter as "mostly about jets".',
    post: 'Very unfair! I ended SO many wars. Some of them were not even happening. Give me the Prize. Big medal. Gold, I hope.' },
  { id: 'svalbard', name: 'Close the Icebreaker Gap', place: 'Svalbard', lon: 16, lat: 78.2, tier: 31,
    effects: [{ type: 'domainMult', domain: 'sea', mult: 3 }], effect: 'Sea ×3',
    desc: 'The Navy commissions an icebreaker, then a second icebreaker to free the first, and then a programme office to study why the first one stopped.',
    post: 'Russia has 40 icebreakers. We will have 41. Beautiful ice, very breakable. The polar bears are thrilled, believe me.' },
  { id: 'fortknox', name: 'Audit Fort Knox (Briefly)', place: 'Fort Knox', lon: -85.9, lat: 37.9, tier: 33,
    effects: [{ type: 'costMult', mult: 0.85 }], effect: 'Asset prices ×0.85',
    desc: 'The gold is confirmed to be present. It is immediately leased to the Golden Dome programme, which is the only audit finding ever acted upon.',
    post: 'I went to Fort Knox. The gold is THERE. Lots of gold. Very shiny. We are putting it on the Dome. Smart, very smart.' },
  { id: 'moon', name: 'Rename the Moon', place: 'The Moon', lon: 998, lat: 998, tier: 37,
    effects: [{ type: 'domainMult', domain: 'space', mult: 3 }], effect: 'Space ×3',
    desc: 'The Moon is formally renamed "The Moon of America". Every textbook and tide table is reprinted. The tides are expected to comply by the next fiscal year.',
    post: 'Our Moon is now the MOON OF AMERICA. Much better name. Other countries can still look at it. For a small fee.' },
];

export const GEO: GeoOp[] = [...GEO_ROWS].sort((a, b) => a.tier - b.tier).map(({ tier, ...r }) => ({ ...r, cost: ASSETS[Math.min(tier, ASSETS.length - 1)].baseCost * 30 }));
export const GEO_BY_ID: Record<string, GeoOp> = Object.fromEntries(GEO.map(g => [g.id, g]));

// ---------- Presidential posts ----------

/** Generic posts, shown when the President is clicked or idle. */
export const POSTS: string[] = [
  'Nobody spends money like us. NOBODY. Many people are saying it.',
  'We will spend so much, you will get tired of spending. You will say please, sir, no more jets.',
  'Taxpayers LOVE it. A big strong taxpayer came up to me, tears in his eyes, said sir, take more.',
  'Deficit? FAKE NEWS. The money is right there. In the jets. Go look at the jets.',
  'The Department of WAR. Much better name. Much better ratings than "Defense". Defense is weak!',
  'Some people say a trillion dollars is a lot of money. It is not. I checked. It is a beautiful number.',
  'The auditors cannot find the receipts. SAD! Probably the receipts are classified.',
  'Other countries were LAUGHING at our tiny budget. They are not laughing now. They are invoiced.',
  'Make Appropriations Great Again!',
  'I have the best generals. They call me sir. Big strong generals, crying, saying sir.',
  'The national debt is like a very big credit card. And who pays credit cards? Not us. Future people.',
  'Fighter jet. I know more about fighter jets than anybody. You press the button and the money goes.',
  'We are going to win so much. Winning costs money. Very expensive winning.',
  'Very proud of the toilet seats. Gold. $10,000. Classy. You sit on it and you feel like a winner.',
  'Big beautiful budget bill. 2,000 pages. Read none of it. Did not have to. I know what is in it: jets.',
  'They want to cut waste. There is no waste. Every dollar is a WINNER dollar.',
];

/** Posts for the first deployment of an asset, with {name} replaced by its short name. */
export const DEPLOY_POSTS: string[] = [
  'Just bought the {name}. The best {name} ever built. Some say better than the old {name}. Much better.',
  'The {name} is HERE. People are looking at it, they cannot believe it. Gorgeous. Paid in full (by you).',
  'We are getting the {name}. Incredible machine. I asked how much. They said a lot. I said PERFECT.',
  'Congratulations to the {name}! Tremendous. Built in a very important district. Very important voters.',
];

export const EVENT_POSTS = {
  briefcase: ['A beautiful briefcase. Totally normal. Perfectly legal. PERFECTLY.', 'A very generous donor left a briefcase. Great patriot. Great guy. Never met him.'],
  toilet: ['GOLD TOILET SEAT. $10,000. Very classy. The Pentagon finally has taste.'],
  auditStart: ['WITCH HUNT! The auditors are here. Shred everything. SHRED!', 'Rigged audit by radical accountants. Total disgrace. Shred the receipts!'],
  auditWin: ['TOTAL AND COMPLETE EXONERATION! No receipts, no problem!'],
  auditLose: ['The audit was RIGGED. We failed beautifully. Seventh year in a row. A record!'],
  rank: ['Promoted! Big strong generals came up to me with tears in their eyes. Sir, they said. SIR.'],
  order: ['Signed it. Big signature. The biggest. Executive order, very powerful, maybe even legal.'],
  prestige: ['I am back. Again. Constitutional scholars are looking into it. Very busy people.'],
} as const;

/** Random presidential events: a post plus a timed effect. */
export interface PostEvent { id: string; title: string; post: string; body: string; buff: { rate?: number; click?: number; cost?: number; domain?: 'air' | 'ground' | 'sea' | 'space'; duration: number } }

export const POST_EVENTS: PostEvent[] = [
  { id: 'pe_tariff', title: 'Tariff Tantrum', post: 'Effective MIDNIGHT: 200% tariffs on everybody. Allies too. ESPECIALLY allies. Very unfair to us!',
    body: 'Asset prices rise 20% but panicked procurement multiplies all spending ×3 for 45 seconds.', buff: { rate: 3, cost: 1.2, duration: 45 } },
  { id: 'pe_allcaps', title: 'All-Caps Post at 3 a.m.', post: 'SPEND THE MONEY!!! ALL OF IT!!! NO MORE WAITING!!! COVFEFE!!!',
    body: 'Click power ×25 for 15 seconds. Nobody knows what the last word means.', buff: { click: 25, duration: 15 } },
  { id: 'pe_doge', title: 'Efficiency Department Visits the Pentagon', post: 'The efficiency team went to the Pentagon. Found NOTHING to cut. Perfect department. Gave them more.',
    body: 'Cuts were found everywhere except defence. Savings are redirected: all spending ×2 for 60 seconds.', buff: { rate: 2, duration: 60 } },
  { id: 'pe_flyover', title: 'Super Bowl Flyover', post: 'Did you see the flyover? Four jets. Over a football game. Very patriotic. Very expensive. Touchdown!',
    body: 'Air assets spend ×6 for 30 seconds on fuel, glory and halftime.', buff: { rate: 6, domain: 'air', duration: 30 } },
  { id: 'pe_shutdown', title: 'Government Shutdown Averted', post: 'We averted the shutdown! Passed a bill. Big bill. Nobody read it. Had a lot of jets in it, probably.',
    body: 'A 3 a.m. continuing resolution adds money to everything: all spending ×4 for 30 seconds.', buff: { rate: 4, duration: 30 } },
  { id: 'pe_navyparade', title: 'Fleet Week Spectacular', post: 'Fleet Week! The ships are so big. Bigger than the old ships. I would know, I looked at them.',
    body: 'Sea assets spend ×6 for 30 seconds while sailors buy $14 hot dogs.', buff: { rate: 6, domain: 'sea', duration: 30 } },
];
