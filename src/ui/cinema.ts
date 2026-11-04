// Screen-level cinematics: camera shake, shockwaves, click combos, title cards and the inauguration sequence.
import { $, h } from './dom';
import { spriteImg } from '../art/sprite';

let trauma = 0;
let reduced = false;

export function setReducedMotion(on: boolean): void { reduced = on; }

/** Adds screen trauma (0-1). The app shakes by trauma squared and recovers over about a second. */
export function shake(amount: number): void {
  if (!reduced) trauma = Math.min(1, trauma + amount);
}

export function updateCinema(dt: number): void {
  const app = $('#app');
  if (trauma <= 0) { if (app.style.transform) app.style.transform = ''; return; }
  trauma = Math.max(0, trauma - dt * 1.4);
  const k = trauma * trauma;
  const x = (Math.random() - 0.5) * 22 * k, y = (Math.random() - 0.5) * 22 * k, r = (Math.random() - 0.5) * 1.6 * k;
  app.style.transform = trauma > 0 ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)` : '';
}

export function shockwave(x: number, y: number, big = false): void {
  if (reduced) return;
  const el = h('div.shock', { class: big ? 'big' : '', style: `left:${x}px;top:${y}px` });
  $('#fx-layer').append(el);
  setTimeout(() => el.remove(), 700);
}

// ---------- Click combo ----------

let combo = 0;
let comboTimer = 0;
const COMBO_TIERS: [number, string][] = [[10, 'Spree'], [25, 'Rampage'], [50, 'Shopping Frenzy'], [100, 'Fiscal Meltdown'], [200, 'Trillion-Dollar Fingers'], [400, 'Unauditable']];

/** Registers a click; returns a combo tier label when one is reached. */
export function comboClick(): { count: number; tier?: string } {
  combo++;
  comboTimer = 1.3;
  const el = $('#combo');
  el.textContent = `COMBO ×${combo}`;
  el.style.setProperty('--s', String(Math.min(2.2, 1 + combo / 120)));
  el.classList.add('show');
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  el.classList.toggle('hot', combo >= 50);
  const tier = COMBO_TIERS.find(([n]) => n === combo);
  return { count: combo, tier: tier?.[1] };
}

export function updateCombo(dt: number): void {
  if (comboTimer <= 0) return;
  comboTimer -= dt;
  if (comboTimer <= 0) {
    combo = 0;
    $('#combo').classList.remove('show', 'hot');
  }
}

// ---------- Title cards ----------

/** A large centred title card with letterbox bars, used for promotions and big moments. */
export function titleCard(kicker: string, title: string, sub: string, icon?: HTMLImageElement | string, ms = 2600): void {
  document.querySelectorAll('.title-card').forEach(el => el.remove());
  const img = typeof icon === 'string' ? spriteImg(icon, 0, 96, 96) : icon;
  const el = h('div.title-card', {},
    h('div.tc-bar.top'), h('div.tc-bar.bottom'),
    h('div.tc-body', {}, img ? h('div.tc-icon', {}, img) : null, h('div.tc-kicker', {}, kicker), h('div.tc-title', {}, title), sub ? h('div.tc-sub', {}, sub) : null));
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 500);
}

// ---------- Inauguration sequence ----------

/**
 * Plays the New Administration cinematic. `reset` is invoked at the darkest moment so the
 * board is already empty when the curtain rises.
 */
export function inauguration(outgoingSpent: string, gain: string, term: number, reset: () => void, onBeat: (beat: 'drum' | 'boom' | 'fanfare') => void): void {
  const fireworks = h('div.fw-layer');
  const ord = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? 'th');
  const stage = h('div.inaug', {},
    h('div.inaug-stripes'),
    h('div.inaug-line.l1', {}, 'THE OUTGOING ADMINISTRATION SPENT'),
    h('div.inaug-num', {}, outgoingSpent),
    h('div.inaug-capitol', {}, spriteImg('capitol', 0, 240, 200),
      h('div.inaug-potus', {}, spriteImg('potus_point', 0, 176, 176), spriteImg('podium', 0, 176, 120))),
    h('div.inaug-line.l2', {}, `THE ${ord(term).toUpperCase()} TERM BEGINS`),
    h('div.inaug-sub', {}, 'Constitutional scholars have been asked to look the other way.'),
    h('div.inaug-gain', {}, `+${gain} POLITICAL CAPITAL`),
    fireworks);
  document.body.append(stage);
  onBeat('drum');
  setTimeout(() => { stage.classList.add('b2'); onBeat('boom'); shake(0.6); }, 1800);
  setTimeout(() => { reset(); stage.classList.add('b3'); onBeat('fanfare'); }, 2600);
  const burst = (i: number) => {
    const x = 15 + Math.random() * 70, y = 10 + Math.random() * 40;
    const hue = ['#f5d33f', '#e0524b', '#5c9bd6', '#7fd46a', '#ffffff'][i % 5];
    const fw = h('div.fw', { style: `left:${x}%;top:${y}%;--c:${hue}` });
    for (let k = 0; k < 16; k++) fw.append(h('i', { style: `--a:${(k / 16) * 360}deg` }));
    fireworks.append(fw);
    setTimeout(() => fw.remove(), 1400);
    if (i % 2 === 0) onBeat('boom');
  };
  for (let i = 0; i < 12; i++) setTimeout(() => burst(i), 2800 + i * 260);
  setTimeout(() => stage.classList.add('out'), 6400);
  setTimeout(() => stage.remove(), 7200);
}

// ---------- Golden rays ----------

export function goldenRays(): HTMLElement {
  return h('span.rays');
}
