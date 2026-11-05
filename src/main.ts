import './ui/styles.css';
import './ui/americana.css';
import { ASSETS } from './data/assets';
import { newState, type GameState } from './core/state';
import { loadLocal, recordHallOfFame, saveLocal, SAVE_KEY, wipeLocal } from './core/save';
import * as E from './core/economy';
import { on } from './core/bus';
import { checkAchievements, openBriefcase, resolveAudit, scheduleBriefcase, updateEvents } from './core/events';
import { fmt, money } from './core/format';
import { Board } from './board/board';
import { audio } from './audio/audio';
import { spriteImg } from './art/sprite';
import { $, h, setText } from './ui/dom';
import { closeModal, flash, floatNumber, flyBills, modalOpen, openModal, refreshTip, toast } from './ui/overlay';
import { initStore, invalidateStore, updateStore } from './ui/store';
import { initPanels, jukebox, showUnitInfo, updatePanels } from './ui/panels';
import { comboClick, inauguration, setReducedMotion, shake, shockwave, titleCard, updateCinema, updateCombo } from './ui/cinema';
import { insigniaURL } from './art/insignia';
import { ORDERS, RANKS, rankIndex } from './data/meta';
import { DEPLOY_POSTS, EVENT_POSTS, GEO_BY_ID } from './data/politics';
import { initPresident, randomPost, say, updatePresident } from './ui/president';
import { showSplash } from './ui/splash';
import { FINALE } from './data/finale';
import { showEnding, verdictFor } from './ui/ending';
import { playFilm } from './ui/film';

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

let state: GameState = loadLocal() ?? newState();
const S = () => state;

// ---------- Persistence ----------

/** Seconds between autosaves. Significant actions also trigger a save on the next simulation step. */
const SAVE_EVERY = 5;
/**
 * Set when another tab has written the save. This tab then stops saving entirely, so that its
 * older state can never overwrite the newer progress made in the other tab.
 */
let dormant = false;
let saveTimer = 0;

function persist(): void {
  if (!dormant) saveLocal(state);
}
/** Schedules a save on the next simulation step (coalesces bursts of purchases into one write). */
function requestSave(): void {
  saveTimer = SAVE_EVERY;
}
E.invalidate();

// ---------- Board ----------

const board = new Board($('#board') as HTMLCanvasElement, S);
board.onUnitClick = a => { audio.play('tick'); showUnitInfo(a); };
board.onBlast = size => { shake(0.12 * size); audio.play('explosion'); };
board.sync();

// ---------- Settings ----------

function applySettings(): void {
  const st = state.settings;
  audio.setVolume(st.music, st.sfx, st.muted);
  $('#mute').classList.toggle('off', st.muted);
  setReducedMotion(st.reducedMotion);
  invalidateStore();
}

// ---------- Panels and store ----------

initPanels({
  s: S,
  applySettings,
  replaceState: next => { state = next; E.invalidate(); board.sync(); invalidateStore(); applySettings(); persist(); closeModal(); },
  wipe: () => { wipeLocal(); state = newState(); E.invalidate(); board.sync(); invalidateStore(); closeModal(); applySettings(); persist(); },
});

initStore({ s: S, confirmPrestige });

// ---------- The President ----------

initPresident(() => {
  audio.start();
  state.stats.potusClicks++;
  audio.play('tick');
  say(randomPost(), pick(['talk', 'point', 'thumbs', 'shout']));
});
on('post', p => { state.stats.posts++; say(p.text, p.pose ?? 'talk'); });

function confirmPrestige(): void {
  const gain = E.pendingCapital(state);
  if (gain < 1) return;
  const close = openModal('Inaugurate New Administration', h('div', {},
    h('div', { style: 'display:grid;place-items:center;margin-bottom:8px' }, spriteImg('potus_point', 0, 132, 132)),
    h('p', {}, `The outgoing administration leaves office with ${money(state.lifetime)} spent in total. The incoming administration receives `, h('b', { style: 'color:#f5d33f' }, `${fmt(gain)} Political Capital`), '.'),
    h('p', {}, 'All assets, upgrades, research, lobbying and branch levels will be reset. Medals, executive orders and political capital remain. The mandate bonus will rise to ',
      h('b', {}, `×${E.mandate(state.capitalEarned + gain).toFixed(2)}`), '.'),
    h('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px' },
      h('button.btn', { onclick: () => close() }, 'Remain in office (for now)'),
      h('button.btn.primary', { onclick: () => { close(); doPrestige(); } }, 'Take the oath (again)'))));
}

