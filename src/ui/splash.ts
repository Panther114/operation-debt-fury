// The title screen: stars, stripes, an eagle, the President at the podium and one instruction.
import { spriteImg } from '../art/sprite';
import { $, h } from './dom';

export function showSplash(firstTime: boolean, onStart: () => void): void {
  const root = $('#splash');
  const fireworks = h('div.fw-layer');
  const title = 'OPERATION DEBT FURY';
  let n = 0;
  const letters = title.split(' ').flatMap((word, w) => [w ? ' ' : '', h('span.sp-word', {}, ...[...word].map(c => h('span.sp-letter', { style: `--i:${n++}` }, c)))]);
  const stars = h('div.sp-stars');
  for (let i = 0; i < 60; i++) stars.append(h('i', { style: `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--d:${(Math.random() * 3).toFixed(2)}s` }));
  const go = h('button.sp-go', {}, firstTime ? '★ BEGIN SPENDING ★' : '★ RESUME SPENDING ★');
  root.replaceChildren(h('div.sp', {},
    h('div.sp-flag'), stars,
    h('div.sp-inner', {},
      h('div.sp-eagle', {}, spriteImg('eagle', 0, 208, 128)),
      h('div.sp-kicker', {}, 'THE UNITED STATES DEPARTMENT OF WAR PRESENTS'),
      h('h1.sp-title', {}, ...letters),
      h('div.sp-tag', {}, h('span', {}, 'SPEND THE TAXPAYER’S MONEY')),
      h('div.sp-stage', {},
        h('div.sp-cash.l', {}, spriteImg('pallet', 0, 128, 128)),
        h('div.sp-potus', {}, spriteImg('potus_point', 0, 176, 176), spriteImg('podium', 0, 176, 120)),
        h('div.sp-cash.r', {}, spriteImg('pallet', 0, 128, 128))),
      go,
      h('div.sp-fine', {}, 'A work of satire. Paid for by the taxpayer. Not approved by the taxpayer. The taxpayer was not asked.')),
    fireworks));
  root.classList.add('show');
  let i = 0;
  const burst = () => {
    if (!root.classList.contains('show')) return;
    const fw = h('div.fw', { style: `left:${8 + Math.random() * 84}%;top:${6 + Math.random() * 40}%;--c:${['#ff4655', '#ffffff', '#5c9bd6', '#f5d33f'][i++ % 4]}` });
    for (let k = 0; k < 16; k++) fw.append(h('i', { style: `--a:${(k / 16) * 360}deg` }));
    fireworks.append(fw);
    setTimeout(() => fw.remove(), 1400);
    setTimeout(burst, 500 + Math.random() * 700);
  };
  setTimeout(burst, 1400);
  let done = false;
  const start = () => {
    if (done) return;
    done = true;
    root.classList.add('out');
    window.removeEventListener('keydown', key);
    setTimeout(() => { root.classList.remove('show', 'out'); root.replaceChildren(); }, 700);
    onStart();
  };
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') start(); };
  go.addEventListener('click', start);
  window.addEventListener('keydown', key);
}
