// Left column, top bar, news ticker and the modal screens.
import { ASSETS, type AssetDef } from '../data/assets';
import { ACHIEVEMENTS } from '../data/achievements';
import { BRANCHES, BRANCH_BONUS_PER_LEVEL, RANKS, branchLevel, branchXpFor, rankIndex } from '../data/meta';
import { HEADLINES } from '../data/headlines';
import { JUKEBOX } from '../audio/tracks';
import * as E from '../core/economy';
import { duration, fmt, money } from '../core/format';
import type { GameState } from '../core/state';
import { decode, encode } from '../core/save';
import { spriteImg } from '../art/sprite';
import { insigniaURL, ribbonURL } from '../art/insignia';
import { VARIANT_LABELS } from '../art/palette';
import { $, h, setText } from './dom';
import { openModal, tip, ttRow, toast } from './overlay';
import { audio } from '../audio/audio';
import { BASE_DEBT, DEBT_DRIFT, DISTRICTS, OPPORTUNITY, TAXPAYERS, TAXPAYER_MOODS, taxpayerMood } from '../data/politics';

export interface PanelCtx {
  s: () => GameState;
  replaceState: (s: GameState) => void;
  wipe: () => void;
  applySettings: () => void;
}

let ctx: PanelCtx;
const fmtM = (n: number) => money(n, ctx.s().settings.shortNumbers);

// ---------- Left column ----------

export function initPanels(c: PanelCtx): void {
  ctx = c;
  $('#pallet').append(spriteImg('pallet', 0, 192, 192));
  $('#brand-eagle').append(spriteImg('eagle', 0, 52, 32));
  for (const m of TAXPAYER_MOODS) spriteImg(m.sprite, 0, 78, 96);
  const branches = $('#branches');
  for (const b of BRANCHES) {
    const row = h('div.branch', { 'data-id': b.id },
      spriteImg(b.emblem, 0, 20, 20),
      h('div', {}, h('div.branch-name', {}, b.name), h('div.bar', { style: `--c:${b.color}` }, h('i', { style: 'width:0%' }))),
      h('span.branch-lvl', {}, 'Lv 0'));
    tip(row, () => {
      const s = ctx.s();
      const xp = s.branchXp[b.id];
      const lvl = branchLevel(xp);
      return h('div', {}, h('h5', {}, b.name), h('div.tt-desc', {}, `Spending by ${b.name} assets earns branch experience. Each level adds +${BRANCH_BONUS_PER_LEVEL * 100}% to ${b.name} output.`),
        ttRow('Level', String(lvl)), ttRow('Branch spending', fmtM(xp)), ttRow('Next level at', fmtM(branchXpFor(lvl + 1))));
    });
    branches.append(row);
  }
  tip($('#rank'), () => {
    const s = ctx.s();
    const i = rankIndex(s.lifetime);
    const next = RANKS[i + 1];
    return h('div', {}, h('h5', {}, RANKS[i].name), h('div.tt-desc', {}, 'Rank is earned from lifetime spending across all administrations.'), next ? ttRow('Next rank', next.name) : null, next ? ttRow('Required', fmtM(next.at)) : null);
  });
  initTicker();
  for (const b of document.querySelectorAll<HTMLElement>('[data-modal]')) {
    b.addEventListener('click', () => {
      audio.play('tick');
      ({ medals: showMedals, stats: showStats, settings: showSettings } as Record<string, () => void>)[b.dataset.modal!]();
    });
  }
}

let lastRank = -1;