function doPrestige(): void {
  const outgoing = money(state.lifetime);
  const gain = E.pendingCapital(state);
  fanfareUntil = performance.now() + 12000;
  inauguration(outgoing, fmt(gain), state.prestiges + 2, () => {
    E.prestige(state);
    deployed.clear();
    scheduleBriefcase(state);
    board.clearFx();
    board.sync();
    invalidateStore();
    persist();
  }, beat => {
    if (beat === 'drum') audio.play('drumroll');
    else if (beat === 'boom') audio.play('explosion');
    else { audio.play('prestige'); flash(); }
  });
  setTimeout(() => say(pick(EVENT_POSTS.prestige), 'point'), 7400);
  setTimeout(() => toast('New Administration Inaugurated', `+${fmt(gain)} Political Capital. Spend it on Executive Orders in the Administration tab.`, 'capitol', 'gold', 9000), 7000);
}

// ---------- The end ----------

/** Records the completion in the Hall of Fame and returns the updated list. */
function recordEnd() {
  const e = state.ended!;
  return recordHallOfFame({ time: e.time, at: e.at, lifetime: e.lifetime, clicks: e.clicks, prestiges: e.prestiges, grade: verdictFor(e.time).grade });
}

/** A fresh universe: everything is reset except the Hall of Fame, which lives in its own key. */
function restartUniverse(): void {
  wipeLocal();
  state = newState();
  persist();
  location.reload();
}

let ending = false;
function endGame(): void {
  if (ending) return;
  ending = true;
  persist();
  const hof = recordEnd();
  closeModal();
  say(FINALE[FINALE.length - 1].post, 'shout', false);
  fanfareUntil = performance.now() + 60000;
  setTimeout(() => {
    audio.setTrack('frenzy');
    playFilm({
      sfx: name => audio.play(name),
      music: track => { if (track) { audio.duck(false); audio.setTrack(track); } else audio.duck(true); },
    }, () => {
      audio.duck(false);
      audio.setTrack('fanfare');
      showEnding(state, hof, restartUniverse);
    }, { reducedMotion: state.settings.reducedMotion });
  }, 1200);
}

// ---------- Pallet ----------

const pallet = $('#pallet');
pallet.addEventListener('pointerdown', e => {
  audio.start();
  const amount = E.click(state);
  audio.play('click');
  pallet.classList.add('squash');
  setTimeout(() => pallet.classList.remove('squash'), 70);
  const frenzy = state.buffs.some(b => b.click);
  floatNumber(e.clientX, e.clientY, `+${money(amount, true)}`, frenzy);
  const c = comboClick();
  shockwave(e.clientX, e.clientY, frenzy);
  shake(frenzy ? 0.12 : 0.03 + Math.min(0.08, c.count / 1500));
  if (c.tier) {
    audio.play('combo');
    shake(0.35);
    shockwave(e.clientX, e.clientY, true);
    const r = pallet.getBoundingClientRect();
    const el = h('div.combo-tier', { style: `left:${r.left + r.width / 2}px;top:${r.top + r.height * 0.3}px` }, `${c.tier.toUpperCase()}!`);
    $('#fx-layer').append(el);
    setTimeout(() => el.remove(), 1450);
    flyBills(e.clientX, e.clientY, 14);
  }
  if (!state.settings.reducedMotion) {
    const boardRect = $('#board').getBoundingClientRect();
    flyBills(e.clientX, e.clientY, frenzy ? 5 : c.count % 3 === 0 ? 2 : 1, innerWidth > 900 ? boardRect : undefined);
    if (innerWidth > 900 && (frenzy || c.count % 4 === 0)) board.burst(0.1 + Math.random() * 0.8, frenzy ? 6 : 2);
  }
});

