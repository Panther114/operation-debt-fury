// The closing film: about thirty seconds of pixel-art cinema played when Big Bang 2 is funded.
// Scenes: the Oval Office at 2:59 a.m.; the countdown; the universe spent into a singularity;
// silence; the Big Bang 2; a brand-new universe with no debt (briefly); the credits.
// The picture is drawn on a 480 × 270 canvas scaled up without smoothing; text is DOM for crispness.
import { h } from './dom';
import { raster, type Raster } from '../art/sprite';
import { ASSETS } from '../data/assets';
import { money } from '../core/format';

const W = 480, H = 270;
export const FILM_LENGTH = 33.5;

type Beat = 'tick' | 'click' | 'boom' | 'boomFar' | 'explosion' | 'hum' | 'fanfare' | 'rank' | 'drumroll' | 'golden';

interface Thing { r: Raster; a: number; r0: number; spin: number; rot: number; scale: number }
interface Spark { x: number; y: number; vx: number; vy: number; c: string; s: number; bill: boolean }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };

/**
 * Plays the film. `onBeat` receives sound cues; `onDone` runs when the film ends or is skipped.
 * Returns a function that stops the film early.
 */
export function playFilm(onBeat: (b: Beat) => void, onDone: () => void, reducedMotion = false): () => void {
  const cv = h('canvas.film-cv') as HTMLCanvasElement;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const cap = h('div.film-cap');
  const big = h('div.film-big');
  const title = h('div.film-title');
  const debt = h('div.film-debt');
  const credits = h('div.film-credits');
  const bubbles = h('div.film-bubbles');
  const skip = h('button.film-skip', {}, 'Skip ▸▸ (the auditors already have)');
  const stage = h('div.film-stage', {}, cv, bubbles, big, title, debt, credits, cap);
  const root = h('div.film', {}, h('div.film-bar.top'), stage, h('div.film-bar.bottom'), skip);
  document.body.append(root);

  // ---------- Cast and props ----------
  const potus = raster('potus'), potusPoint = raster('potus_point'), potusThumbs = raster('potus_thumbs'), potusShout = raster('potus_shout');
  const taxpayer = raster('taxpayer3'), taxpayerNew = raster('taxpayer0');
  const pallet = raster('pallet'), bill = raster('bill');
  const stars = Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: Math.random() < 0.15 ? 2 : 1, tw: rnd(0, 6) }));
  const ids = ASSETS.map(a => a.id).filter(id => id !== 'csg');
  const things: Thing[] = Array.from({ length: 70 }, (_, i) => {
    const id = i < ids.length ? ids[i] : ['bill', 'bill', 'pallet', 'briefcase', 'toilet', 'receipt', 'capitol', 'eagle'][i % 8];
    return { r: raster(id), a: rnd(0, Math.PI * 2), r0: rnd(70, 330), spin: rnd(0.4, 1.2) * (Math.random() < 0.5 ? -1 : 1), rot: rnd(0, 6), scale: id === 'pallet' ? 0.3 : id === 'capitol' || id === 'eagle' ? 0.4 : 1 };
  });
  const sparks: Spark[] = Array.from({ length: 520 }, (_, i) => {
    const a = rnd(0, Math.PI * 2), v = rnd(20, 260) * (Math.random() < 0.2 ? 1.6 : 1);
    return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: ['#ffffff', '#f5d33f', '#e0524b', '#5c9bd6', '#7fd46a', '#ffb347'][i % 6], s: Math.random() < 0.2 ? 2 : 1, bill: i % 26 === 0 };
  });
  const dust = Array.from({ length: 60 }, () => ({ a: rnd(0, Math.PI * 2), d: rnd(20, 90) }));

  // ---------- Timed DOM cues ----------
  const say = (who: 'potus' | 'aide' | 'taxpayer', text: string, x: number, y: number, ms = 1900) => {
    const b = h('div.film-bubble', { class: `by-${who}`, style: `left:${(x / W) * 100}%;top:${(y / H) * 100}%` }, h('b', {}, who === 'potus' ? 'THE PRESIDENT' : who === 'aide' ? 'AIDE (OFF-SCREEN)' : 'THE TAXPAYER'), h('span', {}, text));
    bubbles.append(b);
    setTimeout(() => b.classList.add('out'), ms);
    setTimeout(() => b.remove(), ms + 400);
  };
  const setCap = (text: string) => { cap.textContent = text; cap.classList.toggle('show', !!text); };
  const setBig = (text: string) => { big.textContent = text; big.classList.remove('pop'); void big.offsetWidth; big.classList.toggle('pop', !!text); };
  const setTitle = (k: string, main: string, sub: string) => {
    title.replaceChildren(h('small', {}, k), h('span', {}, main), h('em', {}, sub));
    title.classList.toggle('show', !!main);
  };
  const CREDITS = [
    'A COST-PLUS PICTURES PRODUCTION', '',
    'BIG BANG 2: THE SEQUEL', '',
    'Directed by', 'THE MILITARY-INDUSTRIAL COMPLEX', '',
    'Produced by', 'CONGRESS (UNREAD)', '',
    'Executive Producer', 'THE PRESIDENT (ALSO STARRING, ALSO CATERING)', '',
    'Financed by', 'YOU', '',
    'Audit Department', '[POSITION ELIMINATED]', '',
    'Seat Coordinator', 'ONE (1) $10,000 TOILET SEAT', '',
    'No taxpayers were consulted in the making of this universe.',
    'Any resemblance to actual budgets is entirely structural.',
  ];
  const cues: [number, () => void][] = [
    [0.2, () => { setCap('THE OVAL OFFICE · 2:59 A.M.'); onBeat('drumroll'); }],
    [1.3, () => say('potus', 'Is this the button for the Diet Coke?', 250, 70)],
    [3.1, () => say('aide', 'No, sir. That one ends the universe.', 60, 40)],
    [4.5, () => { say('potus', 'Even better.', 250, 70, 1100); }],
    [5.2, () => { bubbles.replaceChildren(); setCap(''); setBig('3'); onBeat('tick'); }],
    [6.2, () => { setBig('2'); onBeat('tick'); }],
    [6.9, () => say('taxpayer', 'WAIT! I have questions about the bill!', 20, 150, 1700)],
    [7.2, () => { setBig('1'); onBeat('tick'); }],
    [8.7, () => { setBig('CLICK.'); onBeat('click'); onBeat('explosion'); }],
    [9.4, () => { bubbles.replaceChildren(); setBig(''); setCap('Every dollar in existence is spent at once.'); onBeat('hum'); }],
    [10.5, () => onBeat('boomFar')], [11.6, () => onBeat('boomFar')], [12.6, () => onBeat('boomFar')], [13.4, () => onBeat('boom')], [14.1, () => onBeat('boom')],
    [12.2, () => setCap('The Dyson Sphere, the fleet, the Moon base, the toilet seat: all of it.')],
    [15.2, () => { setCap('Government Accountability Office: "There is nothing left to audit."'); debt.classList.remove('show'); }],
    [17.0, () => { setCap(''); onBeat('explosion'); onBeat('boom'); }],
    [17.6, () => { setTitle('A UNIVERSE-SCALE PROCUREMENT EVENT', 'BIG BANG 2', 'THE SEQUEL · NOW IN 17 DIMENSIONS'); onBeat('fanfare'); }],
    [20.6, () => setTitle('', '', '')],
    [21.4, () => { bubbles.replaceChildren(); setCap('Universe 2. Day one. Population: two.'); debt.classList.add('show', 'zero'); }],
    [23.5, () => { setCap(''); onBeat('golden'); }],
    [23.9, () => { debt.classList.remove('zero'); onBeat('click'); }],
    [24.1, () => say('potus', 'A new universe with ZERO debt. Tremendous. Let\'s fix that.', 120, 120, 1900)],
    [25.3, () => say('taxpayer', 'Oh no.', 360, 120, 1100)],
    [31.4, () => { credits.classList.remove('roll'); setTitle('A COST-PLUS PICTURES PRODUCTION', 'THE END', '(OF THE MONEY)'); onBeat('explosion'); }],
    [26.4, () => { bubbles.replaceChildren(); setCap(''); debt.classList.remove('show'); credits.replaceChildren(...CREDITS.map(l => h('div', { class: l === l.toUpperCase() && l ? 'cr-big' : '' }, l || ' '))); credits.classList.add('roll'); onBeat('rank'); }],
  ];
  cues.sort((a, b) => a[0] - b[0]);
  const debtStart = 21.4;
  const debtGo = 23.9;

  // ---------- Drawing helpers ----------
  const spr = (r: Raster, x: number, y: number, s = 1, flip = false) => {
    if (flip) { ctx.save(); ctx.translate(Math.round(x + r.w * s), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(r.canvas, 0, 0, r.w * s, r.h * s); ctx.restore(); }
    else ctx.drawImage(r.canvas, Math.round(x), Math.round(y), r.w * s, r.h * s);
  };
  const starfield = (t: number, alpha: number, drift = 0) => {
    for (const st of stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + st.tw);
      ctx.fillStyle = `rgba(255,255,255,${alpha * tw})`;
      ctx.fillRect(((st.x - drift * t * st.s * 6) % W + W) % W, st.y, st.s, st.s);
    }
  };
  const flagRect = (x: number, y: number, w: number, hgt: number) => {
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#f2f2f2' : '#c8283a'; ctx.fillRect(x, y + (i * hgt) / 7, w, Math.ceil(hgt / 7)); }
    ctx.fillStyle = '#1f2f6e'; ctx.fillRect(x, y, w * 0.45, hgt * 0.55);
  };

  // Scene 1: the Oval Office at night, with a slow push-in on the button.
  function office(t: number): void {
    const z = 1 + ease(t / 5) * 0.18;
    ctx.save();
    ctx.translate(300, 180); ctx.scale(z, z); ctx.translate(-300, -180);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16224a'); g.addColorStop(1, '#0b1330');
    ctx.fillStyle = g; ctx.fillRect(-40, -40, W + 80, H + 80);
    // Windows with stars, moonlight and gold curtains.
    for (const wx of [70, 330]) {
      ctx.fillStyle = '#050a1c'; ctx.fillRect(wx, 30, 80, 110);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; ctx.fillRect(wx + ((i * 37) % 76) + 2, 34 + ((i * 53) % 100), 1, 1); }
      ctx.fillStyle = '#2a3c84'; ctx.fillRect(wx + 38, 30, 4, 110); ctx.fillRect(wx, 84, 80, 3);
      ctx.fillStyle = '#c99a2e'; ctx.fillRect(wx - 12, 24, 14, 126); ctx.fillRect(wx + 78, 24, 14, 126);
      ctx.fillStyle = '#9a7414'; ctx.fillRect(wx - 12, 24, 3, 126); ctx.fillRect(wx + 89, 24, 3, 126);
    }
    flagRect(176, 40, 34, 22); flagRect(270, 40, 34, 22);
    ctx.fillStyle = '#4a3a1a'; ctx.fillRect(192, 62, 2, 90); ctx.fillRect(286, 62, 2, 90);
    // Carpet with a seal.
    ctx.fillStyle = '#1d2d66'; ctx.fillRect(-40, 205, W + 80, 80);
    ctx.fillStyle = '#c99a2e'; ctx.beginPath(); ctx.ellipse(240, 238, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2d66'; ctx.beginPath(); ctx.ellipse(240, 238, 62, 13, 0, 0, Math.PI * 2); ctx.fill();
    // The President behind the Resolute desk.
    const bob = Math.round(Math.sin(t * 2.2) * 1.5);
    spr(t > 4.4 ? potusThumbs : t > 1.2 ? potusPoint : potus, 196, 74 + bob, 2);
    ctx.fillStyle = '#5a3416'; ctx.fillRect(130, 150, 220, 62);
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(126, 146, 228, 8);
    ctx.fillStyle = '#3e230e'; ctx.fillRect(150, 162, 70, 40); ctx.fillRect(260, 162, 70, 40);
    ctx.fillStyle = '#c99a2e'; ctx.fillRect(232, 172, 16, 16);
    // The button, glowing.
    const glow = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,60,60,${0.25 + glow * 0.3})`; ctx.beginPath(); ctx.arc(306, 142, 13 + glow * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(296, 140, 20, 6);
    ctx.fillStyle = '#d42020'; ctx.beginPath(); ctx.arc(306, 140, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ff8080'; ctx.fillRect(302, 135, 3, 2);
    // A diet cola, for the joke.
    ctx.fillStyle = '#cfd4dc'; ctx.fillRect(160, 136, 6, 10); ctx.fillStyle = '#e0524b'; ctx.fillRect(160, 139, 6, 3);
    ctx.restore();
  }

  // Scene 2: close-up countdown, with a finger descending in three steps.
  function countdown(t: number): void {
    const lt = t - 5;
    const alarm = 0.5 + 0.5 * Math.sin(lt * 9);
    ctx.fillStyle = `rgb(${30 + alarm * 50}, 6, 12)`; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,40,40,${0.05 + alarm * 0.06})`; ctx.fillRect(0, i * 24 + ((lt * 40) % 24), W, 10); }
    // Desk and the button, large.
    ctx.fillStyle = '#5a3416'; ctx.fillRect(0, 196, W, 74); ctx.fillStyle = '#7a4a22'; ctx.fillRect(0, 190, W, 8);
    const pressed = lt > 3.7;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(170, 168, 140, 26); ctx.fillStyle = '#444'; ctx.fillRect(170, 168, 140, 5);
    ctx.fillStyle = '#c99a2e'; ctx.font = '8px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.fillText('DO NOT PRESS (UNLESS FUNDED)', 240, 186);
    ctx.fillStyle = '#d42020'; ctx.beginPath(); ctx.ellipse(240, 168, 52, pressed ? 14 : 34, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ff6a6a'; ctx.fillRect(214, pressed ? 158 : 144, 14, 5);
    // The finger: three steps down, then the press.
    const steps = lt < 1 ? 0 : lt < 2.2 ? 1 : lt < 3.4 ? 2 : 3;
    const fy = pressed ? 126 : -40 + steps * 42 + Math.sin(lt * 14) * 1.5;
    ctx.fillStyle = '#1d2d66'; ctx.fillRect(222, fy - 120, 44, 92);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(222, fy - 34, 44, 8);
    ctx.fillStyle = '#f0b48a'; ctx.fillRect(228, fy - 26, 32, 26); ctx.fillRect(236, fy, 14, 20);
    ctx.fillStyle = '#d99470'; ctx.fillRect(236, fy + 16, 14, 4); ctx.fillRect(228, fy - 10, 32, 2);
    ctx.fillStyle = '#f5d33f'; ctx.fillRect(250, fy - 22, 6, 4);
    // The taxpayer runs in from the left, too late.
    if (lt > 1.8) {
      const tx = -70 + Math.min(1, (lt - 1.8) / 1.2) * 90;
      spr(taxpayer, tx, 120 + Math.abs(Math.sin(lt * 16)) * -6, 2);
    }
    if (pressed) {
      const f = clamp(1 - (lt - 3.7) / 0.5);
      ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(0, 0, W, H);
    }
  }

  // Scene 3: everything spirals into a singularity.
  function collapse(t: number): void {
    const p = clamp((t - 9) / 6);
    ctx.fillStyle = '#03050d'; ctx.fillRect(0, 0, W, H);
    starfield(t, 1 - p * 0.8);
    const cx = W / 2, cy = H / 2;
    // Earth, shrinking and reddening as the budget leaves it.
    const er = 34 * (1 - ease(p * 1.3));
    if (er > 0.5) {
      ctx.fillStyle = '#2d5fb3'; ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a8a3a';
      for (let i = 0; i < 5; i++) { const a = t * 0.6 + i * 1.3; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * er * 0.5, cy + Math.sin(a * 1.7) * er * 0.4, er * 0.3, 0, Math.PI * 2); ctx.fill(); }
    }
    // Accretion disc and event horizon.
    const hr = 4 + ease(p) * 26;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.32);
    for (let i = 0; i < 90; i++) {
      const a = i / 90 * Math.PI * 2 + t * (2 + p * 6);
      const rr = hr * (1.6 + (i % 5) * 0.25);
      ctx.fillStyle = ['#f5d33f', '#ffb347', '#e0524b', '#ffffff'][i % 4];
      ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 2, 2);
    }
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(245,211,63,${0.4 + 0.3 * Math.sin(t * 10)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, hr + 1, 0, Math.PI * 2); ctx.stroke();
    // The fleet, the bills and the furniture, spiralling in.
    for (const th of things) {
      const k = Math.pow(1 - p, 1.4);
      const rr = th.r0 * k;
      if (rr < hr * 0.8) continue;
      const a = th.a + th.spin * (t - 9) * (1 + p * 7);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6;
      const s = th.scale * (0.4 + 0.6 * clamp(rr / 120));
      ctx.save(); ctx.translate(x, y); ctx.rotate(th.rot + (t - 9) * th.spin * 2);
      ctx.drawImage(th.r.canvas, -th.r.w * s / 2, -th.r.h * s / 2, th.r.w * s, th.r.h * s);
      ctx.restore();
    }
    if (t > 14.4) { ctx.fillStyle = `rgba(0,0,0,${clamp((t - 14.4) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
  }

  // Scene 4: silence and a single point of light.
  function silence(t: number): void {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const k = 0.5 + 0.5 * Math.sin(t * 8);
    const r = t > 16.4 ? 1 + (t - 16.4) * 4 : 1;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + k * 0.5})`; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.fill();
  }

  // Scene 5: the Big Bang 2.
  function bang(t: number): void {
    const lt = t - 17;
    ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 40 + lt * 120);
    neb.addColorStop(0, `rgba(255,240,200,${clamp(1 - lt / 3)})`); neb.addColorStop(0.4, 'rgba(200,80,160,0.35)'); neb.addColorStop(1, 'rgba(20,10,60,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const rr = (lt - i * 0.25) * 260;
      if (rr <= 0) continue;
      ctx.strokeStyle = `rgba(255,255,255,${clamp(0.8 - rr / 500)})`; ctx.lineWidth = 3 - i * 0.5;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, rr, 0, Math.PI * 2); ctx.stroke();
    }
    const d = Math.pow(lt, 0.75);
    for (const sp of sparks) {
      const x = W / 2 + sp.vx * d, y = H / 2 + sp.vy * d * 0.8;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      if (sp.bill) spr(bill, x, y, 1); else { ctx.fillStyle = sp.c; ctx.fillRect(x, y, sp.s, sp.s); }
    }
    const flash = clamp(1 - lt / 0.7);
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
    if (t > 20.6) { ctx.fillStyle = `rgba(5,3,15,${clamp((t - 20.6) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
  }

  // Scene 6: Universe 2, day one.
  function newUniverse(t: number): void {
    const lt = t - 21.2;
    ctx.fillStyle = '#070b22'; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(360, 70, 10, 360, 70, 220);
    neb.addColorStop(0, 'rgba(140,90,220,0.35)'); neb.addColorStop(1, 'rgba(10,10,40,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    starfield(t, clamp(lt / 1.2), 0.4);
    // A pristine new planet with no military-industrial complex (yet).
    const pr = 46;
    ctx.fillStyle = '#2f73c9'; ctx.beginPath(); ctx.arc(390, 210, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6fbf4a';
    ctx.beginPath(); ctx.arc(372, 196, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(408, 222, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(360, 178, 22, 3); ctx.fillRect(398, 236, 16, 2);
    // A tiny flag is planted the moment the President lands.
    if (lt > 2.6) { ctx.fillStyle = '#4a3a1a'; ctx.fillRect(388, 156, 1, 10); flagRect(389, 156, 9, 6); }
    // The taxpayer, reassembled from stardust.
    const form = clamp((lt - 1.2) / 1.4);
    for (const dd of dust) {
      const r = dd.d * (1 - form);
      ctx.fillStyle = `rgba(245,211,63,${1 - form * 0.6})`;
      ctx.fillRect(330 + Math.cos(dd.a + lt) * r, 120 + Math.sin(dd.a + lt) * r, 1, 1);
    }
    if (form > 0) { ctx.globalAlpha = form; spr(lt > 4 ? taxpayer : taxpayerNew, 300, 92, 2); ctx.globalAlpha = 1; }
    // The President arrives on a pallet of cash.
    const px = -110 + ease((lt - 1.2) / 1.6) * 230;
    const py = 112 + Math.sin(t * 5) * 3;
    if (lt > 1.2) {
      spr(pallet, px + 8, py + 60, 0.5);
      spr(lt > 2.7 ? potusShout : potusPoint, px, py - 10, 1.6);
      if (lt > 2.7 && lt < 3.4) { ctx.fillStyle = '#7fd46a'; ctx.font = '10px Silkscreen, monospace'; ctx.textAlign = 'left'; ctx.fillText('+$0.01', px + 70, py - 12 - (lt - 2.7) * 20); }
    }
    if (t > 25.9) { ctx.fillStyle = `rgba(0,0,0,${clamp((t - 25.9) / 0.5)})`; ctx.fillRect(0, 0, W, H); }
  }

  // Scene 7: credits over a drifting starfield.
  function creditsScene(t: number): void {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    starfield(t, 0.6, 1.5);
    spr(potusThumbs, 14, 196 + Math.sin(t * 2) * 2, 1);
  }

  // ---------- Main loop ----------
  const t0 = performance.now();
  let next = 0, done = false, raf = 0;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('out');
    setTimeout(() => root.remove(), 700);
    onDone();
  };
  skip.addEventListener('click', finish);
  const frame = (now: number) => {
    if (done) return;
    const t = (now - t0) / 1000;
    while (next < cues.length && cues[next][0] <= t) cues[next++][1]();
    if (t < 5) office(t);
    else if (t < 9) countdown(t);
    else if (t < 15) collapse(t);
    else if (t < 17) silence(t);
    else if (t < 21.2) bang(t);
    else if (t < 26.4) newUniverse(t);
    else creditsScene(t);
    // The debt clock: frozen at zero, then off to the races.
    if (t >= debtStart && t < 26.4) {
      const v = t < debtGo ? 0 : 0.01 * 10 ** Math.min(40, (t - debtGo) * 14);
      debt.textContent = `UNIVERSE 2 NATIONAL DEBT: ${v ? money(v) : '$0.00'}`;
    }
    // Camera shake during the collapse and the bang.
    const shakeAmt = reducedMotion ? 0 : t > 9 && t < 15 ? clamp((t - 9) / 6) * 7 : t > 17 && t < 18.5 ? (18.5 - t) * 9 : t > 8.7 && t < 9.2 ? 6 : 0;
    stage.style.transform = shakeAmt ? `translate(${rnd(-shakeAmt, shakeAmt).toFixed(1)}px, ${rnd(-shakeAmt, shakeAmt).toFixed(1)}px)` : '';
    if (t >= FILM_LENGTH) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // Animation frames stop in hidden tabs; make sure the film still ends.
  const guard = setInterval(() => { if (done) clearInterval(guard); else if ((performance.now() - t0) / 1000 > FILM_LENGTH + 2) { clearInterval(guard); finish(); } }, 1000);
  return finish;
}
