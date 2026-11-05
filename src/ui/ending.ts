// The end of the game: the Big Bang 2 cinematic and the Final Audit Report, with playthrough time,
// statistics and the Hall of Fame. The game cannot be continued; the only way forward is a new universe.
import { $, h } from './dom';
import { spriteImg } from '../art/sprite';
import { duration, fmt, money } from '../core/format';
import type { GameState } from '../core/state';
import type { HofEntry } from '../core/save';
import { ACHIEVEMENTS } from '../data/achievements';
import { EPILOGUE, VERDICTS } from '../data/finale';
import { GEO, OPPORTUNITY, TAXPAYERS } from '../data/politics';
import { RANKS, rankIndex } from '../data/meta';

export function verdictFor(time: number): { grade: string; text: string } {
  const v = VERDICTS.find(([limit]) => time < limit) ?? VERDICTS[VERDICTS.length - 1];
  return { grade: v[1], text: v[2] };
}

/** Shows the Final Audit Report. It covers the whole game and offers only a fresh start. */
export function showEnding(s: GameState, hof: HofEntry[], onRestart: () => void, onBack?: () => void): void {
  const end = s.ended!;
  const v = verdictFor(end.time);
  const place = hof.findIndex(e => e.at === end.at);
  const universe = Math.max(1, hof.length);
  const stats: [string, string][] = [
    ['Total spent', money(end.lifetime)],
    ['Bill per taxpayer', money(end.lifetime / TAXPAYERS)],
    ['Final rank', RANKS[rankIndex(end.lifetime)].name],
    ['Pallet clicks', fmt(end.clicks)],
    ['Assets procured', fmt(s.stats.bought)],
    ['Administrations served', fmt(end.prestiges + 1)],
    ['Medals awarded', `${end.achievements} / ${ACHIEVEMENTS.length}`],
    ['World operations launched', `${fmt(s.stats.geoOps)} (map of ${GEO.length})`],
    ['Lobbyist briefcases accepted', fmt(s.stats.briefcases)],
    ['$10,000 toilet seats', fmt(s.stats.toilets)],
    ['Audits failed', `${fmt(s.stats.auditsFailed)} of ${fmt(s.stats.audits)}`],
    ['Contracts signed', fmt(s.stats.contracts)],
    ['Peak spending rate', `${money(end.bestRate)}/s`],
  ];
  const opp = [...OPPORTUNITY].sort(() => Math.random() - 0.5).slice(0, 3)
    .map(([label, cost]) => h('li', {}, h('b', {}, fmt(Math.floor(end.lifetime / cost))), ` ${label}`));
  const best = hof.slice(0, 5).map((e, i) => h('tr', { class: e.at === end.at ? 'me' : '' },
    h('td', {}, `#${i + 1}`), h('td', {}, duration(e.time)), h('td', {}, e.grade), h('td', {}, `${e.prestiges + 1} admin.`),
    h('td', {}, new Date(e.at).toLocaleDateString())));
  const go = h('button.sp-go.end-go', {}, '★ BEGIN A NEW UNIVERSE ★');
  const root = h('div.end', {},
    h('div.end-flag'),
    h('div.end-inner', {},
      h('div.end-kicker', {}, `UNIVERSE #${universe} · DECOMMISSIONED`),
      h('h1.end-title', {}, 'FINAL AUDIT REPORT'),
      h('div.end-sub', {}, 'Government Accountability Office · Case closed (there is nothing left to audit)'),
      h('div.end-hero', {},
        h('div.end-time', {}, h('span', {}, 'PLAYTHROUGH TIME'), h('b', {}, duration(end.time))),
        h('div.end-grade', { class: `g-${v.grade}` }, h('span', {}, 'GRADE'), h('b', {}, v.grade))),
      h('p.end-verdict', {}, v.text),
      place === 0 && hof.length > 1 ? h('div.end-record', {}, '★ NEW RECORD: FASTEST UNIVERSE EVER SPENT ★') : null,
      h('div.end-cols', {},
        h('div.end-col', {},
          h('div.section-title', {}, 'Playthrough Statistics'),
          h('table.stats-table', {}, ...stats.map(([k, val]) => h('tr', {}, h('td', {}, k), h('td', {}, val))))),
        h('div.end-col', {},
          h('div.section-title', {}, 'Opportunity Cost'),
          h('p.hint', {}, 'Instead, the same money could have bought:'),
          h('ul.end-opp', {}, ...opp),
          h('div.section-title', {}, 'Epilogue'),
          h('ul.end-epi', {}, ...EPILOGUE.map(line => h('li', {}, line))),
          h('div.section-title', {}, 'Hall of Fame (Fastest Universes)'),
          h('table.stats-table.end-hof', {}, ...best))),
      h('div.end-potus', {}, spriteImg('potus_thumbs', 0, 96, 96),
        h('div.end-quote', {}, '"Great universe. Beautiful universe. We spent all of it. Now we get a new one, and the new one has NO DEBT. Incredible. Let\'s go!"')),
      h('div.end-actions', {},
        onBack ? h('button.film-btn', { onclick: onBack }, '◂ RETURN TO TITLE') : null,
        go),
      h('div.sp-fine', {}, 'Progress, medals and political capital are reset. Only the Hall of Fame survives the singularity.')));
  const host = $('#splash');
  host.replaceChildren(root);
  host.classList.remove('out');
  host.classList.add('show', 'ending');
  // Two-step confirmation: the first click arms the button, the second starts the new universe.
  let armed = false;
  go.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      go.textContent = '★ CONFIRM: RESET EVERYTHING (EXCEPT THE HALL OF FAME) ★';
      setTimeout(() => { armed = false; go.textContent = '★ BEGIN A NEW UNIVERSE ★'; }, 4000);
      return;
    }
    onRestart();
  });
}
