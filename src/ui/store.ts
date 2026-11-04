// The right-hand store column: assets, upgrades, research, contractors and the administration (prestige) tab.
import { ASSETS, ASSET_BY_ID, type AssetDef } from '../data/assets';
import { UPGRADES, type UpgradeDef } from '../data/upgrades';
import { RESEARCH, RESEARCH_BRANCHES, RESEARCH_BY_ID } from '../data/research';
import { BRANCHES, CONTRACTORS, LOBBY_BONUS, ORDERS } from '../data/meta';
import * as E from '../core/economy';
import { contractCost, contractReady, signContract } from '../core/events';
import { emit } from '../core/bus';
import { duration, fmt, money } from '../core/format';
import type { GameState } from '../core/state';
import { spriteImg } from '../art/sprite';
import { VARIANT_LABELS } from '../art/palette';
import { $, h, setText, toggle } from './dom';
import { tip, ttRow, hideTip } from './overlay';
import { audio } from '../audio/audio';
import { DISTRICTS, GEO, GEO_BY_ID } from '../data/politics';
import { drawWorld, geoAt } from './worldmap';

export interface StoreCtx {
  s: () => GameState;
  confirmPrestige: () => void;
}

interface Tab { build(): Node; update(): void; signature(): string }

let ctx: StoreCtx;
let current = 'assets';
let built = '';
const tabs: Record<string, Tab> = {};

const fmtM = (n: number) => money(n, ctx.s().settings.shortNumbers);
const DOMAIN_NAME = { air: 'Air', ground: 'Ground', sea: 'Sea', space: 'Space' };
const BRANCH_NAME = Object.fromEntries(BRANCHES.map(b => [b.id, b.name]));

function bought(kind: 'asset' | 'upgrade' | 'research' | 'lobby' | 'order' | 'contract' | 'geo', asset?: AssetDef, id?: string): void {
  emit('purchase', { kind, asset, id });
  built = '';
}

// ---------- Assets ----------

function bulkCount(s: GameState, a: AssetDef): number {
  const b = s.settings.bulk;
  return b === -1 ? Math.max(1, E.maxAffordable(s, a)) : b;
}

function assetTip(a: AssetDef): Node {
  const s = ctx.s();
  const m = E.mods(s);
  const i = a.tier;
  const owned = s.owned[a.id] ?? 0;
  const each = a.baseRate * m.asset[i];
  const share = m.rate > 0 ? (m.rates[i] / m.rate) * 100 : 0;
  const v = E.assetVariant(s, a.id);
  return h('div', {},
    h('h5', {}, a.name),
    h('div.tt-sub', {}, `Tier ${i + 1} · ${BRANCH_NAME[a.branch]} · ${DOMAIN_NAME[a.domain]}`),
    h('div.tt-desc', {}, a.desc),
    ttRow('Each spends', `${fmtM(each)}/s`),
    ttRow('Owned', fmt(owned)),
    owned ? ttRow('Total', `${fmtM(m.rates[i])}/s (${share.toFixed(1)}%)`) : null,
    ttRow('Livery', VARIANT_LABELS[v]),
    ttRow('Real unit cost', a.realCost),
    DISTRICTS[a.id] ? ttRow('Built in', DISTRICTS[a.id]) : null,
    a.requires && !s.research.includes(a.requires) ? h('div.tt-sub', { style: 'margin-top:6px;color:#e0524b' }, `Requires R&D: ${RESEARCH_BY_ID[a.requires].name}`) : null,
  );
}