// ---------- Golden briefcase ----------

function spawnGolden(kind: 'briefcase' | 'toilet'): void {
  const btn = h('button.golden', { 'aria-label': kind === 'toilet' ? 'Gold-plated toilet seat' : 'Lobbyist briefcase' }, h('span.rays'), spriteImg(kind, 0, 64, 64));
  const area = $('#game').getBoundingClientRect();
  btn.style.left = `${area.left + 40 + Math.random() * Math.max(10, area.width - 140)}px`;
  btn.style.top = `${area.top + 40 + Math.random() * Math.max(10, area.height - 140)}px`;
  let done = false;
  const leave = () => { if (done) return; done = true; btn.classList.add('leaving'); setTimeout(() => btn.remove(), 420); };
  btn.addEventListener('click', e => {
    if (done) return;
    audio.start();
    audio.play('goldenOpen');
    openBriefcase(state, kind);
    floatNumber(e.clientX, e.clientY, kind === 'toilet' ? 'TOILET SEAT!' : 'LOBBIED!', true);
    flyBills(e.clientX, e.clientY, 24);
    shockwave(e.clientX, e.clientY, true);
    shake(0.45);
    flash();
    leave();
  });
  document.body.append(btn);
  audio.play('golden');
  setTimeout(leave, 13000 * E.mods(state).eventDur);
}

on('briefcase', ({ kind }) => spawnGolden(kind));

// ---------- Audit mini-game ----------

let auditActive = false;
on('audit', () => {
  if (modalOpen() || auditActive) { state.nextAuditAt = state.time + 60; return; }
  auditActive = true;
  audio.play('audit');
  say(pick(EVENT_POSTS.auditStart), 'shout');
  const need = 10, time = 9;
  let shredded = 0, left = time, finished = false;
  const field = h('div.audit-field');
  const status = h('div.audit-status', {}, h('span.c', {}, `Shredded 0/${need}`), h('span.t', {}, `${time}s`));
  const finish = (ok: boolean) => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    auditActive = false;
    close();
    resolveAudit(state, ok);
    audio.play(ok ? 'achievement' : 'error');
  };
  const spawn = () => {
    if (finished) return;
    const r = h('button.receipt', { style: `left:${5 + Math.random() * 85}%;--fall:${4 + Math.random() * 3}s` }, spriteImg('receipt', 0, 40, 52));
    r.addEventListener('pointerdown', () => {
      r.classList.add('shred');
      audio.play('click');
      shredded++;
      setText(status.querySelector('.c')!, `Shredded ${shredded}/${need}`);
      if (shredded >= need) finish(true);
    });
    r.addEventListener('animationend', ev => { if ((ev as AnimationEvent).animationName === 'receiptFall') r.remove(); });
    field.append(r);
  };
  const close = openModal('Congressional Audit', h('div', {},
    h('p', {}, 'The Government Accountability Office has arrived. Shred the receipts before they reach the bottom of the desk.'),
    status, field), () => finish(false), false);
  let spawnTick = 0;
  const timer = setInterval(() => {
    spawnTick++;
    if (spawnTick % 2 === 0) { left--; setText(status.querySelector('.t')!, `${left}s`); }
    spawn(); if (Math.random() < 0.5) spawn();
    if (left <= 0) finish(shredded >= need);
  }, 500);
  spawn(); spawn();
});

// ---------- Bus reactions ----------

