export type Domain = 'air' | 'ground' | 'sea' | 'space';
export type BranchId = 'army' | 'navy' | 'af' | 'marines' | 'space';
export type Behaviour = 'march' | 'drive' | 'fly' | 'hover' | 'sail' | 'submarine' | 'static' | 'orbit' | 'silo' | 'fixed';

export interface AssetDef {
  id: string;
  name: string;
  short: string;
  domain: Domain;
  branch: BranchId;
  behaviour: Behaviour;
  /** Movement speed on the board, in sprite pixels per second. */
  speed: number;
  /** Maximum number of sprites of this type drawn on the board. */
  cap: number;
  tags: string[];
  desc: string;
  /** Approximate real-world unit cost, shown as flavour text only. */
  realCost: string;
  /** Names of the first three tier upgrades. */
  mods: [string, string, string];
  /** Research node that must be completed before the asset can be bought. */
  requires?: string;
  baseCost: number;
  baseRate: number;
  tier: number;
}

type Row = Omit<AssetDef, 'baseCost' | 'baseRate' | 'tier'>;

const ROWS: Row[] = [
  { id: 'recruit', name: 'Army Recruit', short: 'Recruit', domain: 'ground', branch: 'army', behaviour: 'march', speed: 6, cap: 14, tags: ['infantry'],
    desc: 'Signing bonus, gym membership, and a lifetime supply of energy drinks. Spends money mostly on energy drinks.', realCost: '~$60,000 per year', mods: ['Signing Bonus', 'Tactical Energy Drinks', 'Branded Gaming Chair'] },
  { id: 'humvee', name: 'HMMWV', short: 'Humvee', domain: 'ground', branch: 'army', behaviour: 'drive', speed: 14, cap: 8, tags: ['vehicle'],
    desc: 'A jeep that went to the gym. Gets 8 miles per gallon and 0 miles per budget hearing.', realCost: '~$220,000', mods: ['Up-Armor Kit', 'Heated Cupholders', 'Chrome Rims'] },
  { id: 't6', name: 'T-6 Texan II', short: 'Texan II', domain: 'air', branch: 'af', behaviour: 'fly', speed: 26, cap: 6, tags: ['trainer', 'prop'],
    desc: 'Where future fighter pilots learn to burn money at 300 knots.', realCost: '~$6 million', mods: ['Fuzzy Dice Mod', 'Student Pilot Surcharge', 'Instructor Call-Sign Fees'] },
  { id: 'mq9', name: 'MQ-9 Reaper', short: 'Reaper', domain: 'air', branch: 'af', behaviour: 'fly', speed: 16, cap: 6, tags: ['drone'],
    desc: 'Flown from a trailer in Nevada by a pilot who still had to pass flight school.', realCost: '~$32 million', mods: ['Extended-Range Wings', 'Air-Conditioned Trailer', 'Loyalty Points Program'] },
  { id: 'uh60', name: 'UH-60 Black Hawk', short: 'Black Hawk', domain: 'air', branch: 'army', behaviour: 'hover', speed: 12, cap: 6, tags: ['helo', 'transport'],
    desc: 'The Army flies it, names it after a tribe, and lets you pay for the gold-plated rotor bolts.', realCost: '~$21 million', mods: ['Medevac Package', 'Rotor Bolt Premium', 'Night Stalker Subscription'] },
  { id: 'mk6', name: 'Mark VI Patrol Boat', short: 'Mk VI', domain: 'sea', branch: 'navy', behaviour: 'sail', speed: 12, cap: 6, tags: ['ship', 'small'],
    desc: 'A very expensive speedboat with a very serious machine gun.', realCost: '~$10 million', mods: ['Twin Waterjets', 'Wake Enhancement', 'Yacht Club Membership'] },
  { id: 'stryker', name: 'Stryker ICV', short: 'Stryker', domain: 'ground', branch: 'army', behaviour: 'drive', speed: 12, cap: 6, tags: ['vehicle', 'armor'],
    desc: 'Eight wheels, one turret, infinite paperwork.', realCost: '~$5 million', mods: ['Double-V Hull', '30 mm Upgrade', 'Ninth Wheel (Spare)'] },
  { id: 'ah64', name: 'AH-64 Apache', short: 'Apache', domain: 'air', branch: 'army', behaviour: 'hover', speed: 14, cap: 6, tags: ['helo', 'attack'],
    desc: 'A flying tank with a radar hat. Costs more per hour than most people earn per year.', realCost: '~$52 million', mods: ['Longbow Radar Hat', 'Hellfire Bulk Order', 'Monocle Display'] },
  { id: 'a10', name: 'A-10 Thunderbolt II', short: 'Warthog', domain: 'air', branch: 'af', behaviour: 'fly', speed: 18, cap: 6, tags: ['jet', 'attack'],
    desc: 'A gun with a plane attached. Scheduled for retirement every year since 1995.', realCost: '~$19 million', mods: ['GAU-8 Ammunition Subscription', 'Retirement Postponement', 'BRRRT Licensing Fee'] },
  { id: 'f16', name: 'F-16 Fighting Falcon', short: 'Viper', domain: 'air', branch: 'af', behaviour: 'fly', speed: 34, cap: 7, tags: ['jet', 'fighter'],
    desc: 'The everyman fighter. Over 4,600 built, and every one of them on a payment plan.', realCost: '~$63 million', mods: ['Block 52 Update', 'Block 70 Update', 'Conformal Fuel Wallets'] },
  { id: 'abrams', name: 'M1A2 Abrams', short: 'Abrams', domain: 'ground', branch: 'army', behaviour: 'drive', speed: 9, cap: 6, tags: ['vehicle', 'armor', 'tank'],
    desc: 'Powered by a jet engine, which means it gets jet-engine mileage while driving to the grocery store.', realCost: '~$10 million', mods: ['SEPv3 Upgrade', 'Turbine Polish', 'Tank Tread Leasing'] },
  { id: 'himars', name: 'M142 HIMARS', short: 'HIMARS', domain: 'ground', branch: 'army', behaviour: 'drive', speed: 11, cap: 5, tags: ['vehicle', 'artillery', 'missile'],
    desc: 'Rockets on a truck, deeply beloved on the internet. Every rocket is individually invoiced.', realCost: '~$5 million + rockets', mods: ['Extended-Range Pods', 'Meme Royalties', 'Rocket Refill Plan'] },
  { id: 'ch47', name: 'CH-47 Chinook', short: 'Chinook', domain: 'air', branch: 'army', behaviour: 'hover', speed: 10, cap: 5, tags: ['helo', 'transport'],
    desc: 'Two rotors, because one rotor did not spend enough money.', realCost: '~$40 million', mods: ['Block II Rotors', 'Sling Load Surcharge', 'Third Rotor Feasibility Study'] },
  { id: 'f18', name: 'F/A-18E/F Super Hornet', short: 'Super Hornet', domain: 'air', branch: 'navy', behaviour: 'fly', speed: 32, cap: 6, tags: ['jet', 'fighter', 'carrier'],
    desc: 'The Navy fighter that lands on a moving runway and then charges overtime for it.', realCost: '~$67 million', mods: ['Block III Upgrade', 'Tailhook Insurance', 'Buddy Tanker Kit'] },
  { id: 'lcs', name: 'Littoral Combat Ship', short: 'LCS', domain: 'sea', branch: 'navy', behaviour: 'sail', speed: 9, cap: 4, tags: ['ship'],
    desc: 'A modular warship whose modules were mostly delivered as PowerPoint slides.', realCost: '~$480 million', mods: ['Mission Module (Pending)', 'Early Retirement Bonus', 'Rust Prevention Feasibility Study'] },
  { id: 'c130', name: 'C-130 Hercules', short: 'Herc', domain: 'air', branch: 'af', behaviour: 'fly', speed: 18, cap: 5, tags: ['transport', 'prop'],
    desc: 'Has been flying since the 1950s and will outlive us all, at a moderate hourly rate.', realCost: '~$80 million', mods: ['J-Model Props', 'Gunship Conversion', 'Pallet Air-Drop Program'] },
  { id: 'f15ex', name: 'F-15EX Eagle II', short: 'Eagle II', domain: 'air', branch: 'af', behaviour: 'fly', speed: 36, cap: 6, tags: ['jet', 'fighter'],
    desc: 'A 1970s design with a 2020s price tag and a 2050s missile capacity.', realCost: '~$90 million', mods: ['Missile Truck Mode', 'Fly-By-Wire Retrofit', 'Twelve More Pylons'] },
  { id: 'patriot', name: 'Patriot Battery', short: 'Patriot', domain: 'ground', branch: 'army', behaviour: 'static', speed: 0, cap: 4, tags: ['air-defense', 'missile'],
    desc: 'Every missile costs more than the thing it shoots down. That is the point.', realCost: '~$1 billion per battery', mods: ['PAC-3 Interceptors', 'Radar Gift Wrap', 'Interceptor of the Month Club'] },
  { id: 'mv22', name: 'MV-22 Osprey', short: 'Osprey', domain: 'air', branch: 'marines', behaviour: 'hover', speed: 20, cap: 5, tags: ['tiltrotor', 'transport'],
    desc: 'Half helicopter, half airplane, fully over budget.', realCost: '~$90 million', mods: ['Nacelle Wax', 'Tilt Fee', 'Gearbox Concierge'] },
  { id: 'ddg', name: 'Arleigh Burke Destroyer', short: 'Burke', domain: 'sea', branch: 'navy', behaviour: 'sail', speed: 8, cap: 4, tags: ['ship', 'missile'],
    desc: 'Ninety-six missile cells and a very nice wardroom. Production has never stopped and never will.', realCost: '~$2.2 billion', mods: ['Flight III Upgrade', 'SPY-6 Radar', 'VLS Cell Leasing'] },
  { id: 'kc46', name: 'KC-46 Pegasus', short: 'Pegasus', domain: 'air', branch: 'af', behaviour: 'fly', speed: 20, cap: 4, tags: ['tanker', 'support'],
    desc: 'A flying gas station. The boom camera is fixed, according to the latest press release.', realCost: '~$165 million', mods: ['Boom Camera Fix #7', 'Remote Vision 2.0', 'Premium Fuel Upgrade'] },
  { id: 'e7', name: 'E-7 Wedgetail', short: 'Wedgetail', domain: 'air', branch: 'af', behaviour: 'fly', speed: 18, cap: 3, tags: ['awacs', 'support'],
    desc: 'Sees everything for hundreds of miles, except the cost overruns.', realCost: '~$590 million', mods: ['Top-Hat Radar', 'Situational Awareness Package', 'Oversight Blind Spot'] },
  { id: 'f35', name: 'F-35 Lightning II', short: 'Lightning II', domain: 'air', branch: 'af', behaviour: 'fly', speed: 34, cap: 7, tags: ['jet', 'fighter', 'stealth'],
    desc: 'A trillion-dollar program that, against all odds, is also an airplane.', realCost: '~$82 million (+$1.7 trillion sustainment)', mods: ['Block 4 Software', 'TR-3 Hardware', 'Sustainment Lifetime Plan'] },
  { id: 'c17', name: 'C-17 Globemaster III', short: 'Globemaster', domain: 'air', branch: 'af', behaviour: 'fly', speed: 17, cap: 3, tags: ['transport', 'jet'],
    desc: 'Carries an Abrams across the planet so it can idle in a different parking lot.', realCost: '~$340 million', mods: ['Extended Cargo Bay', 'Tank Valet Parking', 'Strategic Airlift Rewards Card'] },
  { id: 'ssn', name: 'Virginia-class Submarine', short: 'Virginia', domain: 'sea', branch: 'navy', behaviour: 'submarine', speed: 7, cap: 3, tags: ['sub', 'nuclear'],
    desc: 'So quiet that nobody has heard the invoice yet.', realCost: '~$4.3 billion', mods: ['Virginia Payload Module', 'Sonar Subscription', 'Periscope Upholstery'] },
  { id: 'thaad', name: 'THAAD Battery', short: 'THAAD', domain: 'ground', branch: 'army', behaviour: 'static', speed: 0, cap: 3, tags: ['air-defense', 'missile'],
    desc: 'Hits a bullet with a bullet, in space, for a fee.', realCost: '~$1.8 billion per battery', mods: ['AN/TPY-2 Radar', 'Hit-to-Kill Bonus', 'Exoatmospheric Surcharge'] },
  { id: 'f22', name: 'F-22 Raptor', short: 'Raptor', domain: 'air', branch: 'af', behaviour: 'fly', speed: 38, cap: 6, tags: ['jet', 'fighter', 'stealth'],
    desc: 'Production stopped at 187, which only made each one feel more special.', realCost: '~$350 million (program cost)', mods: ['Supercruise Package', 'Thrust Vectoring Premium', 'Stealth Coat Re-Spray'] },
  { id: 'b52', name: 'B-52 Stratofortress', short: 'BUFF', domain: 'air', branch: 'af', behaviour: 'fly', speed: 13, cap: 3, tags: ['bomber', 'nuclear'],
    desc: 'First flew in 1952 and is scheduled to retire in the 2050s, when the pilots will be the grandchildren of the original pilots.', realCost: '~$84 million (1962 dollars)', mods: ['Re-Engine Program', 'Heritage Upholstery', 'Centennial Service Plan'] },
  { id: 'lha', name: 'America-class Amphibious Assault Ship', short: 'America', domain: 'sea', branch: 'marines', behaviour: 'sail', speed: 6, cap: 2, tags: ['ship', 'carrier'],
    desc: 'Technically not an aircraft carrier, which is why it only costs as much as one.', realCost: '~$3.4 billion', mods: ['Well Deck Restoration', 'F-35B Hangar Expansion', 'Marine Corps Birthday Ball'] },
  { id: 'b2', name: 'B-2 Spirit', short: 'Spirit', domain: 'air', branch: 'af', behaviour: 'fly', speed: 18, cap: 3, tags: ['bomber', 'stealth', 'nuclear'],
    desc: 'Each one is worth more than its weight in gold. Literally. Somebody checked.', realCost: '~$2.1 billion', mods: ['Climate-Controlled Hangar', 'Radar Absorbent Re-Coat', 'Mission Comfort Toilet'] },
  { id: 'ssbn', name: 'Columbia-class SSBN', short: 'Columbia', domain: 'sea', branch: 'navy', behaviour: 'submarine', speed: 5, cap: 2, tags: ['sub', 'nuclear'],
    desc: 'The most expensive submarine ever built, carrying the most expensive deterrent ever conceived.', realCost: '~$9 billion', mods: ['Electric Drive', 'Life-of-Ship Reactor', 'Deterrence Loyalty Program'] },
  { id: 'sentinel', name: 'LGM-35 Sentinel ICBM', short: 'Sentinel', domain: 'ground', branch: 'af', behaviour: 'silo', speed: 0, cap: 3, tags: ['missile', 'nuclear'],
    desc: 'The program cost went up 81% and the Pentagon decided it was too important to cancel. A modern classic.', realCost: '~$214 million per missile', mods: ['New Silo Carpeting', 'Nunn-McCurdy Waiver', 'Cost Growth Acceleration'] },
  { id: 'b21', name: 'B-21 Raider', short: 'Raider', domain: 'air', branch: 'af', behaviour: 'fly', speed: 19, cap: 3, tags: ['bomber', 'stealth', 'nuclear'],
    desc: 'So secret that even the bill arrives in an unmarked envelope.', realCost: '~$700 million', mods: ['Open Architecture', 'Classified Upgrade', 'Classified Upgrade (Also)'] },
  { id: 'cvn', name: 'Ford-class Aircraft Carrier', short: 'Ford', domain: 'sea', branch: 'navy', behaviour: 'sail', speed: 5, cap: 2, tags: ['ship', 'carrier', 'nuclear'],
    desc: 'A 100,000-ton floating city. Its electromagnetic catapult launches aircraft and budget requests with equal force.', realCost: '~$13 billion', mods: ['EMALS Catapult', 'Advanced Weapons Elevators', 'Flight Deck Mini-Golf'] },
  { id: 'f47', name: 'F-47 NGAD Fighter', short: 'F-47', domain: 'air', branch: 'af', behaviour: 'fly', speed: 44, cap: 5, tags: ['jet', 'fighter', 'stealth'], requires: 'st6',
    desc: 'Sixth-generation. Nobody knows what it looks like. Everybody knows what it costs: yes.', realCost: '~$300 million (estimated, optimistic)', mods: ['Collaborative Combat Wingmen', 'Adaptive Engine', 'Seventh-Generation Preorder'] },
  { id: 'csg', name: 'Carrier Strike Group', short: 'Strike Group', domain: 'sea', branch: 'navy', behaviour: 'sail', speed: 4, cap: 1, tags: ['ship', 'carrier', 'nuclear', 'group'], requires: 'nu5',
    desc: 'A carrier, an air wing, a cruiser, destroyers and a submarine. Projects power across the globe and spending across the fiscal year.', realCost: '~$40 billion + $7 million per day', mods: ['Air Wing Expansion', 'Escort Upgrade', 'Steel Beach Picnic'] },
  { id: 'shield', name: 'Golden Dome Missile Shield', short: 'Golden Dome', domain: 'space', branch: 'space', behaviour: 'orbit', speed: 6, cap: 4, tags: ['space', 'missile'], requires: 'sp3',
    desc: 'A dome of satellites over the entire country, finished in gold at the request of the President. Shoots down missiles, meteors and, eventually, the debt ceiling.', realCost: '~$175 billion (first estimate)', mods: ['Space-Based Interceptors', 'Dome Polish', 'Golden Finish'] },
  { id: 'orbcarrier', name: 'Space Force Orbital Carrier', short: 'Orbital Carrier', domain: 'space', branch: 'space', behaviour: 'orbit', speed: 4, cap: 2, tags: ['space', 'carrier'], requires: 'sp5',
    desc: 'A carrier, but in space. The Navy has filed a formal complaint. The Space Force has filed a larger budget request.', realCost: 'Classified (large)', mods: ['Zero-G Catapult', 'Space Galley', 'Orbital Steel Beach Picnic'] },
  { id: 'lunar', name: 'Lunar Marine Base', short: 'Moon Base', domain: 'space', branch: 'marines', behaviour: 'fixed', speed: 0, cap: 1, tags: ['space', 'base'], requires: 'sp7',
    desc: 'The Marines got there first, as promised. The commissary charges $400 for a moon pie.', realCost: '1 Moon (nominal)', mods: ['Regolith Barracks', 'Moon Pie Logistics', 'Low-Gravity Drill Field'] },
  { id: 'dyson', name: 'Dyson Sphere Defense Contract', short: 'Dyson Sphere', domain: 'space', branch: 'space', behaviour: 'fixed', speed: 0, cap: 1, tags: ['space', 'megastructure'], requires: 'sp8',
    desc: 'Encloses the Sun to protect it from foreign adversaries. Delivery expected in 40,000 years; payments start now.', realCost: 'The entire output of a star', mods: ['Solar Panel Overrun', 'Stellar Sustainment', 'Galactic Cost-Plus Clause'] },
];

/** Tuning parameters for the production curve (see scripts/balance-sim.ts). */
export const CURVE = { cost0: 15, costGrowth: 6.7, costAccel: 1.008, rate0: 0.35, rateGrowth: 4.5 };

function nice(n: number): number {
  if (n < 100) return Math.round(n);
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

export const ASSETS: AssetDef[] = ROWS.map((r, i) => ({
  ...r,
  tier: i,
  baseCost: nice(CURVE.cost0 * CURVE.costGrowth ** i * CURVE.costAccel ** ((i * (i - 1)) / 2)),
  baseRate: nice(CURVE.rate0 * CURVE.rateGrowth ** i * 10) / 10,
}));

export const ASSET_BY_ID: Record<string, AssetDef> = Object.fromEntries(ASSETS.map(a => [a.id, a]));