const assetsTab: Tab = {
  signature() {
    const s = ctx.s();
    return 'assets:' + ASSETS.filter(a => E.isAssetVisible(s, a)).length + ':' + ASSETS.filter(a => E.isAssetUnlocked(s, a)).length;
  },
  build() {
    const s = ctx.s();
    const frag = h('div');
    const seg = h('div.seg');
    for (const [label, val] of [['×1', 1], ['×10', 10], ['×100', 100], ['Max', -1]] as const) {
      seg.append(h('button', { 'data-bulk': val, class: s.settings.bulk === val ? 'on' : '', onclick: () => { s.settings.bulk = val; built = ''; } }, label));
    }
    frag.append(h('div.store-tools', {}, seg, h('span.hint', {}, 'Hover for intelligence briefs')));
    const visible = ASSETS.filter(a => E.isAssetVisible(s, a));
    const next = ASSETS[visible.length];
    for (const a of visible) {
      const row = h('button.asset', { 'data-id': a.id, onclick: () => {
        const st = ctx.s();
        if (!E.isAssetUnlocked(st, a)) { audio.play('error'); return; }
        const n = bulkCount(st, a);
        if (E.buyAsset(st, a, n)) bought('asset', a); else audio.play('error');
      } },
      h('span.ico', {}, spriteImg(a.id, E.assetVariant(s, a.id), 64, 32)),
      h('span', {}, h('div.asset-name', {}, a.name), h('div.asset-cost', {}, '')),
      h('span.asset-owned', {}, ''));
      tip(row, () => assetTip(a));
      frag.append(row);
    }
    if (next) {
      frag.append(h('div.asset.locked.mystery', {}, h('span.ico', {}, spriteImg(next.id, 0, 64, 32)), h('span', {}, h('div.asset-name', {}, 'Classified Program'), h('div.asset-cost', {}, `Clearance at ${fmtM(next.baseCost * 0.5)} lifetime spending`)), h('span.asset-owned', {}, '?')));
    }
    return frag;
  },
  update() {
    const s = ctx.s();
    for (const row of document.querySelectorAll<HTMLElement>('#store-body .asset[data-id]')) {
      const a = ASSET_BY_ID[row.dataset.id!];
      const n = bulkCount(s, a);
      const cost = E.assetCost(s, a, n);
      const locked = !E.isAssetUnlocked(s, a);
      setText(row.querySelector('.asset-cost')!, locked ? `Requires R&D: ${RESEARCH_BY_ID[a.requires!].name}` : `${fmtM(cost)}${n > 1 ? `  (×${n})` : ''}`);
      setText(row.querySelector('.asset-owned')!, fmt(s.owned[a.id] ?? 0));
      toggle(row, 'poor', locked || cost > s.budget);
      toggle(row, 'locked', locked);
      const img = row.querySelector('img')!;
      const v = String(E.assetVariant(s, a.id));
      if (img.dataset.v !== v) {
        const next = spriteImg(a.id, +v, 64, 32);
        next.dataset.v = v;
        img.replaceWith(next);
      }
    }
  },
};

// ---------- Upgrades ----------

function upgradeIcon(u: UpgradeDef): HTMLImageElement {
  const variant = u.kind === 'asset' ? (u.level! >= 5 ? 3 : u.level! >= 3 ? 2 : u.level! >= 1 ? 1 : 0) : 0;
  return spriteImg(u.icon, variant, 48, 48);
}

function upgradeTip(u: UpgradeDef): Node {
  return h('div', {},
    h('h5', {}, u.name),
    h('div.tt-sub', {}, u.kind === 'asset' ? `${ASSET_BY_ID[u.asset!].name} upgrade` : u.kind === 'click' ? 'Pallet upgrade' : 'Doctrine (synergy)'),
    h('div.tt-desc', {}, u.desc),
    ttRow('Cost', fmtM(u.cost)));
}

const upgradesTab: Tab = {
  signature() {
    const s = ctx.s();
    return 'up:' + E.availableUpgrades(s).map(u => u.id).join(',') + '|' + s.upgrades.length;
  },
  build() {
    const s = ctx.s();
    const avail = E.availableUpgrades(s);
    const frag = h('div');
    frag.append(h('div.store-tools', {},
      h('button.btn.small', { onclick: () => {
        const st = ctx.s();
        let n = 0;
        for (const u of E.availableUpgrades(st)) if (u.cost <= st.budget && E.buyUpgrade(st, u)) n++;
        if (n) bought('upgrade'); else audio.play('error');
      } }, 'Buy all affordable'),
      h('span.hint', {}, `${avail.length} available`)));
    const grid = h('div.grid');
    for (const u of avail) {
      const t = h('button.tile', { 'data-id': u.id, class: u.kind === 'click' ? 'click-up' : u.kind === 'synergy' ? 'syn-up' : '', onclick: () => {
        if (E.buyUpgrade(ctx.s(), u)) { hideTip(); bought('upgrade', u.asset ? ASSET_BY_ID[u.asset] : undefined); } else audio.play('error');
      } }, upgradeIcon(u), u.level !== undefined ? h('span.lvl', {}, String(u.level + 1)) : null);
      tip(t, () => upgradeTip(u));
      grid.append(t);
    }
    if (!avail.length) frag.append(h('p.hint', {}, 'No upgrades available. Buy more assets to unlock procurement upgrades.'));
    frag.append(grid);
    if (s.upgrades.length) {
      const done = h('div.grid');
      const have = new Set(s.upgrades);
      for (const u of UPGRADES.filter(x => have.has(x.id))) {
        const t = h('div.tile', { style: 'opacity:.75' }, upgradeIcon(u));
        tip(t, () => upgradeTip(u));
        done.append(t);
      }
      frag.append(h('div.owned-list', {}, h('div.section-title', {}, `Purchased (${s.upgrades.length})`), done));
    }
    return frag;
  },
  update() {
    const s = ctx.s();
    for (const t of document.querySelectorAll<HTMLElement>('#store-body .tile[data-id]')) {
      const u = UPGRADES.find(x => x.id === t.dataset.id)!;
      toggle(t, 'ok', u.cost <= s.budget);
      toggle(t, 'poor', u.cost > s.budget);
    }
  },
};

