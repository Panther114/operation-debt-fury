import { FIXED, VARIANTS } from './palette';
import type { SpriteDef } from './types';
import { SPRITES as AIR1 } from './sprites/air1';
import { SPRITES as AIR2 } from './sprites/air2';
import { SPRITES as SURFACE } from './sprites/surface';
import { SPRITES as SPACE } from './sprites/space';

export const SPRITES: Record<string, SpriteDef> = { ...AIR1, ...AIR2, ...SURFACE, ...SPACE };

// The strike group is a formation: a destroyer escorting the carrier.
const CSG_PARTS = [{ id: 'ddg', dx: 0 }, { id: 'cvn', dx: 50 }];

export interface Raster { canvas: HTMLCanvasElement; w: number; h: number; def: SpriteDef }

const cache = new Map<string, Raster>();

function paintRows(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, ox: number, oy: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

/** Rasterises a sprite at 1 px per pixel, cached per id, variant and facing. */
export function raster(id: string, variant = 0, flip = false): Raster {
  const key = `${id}|${variant}|${flip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let r: Raster;
  if (id === 'csg') {
    const parts = CSG_PARTS.map(p => ({ ...p, r: raster(p.id, variant) }));
    const w = Math.max(...parts.map(p => p.dx + p.r.w));
    const h = Math.max(...parts.map(p => p.r.h));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    for (const p of parts) ctx.drawImage(p.r.canvas, p.dx, h - p.r.h);
    r = { canvas, w, h, def: SPRITES.cvn };
  } else {
    const def = SPRITES[id] ?? SPRITES.receipt;
    const trio = VARIANTS[def.paint ?? 'grey'][variant] ?? VARIANTS.grey[0];
    const pal: Record<string, string> = { ...FIXED, a: trio[0], b: trio[1], c: trio[2] };
    const w = def.rows[0].length, h = def.rows.length;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    paintRows(canvas.getContext('2d')!, def.rows, pal, 0, 0);
    r = { canvas, w, h, def };
  }
  if (flip) {
    const canvas = document.createElement('canvas');
    canvas.width = r.w; canvas.height = r.h;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(r.w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(r.canvas, 0, 0);
    r = { ...r, canvas };
  }
  cache.set(key, r);
  return r;
}

const urlCache = new Map<string, string>();

/** A data URL of the whole sprite scaled by an integer factor, fitted to a maximum box. */
export function spriteURL(id: string, variant = 0, maxW = 64, maxH = 32): string {
  const key = `${id}|${variant}|${maxW}x${maxH}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const r = raster(id, variant);
  const scale = Math.max(1, Math.floor(Math.min(maxW / r.w, maxH / r.h)));
  const canvas = document.createElement('canvas');
  canvas.width = r.w * scale; canvas.height = r.h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(r.canvas, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Returns an <img> element showing the sprite crisply scaled. */
export function spriteImg(id: string, variant = 0, maxW = 64, maxH = 32, cls = 'sprite'): HTMLImageElement {
  const img = new Image();
  img.src = spriteURL(id, variant, maxW, maxH);
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  return img;
}