export function updatePanels(): void {
  const s = ctx.s();
  const m = E.mods(s);
  setText($('#budget'), money(s.budget));
  setText($('#rate'), `${fmtM(m.rate + m.autoClick * m.clickPower)}/s`);
  setText($('#spent'), fmtM(s.spent));
  setText($('#clickpow'), fmtM(m.clickPower));
  $('#pallet').classList.toggle('frenzy', s.buffs.some(b => b.click));
  // Rank.
  const r = rankIndex(s.lifetime);
  if (r !== lastRank) {
    lastRank = r;
    const img = new Image();
    img.src = insigniaURL(RANKS[r].insignia);
    $('#rank').replaceChildren(img, h('span', {}, RANKS[r].name));
  }
  // Buffs.
  const buffs = $('#buffs');
  const sig = s.buffs.map(b => b.id).join(',');
  if (buffs.dataset.sig !== sig) {
    buffs.dataset.sig = sig;
    buffs.replaceChildren(...s.buffs.map(b => h('div.buff', { class: b.good ? 'good' : 'bad', 'data-id': b.id },
      h('span', {}, b.label), h('span.t', {}, ''), h('i.buff-bar'))));
  }
  for (const el of buffs.children) {
    const b = s.buffs.find(x => x.id === (el as HTMLElement).dataset.id);
    if (!b) continue;
    const left = Math.max(0, b.until - s.time);
    const fx = b.rate ? `×${fmt(b.rate)}` : b.click ? `click ×${fmt(b.click)}` : '';
    setText(el.querySelector('.t')!, `${fx} ${Math.ceil(left)}s`);
    (el.querySelector('.buff-bar') as HTMLElement).style.width = `${(left / b.duration) * 100}%`;
  }
  // Branches.
  for (const row of document.querySelectorAll<HTMLElement>('#branches .branch')) {
    const xp = s.branchXp[row.dataset.id as keyof GameState['branchXp']];
    const lvl = branchLevel(xp);
    const lo = branchXpFor(lvl), hi = branchXpFor(lvl + 1);
    const p = lvl === 0 ? xp / 1000 : (Math.log(Math.max(xp, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    (row.querySelector('.bar > i') as HTMLElement).style.width = `${Math.min(100, p * 100)}%`;
    setText(row.querySelector('.branch-lvl')!, `Lv ${lvl}`);
  }
  // Debt clock and the taxpayer.
  const perTax = s.lifetime / TAXPAYERS;
  const debt = BASE_DEBT + s.time * DEBT_DRIFT + s.lifetime;
  setText($('#debt'), debt < 1e15 ? '$' + Math.floor(debt).toLocaleString('en-US') : money(debt));
  setText($('#per-taxpayer'), money(perTax));
  const mood = taxpayerMood(perTax);
  const art = $('#taxpayer-art');
  if (art.dataset.sprite !== mood.sprite) {
    art.dataset.sprite = mood.sprite;
    art.replaceChildren(spriteImg(mood.sprite, 0, 78, 96));
    art.classList.remove('sob'); void art.offsetWidth; art.classList.add('sob');
  }
  setText($('#taxpayer-mood'), mood.mood);
  setText($('#taxpayer-note'), mood.note);
  const idx = TAXPAYER_MOODS.indexOf(mood);
  const nextAt = TAXPAYER_MOODS[idx + 1]?.at;
  ($('#taxpayer-bar') as HTMLElement).style.width = nextAt ? `${Math.min(100, (Math.log10(1 + perTax * 100) / Math.log10(1 + nextAt * 100)) * 100)}%` : '100%';
  const slot = Math.floor(performance.now() / 6000);
  const opp = $('#opportunity');
  if (opp.dataset.slot !== String(slot) && s.lifetime > 0) {
    opp.dataset.slot = String(slot);
    const affordable = OPPORTUNITY.filter(([, c]) => s.lifetime / c >= 1);
    const [label, cost] = affordable.length ? affordable[slot % affordable.length] : OPPORTUNITY[0];
    opp.textContent = `${fmt(Math.floor(s.lifetime / cost))} ${label}`;
    opp.classList.remove('roll'); void opp.offsetWidth; opp.classList.add('roll');
  } else if (!s.lifetime) setText(opp, 'nothing yet. Start spending.');
  // Board HUD.
  const total = ASSETS.reduce((t, a) => t + (s.owned[a.id] ?? 0), 0);
  setText($('#hud-units'), total ? `${fmt(total)} assets deployed` : '');
  setText($('#hud-capital'), s.capitalEarned ? `Mandate ×${E.mandate(s.capitalEarned).toFixed(2)} · Morale +${s.achievements.length}%` : s.achievements.length ? `Morale +${s.achievements.length}%` : '');
}

// ---------- Ticker ----------

function initTicker(): void {
  const el = $('#ticker-text');
  const next = () => {
    const s = ctx.s();
    const top = ASSETS.reduce((t, a) => ((s.owned[a.id] ?? 0) > 0 ? a.tier : t), 0);
    const pool = HEADLINES.filter(([tier]) => tier <= top);
    // Prefer headlines about recently unlocked tiers.
    const fresh = pool.filter(([tier]) => tier >= top - 2);
    const src = Math.random() < 0.4 && fresh.length ? fresh : pool;
    const pick = src[Math.floor(Math.random() * src.length)];
    el.textContent = pick[1];
    el.classList.remove('run');
    void el.offsetWidth;
    const width = el.scrollWidth + el.parentElement!.clientWidth;
    el.style.setProperty('--dur', `${Math.max(8, width / 90)}s`);
    el.classList.add('run');
  };
  el.addEventListener('animationend', next);
  $('#ticker').addEventListener('click', () => { ctx.s().stats.tickerClicks++; next(); });
  next();
}

// ---------- Modals ----------

export function showUnitInfo(a: AssetDef): void {
  const s = ctx.s();
  const m = E.mods(s);
  const v = E.assetVariant(s, a.id);
  const owned = s.owned[a.id] ?? 0;
  const body = h('div', {},
    h('div', { style: 'display:grid;place-items:center;padding:16px;background:#0d1013;border-radius:4px;margin-bottom:12px' }, spriteImg(a.id, v, 360, 120)),
    h('p', { style: 'font-style:italic;color:#c5ced6' }, a.desc),
    h('table.stats-table', {}, ...[
      ['Owned', fmt(owned)],
      ['Livery', VARIANT_LABELS[v]],
      ['Spending per unit', `${fmtM(a.baseRate * m.asset[a.tier])}/s`],
      ['Total spending', `${fmtM(m.rates[a.tier])}/s`],
      ['Share of all spending', m.rate ? `${((m.rates[a.tier] / m.rate) * 100).toFixed(2)}%` : '0%'],
      ['Next unit cost', fmtM(E.assetCost(s, a))],
      ['Real-world unit cost', a.realCost],
      ['Congressional district', DISTRICTS[a.id] ?? 'Classified'],
    ].map(([k, val]) => h('tr', {}, h('td', {}, k), h('td', {}, val)))));
  openModal(a.name, body);
}

function showMedals(): void {
  const s = ctx.s();
  const have = new Set(s.achievements);
  const grid = h('div.medals');
  for (const a of ACHIEVEMENTS) {
    const earned = have.has(a.id);
    const img = new Image();
    img.src = ribbonURL(a.id, earned);
    img.className = 'sprite';
    grid.append(h('div.medal', { class: earned ? '' : 'no' }, img, h('div', {}, h('b', {}, earned || !a.secret ? a.name : 'Classified'), h('span', {}, earned || !a.secret ? a.desc : 'Secret medal.'))));
  }
  openModal(`Medals (${s.achievements.length}/${ACHIEVEMENTS.length})`, h('div', {}, h('p.hint', {}, `Each medal raises morale: +1% to all spending. Current bonus: +${s.achievements.length}%.`), grid));
}

function showStats(): void {
  const s = ctx.s();
  const m = E.mods(s);
  const rows: [string, string][] = [
    ['Lifetime spending', money(s.lifetime)],
    ['Spent this administration', money(s.spent)],
    ['Current spending rate', `${money(m.rate)}/s`],
    ['Best spending rate', `${money(s.stats.bestRate)}/s`],
    ['Pallet clicks', fmt(s.clicks)],
    ['Spent by clicking', money(s.clickSpent)],
    ['Assets owned', fmt(ASSETS.reduce((t, a) => t + (s.owned[a.id] ?? 0), 0))],
    ['Upgrades purchased', fmt(s.upgrades.length)],
    ['Research completed', fmt(s.research.length)],
    ['Administrations', fmt(s.prestiges + 1)],
    ['Political capital (earned / unspent)', `${fmt(s.capitalEarned)} / ${fmt(s.capital)}`],
    ['Global multiplier', `×${fmt(m.global)}`],
    ['Briefcases opened', fmt(s.stats.briefcases)],
    ['Toilet seats procured', fmt(s.stats.toilets)],
    ['Audits (survived / failed)', `${s.stats.audits - s.stats.auditsFailed} / ${s.stats.auditsFailed}`],
    ['Contracts signed', fmt(s.stats.contracts)],
    ['War games', fmt(s.stats.wargames)],
    ['World operations launched', fmt(s.stats.geoOps)],
    ['Presidential posts', fmt(s.stats.posts)],
    ['Bill per taxpayer (lifetime)', money(s.lifetime / TAXPAYERS)],
    ['Time this administration', duration(s.runTime)],
    ['Total play time', duration(s.time)],
  ];
  openModal('Statistics', h('table.stats-table', {}, ...rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))));
}

function showSettings(): void {
  const s = ctx.s();
  const set = s.settings;
  const range = (val: number, on: (v: number) => void) => h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: val, oninput: (e: Event) => { on(Number((e.target as HTMLInputElement).value)); ctx.applySettings(); } });
  const check = (val: boolean, on: (v: boolean) => void) => h('input', { type: 'checkbox', checked: val, onchange: (e: Event) => { on((e.target as HTMLInputElement).checked); ctx.applySettings(); } });
  const juke = h('select', { onchange: (e: Event) => { jukebox = (e.target as HTMLSelectElement).value; } }, ...JUKEBOX.map(t => h('option', { value: t.id, selected: t.id === jukebox }, t.name)));
  const area = h('textarea.save', { readonly: true }) as HTMLTextAreaElement;
  area.value = encode(s);
  const body = h('div', {},
    h('div.form-row', {}, h('label', {}, 'Music volume'), range(set.music, v => { set.music = v; })),
    h('div.form-row', {}, h('label', {}, 'Effects volume'), range(set.sfx, v => { set.sfx = v; })),
    h('div.form-row', {}, h('label', {}, 'Jukebox'), juke),
    h('div.form-row', {}, h('label', {}, 'Always show board labels'), check(set.labels, v => { set.labels = v; })),
    h('div.form-row', {}, h('label', {}, 'Short numbers'), check(set.shortNumbers, v => { set.shortNumbers = v; })),
    h('div.form-row', {}, h('label', {}, 'Reduced motion'), check(set.reducedMotion, v => { set.reducedMotion = v; })),
    h('div.section-title', { style: 'margin-top:14px' }, 'Save Data'),
    h('p.hint', {}, 'The game saves automatically every 30 seconds in this browser. Copy the code below to back up a save or move it to another browser.'),
    area,
    h('div.row', { style: 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap' },
      h('button.btn.small', { onclick: () => { area.select(); void navigator.clipboard?.writeText(area.value); toast('Save Copied', 'The save code is on the clipboard.', 'receipt', 'good'); } }, 'Copy save code'),
      h('button.btn.small', { onclick: () => importSave() }, 'Import save code'),
      h('button.btn.small.danger', { onclick: () => {
        if (confirm('Erase all progress, including medals and executive orders? This cannot be undone.')) ctx.wipe();
      } }, 'Wipe save')),
    h('p.hint', { style: 'margin-top:14px' }, 'All art, music and text are original. Unit costs are approximate public figures, shown for satire.'));
  openModal('Settings', body);
}

function importSave(): void {
  const text = prompt('Paste a save code:');
  if (!text) return;
  try {
    ctx.replaceState(decode(text));
    toast('Save Imported', 'Welcome back, Commander.', 'receipt', 'good');
  } catch {
    toast('Import Failed', 'That code is not a valid Operation Debt Fury save.', 'audit', 'bad');
  }
}

/** Selected jukebox track ('auto' lets the game choose). */
export let jukebox = 'auto';