// ---------- Research ----------

const researchTab: Tab = {
  signature() { return 'rd:' + ctx.s().research.join(','); },
  build() {
    const s = ctx.s();
    const frag = h('div');
    frag.append(h('p.hint', { style: 'margin:0 0 8px' }, 'Black Budget R&D. Projects reset with each New Administration. Some projects unlock new assets.'));
    const tree = h('div.tree');
    for (const b of RESEARCH_BRANCHES) {
      const col = h('div.tree-col', { style: `--c:${b.color}` }, h('div.tree-head', {}, b.name));
      for (const r of RESEARCH.filter(x => x.branch === b.id)) {
        const done = s.research.includes(r.id);
        const node = h('button.node', { 'data-id': r.id, class: done ? 'done' : E.canResearch(s, r) ? 'avail' : 'locked', onclick: () => {
          if (E.buyResearch(ctx.s(), r)) { hideTip(); bought('research'); } else audio.play('error');
        } }, h('span', {}, r.name), h('span.cost', {}, done ? 'Complete' : ''));
        tip(node, () => h('div', {}, h('h5', {}, r.name), h('div.tt-sub', {}, `${b.name} research`), h('div.tt-desc', {}, r.desc), done ? ttRow('Status', 'Complete') : ttRow('Cost', fmtM(E.researchCost(ctx.s(), r))), r.requires.length && !done ? ttRow('Requires', RESEARCH_BY_ID[r.requires[0]].name) : null));
        col.append(node);
      }
      tree.append(col);
    }
    frag.append(tree);
    return frag;
  },
  update() {
    const s = ctx.s();
    for (const n of document.querySelectorAll<HTMLElement>('#store-body .node.avail, #store-body .node.locked')) {
      const r = RESEARCH_BY_ID[n.dataset.id!];
      const cost = E.researchCost(s, r);
      setText(n.querySelector('.cost')!, fmtM(cost));
      toggle(n, 'ok', cost <= s.budget);
      toggle(n, 'poor', cost > s.budget);
    }
  },
};

// ---------- Contractors ----------

const contractorsTab: Tab = {
  signature() { return 'ct'; },
  build() {
    const frag = h('div');
    frag.append(h('p.hint', { style: 'margin:0 0 8px' }, `Lobbying permanently boosts a contractor's product lines by +${LOBBY_BONUS * 100}% per level (this administration). Signing a contract spends 10% of the budget for a temporary boost, with unpredictable overruns.`));
    for (const c of CONTRACTORS) {
      const card = h('div.card', { 'data-id': c.id, style: `--c:${c.color}` },
        h('h4', {}, c.name), h('div.motto', {}, c.motto),
        h('div.tags', {}, ...c.tags.map(t => h('span.tag', {}, t))),
        h('div.meta', {}, h('span.lvl', {}, ''), h('span.bonus', {}, '')),
        h('div.row', {},
          h('button.btn.small.lobby', { onclick: () => { if (E.buyLobby(ctx.s(), c)) bought('lobby'); else audio.play('error'); } }, ''),
          h('button.btn.small.primary.contract', { onclick: () => { const st = ctx.s(); if (contractReady(st, c)) { signContract(st, c); bought('contract'); } else audio.play('error'); } }, '')));
      frag.append(card);
    }
    return frag;
  },
  update() {
    const s = ctx.s();
    for (const card of document.querySelectorAll<HTMLElement>('#store-body .card[data-id]')) {
      const c = CONTRACTORS.find(x => x.id === card.dataset.id)!;
      const lvl = s.lobby[c.id] ?? 0;
      const cost = E.lobbyCost(s, c);
      setText(card.querySelector('.lvl')!, `Lobbying level ${lvl}`);
      setText(card.querySelector('.bonus')!, `+${Math.round(lvl * LOBBY_BONUS * 100)}% output`);
      const lob = card.querySelector<HTMLButtonElement>('.lobby')!;
      setText(lob, `Lobby: ${fmtM(cost)}`);
      lob.disabled = cost > s.budget;
      const con = card.querySelector<HTMLButtonElement>('.contract')!;
      const wait = (s.contractReadyAt[c.id] ?? 0) - s.time;
      setText(con, lvl === 0 ? 'Contract: lobby first' : wait > 0 ? `Next contract in ${duration(wait)}` : `Sign contract: ${fmtM(contractCost(s))}`);
      con.disabled = !contractReady(s, c);
    }
  },
};

