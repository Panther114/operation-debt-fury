// Procedurally drawn pixel insignia (rank) and medal ribbons (achievements).
import type { Insignia } from '../data/meta';

const GOLD = '#f5d33f', GOLD_D = '#9a7414', SILVER = '#d7dde3', SILVER_D = '#7f8a94';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  const px = [[0, -3], [0, -2], [-1, -1], [0, -1], [1, -1], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [-1, 2], [1, 2], [2, 2], [-2, 3], [2, 3]];
  ctx.fillStyle = color;
  for (const [x, y] of px) ctx.fillRect(cx + x, cy + y, 1, 1);
}

/** Rank insignia as a 24x18 pixel canvas data URL. */
export function insigniaURL(ins: Insignia): string {
  const [c, ctx] = canvas(24, 18);
  switch (ins.kind) {
    case 'chevron': {
      if (ins.n === 0) { ctx.fillStyle = SILVER_D; ctx.fillRect(9, 6, 6, 4); break; }
      const n = Math.min(ins.n, 3), gap = ins.n > 3 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const y = (ins.n > 3 ? 0 : 2) + i * gap;
        for (let x = 0; x < 9; x++) {
          ctx.fillStyle = GOLD; ctx.fillRect(3 + x, y + 8 - x, 2, 2); ctx.fillRect(19 - x, y + 8 - x, 2, 2);
          ctx.fillStyle = GOLD_D; ctx.fillRect(3 + x, y + 10 - x, 2, 1); ctx.fillRect(19 - x, y + 10 - x, 2, 1);
        }
      }
      ctx.fillStyle = GOLD;
      for (let i = 0; i < ins.n - 3; i++) ctx.fillRect(5, 13 + i * 2, 14, 1);
      break;
    }
    case 'bar':
      for (let i = 0; i < ins.n; i++) {
        const x = ins.n === 1 ? 9 : 5 + i * 9;
        ctx.fillStyle = ins.n === 1 && i === 0 ? GOLD : SILVER;
        ctx.fillRect(x, 2, 5, 12);
        ctx.fillStyle = ins.n === 1 ? GOLD_D : SILVER_D;
        ctx.fillRect(x + 4, 2, 1, 12);
      }
      break;
    case 'leaf':
      ctx.fillStyle = GOLD;
      for (let y = 0; y < 12; y++) { const w = Math.round(6 * Math.sin((y / 11) * Math.PI)) + 1; ctx.fillRect(12 - w, 2 + y, w * 2, 1); }
      ctx.fillStyle = GOLD_D; ctx.fillRect(11, 3, 2, 12);
      break;
    case 'eagle':
      ctx.fillStyle = SILVER;
      ctx.fillRect(10, 3, 4, 9); ctx.fillRect(2, 5, 8, 3); ctx.fillRect(14, 5, 8, 3); ctx.fillRect(4, 8, 4, 2); ctx.fillRect(16, 8, 4, 2); ctx.fillRect(9, 12, 6, 3);
      ctx.fillStyle = SILVER_D; ctx.fillRect(11, 1, 2, 2); ctx.fillRect(10, 6, 4, 1);
      break;
    case 'star': {
      const n = ins.n, gap = n > 3 ? 4 : 7;
      const start = 12 - ((n - 1) * gap) / 2;
      for (let i = 0; i < n; i++) star(ctx, Math.round(start + i * gap), 8, SILVER);
      break;
    }
    case 'cosmic':
      for (let i = 0; i < 5; i++) star(ctx, 3 + i * 4.5, 8, i % 2 ? GOLD : SILVER);
      ctx.fillStyle = '#8a5cc8';
      for (let i = 0; i < ins.n; i++) ctx.fillRect(4 + i * 7, 14, 3, 2);
      break;
  }
  return c.toDataURL();
}

function hash(str: string): number {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const RIBBON = ['#c8322d', '#2a4a8a', '#f2f4f5', '#f5d33f', '#5d6b3a', '#8a5cc8', '#2f6e2f', '#f08a24', '#18305e', '#7a1c1a', '#6fd3f0', '#c9b27c'];

/** A 24x8 service ribbon whose stripe pattern is derived from the achievement id. */
export function ribbonURL(id: string, earned: boolean): string {
  const [c, ctx] = canvas(24, 8);
  let h = hash(id);
  const stripes: string[] = [];
  for (let i = 0; i < 4; i++) { stripes.push(RIBBON[h % RIBBON.length]); h = Math.floor(h / RIBBON.length) + i * 7919; }
  const pattern = [0, 1, 2, 3, 2, 1, 0].map(i => stripes[i]);
  const widths = [3, 3, 3, 6, 3, 3, 3];
  let x = 0;
  pattern.forEach((col, i) => { ctx.fillStyle = earned ? col : '#3a3f47'; ctx.fillRect(x, 0, widths[i], 8); x += widths[i]; });
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 7, 24, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, 24, 1);
  if (earned && hash(id) % 3 === 0) star(ctx, 12, 4, SILVER);
  return c.toDataURL();
}
