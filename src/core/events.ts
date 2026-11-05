import { ASSETS, type Domain } from '../data/assets';
import { CONTRACT_COOLDOWN, CONTRACTORS, type ContractorDef } from '../data/meta';
import { ACHIEVEMENTS } from '../data/achievements';
import { RANKS, rankIndex } from '../data/meta';
import { emit } from './bus';
import { invalidate, mods, recordSpend } from './economy';
import { money } from './format';
import type { Buff, GameState } from './state';
import { EVENT_POSTS, POST_EVENTS } from '../data/politics';

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function addBuff(s: GameState, b: Omit<Buff, 'until' | 'duration'> & { duration: number }): void {
  const dur = b.good ? b.duration * mods(s).eventDur : b.duration;
  s.buffs = s.buffs.filter(x => x.id !== b.id);
  s.buffs.push({ ...b, duration: dur, until: s.time + dur });
  invalidate();
  emit('buff', undefined);
}

// ---------- Golden briefcases ----------

export function scheduleBriefcase(s: GameState): void {
  s.nextBriefcaseAt = s.time + rand(90, 180) / mods(s).eventFreq;
}

export function openBriefcase(s: GameState, kind: 'briefcase' | 'toilet'): void {
  const m = mods(s);
  if (kind === 'toilet') {
    const amt = Math.max(1e4, m.rate * 120);
    s.stats.toilets++;
    recordSpend(s, amt);
    emit('post', { text: pick(EVENT_POSTS.toilet), pose: 'thumbs' });
    emit('toast', { title: '$10,000 Toilet Seat Acquired', body: `Procured one (1) gold-plated toilet seat for ${money(amt)}. Morale is through the roof.`, icon: 'toilet', tone: 'gold' });
    return;
  }
  s.stats.briefcases++;
  emit('post', { text: pick(EVENT_POSTS.briefcase), pose: 'thumbs' });
  const r = Math.random();
  if (r < 0.42) {
    addBuff(s, { id: 'supplemental', label: 'Emergency Supplemental', rate: 5, duration: 60, good: true });
    emit('toast', { title: 'Emergency Supplemental', body: 'Congress passed it at 3 a.m. without reading it. All spending ×5 for 60 seconds.', icon: 'briefcase', tone: 'gold' });
  } else if (r < 0.72) {
    const amt = Math.min(s.budget * 0.15, m.rate * 900) + 13;
    s.budget += amt;
    emit('toast', { title: 'Lobbyist Windfall', body: `A briefcase containing ${money(amt)} was left on your desk. Nobody knows who left it.`, icon: 'briefcase', tone: 'gold' });
  } else if (r < 0.88) {
    addBuff(s, { id: 'earmark', label: 'Earmark Frenzy', click: 77, duration: 13, good: true });
    emit('toast', { title: 'Earmark Frenzy', body: 'Every click is now an earmark. Click power ×77 for 13 seconds. Go, go, go!', icon: 'briefcase', tone: 'gold' });
  } else {
    const domains = [...new Set(ASSETS.filter(a => s.owned[a.id]).map(a => a.domain))];
    const d = domains[Math.floor(Math.random() * domains.length)] ?? 'ground';
    addBuff(s, { id: 'porkbarrel', label: `Pork Barrel: ${DOMAIN_LABEL[d]}`, rate: 10, domain: d, duration: 40, good: true });
    emit('toast', { title: 'Pork Barrel Bonanza', body: `A key committee chair has a factory in their district. ${DOMAIN_LABEL[d]} spending ×10 for 40 seconds.`, icon: 'capitol', tone: 'gold' });
  }
}

export const DOMAIN_LABEL: Record<Domain, string> = { air: 'Air', ground: 'Ground', sea: 'Sea', space: 'Space' };

// ---------- Audits ----------

export function resolveAudit(s: GameState, success: boolean): void {
  s.stats.audits++;
  if (success || mods(s).auditImmune) {
    addBuff(s, { id: 'audit', label: 'Audit Inconclusive', rate: 2, duration: 60, good: true });
    emit('post', { text: pick(EVENT_POSTS.auditWin), pose: 'thumbs' });
    emit('toast', { title: 'Audit Inconclusive', body: 'The auditors could not locate a single receipt. Spending ×2 for 60 seconds in celebration.', icon: 'audit', tone: 'good' });
  } else {
    s.stats.auditsFailed++;
    addBuff(s, { id: 'audit', label: 'Findings Published', rate: 0.5, duration: 30, good: false });
    emit('post', { text: pick(EVENT_POSTS.auditLose), pose: 'shout' });
    emit('toast', { title: 'Audit Failed (Again)', body: 'The Pentagon has failed its audit for another consecutive year. Spending ×0.5 for 30 seconds while everyone pretends to care.', icon: 'audit', tone: 'bad' });
  }
}

// ---------- War games ----------