// ---------- Administration (prestige) ----------

const ordersTab: Tab = {
  signature() { const s = ctx.s(); return 'eo:' + s.orders.join(',') + ':' + s.prestiges; },
  build() {
    const frag = h('div');
    frag.append(h('div.prestige-box', {},
      h('h3', {}, '★ New Administration ★'),
      h('p', {}, 'Win another election (term limits are under review) and hand over to a new administration to convert lifetime spending into Political Capital. Assets, upgrades, research, lobbying and branch levels reset; medals, executive orders and capital remain.'),
      h('div.prestige-big', { id: 'eo-pending' }, ''),
      h('p', { id: 'eo-info' }, ''),
      h('button.btn.primary', { id: 'eo-go', onclick: () => ctx.confirmPrestige() }, 'Inaugurate New Administration')));
    frag.append(h('div.section-title', {}, 'Executive Orders (permanent)'));
    for (const o of ORDERS) {
      const card = h('div.card', { 'data-id': o.id, style: '--c:#f5d33f' },
        h('h4', {}, o.name), h('div.motto', {}, o.desc),
        h('div.meta', {}, h('span', {}, `Cost: ${fmt(o.cost)} capital`), h('span.st', {}, '')),
        h('div.row', {}, h('button.btn.small.buy', { onclick: () => { if (E.buyOrder(ctx.s(), o.id)) bought('order', undefined, o.id); else audio.play('error'); } }, 'Sign Executive Order')));
      frag.append(card);
    }
    return frag;
  },
  update() {
    const s = ctx.s();
    const pending = E.pendingCapital(s);
    setText($('#eo-pending'), `+${fmt(pending)} Political Capital`);
    setText($('#eo-info'), `Unspent capital: ${fmt(s.capital)} · Earned in total: ${fmt(s.capitalEarned)} · Mandate bonus: ×${E.mandate(s.capitalEarned).toFixed(2)} (×${E.mandate(s.capitalEarned + pending).toFixed(2)} after) · Next point at ${fmtM(E.nextCapitalAt(s))} lifetime.`);
    $<HTMLButtonElement>('#eo-go').disabled = pending < 1;
    for (const card of document.querySelectorAll<HTMLElement>('#store-body .card[data-id]')) {
      const o = ORDERS.find(x => x.id === card.dataset.id)!;
      const have = s.orders.includes(o.id);
      const b = card.querySelector<HTMLButtonElement>('.buy')!;
      b.disabled = have || s.capital < o.cost;
      setText(b, have ? 'In effect' : 'Sign Executive Order');
      setText(card.querySelector('.st')!, have ? 'Signed' : s.capital >= o.cost ? 'Affordable' : '');
    }
  },
};

// ---------- World operations ----------

let worldHot: string | null = null;