on('toast', t => toast(t.title, t.body, t.icon, t.tone));
on('achievement', a => { requestSave(); toast(`Medal Awarded: ${a.name}`, a.desc, 'emb_army', 'gold'); audio.play('achievement'); });
on('rank', r => {
  const img = new Image();
  img.src = insigniaURL(RANKS[rankIndex(state.lifetime)].insignia);
  titleCard('PROMOTION', r.name.toUpperCase(), 'By order of the Committee on Appropriations', img);
  say(pick(EVENT_POSTS.rank), 'thumbs', false);
  shake(0.3);
  audio.play('rank');
});
on('buff', () => invalidateStore());
on('purchase', p => {
  requestSave();
  const firstOfType = p.kind === 'asset' && p.asset && !deployed.has(p.asset.id);
  board.sync();
  if (firstOfType && p.asset) {
    deployed.add(p.asset.id);
    board.deploy(p.asset);
    audio.play('deploy');
    shake(0.25 + p.asset.tier / 80);
    setTimeout(() => { board.shake(0.5); }, 400);
    say(pick(DEPLOY_POSTS).replaceAll('{name}', p.asset.short), p.asset.tier % 2 ? 'thumbs' : 'point', p.asset.tier >= 3);
  }
  if (p.kind === 'geo' && p.id) {
    const g = GEO_BY_ID[p.id];
    titleCard('★ OPERATION LAUNCHED ★', g.name.toUpperCase(), `${g.place} · ${g.effect}`, 'flag', 3000);
    say(g.post, 'point');
    flash();
    shake(0.5);
    audio.play('deploy');
    board.burst(0.5, 12);
  }
  if (p.kind === 'finale' && p.id) {
    if (state.ended) { endGame(); return; }
    const phase = FINALE[state.finale - 1];
    titleCard(`★ BIG BANG 2 · PHASE ${state.finale} OF ${FINALE.length} FUNDED ★`, phase.name.toUpperCase(), phase.effect, 'dyson', 3200);
    say(phase.post, 'shout');
    flash();
    shake(0.7);
    audio.play('prestige');
    board.burst(0.5, 20);
  }
  if (p.kind === 'order' && p.id) {
    const o = ORDERS.find(x => x.id === p.id);
    titleCard('EXECUTIVE ORDER SIGNED', (o?.name ?? '').toUpperCase(), 'Signed with a very large marker. Effective immediately. Legality pending.', spriteImg('potus_sign', 0, 132, 132), 3000);
    say(pick(EVENT_POSTS.order), 'thumbs');
  }
  const sfx = p.kind === 'research' ? 'research' : p.kind === 'upgrade' || p.kind === 'order' ? 'upgrade' : 'buy';
  audio.play(sfx);
  if (p.kind === 'asset' && p.asset) {
    if (p.asset.domain === 'air' && ['jet', 'bomber', 'fighter'].some(t => p.asset!.tags.includes(t))) audio.play('jet');
    else if (p.asset.tags.includes('tank') || p.asset.tags.includes('artillery') || p.asset.tags.includes('missile')) audio.play('boom');
    else if (p.asset.domain === 'sea') audio.play('horn');
  }
  checkAchievements(state);
});

/** Asset types already introduced with a deployment cinematic this administration. */
const deployed = new Set(ASSETS.filter(a => (state.owned[a.id] ?? 0) > 0).map(a => a.id));

// ---------- Mute, mobile tabs ----------

$('#mute').addEventListener('click', () => {
  audio.start();
  state.settings.muted = !state.settings.muted;
  state.stats.muteToggles++;
  applySettings();
});

for (const b of document.querySelectorAll<HTMLElement>('#mobile-tabs button')) {
  b.addEventListener('click', () => {
    for (const x of document.querySelectorAll('#mobile-tabs button')) x.classList.toggle('active', x === b);
    for (const col of document.querySelectorAll<HTMLElement>('#game > .col')) col.classList.toggle('show', col.dataset.tab === b.dataset.show);
  });
}
$('#left').classList.add('show');

// Start audio on the first interaction anywhere (browsers require a gesture).
window.addEventListener('pointerdown', () => audio.start(), { once: true });
window.addEventListener('keydown', () => audio.start(), { once: true });

// ---------- Music selection ----------

let fanfareUntil = 0;
function chooseMusic(): void {
  if (!audio.started) return;
  const m = E.mods(state);
  audio.intensity = m.rate < 1e3 ? 1 : m.rate < 1e9 ? 2 : 3;
  if (jukebox !== 'auto') { audio.setTrack(jukebox); return; }
  if (performance.now() < fanfareUntil) audio.setTrack('fanfare');
  else if (auditActive) audio.setTrack('warroom');
  else if (state.buffs.some(b => b.good && ((b.rate ?? 1) >= 7 || (b.click ?? 1) >= 50))) audio.setTrack('frenzy');
  else if (state.buffs.some(b => !b.good)) audio.setTrack('warroom');
  else audio.setTrack('march');
}

