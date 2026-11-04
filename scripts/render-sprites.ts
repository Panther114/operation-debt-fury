// Renders sprite definitions to a PNG contact sheet for visual review, and validates them.
// Usage: npx tsx scripts/render-sprites.ts <module path relative to repo> <out.png> [scale]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FIXED, VARIANTS, type PaintId } from '../src/art/palette';
import type { SpriteDef } from '../src/art/types';

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

export function validate(id: string, rows: string[]): string[] {
  const errs: string[] = [];
  if (!rows.length) errs.push(`${id}: no rows`);
  const w = rows[0]?.length ?? 0;
  rows.forEach((r, i) => {
    if (r.length !== w) errs.push(`${id}: row ${i} has length ${r.length}, expected ${w}`);
    for (const ch of r) if (ch !== '.' && !(ch in FIXED) && !'abc'.includes(ch)) errs.push(`${id}: row ${i} unknown char '${ch}'`);
  });
  return errs;
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(w: number, h: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  const [mod, out, scaleArg] = process.argv.slice(2);
  const scale = Number(scaleArg ?? 4);
  const m = await import(pathToFileURL(resolve(mod)).href);
  const sprites: Record<string, SpriteDef> = m.SPRITES;
  const entries: { id: string; rows: string[]; paint: PaintId }[] = [];
  const errs: string[] = [];
  for (const [id, s] of Object.entries(sprites)) {
    errs.push(...validate(id, s.rows));
    entries.push({ id, rows: s.rows, paint: s.paint ?? 'grey' });
    if (s.icon) { errs.push(...validate(id + ':icon', s.icon)); entries.push({ id: id + ':icon', rows: s.icon, paint: s.paint ?? 'grey' }); }
  }
  // Each sprite is drawn in all 4 variants side by side, one sprite per line.
  const pad = 4;
  const cellW = Math.max(...entries.map(e => e.rows[0]?.length ?? 0)) + pad;
  const W = cellW * 4 * scale + pad;
  const H = entries.reduce((s, e) => s + (e.rows.length + pad) * scale, pad);
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = 40; img[i * 4 + 1] = 52; img[i * 4 + 2] = 64; img[i * 4 + 3] = 255; }
  let oy = pad;
  for (const e of entries) {
    for (let v = 0; v < 4; v++) {
      const trio = VARIANTS[e.paint][v];
      const pal: Record<string, string> = { ...FIXED, a: trio[0], b: trio[1], c: trio[2] };
      const ox = pad + v * cellW * scale;
      e.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.' || !pal[ch]) return;
        const [r, g, b] = hex(pal[ch]);
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const px = ox + x * scale + sx, py = oy + y * scale + sy;
          if (px >= W || py >= H) continue;
          const o = (py * W + px) * 4;
          img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = 255;
        }
      }));
    }
    oy += (e.rows.length + pad) * scale;
  }
  writeFileSync(out, png(W, H, img));
  console.log(`Rendered ${entries.length} sprites to ${out} (${W}x${H}).`);
  console.log(entries.map(e => `${e.id}: ${e.rows[0]?.length}x${e.rows.length}`).join('\n'));
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; } else console.log('Validation OK.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