const worldTab: Tab = {
  signature() { const s = ctx.s(); return 'geo:' + s.geo.join(',') + ':' + GEO.filter((g, i) => E.isGeoVisible(s, g, i, GEO)).length; },
  build() {
    const s = ctx.s();
    const frag = h('div');
    const canvas = h('canvas.world-map', { id: 'world-map' }) as HTMLCanvasElement;
    const visible = GEO.filter((g, i) => E.isGeoVisible(s, g, i, GEO));
    canvas.addEventListener('mousemove', e => {
      const g = geoAt(canvas, e.clientX, e.clientY, visible);
      worldHot = g?.id ?? null;
      canvas.style.cursor = g ? 'pointer' : 'default';
      for (const c of document.querySelectorAll<HTMLElement>('#store-body .geo-card')) toggle(c, 'hot', c.dataset.id === worldHot);
    });
    canvas.addEventListener('mouseleave', () => { worldHot = null; });
    canvas.addEventListener('click', e => {
      const g = geoAt(canvas, e.clientX, e.clientY, visible);
      if (!g) return;
      const card = document.querySelector<HTMLElement>(`#store-body .geo-card[data-id="${g.id}"]`);
      card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      card?.classList.remove('flash'); void card?.offsetWidth; card?.classList.add('flash');
    });
    frag.append(
      h('div.world-head', {}, h('span', {}, '★ Theatre of Operations ★'), h('span.hint', {}, `${s.geo.length}/${GEO.length} complete`)),
      h('div.world-frame', {}, canvas),
      h('p.hint', { style: 'margin:6px 0 8px' }, 'Foreign policy, conducted entirely through procurement. Each operation is a permanent bonus for this administration and is paid for by the taxpayer. Red rings mark open opportunities; flags mark American soil (new).'));
    for (const g of visible) {
      const done = s.geo.includes(g.id);
      const card = h('div.card.geo-card', { 'data-id': g.id, class: done ? 'done' : '' },
        h('div.geo-top', {}, h('h4', {}, g.name), h('span.geo-place', {}, g.place)),
        h('div.motto', {}, g.desc),
        h('div.meta', {}, h('span.geo-fx', {}, g.effect), h('span.st', {}, '')),
        h('div.row', {}, h('button.btn.small.primary.buy', { onclick: () => {
          if (E.buyGeo(ctx.s(), g)) { hideTip(); bought('geo', undefined, g.id); } else audio.play('error');
        } }, '')));
      card.addEventListener('mouseenter', () => { worldHot = g.id; });
      card.addEventListener('mouseleave', () => { if (worldHot === g.id) worldHot = null; });
      frag.append(card);
    }
    const next = GEO[visible.length];
    if (next) frag.append(h('div.card.geo-card.mystery', {}, h('h4', {}, 'Classified Operation'), h('div.motto', {}, `Intelligence will brief you after ${fmtM(next.cost * 0.02)} in lifetime spending.`)));
    return frag;
  },
  update() {
    const s = ctx.s();
    const canvas = document.getElementById('world-map') as HTMLCanvasElement | null;
    if (canvas) drawWorld(canvas, new Set(s.geo), worldHot, performance.now() / 1000);
    for (const card of document.querySelectorAll<HTMLElement>('#store-body .geo-card[data-id]')) {
      const g = GEO_BY_ID[card.dataset.id!];
      const done = s.geo.includes(g.id);
      const cost = E.geoCost(s, g);
      const b = card.querySelector<HTMLButtonElement>('.buy')!;
      b.disabled = done || cost > s.budget;
      setText(b, done ? 'Mission Accomplished' : `Launch: ${fmtM(cost)}`);
      setText(card.querySelector('.st')!, done ? '★ Complete' : cost <= s.budget ? 'Affordable' : '');
    }
  },
};

Object.assign(tabs, { world: worldTab, assets: assetsTab, upgrades: upgradesTab, research: researchTab, contractors: contractorsTab, orders: ordersTab });

export function initStore(c: StoreCtx): void {
  ctx = c;
  for (const t of document.querySelectorAll<HTMLElement>('#right .tab')) {
    t.addEventListener('click', () => {
      current = t.dataset.tab!;
      built = '';
      for (const x of document.querySelectorAll('#right .tab')) x.classList.toggle('active', x === t);
      $('#store-body').scrollTop = 0;
      audio.play('tick');
    });
  }
}

export function invalidateStore(): void { built = ''; }

export function updateStore(): void {
  const tab = tabs[current];
  const sig = current + '|' + tab.signature();
  if (sig !== built) {
    const body = $('#store-body');
    const scroll = body.scrollTop;
    body.replaceChildren(tab.build());
    body.scrollTop = scroll;
    built = sig;
  }
  tab.update();
  // Badges.
  const s = ctx.s();
  const ups = E.availableUpgrades(s).filter(u => u.cost <= s.budget).length;
  setText($('#badge-upgrades'), ups ? String(ups) : '');
  const rd = RESEARCH.filter(r => E.canResearch(s, r) && E.researchCost(s, r) <= s.budget).length;
  setText($('#badge-research'), rd ? String(rd) : '');
  const p = E.pendingCapital(s);
  const geo = GEO.filter((g, i) => !s.geo.includes(g.id) && E.isGeoVisible(s, g, i, GEO) && E.geoCost(s, g) <= s.budget).length;
  setText($('#badge-world'), geo ? String(geo) : '');
  setText($('#badge-orders'), p >= Math.max(1, s.capitalEarned) ? '!' : '');
}