const WARGAMES: Record<Domain, string[]> = {
  air: ['Exercise Red Flag', 'Exercise Cope Thunder', 'Operation Budget Thunder'],
  ground: ['Exercise Defender', 'National Training Center Rotation', 'Operation Expensive Mud'],
  sea: ['RIMPAC', 'Exercise Valiant Shield', 'Operation Floating Invoice'],
  space: ['Space Flag', 'Exercise Orbital Overrun', 'Operation Zero-G Receipt'],
};

function startWargame(s: GameState): void {
  const domains = [...new Set(ASSETS.filter(a => s.owned[a.id]).map(a => a.domain))];
  if (!domains.length) return;
  const d = domains[Math.floor(Math.random() * domains.length)];
  const names = WARGAMES[d];
  const name = names[Math.floor(Math.random() * names.length)];
  s.stats.wargames++;
  addBuff(s, { id: 'wargame', label: name, rate: 3, domain: d, duration: 45, good: true });
  emit('toast', { title: `War Game: ${name}`, body: `${DOMAIN_LABEL[d]} assets burn fuel, ammunition and money ×3 for 45 seconds.`, icon: 'emb_army', tone: 'info' });
}

// ---------- Contracts ----------

export function contractReady(s: GameState, c: ContractorDef): boolean {
  return (s.lobby[c.id] ?? 0) > 0 && (s.contractReadyAt[c.id] ?? 0) <= s.time;
}

export function contractCost(s: GameState): number {
  return s.budget * 0.1;
}

export function signContract(s: GameState, c: ContractorDef): void {
  if (!contractReady(s, c)) return;
  const cost = contractCost(s);
  s.budget -= cost;
  recordSpend(s, cost);
  s.stats.contracts++;
  s.contractReadyAt[c.id] = s.time + CONTRACT_COOLDOWN;
  const r = Math.random();
  let mult = 2, dur = 60, body: string;
  if (r < 0.4) {
    const extra = s.budget * 0.1;
    s.budget -= extra;
    recordSpend(s, extra);
    body = `Cost overrun of ${money(extra)}. Excellent: that also counts as spending.`;
  } else if (r < 0.65) {
    dur = 30;
    body = 'Schedule slip: deliveries cut short. Boost lasts 30 seconds.';
  } else if (r < 0.9) {
    mult = 3;
    body = 'Scope creep: the contract now includes everything. Boost raised to ×3.';
  } else {
    mult = 5;
    s.stats.underBudget++;
    body = 'Delivered on time and under budget. Investigators have been notified. Boost raised to ×5.';
  }
  addBuff(s, { id: `contract_${c.id}`, label: c.name, rate: mult, tags: c.tags, duration: dur, good: true });
  emit('toast', { title: `Contract Signed: ${c.name}`, body, icon: 'capitol', tone: 'good' });
}

// ---------- Presidential posts ----------

export function presidentialEvent(s: GameState): void {
  const e = pick(POST_EVENTS);
  s.stats.posts++;
  addBuff(s, { id: e.id, label: e.title, rate: e.buff.rate, click: e.buff.click, cost: e.buff.cost, domain: e.buff.domain, duration: e.buff.duration, good: true });
  emit('post', { text: e.post, pose: e.buff.click ? 'shout' : 'point', title: e.title });
  emit('toast', { title: `Presidential Post: ${e.title}`, body: e.body, icon: 'potus_talk', tone: 'gold' });
}

// ---------- Scheduler and achievements ----------

let achieveTimer = 0;
let lastRank = -1;

export function updateEvents(s: GameState, dt: number): void {
  if (s.time >= s.nextBriefcaseAt) {
    scheduleBriefcase(s);
    emit('briefcase', { kind: Math.random() < 0.08 ? 'toilet' : 'briefcase' });
  }
  if (s.time >= s.nextAuditAt) {
    s.nextAuditAt = s.time + rand(360, 600);
    if (s.lifetime > 1e6) emit('audit', undefined);
  }
  if (s.time >= s.nextWargameAt) {
    s.nextWargameAt = s.time + rand(280, 460);
    startWargame(s);
  }
  if (s.time >= s.nextPostAt) {
    s.nextPostAt = s.time + rand(150, 270) / mods(s).eventFreq;
    if (s.lifetime > 500) presidentialEvent(s);
  }
  achieveTimer += dt;
  if (achieveTimer >= 0.5) {
    achieveTimer = 0;
    checkAchievements(s);
  }
}

export function checkAchievements(s: GameState): void {
  const m = mods(s);
  const have = new Set(s.achievements);
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || !a.check(s, m)) continue;
    s.achievements.push(a.id);
    invalidate();
    emit('achievement', { id: a.id, name: a.name, desc: a.desc });
  }
  const r = rankIndex(s.lifetime);
  if (lastRank >= 0 && r > lastRank) emit('rank', { name: RANKS[r].name });
  lastRank = r;
}

export { CONTRACTORS };