// ---------- Main loop ----------

const STEP = 1 / 20;
let acc = 0;
let last = performance.now();
let uiTimer = 0;

function frame(now: number): void {
  step(now);
  requestAnimationFrame(frame);
}

// Animation frames stop entirely in hidden tabs; a timer keeps the simulation running there.
setInterval(() => { if (performance.now() - last > 400) step(performance.now()); }, 500);

function step(now: number): void {
  if (dormant || state.ended) return;
  // Clamp very long gaps (background tabs) so the simulation catches up in bounded chunks.
  const dt = Math.min(60, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 2400) {
    const expired = E.tick(state, STEP);
    updateEvents(state, STEP);
    if (expired) invalidateStore();
    acc -= STEP;
    steps++;
  }
  if (steps >= 2400) acc = 0;
  board.update(dt);
  board.draw();
  if (board.takeBoom()) audio.play('boomFar');
  updateCinema(dt);
  updateCombo(dt);
  updatePresident();
  document.body.classList.toggle('frenzy', state.buffs.some(b => b.good && ((b.rate ?? 1) >= 7 || (b.click ?? 1) >= 50)));
  document.body.classList.toggle('alarm', auditActive);
  uiTimer += dt;
  if (uiTimer >= 0.2) {
    uiTimer = 0;
    updatePanels();
    updateStore();
    refreshTip();
    chooseMusic();
    document.title = `${money(state.budget, true)} · Operation Debt Fury`;
  }
  saveTimer += dt;
  if (saveTimer >= SAVE_EVERY) { saveTimer = 0; persist(); }
}

applySettings();
updatePanels();
updateStore();
requestAnimationFrame(frame);

// Save whenever the page may be about to disappear. 'pagehide' is the event mobile browsers fire
// reliably; 'beforeunload' and 'visibilitychange' cover desktop tab closes and tab switches.
window.addEventListener('pagehide', persist);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

// The 'storage' event fires only in tabs other than the writer: another tab now owns the save.
window.addEventListener('storage', e => {
  if (dormant || (e.key !== SAVE_KEY && e.key !== null)) return;
  dormant = true;
  audio.setVolume(0, 0, true);
  openModal('Game Open in Another Tab', h('div', {},
    h('p', {}, 'Progress is being saved by another tab. This tab has been paused so that it cannot overwrite that progress.'),
    h('div', { style: 'display:flex;justify-content:flex-end;margin-top:12px' },
      h('button.btn.primary', { onclick: () => location.reload() }, 'Load latest progress'))), undefined, false);
});

// Claim the save for this tab immediately, so any older tab still open stops saving.
persist();

if (state.ended) {
  // A finished game cannot be continued: show the report until a new universe is started.
  const hof = recordEnd();
  showEnding(state, hof, restartUniverse);
  window.addEventListener('pointerdown', () => { audio.start(); audio.setTrack('fanfare'); }, { once: true });
} else showSplash(!state.clicks && !state.prestiges, () => {
  audio.start();
  audio.play('prestige');
  if (!state.clicks && !state.prestiges) {
    say('My fellow Americans. Congress gave us $15 of YOUR money. Click the cash. Spend it ALL. Then buy a recruit. Then buy EVERYTHING.', 'point');
    setTimeout(() => toast('Orders from the Oval Office', 'Click the pallet of taxpayer cash to spend it, then buy your first Recruit. Every dollar spent is refunded by Congress and spent again.', 'pallet', 'gold', 12000), 400);
  } else {
    say(`Welcome back. You have spent ${money(state.lifetime)} of taxpayer money. Not enough. NEVER enough.`, 'thumbs');
  }
});

// Debug hook for automated checks in development builds.
if (import.meta.env.DEV) (window as unknown as { odf: unknown }).odf = { S, E, ASSETS, board };
