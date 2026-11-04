// Tooltip, toasts, modal dialogs and visual effects.
import { $, h } from './dom';
import { spriteImg } from '../art/sprite';

// ---------- Tooltip ----------

let ttSource: HTMLElement | null = null;
let ttBuild: (() => Node) | null = null;

/** Attaches a tooltip whose content is rebuilt on every hover (so numbers stay live). */
export function tip(el: HTMLElement, build: () => Node): void {
  el.addEventListener('mouseenter', e => { ttSource = el; ttBuild = build; showTip(e as MouseEvent); });
  el.addEventListener('mousemove', e => positionTip(e as MouseEvent));
  el.addEventListener('mouseleave', () => hideTip());
}

function showTip(e: MouseEvent): void {
  const tt = $('#tooltip');
  tt.replaceChildren(ttBuild!());
  tt.classList.add('show');
  positionTip(e);
}

function positionTip(e: MouseEvent): void {
  const tt = $('#tooltip');
  const r = tt.getBoundingClientRect();
  let x = e.clientX + 16, y = e.clientY + 12;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 16;
  if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8;
  tt.style.left = Math.max(8, x) + 'px';
  tt.style.top = Math.max(8, y) + 'px';
}

export function hideTip(): void {
  ttSource = null;
  $('#tooltip').classList.remove('show');
}

/** Refreshes an open tooltip's contents (called by the UI refresh loop). */
export function refreshTip(): void {
  if (!ttSource || !ttBuild) return;
  if (!document.body.contains(ttSource)) { hideTip(); return; }
  $('#tooltip').replaceChildren(ttBuild());
}

export function ttRow(label: string, value: string): HTMLElement {
  return h('div.tt-row', {}, h('span', {}, label), h('b', {}, value));
}

// ---------- Toasts ----------

export function toast(title: string, body = '', icon = '', tone = 'info', ms = 6500): void {
  const box = $('#toasts');
  const el = h('div.toast', { class: tone }, icon ? spriteImg(icon, 0, 32, 32) : h('span'), h('div', {}, h('b', {}, title), body ? h('span', {}, body) : null));
  el.addEventListener('click', () => dismiss());
  box.prepend(el);
  while (box.children.length > 5) box.lastElementChild!.remove();
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  setTimeout(dismiss, ms);
}

// ---------- Modals ----------

let modalClose: (() => void) | null = null;

export function openModal(title: string, body: Node, onClose?: () => void, closable = true): () => void {
  closeModal();
  const back = h('div.modal-back');
  const close = () => { back.remove(); modalClose = null; onClose?.(); };
  const modal = h('div.modal', {},
    h('div.modal-head', {}, h('h2', {}, title), closable ? h('button.btn.small', { onclick: close }, 'Close') : null),
    h('div.modal-body', {}, body));
  back.append(modal);
  if (closable) back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  $('#modal-root').append(back);
  modalClose = close;
  return close;
}

export function closeModal(): void {
  modalClose?.();
}

export function modalOpen(): boolean {
  return !!modalClose;
}

// ---------- Effects ----------

export function floatNumber(x: number, y: number, text: string, gold = false): void {
  const el = h('div.float-num', { class: gold ? 'gold' : '', style: `left:${x - 20}px;top:${y - 20}px` }, text);
  $('#fx-layer').append(el);
  setTimeout(() => el.remove(), 950);
}

export function flyBills(x: number, y: number, count: number, toward?: DOMRect): void {
  const layer = $('#fx-layer');
  for (let i = 0; i < count; i++) {
    const img = spriteImg('bill', 0, 24, 12, 'fly-bill');
    const tx = toward ? toward.left + toward.width * (0.2 + Math.random() * 0.6) - x : (Math.random() - 0.5) * 220;
    const ty = toward ? toward.top + toward.height * (0.3 + Math.random() * 0.4) - y : -80 - Math.random() * 120;
    img.style.cssText = `left:${x - 12}px;top:${y - 6}px;--dx:${tx}px;--dy:${ty}px;--rot:${(Math.random() - 0.5) * 720}deg;animation-duration:${700 + Math.random() * 500}ms`;
    layer.append(img);
    setTimeout(() => img.remove(), 1300);
  }
}

export function flash(): void {
  const el = h('div.screen-flash');
  document.body.append(el);
  setTimeout(() => el.remove(), 650);
}
