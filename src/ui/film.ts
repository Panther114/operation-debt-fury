// The closing film: about 39 seconds of pixel-art cinema played when Big Bang 2 is funded.
//
// Everything is drawn on a 320 × 180 canvas that is scaled up by an integer factor, so every pixel
// stays square. Shapes are filled with scanline spans (no anti-aliasing), shading and transitions
// use a 4 × 4 Bayer dither, text is rendered from the pixel fonts and thresholded to hard pixels,
// and camera "zooms" are integer crops of an off-screen frame.
//
// Shot list:
//   1. Studio ident: Cost-Plus Pictures, searchlights and a light sweep.
//   2. Establishing shot: the White House at 2:59 a.m., tilting down from the sky.
//   3. The Oval Office: wide shot, then 2× and 3× cuts for a three-line exchange.
//   4. Insert: the button. Safety cover, alarm beacon, countdown, the taxpayer, impact frames.
//   5. The universe is spent: a black hole swallows the fleet, the money and the Earth.
//   6. Silence and a single point of light.
//   7. Big Bang 2: impact frames, shock rings, debris and the title.
//   8. Universe 2: a new planet at sunrise, a debt clock at $0.00, and the President.
//   9. Credits and THE END.
//  10. Conclusion: the full game title over the new world at sunrise. It is held indefinitely
//      (with ambient animation) until the player opens the Final Audit Report or restarts.
import { h } from './dom';
import { raster, type Raster } from '../art/sprite';
import { ASSETS } from '../data/assets';
import { money } from '../core/format';
import type { Sfx } from '../audio/audio';
import { ANTHEM_ROCKETS, ANTHEM_TOP } from '../audio/tracks';

export interface FilmAudio {
  sfx(name: Sfx): void;
  /** Switches the score; null fades the music out. */
  music(track: string | null, from?: number): void;
}

const W = 320, H = 180;
const BAR = 12;
const SCENES: [string, number][] = [
  ['ident', 2.8], ['establish', 3.8], ['office', 6.2], ['button', 5.0], ['collapse', 5.6],
  ['silence', 1.4], ['bang', 3.8], ['universe', 5.0], ['credits', 5.4],
];
export const FILM_LENGTH = SCENES.reduce((t, s) => t + s[1], 0);
const START: Record<string, number> = {};
SCENES.reduce((t, [id, d]) => { START[id] = t; return t + d; }, 0);

// ---------- Palette ----------
const K = '#05060c';
const WHITE = '#ffffff';
const GOLD = '#f5d33f', GOLD_D = '#c99a2e', GOLD_DD = '#9a7414';
const RED = '#b8202c', RED_L = '#e0524b', RED_D = '#7a1c1a';
const NAVY = '#1d2d66', NAVY_D = '#101a3a', NAVY_DD = '#0a1028';
const SKIN = '#e3b48a', SKIN_D = '#a8714a';
const GREY = '#8f99a3', GREY_L = '#c4ccd3', GREY_D = '#3a3f47', GREY_M = '#5a616b';
const MONEY = '#5fae4e', MONEY_D = '#2f6e2f';

type Fill = string | { tile: HTMLCanvasElement };
type Ctx = CanvasRenderingContext2D;

// ---------- Maths ----------
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeIn = (x: number) => clamp(x) ** 3;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, s: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x: number, y: number, s: number): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2; a *= 0.5; }
  return v;
}

// ---------- Dither ----------
// A dithered fill is a pre-tiled canvas per colour and level. Shapes copy sub-rectangles from it
// (drawImage is far cheaper than pattern fills), and the tile phase follows the destination
// coordinates, so dithers line up across shapes and never swim.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayerAt = (x: number, y: number) => BAYER[(x & 3) + (y & 3) * 4];
interface Tile { tile: HTMLCanvasElement }
const TW = W + 40, TH = 104;
const tileCache = new Map<string, Tile>();
const patternCache = new Map<string, CanvasPattern>();
let patCtx: Ctx;

/** A canvas pattern (used only for compositing masks). */
function patternOf(color: string, level: number): CanvasPattern {
  const l = Math.round(clamp(level, 0, 16));
  const key = color + l;
  let p = patternCache.get(key);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = color;
    for (let i = 0; i < 16; i++) if (BAYER[i] < l) x.fillRect(i & 3, i >> 2, 1, 1);
    p = patCtx.createPattern(c, 'repeat')!;
    patternCache.set(key, p);
  }
  return p;
}

/** A fill that covers `level` of every 16 pixels with `color` (16 = solid). */
function pat(color: string, level: number): Fill {
  const l = Math.round(clamp(level, 0, 16));
  if (l >= 16) return color;
  const key = color + l;
  let f = tileCache.get(key);
  if (!f) {
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const c = cv.getContext('2d')!;
    c.fillStyle = patternOf(color, l);
    c.fillRect(0, 0, TW, TH);
    f = { tile: cv };
    tileCache.set(key, f);
  }
  return f;
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;
/** Fills an axis-aligned rectangle (integer coordinates) with a colour or a dither tile. */
function span(c: Ctx, f: Fill, x: number, y: number, w: number, hgt: number): void {
  if (w <= 0 || hgt <= 0) return;
  if (typeof f === 'string') { c.fillStyle = f; c.fillRect(x, y, w, hgt); return; }
  if (x < -CLIP) { w -= -CLIP - x; x = -CLIP; }
  if (x + w > W + CLIP) w = W + CLIP - x;
  if (w <= 0) return;
  const sx = 4 + mod4(x);
  for (let yy = y; yy < y + hgt; yy += TH - 8) {
    const hh = Math.min(TH - 8, y + hgt - yy);
    c.drawImage(f.tile, sx, 4 + mod4(yy), w, hh, x, yy, w, hh);
  }
}

function rect(c: Ctx, x: number, y: number, w: number, hgt: number, f: Fill): void {
  span(c, f, Math.round(x), Math.round(y), Math.round(w), Math.round(hgt));
}
function dfill(c: Ctx, color: string, level: number, x = 0, y = 0, w = W, hgt = H): void {
  if (level <= 0) return;
  rect(c, x, y, w, hgt, pat(color, level));
}

/** Vertical gradient between colour stops, dithered across each band. */
function vgrad(c: Ctx, stops: [number, string][], x = 0, w = W): void {
  for (let i = 0; i < stops.length - 1; i++) {
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    rect(c, x, y0, w, y1 - y0, c0);
    for (let y = Math.round(y0); y < y1; y++) dfill(c, c1, ((y - y0) / (y1 - y0)) * 16, x, y, w, 1);
  }
}

// ---------- Crisp shapes (scanline spans, no anti-aliasing) ----------
/** Rows and columns beyond the frame that shapes still fill (covers camera shake). */
const CLIP = 12;
function disc(c: Ctx, cx: number, cy: number, r: number, f: Fill): void {
  if (r <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const ri = Math.ceil(r);
  for (let y = Math.max(-ri, -cy - CLIP); y <= Math.min(ri, H + CLIP - cy); y++) {
    const d = r * r - y * y;
    if (d < 0) continue;
    const hw = Math.round(Math.sqrt(d));
    const x0 = Math.max(cx - hw, -CLIP), x1 = Math.min(cx + hw + 1, W + CLIP);
    span(c, f, x0, cy + y, x1 - x0, 1);
  }
}
function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, f: Fill): void {
  if (rx <= 0 || ry <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const ri = Math.ceil(ry);
  for (let y = Math.max(-ri, -cy - CLIP); y <= Math.min(ri, H + CLIP - cy); y++) {
    const k = 1 - (y * y) / (ry * ry);
    if (k < 0) continue;
    const hw = Math.round(rx * Math.sqrt(k));
    span(c, f, cx - hw, cy + y, hw * 2 + 1, 1);
  }
}
function ring(c: Ctx, cx: number, cy: number, r: number, th: number, f: Fill): void {
  if (r <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const ri = Math.ceil(r), r2 = Math.max(0, r - th);
  for (let y = Math.max(-ri, -cy - CLIP); y <= Math.min(ri, H + CLIP - cy); y++) {
    const d = r * r - y * y;
    if (d < 0) continue;
    const o = Math.round(Math.sqrt(d));
    const d2 = r2 * r2 - y * y;
    const i = d2 > 0 ? Math.round(Math.sqrt(d2)) : -1;
    if (i < 0) { span(c, f, cx - o, cy + y, o * 2 + 1, 1); continue; }
    span(c, f, cx - o, cy + y, o - i, 1);
    span(c, f, cx + i + 1, cy + y, o - i, 1);
  }
}
/** Even-odd scanline polygon fill. */
function poly(c: Ctx, pts: [number, number][], f: Fill): void {
  const ys = pts.map(p => p[1]);
  const y0 = Math.max(-CLIP, Math.floor(Math.min(...ys))), y1 = Math.min(H + CLIP, Math.ceil(Math.max(...ys)));
  for (let y = y0; y < y1; y++) {
    const sy = y + 0.5, xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
      if (b > a) span(c, f, a, y, b - a, 1);
    }
  }
}
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, f: Fill): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 600; n++) {
    if (x0 >= -CLIP && x0 < W + CLIP && y0 >= -CLIP && y0 < H + CLIP) span(c, f, x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
/** Soft light: nested dithered discs, brightest at the centre. */
function glow(c: Ctx, cx: number, cy: number, r: number, color: string, max: number): void {
  for (let k = 0; k < 5; k++) disc(c, cx, cy, r * (1 - k / 5), pat(color, (max * (k + 1)) / 5));
}
/** Black everywhere outside a circle (iris wipe). */
function iris(c: Ctx, cx: number, cy: number, r: number): void {
  c.fillStyle = K;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = 0; y < H; y++) {
    const dy = y - cy, d = r * r - dy * dy;
    if (d <= 0) { c.fillRect(0, y, W, 1); continue; }
    const hw = Math.round(Math.sqrt(d));
    c.fillRect(0, y, Math.max(0, cx - hw), 1);
    c.fillRect(cx + hw + 1, y, W, 1);
  }
}
function star4(c: Ctx, x: number, y: number, s: number, color: string): void {
  rect(c, x - s, y, s * 2 + 1, 1, color);
  rect(c, x, y - s, 1, s * 2 + 1, color);
  if (s > 1) rect(c, x - 1, y - 1, 3, 3, color);
}

// ---------- Sprites ----------
const flipped = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** A mirrored copy of an image, made once. */
function mirror(img: HTMLCanvasElement): HTMLCanvasElement {
  let m = flipped.get(img);
  if (!m) {
    m = document.createElement('canvas');
    m.width = img.width; m.height = img.height;
    const c = m.getContext('2d')!;
    c.translate(img.width, 0); c.scale(-1, 1); c.drawImage(img, 0, 0);
    flipped.set(img, m);
  }
  return m;
}
function spr(c: Ctx, r: Raster | HTMLCanvasElement, x: number, y: number, s = 1, flip = false): void {
  const base = 'canvas' in r ? r.canvas : r;
  const img = flip ? mirror(base) : base;
  c.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s);
}
let tmp: HTMLCanvasElement;
/** Draws an image dissolved by an ordered dither (level 0-16). */
function sprDither(c: Ctx, img: HTMLCanvasElement, x: number, y: number, level: number, s = 1): void {
  if (level >= 16) { spr(c, img, x, y, s); return; }
  if (level <= 0) return;
  const w = img.width * s, hh = img.height * s;
  if (tmp.width < w || tmp.height < hh) { tmp.width = Math.max(tmp.width, w); tmp.height = Math.max(tmp.height, hh); }
  const t = tmp.getContext('2d')!;
  t.imageSmoothingEnabled = false;
  t.clearRect(0, 0, tmp.width, tmp.height);
  t.drawImage(img, 0, 0, w, hh);
  t.globalCompositeOperation = 'destination-in';
  t.fillStyle = patternOf('#000', level);
  t.fillRect(0, 0, w, hh);
  t.globalCompositeOperation = 'source-over';
  c.drawImage(tmp, 0, 0, w, hh, Math.round(x), Math.round(y), w, hh);
}
function canvasOf(w: number, hh: number, draw: (c: Ctx) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hh;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  draw(c);
  return cv;
}

// ---------- Bitmap text ----------
// A hand-built 5 x 7 pixel font (uppercase, digits and punctuation), so that every glyph sits on the
// pixel grid exactly. FP selects the bold cut (each glyph thickened by one pixel), FS the regular.
const FP = 'bold';
const FS = 'regular';
const G: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['###', ' # ', ' # ', ' # ', ' # ', ' # ', '###'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  Q: [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '#   #', '# # #', '# # #', '# # #', ' # # '],
  X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  0: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  1: [' # ', '## ', ' # ', ' # ', ' # ', ' # ', '###'],
  2: [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  3: ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  4: ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  5: ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  6: ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '],
  7: ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  8: [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  9: [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
  '.': [' ', ' ', ' ', ' ', ' ', ' ', '#'],
  ',': ['  ', '  ', '  ', '  ', '  ', ' #', '# '],
  '!': ['#', '#', '#', '#', '#', ' ', '#'],
  '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
  "'": ['#', '#', ' ', ' ', ' ', ' ', ' '],
  '"': ['# #', '# #', '   ', '   ', '   ', '   ', '   '],
  ':': [' ', '#', ' ', ' ', ' ', '#', ' '],
  ';': ['  ', ' #', '  ', '  ', '  ', ' #', '# '],
  '-': ['   ', '   ', '   ', '###', '   ', '   ', '   '],
  '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '],
  '$': ['  #  ', ' ####', '# #  ', ' ### ', '  # #', '#### ', '  #  '],
  '(': ['  #', ' # ', '#  ', '#  ', '#  ', ' # ', '  #'],
  ')': ['#  ', ' # ', '  #', '  #', '  #', ' # ', '#  '],
  '[': ['##', '# ', '# ', '# ', '# ', '# ', '##'],
  ']': ['##', ' #', ' #', ' #', ' #', ' #', '##'],
  '/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
  '&': [' ##  ', '#  # ', '# #  ', ' #   ', '# # #', '#  # ', ' ## #'],
  ' ': ['  ', '  ', '  ', '  ', '  ', '  ', '  '],
};
const textCache = new Map<string, HTMLCanvasElement>();
/** Renders a string to a cached canvas: 1 px margin on the left, glyphs on rows 1-7, 1 px tracking. */
function glyphs(str: string, font: string, color: string): HTMLCanvasElement {
  const key = font + '|' + color + '|' + str;
  let cv = textCache.get(key);
  if (cv) return cv;
  const bold = font === FP;
  const chars = [...str.toUpperCase()].map(ch => G[ch] ?? G['?']);
  const adv = chars.map(g => g[0].length + (bold ? 1 : 0) + 1);
  const width = Math.max(1, adv.reduce((a, b) => a + b, 0) - 1);
  cv = document.createElement('canvas');
  cv.width = width + 3; cv.height = 10;
  const c = cv.getContext('2d')!;
  c.fillStyle = color;
  let x = 1;
  chars.forEach((g, i) => {
    g.forEach((row, y) => {
      for (let k = 0; k < row.length; k++) if (row[k] === '#') c.fillRect(x + k, y + 1, bold ? 2 : 1, 1);
    });
    x += adv[i];
  });
  if (textCache.size > 1500) textCache.clear();
  textCache.set(key, cv);
  return cv;
}
const textW = (str: string, font = FS) => glyphs(str, font, '#ffffff').width - 3;

interface TextOpts { font?: string; color?: string; align?: 'left' | 'center' | 'right'; scale?: number; outline?: string; shadows?: string[]; spacing?: number }
function text(c: Ctx, str: string, x: number, y: number, o: TextOpts = {}): number {
  const font = o.font ?? FS, s = o.scale ?? 1;
  if (o.spacing) {
    // Per-character layout with extra tracking (in unscaled pixels).
    const adv = [...str].map(ch => (textW(ch, font) + o.spacing!) * s);
    const total = adv.reduce((a, b) => a + b, 0) - o.spacing * s;
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const one = { ...o, spacing: 0, align: 'left' as const };
    for (let pass = 0; pass < 2; pass++) {
      cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
      [...str].forEach((ch, i) => {
        if (ch !== ' ') text(c, ch, cx, y, pass === 0 ? { ...one, color: o.outline ?? K, shadows: o.shadows } : { ...one, shadows: [], outline: undefined });
        cx += adv[i];
      });
    }
    return total;
  }
  const g = glyphs(str, font, o.color ?? WHITE);
  const w = (g.width - 3) * s;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x) - s, y0 = Math.round(y);
  (o.shadows ?? []).forEach((col, i) => c.drawImage(glyphs(str, font, col), x0 + (i + 1) * s, y0 + (i + 1) * s, g.width * s, g.height * s));
  if (o.outline) {
    const ol = glyphs(str, font, o.outline);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.drawImage(ol, x0 + dx * s, y0 + dy * s, g.width * s, g.height * s);
  }
  c.drawImage(g, x0, y0, g.width * s, g.height * s);
  return w;
}
function wrap(str: string, maxW: number, font = FS): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const next = cur ? cur + ' ' + word : word;
    if (textW(next, font) > maxW && cur) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- Film ----------

interface Line { who: 'potus' | 'aide' | 'taxpayer'; text: string; at: number; until: number; pose?: string }

export interface FilmOptions {
  reducedMotion?: boolean;
  /** Development aid: start part-way through (seconds). */
  startAt?: number;
  /** Development aid: hold a single frame at this time (seconds). */
  freezeAt?: number;
  /** Development aid: receives the frame renderer, for stepping through the film. */
  expose?: (render: (t: number) => void) => void;
  /** The closing title that follows the credits and is held until the player chooses. */
  conclusion?: {
    /** One line under the title, e.g. the playthrough time and grade. */
    line: string;
    onStats: () => void;
    onRestart: () => void;
  };
}

/** Starts the film at the closing title, already settled with its buttons visible. */
export const TITLE_HOLD = FILM_LENGTH + 4.5;

export function playFilm(audio: FilmAudio, opts: FilmOptions = {}): () => void {
  const reducedMotion = !!opts.reducedMotion;
  const cv = h('canvas.film-cv') as HTMLCanvasElement;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  patCtx = ctx;
  tmp = document.createElement('canvas');
  const world = document.createElement('canvas');
  world.width = W; world.height = H;
  const wctx = world.getContext('2d')!;
  wctx.imageSmoothingEnabled = false;

  const skip = h('button.film-skip', {}, 'SKIP ▸▸');
  const RESTART_LABEL = '★ BEGIN A NEW UNIVERSE ★';
  const statsBtn = h('button.film-btn', {}, 'VIEW FINAL REPORT');
  const restartBtn = h('button.film-btn.primary', {}, RESTART_LABEL);
  const stage = h('div.film-stage', {}, cv, h('div.film-end', {}, statsBtn, restartBtn));
  const root = h('div.film', {}, stage, skip);
  if ((opts.startAt ?? 0) >= FILM_LENGTH) skip.hidden = true;
  document.body.append(root);
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    const k = s >= 1 ? Math.floor(s) : s;
    for (const el of [cv, stage]) { el.style.width = `${W * k}px`; el.style.height = `${H * k}px`; }
    stage.style.setProperty('--k', String(k));
  };
  fit();
  addEventListener('resize', fit);

  // ---------- Cast ----------
  const P = {
    idle: raster('potus'), talk: raster('potus_talk'), blink: raster('potus_blink'), point: raster('potus_point'),
    thumbs: raster('potus_thumbs'), shout: raster('potus_shout'),
  };
  const taxpayer = raster('taxpayer0'), taxpayerSad = raster('taxpayer3');
  const eagle = raster('eagle'), bill = raster('bill'), flag = raster('flag');
  const R = rng(1776);

  // The Secret Service aide: a full figure for the wide shot and a portrait for the dialogue box.
  const aideBody = canvasOf(14, 36, c => {
    rect(c, 4, 0, 6, 2, '#2a1a10');
    rect(c, 3, 2, 8, 7, SKIN); rect(c, 3, 2, 8, 2, '#2a1a10');
    rect(c, 3, 5, 8, 2, K); rect(c, 4, 5, 2, 1, '#6a7ab8');
    rect(c, 2, 9, 10, 15, '#14161a'); rect(c, 6, 9, 2, 6, WHITE); rect(c, 6, 10, 2, 5, K);
    rect(c, 1, 10, 2, 13, '#14161a'); rect(c, 11, 10, 2, 13, '#14161a');
    rect(c, 1, 23, 2, 2, SKIN); rect(c, 11, 23, 2, 2, SKIN);
    rect(c, 3, 24, 3, 11, '#14161a'); rect(c, 8, 24, 3, 11, '#14161a');
    rect(c, 2, 35, 4, 1, K); rect(c, 8, 35, 4, 1, K);
    rect(c, 11, 4, 1, 6, GREY_L);
  });
  const aidePortrait = canvasOf(32, 32, c => {
    rect(c, 0, 0, 32, 32, '#22305e');
    rect(c, 9, 4, 14, 5, '#2a1a10');
    rect(c, 9, 7, 14, 14, SKIN); rect(c, 21, 9, 2, 10, SKIN_D);
    rect(c, 8, 11, 16, 4, K); rect(c, 10, 12, 4, 1, '#6a7ab8'); rect(c, 18, 12, 4, 1, '#6a7ab8');
    rect(c, 13, 18, 6, 1, SKIN_D);
    rect(c, 13, 21, 6, 3, SKIN_D);
    rect(c, 3, 24, 26, 8, '#14161a'); rect(c, 14, 24, 4, 8, WHITE); rect(c, 15, 25, 2, 7, K);
    rect(c, 24, 10, 1, 14, GREY_L); rect(c, 23, 10, 2, 2, GREY_L);
  });
  // A cash pallet scaled for the film, with stacks of bills.
  const cashPallet = canvasOf(30, 14, c => {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      rect(c, 2 + i * 9, 1 + j * 4, 8, 4, MONEY); rect(c, 2 + i * 9, 1 + j * 4, 8, 1, '#b8e0a0');
      rect(c, 5 + i * 9, 2 + j * 4, 2, 2, MONEY_D);
    }
    rect(c, 0, 9, 30, 2, '#9a6634'); rect(c, 0, 12, 30, 2, '#9a6634');
    rect(c, 1, 11, 3, 1, '#5e3a19'); rect(c, 13, 11, 4, 1, '#5e3a19'); rect(c, 26, 11, 3, 1, '#5e3a19');
  });

  // ---------- Pre-rendered layers ----------
  const vignette = canvasOf(W, H, c => {
    c.fillStyle = K;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx * 0.9 + dy * dy * 1.1);
      const v = clamp((d - 0.9) / 0.45) * 7;
      if (bayerAt(x, y) < v) c.fillRect(x, y, 1, 1);
    }
  });
  const nebula = (cols: string[], seed: number, scale: number) => canvasOf(W, H, c => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x * scale, y * scale * 1.3, seed);
      const v = clamp((n - 0.35) * 2.4) * (cols.length - 1);
      const i = Math.floor(v), f = v - i;
      const col = bayerAt(x, y) / 16 < f ? cols[Math.min(cols.length - 1, i + 1)] : cols[i];
      if (col !== K) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    }
  });
  const nebulaA = nebula([K, '#0c0820', '#1c0f3a', '#33175c', '#4e2380'], 7, 0.012);
  const nebulaB = nebula([K, '#071426', '#0e2a46', '#3a1d5c', '#8a2f6e', '#e06a6a'], 11, 0.010);
  // Universe 2: a pristine planet seen from low orbit, lit from the right by the rising sun.
  const newWorld = canvasOf(W, H, c => {
    const pcx = 160, pcy = 400, pr = 280;
    for (let x = 0; x < W; x++) {
      const top = Math.ceil(pcy - Math.sqrt(pr * pr - (x - pcx) ** 2));
      for (let y = Math.max(0, top); y < H; y++) {
        const depth = y - top;
        const fx = x * 0.022, fy = depth * 0.075 + 3;
        const n = fbm(fx, fy, 21), m = fbm(fx * 2, fy * 2, 5), cl = fbm(fx * 1.6 + 7, fy * 1.3, 13);
        let col = n > 0.53 ? (m > 0.5 ? '#5a9a3a' : '#3f7a2a') : n > 0.49 ? '#d8c890' : (m > 0.55 ? '#2f6fc8' : '#2a62b8');
        if (cl > 0.6 && bayerAt(x, y) / 16 < (cl - 0.6) * 6) col = '#eef4ff';
        const light = clamp((x - 20) / 260);
        if (bayerAt(x, y) / 16 > light * 1.1 + 0.15) col = col === '#eef4ff' ? '#8a9ac0' : n > 0.53 ? '#1f3f1a' : '#132e66';
        if (depth < 7 && bayerAt(x + 1, y) < (7 - depth) * 2) col = '#9fdcff';
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
  });
  const stars = Array.from({ length: 150 }, () => ({ x: Math.floor(R() * W), y: Math.floor(R() * H), b: R(), z: 0.2 + R() * 0.8 }));
  const drawStars = (c: Ctx, t: number, dx = 0, dy = 0, alpha = 16) => {
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * (2 + s.b * 4) + s.b * 20);
      const x = Math.round(((s.x + dx * s.z) % W + W) % W), y = Math.round(((s.y + dy * s.z) % H + H) % H);
      const lvl = alpha * (0.35 + 0.65 * tw);
      if (s.b > 0.93) { star4(c, x, y, 1, '#dfe8ff'); continue; }
      rect(c, x, y, 1, 1, pat(s.b > 0.6 ? '#ffffff' : '#8fa0c8', lvl));
    }
  };
  // Earth texture for the falling planet.
  const EW = 96, EH = 48;
  const land = new Uint8Array(EW * EH);
  for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) land[y * EW + x] = fbm(x * 0.09, y * 0.11, 3) > 0.52 ? 1 : 0;
  function planet(c: Ctx, cx: number, cy: number, r: number, rot: number, burn: number): void {
    cx = Math.round(cx); cy = Math.round(cy);
    const ri = Math.ceil(r);
    for (let y = -ri; y <= ri; y++) for (let x = -ri; x <= ri; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r) continue;
      const z = Math.sqrt(r * r - d2);
      const lon = Math.atan2(x, z) + rot, lat = Math.asin(clamp(y / r, -1, 1));
      const u = Math.floor((((lon / (Math.PI * 2)) % 1) + 1) % 1 * EW), v = Math.floor((lat / Math.PI + 0.5) * (EH - 1));
      const isLand = land[v * EW + u] === 1;
      const ice = Math.abs(lat) > 1.15;
      const light = clamp((-x * 0.55 - y * 0.35 + z * 0.75) / r);
      const lit = bayerAt(x + cx, y + cy) / 16 < light * 1.25;
      let col = ice ? (lit ? '#eef4ff' : '#9aa8c8') : isLand ? (lit ? '#5a9a3a' : '#2f5a26') : (lit ? '#2f6fc8' : '#163a7a');
      if (burn > 0 && bayerAt(x + cx + 1, y + cy) / 16 < burn) col = lit ? '#e0524b' : '#7a1c1a';
      c.fillStyle = col;
      c.fillRect(cx + x, cy + y, 1, 1);
    }
    ring(c, cx, cy, r + 1, 1, pat('#8fd0ff', 8));
  }
  // Objects that fall into the singularity: the whole fleet plus the props.
  const ids = ASSETS.map(a => a.id).filter(id => id !== 'csg' && id !== 'dyson');
  const fallers = [...ids, 'briefcase', 'toilet', 'receipt', 'bill', 'bill', 'bill', 'capitol', 'dyson'].map((id, i) => ({
    r: raster(id), a: R() * Math.PI * 2, d: 70 + R() * 150 + (id === 'dyson' ? 60 : 0), w: 0.35 + R() * 0.35, k: i,
  }));
  const debris = Array.from({ length: 460 }, (_, i) => {
    const a = R() * Math.PI * 2, v = (20 + R() * 220) * (R() < 0.15 ? 1.7 : 1);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85, c: [WHITE, GOLD, '#ffb347', '#ff6ad5', '#6fd3f0', RED_L][i % 6], big: R() < 0.18 };
  });
  const bills = Array.from({ length: 14 }, () => { const a = R() * Math.PI * 2; return { vx: Math.cos(a), vy: Math.sin(a), v: 60 + R() * 90, ph: R() }; });
  const grain = Array.from({ length: 40 }, () => ({ y: Math.floor(R() * H), x: Math.floor(R() * W), w: 20 + Math.floor(R() * 80), dark: R() < 0.6 }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 80 + R() * 40, y: -40 + R() * 70, s: 0.8 + R() * 0.6 }));
  const fireflies = Array.from({ length: 12 }, () => ({ x: 20 + R() * 280, y: 134 + R() * 30, p: R() * 6 }));
  const dust = Array.from({ length: 40 }, () => ({ a: R() * Math.PI * 2, d: 18 + R() * 40 }));

  // ---------- Dialogue ----------
  const lines: Line[] = [
    { who: 'potus', text: 'IS THIS THE BUTTON FOR THE DIET COKE?', at: START.office + 0.6, until: START.office + 2.45 },
    { who: 'aide', text: 'NO, SIR. THAT ONE ENDS THE UNIVERSE.', at: START.office + 2.5, until: START.office + 4.3 },
    { who: 'potus', text: '... EVEN BETTER.', at: START.office + 4.4, until: START.office + 6.1, pose: 'shout' },
    { who: 'taxpayer', text: 'WAIT! I HAVE QUESTIONS ABOUT THE BILL!', at: START.button + 2.45, until: START.button + 3.85 },
    { who: 'potus', text: 'A BRAND-NEW UNIVERSE WITH ZERO DEBT. TREMENDOUS. LET\'S FIX THAT.', at: START.universe + 2.5, until: START.universe + 4.0 },
    { who: 'taxpayer', text: 'OH NO.', at: START.universe + 4.05, until: START.universe + 4.95 },
  ];
  const CPS = 34;
  const typed = new Map<Line, number>();
  const NAMES = { potus: 'THE PRESIDENT', aide: 'SECRET SERVICE', taxpayer: 'THE TAXPAYER' };

  function portrait(c: Ctx, who: Line['who'], x: number, y: number, talking: boolean, t: number, pose?: string): void {
    rect(c, x, y, 34, 34, K);
    rect(c, x + 1, y + 1, 32, 32, who === 'taxpayer' ? '#2a3a26' : '#22305e');
    dfill(c, '#3a4a8a', 4, x + 1, y + 1, 32, 16);
    c.save();
    c.beginPath(); c.rect(x + 1, y + 1, 32, 32); c.clip();
    if (who === 'aide') spr(c, aidePortrait, x + 1, y + 1);
    else if (who === 'taxpayer') spr(c, t > START.universe + 3 ? taxpayerSad : (t < START.universe ? taxpayerSad : taxpayer), x + 4, y + 2);
    else {
      const blink = Math.floor(t * 10) % 31 === 0;
      const img = pose === 'shout' ? (talking && Math.floor(t * 9) % 2 ? P.shout : P.thumbs) : talking ? (Math.floor(t * 9) % 2 ? P.talk : P.idle) : blink ? P.blink : P.idle;
      spr(c, img, x - 5, y - 1);
    }
    c.restore();
    rect(c, x, y, 34, 1, GOLD_D); rect(c, x, y + 33, 34, 1, GOLD_DD);
  }

  function dialogue(c: Ctx, t: number): void {
    const ln = lines.find(l => t >= l.at && t < l.until);
    if (!ln) return;
    const age = t - ln.at, left = ln.until - t;
    const slide = Math.round((1 - easeOut(age / 0.18)) * 50 + (1 - easeOut(left / 0.15)) * 50);
    const x = 8, y = H - BAR - 46 + slide, w = W - 16, hh = 44;
    rect(c, x - 1, y - 1, w + 2, hh + 2, K);
    rect(c, x, y, w, hh, NAVY_D);
    dfill(c, NAVY, 5, x, y, w, hh);
    rect(c, x + 1, y + 1, w - 2, 1, GOLD_D); rect(c, x + 1, y + hh - 2, w - 2, 1, GOLD_DD);
    rect(c, x + 1, y + 1, 1, hh - 2, GOLD_D); rect(c, x + w - 2, y + 1, 1, hh - 2, GOLD_DD);
    for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + hh - 4], [x + w - 4, y + hh - 4]]) rect(c, cx, cy, 2, 2, GOLD);
    const n = Math.min(ln.text.length, Math.floor(age * CPS));
    const prev = typed.get(ln) ?? 0;
    if (n > prev) {
      if (Math.floor(n / 2) > Math.floor(prev / 2) && ln.text[n - 1] !== ' ') audio.sfx(ln.who === 'aide' ? 'blipLow' : 'blip');
      typed.set(ln, n);
    }
    const talking = n < ln.text.length;
    portrait(c, ln.who, x + 5, y + 5, talking, t, ln.pose);
    // Name plate.
    const name = NAMES[ln.who];
    const nw = textW(name) + 10;
    rect(c, x + 44, y - 7, nw, 10, K);
    rect(c, x + 45, y - 6, nw - 2, 8, ln.who === 'potus' ? RED : ln.who === 'aide' ? '#2a3a5e' : MONEY_D);
    text(c, name, x + 49, y - 6, { color: WHITE });
    const rows = wrap(ln.text, w - 56);
    let shown = n;
    rows.forEach((row, i) => {
      const part = row.slice(0, Math.max(0, shown));
      shown -= row.length + 1;
      if (part) text(c, part, x + 46, y + 9 + i * 10, { color: '#f2f4f5', shadows: ['#05060c'] });
    });
    if (!talking && Math.floor(t * 3) % 2 === 0) poly(c, [[x + w - 12, y + hh - 9], [x + w - 6, y + hh - 9], [x + w - 9, y + hh - 6]], GOLD);
  }

  /** Lower-third caption with a typed line. */
  function caption(c: Ctx, str: string, age: number, y = H - BAR - 18, color = '#f2f4f5'): void {
    const n = Math.min(str.length, Math.floor(age * 40));
    if (n <= 0) return;
    const w = textW(str) + 12;
    const x = Math.round(W / 2 - w / 2);
    rect(c, x, y, w, 12, K);
    rect(c, x, y, 2, 12, GOLD_D);
    text(c, str.slice(0, n), x + 6, y + 2, { color });
  }

  // ---------- Scenes ----------
  const sweep = canvasOf(W, H, () => {});
  const sctx = sweep.getContext('2d')!;
  sctx.imageSmoothingEnabled = false;

  const logoY = 34;
  const identBack = canvasOf(W, H, c => {
    rect(c, 0, 0, W, H, K);
    vgrad(c, [[0, K], [100, '#0a0f2a'], [150, '#1a1a40']]);
  });
  const identCity = canvasOf(W, H, c => {
    const sky = [[0, 140, 30], [30, 132, 18], [48, 146, 20], [68, 126, 14], [82, 138, 26], [108, 130, 12], [120, 142, 40], [160, 128, 10], [170, 140, 30], [200, 134, 16], [216, 144, 24], [240, 124, 12], [252, 138, 30], [282, 132, 18], [300, 142, 20]];
    for (const [x, y, w] of sky) rect(c, x, y, w, 40, '#070a18');
    rect(c, 0, 150, W, 30, '#070a18');
    for (const [x, y, w] of sky) for (let k = 0; k < w / 5; k++) if (hash2(x, k, 3) > 0.7) rect(c, x + 2 + k * 5, y + 4 + Math.floor(hash2(k, x, 5) * 10), 1, 1, '#c99a4a');
  });
  const identRays = canvasOf(W, H, c => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      poly(c, [[160, logoY + 18], [160 + Math.cos(a - 0.07) * 200, logoY + 18 + Math.sin(a - 0.07) * 200], [160 + Math.cos(a + 0.07) * 200, logoY + 18 + Math.sin(a + 0.07) * 200]], pat(i % 2 ? '#3a2f10' : '#2a2210', 10));
    }
    disc(c, 160, logoY + 18, 30, pat(K, 8));
  });
  const identLogo = canvasOf(W, H, c => {
    spr(c, eagle, 134, logoY);
    text(c, 'COST-PLUS', 160, logoY + 40, { font: FP, scale: 2, align: 'center', color: GOLD, outline: K, shadows: [GOLD_DD, '#4a3008'] });
    text(c, 'PICTURES', 160, logoY + 62, { font: FP, scale: 2, align: 'center', color: GOLD, outline: K, shadows: [GOLD_DD, '#4a3008'] });
    rect(c, 92, logoY + 84, 136, 1, GOLD_D);
    text(c, 'A DIVISION OF THE DEPARTMENT OF WAR', 160, logoY + 88, { align: 'center', color: GREY_L });
  });
  const identGold = canvasOf(W, H, c => {
    text(c, 'COST-PLUS', 160, logoY + 40, { font: FP, scale: 2, align: 'center', color: GOLD });
    text(c, 'PICTURES', 160, logoY + 62, { font: FP, scale: 2, align: 'center', color: GOLD });
  });

  function ident(c: Ctx, u: number): void {
    c.drawImage(identBack, 0, 0);
    // Searchlights.
    for (const [bx, ph] of [[96, 0], [224, 1.7]] as [number, number][]) {
      const a = -Math.PI / 2 + Math.sin(u * 1.6 + ph) * 0.45;
      const far = 260, spread = 0.05;
      const p1: [number, number] = [bx + Math.cos(a - spread) * far, 150 + Math.sin(a - spread) * far];
      const p2: [number, number] = [bx + Math.cos(a + spread) * far, 150 + Math.sin(a + spread) * far];
      poly(c, [[bx - 2, 150], p1, p2, [bx + 2, 150]], pat('#4a5a9a', 4));
      poly(c, [[bx - 1, 150], [lerp(bx, p1[0], 0.6), lerp(150, p1[1], 0.6)], [lerp(bx, p2[0], 0.6), lerp(150, p2[1], 0.6)], [bx + 1, 150]], pat('#8a9ad8', 3));
    }
    c.drawImage(identCity, 0, 0);
    // Rays, the eagle and the wordmark dissolve in; then a light sweep crosses the gold.
    const reveal = clamp((u - 0.15) / 0.5) * 16;
    sprDither(c, identRays, 0, 0, reveal);
    sprDither(c, identLogo, 0, 0, reveal);
    if (reveal >= 16) {
      const sx = lerp(-40, 380, ease((u - 1.1) / 0.9));
      sctx.clearRect(0, 0, W, H);
      sctx.drawImage(identGold, 0, 0);
      sctx.globalCompositeOperation = 'source-atop';
      poly(sctx, [[sx, 0], [sx + 5, 0], [sx - 45, H], [sx - 50, H]], '#ffffff');
      poly(sctx, [[sx + 9, 0], [sx + 11, 0], [sx - 39, H], [sx - 41, H]], '#fff3c0');
      sctx.globalCompositeOperation = 'source-over';
      c.drawImage(sweep, 0, 0);
    }
    if (u > 1.3 && u < 2.3) { const k = Math.floor((u - 1.3) * 10); star4(c, 112 + k * 9, logoY + 42, 2, WHITE); }
    dfill(c, K, clamp((u - 2.3) / 0.5) * 16);
  }

  const skyLayer = canvasOf(W, H, c => vgrad(c, [[0, '#04061a'], [70, '#0d1640'], [130, '#2a2560'], [168, '#4a2f5e']]));
  const moonLayer = canvasOf(64, 64, c => {
    glow(c, 32, 32, 26, '#6a7ab8', 2);
    disc(c, 32, 32, 13, '#e8e4cf');
    disc(c, 36, 33, 11, pat('#b8b294', 7));
    for (const [dx, dy, r] of [[-5, -3, 2], [3, 4, 2], [-1, 6, 1], [4, -5, 1]]) disc(c, 32 + dx, 32 + dy, r, '#c9c3a6');
  });
  const OVAL = { x: 206, y: 112 };
  const grounds = canvasOf(W, H, c => {
    vgrad(c, [[126, '#12301e'], [180, '#0a1a10']]);
    for (const [x, s] of [[14, 1.2], [40, 0.9], [276, 1.1], [304, 1.3], [64, 0.7], [256, 0.8]] as [number, number][]) {
      rect(c, x - 1, 112, 3, 18, '#07100a');
      for (const [dx, dy, r] of [[0, 0, 12], [-8, 6, 9], [8, 5, 10], [0, -9, 9]]) disc(c, x + dx * s, 104 + dy * s, r * s, '#0b1a12');
      disc(c, x - 3 * s, 98, 5 * s, pat('#24402a', 6));
    }
    const cx = 160;
    rect(c, cx - 70, 92, 140, 36, '#b8c0d4');
    dfill(c, '#8a93ac', 8, cx + 20, 92, 50, 36);
    rect(c, cx - 72, 88, 144, 4, '#dfe4f0');
    for (let x = cx - 72; x < cx + 72; x += 4) rect(c, x, 84, 2, 4, '#c9d0e0');
    rect(c, cx - 72, 84, 144, 1, '#dfe4f0');
    for (const wy of [97, 112]) for (let x = cx - 64; x <= cx + 60; x += 10) {
      if (x > cx - 26 && x < cx + 22) continue;
      const lit = hash2(x, wy, 9) > 0.82;
      rect(c, x, wy, 5, 8, lit ? '#f5c66a' : '#1a2340');
      rect(c, x, wy, 5, 1, '#e8ecf4');
      if (lit) dfill(c, '#f5c66a', 3, x - 2, wy - 2, 9, 12);
    }
    rect(c, cx - 24, 80, 48, 48, '#c9d0e0');
    for (let i = 0; i < 6; i++) { rect(c, cx - 21 + i * 8, 86, 4, 42, '#f0f2f8'); rect(c, cx - 17 + i * 8, 86, 1, 42, '#7a83a0'); }
    rect(c, cx - 26, 78, 52, 6, '#e8ecf4');
    for (let x = cx - 26; x < cx + 26; x += 3) rect(c, x, 74, 2, 4, '#d0d6e6');
    rect(c, cx - 26, 73, 52, 1, '#e8ecf4');
    rect(c, cx - 8, 112, 16, 16, '#7a5a2a'); rect(c, cx - 6, 114, 12, 14, '#c99a4a'); rect(c, cx, 114, 1, 14, '#7a5a2a');
    rect(c, cx, 56, 1, 18, GREY_L);
    ellipse(c, cx, 150, 18, 4, '#5a616b');
    ellipse(c, cx, 150, 16, 3, '#1f3a6a');
    for (const lx of [cx - 50, cx + 50]) {
      rect(c, lx, 128, 1, 14, '#2a2f3a');
      glow(c, lx, 127, 6, '#f5d080', 3);
      rect(c, lx - 1, 126, 3, 2, '#ffe9a8');
    }
  });

  function establish(c: Ctx, u: number, t: number): void {
    const cam = -70 * (1 - ease(u / 2.6));
    c.drawImage(skyLayer, 0, 0);
    drawStars(c, t, 0, -cam * 0.3, 14);
    const my = 30 - cam * 0.5;
    c.drawImage(moonLayer, 220, Math.round(my) - 32);
    // Clouds drifting across the moon.
    for (const cl of clouds) {
      const x = ((cl.x + u * 8 * cl.s) % 400) - 40, y = cl.y - cam * 0.6;
      for (const [dx, dy, r] of [[0, 0, 9], [10, -3, 11], [22, 1, 8], [-9, 3, 6]]) ellipse(c, x + dx * cl.s, y + dy, r * cl.s * 1.4, r * cl.s * 0.6, '#262a58');
      for (const [dx, dy, r] of [[2, -3, 6], [12, -6, 7]]) ellipse(c, x + dx * cl.s, y + dy, r * cl.s * 1.2, r * cl.s * 0.35, '#3a3f78');
    }
    c.save();
    c.translate(0, Math.round(-cam));
    c.drawImage(grounds, 0, 0);
    const cx = 160, ow = OVAL;
    glow(c, ow.x + 2, ow.y + 4, 16 + Math.sin(t * 4) * 1, '#f5c66a', 4);
    rect(c, ow.x, ow.y, 5, 8, '#ffd98a');
    rect(c, ow.x + 2, ow.y, 1, 8, '#c99a4a');
    // Flag on the roof, waving.
    for (let x = 0; x < 14; x++) {
      const wv = Math.round(Math.sin(t * 6 - x * 0.6) * 1.2 * (x / 14));
      for (let y = 0; y < 8; y++) {
        const col = x < 6 && y < 4 ? (((x + y) & 1) ? '#ffffff' : '#1f2f6e') : y % 2 ? '#f2f2f2' : '#c8283a';
        rect(c, cx + 1 + x, 57 + y + wv, 1, 1, col);
      }
    }
    // Fountain spray and fireflies.
    for (let i = 0; i < 9; i++) {
      const k = ((t * 1.5 + i / 9) % 1);
      rect(c, cx - 4 + (i % 3) * 4, Math.round(147 - Math.sin(k * Math.PI) * 10), 1, 1, pat('#bfe6ff', 12));
    }
    for (const f of fireflies) if (Math.sin(t * 3 + f.p * 5) > 0.3) rect(c, f.x + Math.sin(t + f.p) * 3, f.y + Math.cos(t * 0.7 + f.p) * 2, 1, 1, '#e8ff8a');
    c.restore();
    // Title card typed in the corner.
    if (u > 1.3) text(c, 'WASHINGTON, D.C.'.slice(0, Math.floor((u - 1.3) * 22)), 20, BAR + 12, { font: FP, color: WHITE, shadows: [K] });
    if (u > 2.1) text(c, '02:59 A.M.'.slice(0, Math.floor((u - 2.1) * 22)), 20, BAR + 24, { color: GOLD, shadows: [K] });
    // Iris closes on the lit window.
    if (u > 3.2) iris(c, ow.x + 2, ow.y + 4 - Math.round(cam), lerp(340, 0, easeIn((u - 3.2) / 0.6)));
  }

  const officeBack = canvasOf(W, H, c => {
    rect(c, 0, 0, W, H, '#3a3122');
    glow(c, 205, 80, 150, '#5e5038', 12);
    glow(c, 205, 86, 90, '#8c7a56', 8);
    // Wainscot and vertical wallpaper stripes.
    for (let x = 0; x < W; x += 6) dfill(c, '#2a2318', 3, x, 0, 1, 100);
    rect(c, 0, 100, W, 2, '#6e5f45'); rect(c, 0, 116, W, 2, '#2a2318');
    for (let x = 4; x < W; x += 24) { rect(c, x, 104, 18, 1, '#6e5f45'); rect(c, x, 113, 18, 1, '#2a2318'); }
    // Door and the aide.
    rect(c, 18, 36, 44, 82, '#e8e4d8'); rect(c, 21, 39, 38, 79, '#5e3a19');
    rect(c, 24, 42, 15, 32, '#4a2c12'); rect(c, 41, 42, 15, 32, '#4a2c12'); rect(c, 24, 78, 15, 36, '#4a2c12'); rect(c, 41, 78, 15, 36, '#4a2c12');
    rect(c, 54, 80, 2, 4, GOLD);
    spr(c, aideBody, 34, 82);
    // Windows with the night outside, gold curtains and valance.
    for (const wx of [100, 146, 192]) {
      vgrad(c, [[24, '#05081c'], [60, '#121a48'], [96, '#2a2560']], wx, 28);
      for (let i = 0; i < 6; i++) if (i % 3) rect(c, wx + ((i * 11 + wx) % 26) + 1, 28 + ((i * 17) % 60), 1, 1, '#c9d4ff');
      rect(c, wx + 13, 24, 2, 72, '#e8e4d8'); rect(c, wx, 58, 28, 2, '#e8e4d8');
      rect(c, wx - 1, 23, 30, 1, '#e8e4d8'); rect(c, wx - 2, 96, 32, 3, '#e8e4d8');
      for (const cx of [wx - 9, wx + 29]) for (let i = 0; i < 9; i++) rect(c, cx + i, 18, 1, 86, [GOLD, GOLD_D, GOLD_DD, GOLD_D][i % 4]);
    }
    disc(c, 166, 40, 6, '#e8e4cf');
    rect(c, 88, 14, 144, 8, GOLD_D);
    for (let x = 88; x < 232; x += 8) ellipse(c, x + 4, 22, 4, 2, GOLD_DD);
    rect(c, 88, 14, 144, 1, GOLD);
    // Flags.
    for (const [fx, pres] of [[84, false], [236, true]] as [number, boolean][]) {
      rect(c, fx, 30, 1, 88, GOLD_DD); disc(c, fx, 29, 2, GOLD);
      for (let x = 0; x < 12; x++) for (let y = 0; y < 50; y++) {
        let col = pres ? '#1f2f6e' : (Math.floor(y / 4) % 2 ? '#f2f2f2' : '#c8283a');
        if (!pres && x < 6 && y < 18) col = ((x + y) & 1) && y % 3 === 0 ? '#ffffff' : '#1f2f6e';
        if (x % 4 === 3) col = pres ? '#14204a' : col === '#f2f2f2' ? '#c4ccd3' : col === '#c8283a' ? '#8a1a26' : '#14204a';
        rect(c, fx + 2 + x, 34 + y + Math.round(Math.sin(x * 0.9) * 1), 1, 1, col);
      }
      for (let x = 0; x < 12; x += 2) rect(c, fx + 2 + x, 85, 1, 2, GOLD);
      if (pres) disc(c, fx + 8, 56, 3, GOLD);
    }
    // Carpet and the seal.
    rect(c, 0, 118, W, 62, NAVY);
    dfill(c, '#24357a', 4, 0, 118, W, 62);
    ellipse(c, 160, 152, 74, 20, GOLD_D);
    ellipse(c, 160, 152, 68, 17, NAVY);
    ellipse(c, 160, 152, 16, 5, GOLD_D);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; rect(c, 160 + Math.cos(a) * 71, 152 + Math.sin(a) * 18.5, 1, 1, WHITE); }
    // Chair, the President and the Resolute desk.
    // High-backed black leather chair with a squared top and piping.
    rect(c, 136, 48, 48, 56, '#121318'); rect(c, 138, 46, 44, 2, '#121318');
    rect(c, 138, 46, 44, 1, '#3a3f4a'); rect(c, 136, 48, 1, 56, '#2a2e38'); rect(c, 183, 48, 1, 56, '#08090c');
    for (let y = 52; y < 100; y += 6) for (let x = 141; x < 182; x += 8) rect(c, x + ((y / 6) % 2) * 4, y, 1, 1, '#3a3f4a');
  });
  const officeFront = canvasOf(W, H, c => {
    ellipse(c, 160, 146, 66, 6, pat(K, 8));
    rect(c, 104, 100, 112, 4, '#8a5a2a'); rect(c, 104, 100, 112, 1, '#b07a3a');
    rect(c, 106, 104, 108, 38, '#5e3a19'); dfill(c, '#4a2c12', 5, 106, 104, 108, 38);
    rect(c, 140, 110, 40, 26, '#4a2c12'); rect(c, 140, 110, 40, 1, '#7a4a22'); rect(c, 140, 135, 40, 1, '#2a180e');
    disc(c, 160, 123, 7, GOLD_D); disc(c, 160, 123, 5, NAVY); rect(c, 158, 122, 5, 2, GOLD);
    for (const x of [112, 186]) { rect(c, x, 108, 20, 30, '#4a2c12'); rect(c, x, 108, 20, 1, '#7a4a22'); }
    // Desk props: the button, a diet cola, a phone and the lamp.
    rect(c, 118, 95, 16, 5, GREY_M); rect(c, 118, 95, 16, 1, GREY_L);
    disc(c, 126, 95, 3, RED); rect(c, 125, 93, 1, 1, '#ff8a8a');
    rect(c, 120, 90, 12, 6, pat('#9fe6ff', 4)); rect(c, 120, 90, 12, 1, '#d8f6ff');
    rect(c, 194, 92, 5, 8, '#c4ccd3'); rect(c, 194, 95, 5, 2, '#c8322d'); rect(c, 194, 92, 5, 1, '#e8ecf0');
    rect(c, 108, 96, 8, 4, K); rect(c, 109, 95, 6, 1, '#2a2f3a');
    rect(c, 204, 98, 9, 2, GOLD_DD); rect(c, 208, 89, 1, 9, GOLD_D);
    poly(c, [[200, 89], [217, 89], [214, 84], [203, 84]], MONEY_D); rect(c, 203, 84, 11, 1, MONEY);
    ellipse(c, 208, 101, 12, 2, pat('#ffd98a', 6));
    rect(c, 203, 90, 11, 1, '#ffe9a8');
  });

  function officeWorld(c: Ctx, t: number, u: number): void {
    c.drawImage(officeBack, 0, 0);
    const pose = t < START.office + 4.4 ? (u > 0.6 && u < 2.45 && Math.floor(t * 9) % 2 ? P.talk : u > 5.4 ? P.point : P.idle) : P.thumbs;
    spr(c, Math.floor(t * 10) % 37 === 0 && pose === P.idle ? P.blink : pose, 138, 56);
    c.drawImage(officeFront, 0, 0);
    if (Math.sin(t * 8) > 0) rect(c, 132, 94, 1, 1, '#ff3a3a');
  }

  function office(c: Ctx, u: number, t: number): void {
    officeWorld(wctx, t, u);
    // Cuts: wide, 2× on the President, 2× on the aide, 3× on the President, wide.
    if (u < 0.6 || u >= 5.4) c.drawImage(world, 0, 0);
    else if (u < 2.45) c.drawImage(world, 80, 40, 160, 90, 0, 0, W, H);
    else if (u < 4.35) c.drawImage(world, 0, 44, 160, 90, 0, 0, W, H);
    else c.drawImage(world, 107, 44, 107, 60, 0, 0, 321, 180);
    if (u < 0.5) iris(c, 160, 80, lerp(0, 340, easeOut(u / 0.5)));
    if (u >= 5.4) dfill(c, '#b8202c', Math.floor(t * 6) % 2 ? 2 : 0);
  }

  function button(c: Ctx, u: number, t: number): void {
    const alarm = Math.floor(u * 4) % 2;
    rect(c, 0, 0, W, H, '#3a2416');
    for (const g of grain) rect(c, g.x, g.y, g.w, 1, g.dark ? '#2a180e' : '#4a301c');
    // Hazard-striped console with a brushed plate.
    for (let y = 46; y < 166; y++) for (let x = 86; x < 234; x += 1) {
      if (x > 91 && x < 229 && y > 51 && y < 161) { x = 228; continue; }
      rect(c, x, y, 1, 1, ((x + y) >> 3) % 2 ? GOLD : K);
    }
    rect(c, 92, 52, 136, 108, GREY_M);
    for (let y = 54; y < 158; y += 3) rect(c, 94, y, 132, 1, '#626a74');
    rect(c, 92, 52, 136, 1, GREY); rect(c, 92, 52, 1, 108, GREY); rect(c, 92, 159, 136, 1, GREY_D); rect(c, 227, 52, 1, 108, GREY_D);
    for (const [sx, sy] of [[98, 58], [222, 58], [98, 154], [222, 154]]) { disc(c, sx, sy, 2, GREY_L); rect(c, sx - 1, sy, 3, 1, GREY_D); }
    rect(c, 118, 138, 84, 19, GREY_L); rect(c, 118, 138, 84, 1, WHITE); rect(c, 118, 156, 84, 1, GREY_D);
    text(c, 'DO NOT PRESS', 160, 140, { align: 'center', color: K });
    text(c, '(UNLESS FUNDED)', 160, 148, { align: 'center', color: RED_D });
    // The button.
    const pressed = u >= 4.05;
    const by = 98 + (pressed ? 3 : 0);
    disc(c, 160, 98, 35, GREY_D); disc(c, 160, 98, 34, GREY_L); disc(c, 160, 98, 32, GREY); disc(c, 160, 98, 30, K);
    disc(c, 160, by, 27, pressed ? RED_D : RED);
    disc(c, 156, by - 4, 20, pressed ? RED : '#d83a3a');
    disc(c, 151, by - 9, 9, pressed ? '#d83a3a' : '#ff7070');
    rect(c, 146, by - 14, 4, 2, WHITE); rect(c, 145, by - 12, 2, 1, WHITE);
    // Safety cover: hinged at the top, flipping open.
    const ang = ease((u - 0.3) / 0.5) * 2.5;
    const hp = Math.round(76 * Math.cos(ang));
    const top = hp >= 0 ? 62 : 62 + hp, hgt = Math.max(1, Math.abs(hp));
    rect(c, 122, top, 76, hgt, pat('#9fe6ff', hp >= 0 ? 4 : 6));
    rect(c, 122, top, 76, 1, '#d8f6ff'); rect(c, 122, top + hgt - 1, 76, 1, '#d8f6ff');
    rect(c, 122, top, 1, hgt, '#d8f6ff'); rect(c, 197, top, 1, hgt, '#d8f6ff');
    if (hgt > 10) line(c, 130, top + 3, 140, top + Math.min(hgt - 3, 30), '#eafaff');
    rect(c, 118, 59, 84, 3, GREY_L); rect(c, 118, 61, 84, 1, GREY_D);
    // Alarm beacon and rotating beams.
    const th = t * 5;
    for (const off of [0, Math.PI]) {
      const a = th + off;
      poly(c, [[300, 16], [300 + Math.cos(a - 0.14) * 420, 16 + Math.sin(a - 0.14) * 420], [300 + Math.cos(a + 0.14) * 420, 16 + Math.sin(a + 0.14) * 420]], pat('#ff3a3a', 3));
    }
    disc(c, 300, 16, 8, RED_D); disc(c, 300, 15, 6, alarm ? '#ff3a3a' : RED); rect(c, 297, 11, 3, 2, '#ffb0b0');
    dfill(c, '#b8202c', alarm ? 3 : 1);
    // The taxpayer bursts in.
    if (u > 2.3 && u < 4.0) {
      const tx = lerp(-60, 10, easeOut((u - 2.3) / 0.35));
      spr(c, taxpayerSad, tx, 52 - Math.abs(Math.sin(u * 22)) * 4, 2);
    }
    // Countdown.
    for (const [at, d] of [[1.0, '3'], [1.6, '2'], [2.2, '1']] as [number, string][]) {
      const age = u - at;
      if (age < 0 || age >= 0.6) continue;
      const s = age < 0.04 ? 6 : age < 0.08 ? 5 : 4;
      text(c, d, 270, 74 - (s - 4) * 8, { font: FP, scale: s, align: 'center', color: WHITE, outline: K, shadows: [RED, K] });
    }
    // The President's hand.
    const fy = u < 3.9 ? 36 + Math.round(Math.sin(u * 30) * (u > 0.9 ? 1 : 0)) : u < 4.05 ? lerp(36, 72, easeIn((u - 3.9) / 0.15)) : 74;
    if (u > 0.9) {
      const dy = u < 1.3 ? lerp(-90, 0, easeOut((u - 0.9) / 0.4)) : 0;
      const y = fy + dy;
      rect(c, 144, y - 140, 32, 116, NAVY); dfill(c, NAVY_DD, 6, 166, y - 140, 10, 116);
      rect(c, 144, y - 26, 32, 7, WHITE); rect(c, 144, y - 20, 32, 1, GREY_L); rect(c, 170, y - 24, 3, 3, GOLD);
      rect(c, 146, y - 19, 28, 16, SKIN); rect(c, 146, y - 19, 1, 16, SKIN_D); rect(c, 171, y - 19, 3, 16, SKIN_D);
      for (const kx of [150, 156, 162, 168]) rect(c, kx, y - 6, 4, 3, SKIN_D);
      rect(c, 155, y - 3, 9, 17, SKIN); rect(c, 162, y - 3, 2, 17, SKIN_D);
      rect(c, 156, y + 8, 7, 5, '#f2d0b0'); rect(c, 156, y + 13, 7, 1, SKIN_D);
    }
    // Impact frames, then the burst.
    if (u >= 4.05 && u < 4.3 && !reducedMotion) {
      const k = Math.floor((u - 4.05) / 0.08);
      const bg = k === 1 ? K : WHITE, fg = k === 1 ? WHITE : K;
      rect(c, 0, 0, W, H, bg);
      disc(c, 160, 101, 30, fg);
      rect(c, 144, -10, 32, 70, fg); rect(c, 155, 50, 9, 26, fg);
    } else if (u >= 4.3) {
      const pts: [number, number][] = [];
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const r = i % 2 ? 44 : 66; pts.push([236 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.62]); }
      poly(c, pts.map(([x, y]) => [236 + (x - 236) * 1.12, 64 + (y - 64) * 1.12] as [number, number]), K);
      poly(c, pts, GOLD);
      text(c, 'CLICK!', 236, 58, { font: FP, scale: 2, align: 'center', color: K });
    }
  }

  function collapse(c: Ctx, u: number, t: number): void {
    const p = clamp(u / 4.8);
    rect(c, 0, 0, W, H, K);
    c.drawImage(nebulaA, 0, 0);
    dfill(c, K, p * 8);
    const cx = 160, cy = 86;
    // Stars stretched toward the hole.
    for (const s of stars) {
      const dx = s.x - cx, dy = s.y - cy;
      const k = 1 - easeIn(p) * 0.9 * s.z;
      const x = cx + dx * k, y = cy + dy * k;
      if (p > 0.4 && s.b > 0.5) line(c, x, y, x + dx * 0.04 * p * 4, y + dy * 0.04 * p * 4, pat('#8fa0c8', 8));
      else rect(c, x, y, 1, 1, s.b > 0.6 ? WHITE : '#8fa0c8');
    }
    const rh = 5 + ease(p) * 11;
    // Back of the accretion disc, lensed over the top.
    const disk = (front: boolean) => {
      for (let i = 0; i < 260; i++) {
        const a = (i / 260) * Math.PI * 2 + t * (1.5 + p * 4) * (i % 3 ? 1 : 1.4);
        const rr = rh * (1.7 + (i % 7) * 0.22);
        const y = Math.sin(a) * rr * 0.26;
        if ((y > 0) !== front) continue;
        rect(c, cx + Math.cos(a) * rr, cy + y, 1, 1, ['#fff3c0', GOLD, '#ffb347', '#e0524b'][i % 4]);
      }
    };
    disk(false);
    ring(c, cx, cy, rh + 4, 2, pat('#ffb347', 9));
    // The Earth falls in.
    const ep = clamp(u / 4.2);
    const ea = 3.6 + ep * 7, ed = lerp(96, 0, easeIn(ep));
    if (ed > rh + 6) {
      const er = lerp(22, 5, ep);
      planet(c, cx + Math.cos(ea) * ed * 1.2, cy + Math.sin(ea) * ed * 0.55, er, t * 0.8, clamp((ep - 0.3) * 1.6));
    }
    // The fleet, the money and the furniture.
    for (const f of fallers) {
      const pp = clamp(p * (1 + (f.k % 5) * 0.08));
      const d = f.d * (1 - easeIn(pp) ** 0.8) * (1 - pp * 0.2);
      if (d < rh + 4) continue;
      const a = f.a + t * f.w * (1 + pp * 6) * (90 / Math.max(30, d));
      const x = cx + Math.cos(a) * d * 1.25, y = cy + Math.sin(a) * d * 0.62;
      const px = cx + Math.cos(a - 0.06) * (d + 6) * 1.25, py = cy + Math.sin(a - 0.06) * (d + 6) * 0.62;
      if (pp > 0.15) line(c, px, py, x, y, pat('#c9d4ff', 6));
      spr(c, f.r, x - f.r.w / 2, y - f.r.h / 2, 1, Math.sin(a) < 0);
    }
    ring(c, cx, cy, rh + 1, 1, '#ffe9a8');
    disc(c, cx, cy, rh, K);
    disk(true);
    // Radial speed lines near the end.
    if (p > 0.55) for (let i = 0; i < 18; i++) {
      const a = hash2(i, Math.floor(t * 12), 4) * Math.PI * 2, r0 = 120 + hash2(i, 1, Math.floor(t * 12)) * 80;
      line(c, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r0 - 40), cy + Math.sin(a) * (r0 - 40), pat(WHITE, 8));
    }
    // Debt counter.
    const val = 10 ** (13.6 + p * 28);
    rect(c, 96, BAR + 4, 128, 22, K); rect(c, 97, BAR + 5, 126, 20, '#1a0a0a');
    rect(c, 97, BAR + 5, 126, 1, RED); rect(c, 97, BAR + 24, 126, 1, RED_D);
    text(c, 'NATIONAL DEBT', 160, BAR + 6, { align: 'center', color: RED_L });
    text(c, p < 0.9 ? money(val, true) : Math.floor(t * 8) % 2 ? 'OVERFLOW' : '', 160, BAR + 15, { font: FP, align: 'center', color: GOLD });
    caption(c, 'EVERY DOLLAR IN EXISTENCE IS SPENT AT ONCE.', u - 0.3);
    if (u > 5.0) disc(c, cx, cy, lerp(rh, 220, easeIn((u - 5.0) / 0.55)), K);
  }

  function silence(c: Ctx, u: number): void {
    rect(c, 0, 0, W, H, K);
    const beat = (u % 0.8) < 0.1;
    rect(c, 160, 86, 1, 1, WHITE);
    if (beat) { star4(c, 160, 86, 2, WHITE); glow(c, 160, 86, 8, '#8fa0c8', 3); }
    if (u > 0.2) text(c, 'GAO: "THERE IS NOTHING LEFT TO AUDIT."'.slice(0, Math.floor((u - 0.2) * 36)), 160, 124, { align: 'center', color: GREY });
  }

  function bang(c: Ctx, u: number, t: number): void {
    if (u < 0.2 && !reducedMotion) {
      const k = Math.floor(u / 0.065);
      rect(c, 0, 0, W, H, k === 1 ? K : WHITE);
      if (k === 1) disc(c, 160, 86, 30, WHITE);
      return;
    }
    rect(c, 0, 0, W, H, K);
    const age = u - 0.2;
    // The new nebula unfolds from the centre.
    const nr = easeOut(age / 1.6) * 220;
    c.drawImage(nebulaB, 0, 0);
    iris(c, 160, 86, nr);
    drawStars(c, t, 0, 0, clamp(age / 1.2) * 16);
    const core = clamp(1 - age / 1.4);
    if (core > 0) {
      glow(c, 160, 86, 20 + 40 * core, '#ffd98a', 5 * core);
      disc(c, 160, 86, 3 + 16 * core, pat('#fff3c0', 10));
      disc(c, 160, 86, 2 + 11 * core, WHITE);
    }
    for (let k = 0; k < 4; k++) {
      const r = (age - k * 0.12) * 230;
      if (r <= 0 || r > 360) continue;
      ring(c, 160, 86, r, 3 - (k > 1 ? 1 : 0), pat([WHITE, GOLD, '#ff6ad5', '#6fd3f0'][k], 16 - r / 30));
    }
    const d = age ** 0.72;
    for (const p of debris) {
      const x = 160 + p.vx * d, y = 86 + p.vy * d;
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      rect(c, 160 + p.vx * d * 0.9, 86 + p.vy * d * 0.9, 1, 1, pat(p.c, 6));
      rect(c, x, y, p.big ? 2 : 1, p.big ? 2 : 1, p.c);
    }
    for (const b of bills) spr(c, bill, 160 + b.vx * b.v * d - 6, 86 + b.vy * b.v * d * 0.8 - 3, 1, Math.floor(t * 10 + b.ph * 10) % 2 === 0);
    // Title slam.
    if (u > 0.9) {
      const a = u - 0.9, s = a < 0.04 ? 5 : a < 0.08 ? 4 : 3;
      text(c, 'BIG BANG 2', 160, 54 - (s - 3) * 10, { font: FP, scale: s, align: 'center', spacing: 1, color: WHITE, outline: K, shadows: [RED, '#1f2f6e', K] });
      if (a > 0.1 && a < 2.4) { const k = Math.floor(a * 6) % 10; star4(c, 52 + k * 24, 54 + (k % 3) * 8, 2, WHITE); }
    }
    if (u > 1.35) text(c, 'THE SEQUEL', 160, 86, { font: FP, scale: 2, align: 'center', spacing: 1, color: GOLD, outline: K, shadows: [GOLD_DD] });
    if (u > 1.8) text(c, 'NOW IN SEVENTEEN DIMENSIONS'.slice(0, Math.floor((u - 1.8) * 40)), 160, 110, { align: 'center', color: '#dfe8ff', outline: K });
    dfill(c, WHITE, clamp((u - 3.3) / 0.45) * 16);
  }

  function universe(c: Ctx, u: number, t: number): void {
    rect(c, 0, 0, W, H, K);
    c.drawImage(nebulaB, 0, 0);
    dfill(c, K, 9);
    drawStars(c, t, u * -3, 0, 14);
    // The sun rising behind the limb, with a lens flare.
    const sy = lerp(126, 102, ease(u / 3));
    glow(c, 252, sy, 60, '#ffd98a', 5);
    disc(c, 252, sy, 8, '#fff6c8');
    for (const [k, r, col] of [[0.35, 3, '#ff6ad5'], [0.6, 5, '#6fd3f0'], [0.85, 2, GOLD], [1.15, 7, '#8a5cc8']] as [number, number, string][]) {
      disc(c, lerp(252, 160, k * 1.4), lerp(sy, 86, k * 1.4), r, pat(col, 5));
    }
    // The planet limb with atmosphere.
    const pcx = 160, pcy = 400, pr = 280;
    disc(c, pcx, pcy, pr + 5, pat('#7fd4ff', 4));
    disc(c, pcx, pcy, pr + 2, pat('#bfe9ff', 9));
    c.drawImage(newWorld, 0, 0);
    const surface = (x: number) => pcy - Math.sqrt(pr * pr - (x - pcx) ** 2);
    // Debt display.
    const started = u > 2.4;
    const val = started ? 0.01 * 10 ** Math.min(20, (u - 2.4) * 10) : 0;
    rect(c, 82, BAR + 4, 156, 22, K);
    rect(c, 83, BAR + 5, 154, 20, started ? '#1a0a0a' : '#0a1a0a');
    rect(c, 83, BAR + 5, 154, 1, started ? RED : MONEY);
    text(c, 'UNIVERSE 2 - NATIONAL DEBT', 160, BAR + 6, { align: 'center', color: started ? RED_L : '#b8e0a0' });
    text(c, val ? money(val, true) : '$0.00', 160, BAR + 15, { font: FP, align: 'center', color: started ? GOLD : '#7fd46a' });
    // The taxpayer, reassembled from stardust.
    const form = clamp((u - 1.0) / 1.2);
    const tx = 224, ty = Math.round(surface(237)) - 32;
    for (const d of dust) {
      const r = d.d * (1 - form);
      if (form < 1) rect(c, tx + 13 + Math.cos(d.a + u * 2) * r, ty + 16 + Math.sin(d.a + u * 2) * r, 1, 1, GOLD);
    }
    sprDither(c, (u > 4.05 ? taxpayerSad : taxpayer).canvas, tx, ty, form * 16);
    // The President arrives on a pallet of cash.
    const land = 1.7;
    const px = lerp(-60, 96, easeOut((u - 0.5) / (land - 0.5))), sfc = surface(px + 15);
    const py = u < land ? lerp(-60, sfc - 14, easeOut((u - 0.5) / (land - 0.5))) : sfc - 14;
    if (u > 0.5) {
      if (u < land + 0.2) for (let i = 0; i < 6; i++) rect(c, px + 4 + i * 4, py + 14 + (hash2(i, Math.floor(t * 20), 2) * 4), 2, 2, i % 2 ? '#ffb347' : GOLD);
      spr(c, cashPallet, px, py);
      const pose = u > 2.4 && u < 2.7 ? P.point : u > 2.5 && u < 4.0 && Math.floor(t * 9) % 2 ? P.talk : u > 4.0 ? P.thumbs : P.idle;
      spr(c, pose, px - 7, py - 44);
      if (u > land && u < land + 0.5) for (let i = 0; i < 10; i++) rect(c, px + 15 + (i - 5) * (u - land) * 30, py + 13 - Math.abs(i - 5) * (u - land) * 4, 1, 1, pat('#c9d4ff', 10));
      if (u > 1.95) { rect(c, px + 34, py - 18, 1, 32, GREY_L); spr(c, flag, px + 35, py - 18); }
      if (u > 2.4 && u < 3.0) text(c, '+$0.01', px + 40, py - 30 - (u - 2.4) * 16, { color: '#7fd46a', outline: K });
    }
    if (u > 4.5) iris(c, px + 15, py - 20, lerp(340, 0, easeIn((u - 4.5) / 0.5)));
  }

  const CREDITS: [string, string][] = [
    ['', 'A COST-PLUS PICTURES PRODUCTION'],
    ['DIRECTED BY', 'THE MILITARY-INDUSTRIAL COMPLEX'],
    ['PRODUCED BY', 'CONGRESS (UNREAD)'],
    ['STARRING', 'THE PRESIDENT'],
    ['ALSO STARRING', 'THE TAXPAYER (UNPAID)'],
    ['SECURITY', 'ONE VERY NERVOUS AIDE'],
    ['FINANCED BY', 'YOU'],
    ['AUDIT DEPARTMENT', '[POSITION ELIMINATED]'],
    ['CATERING', 'ONE $10,000 TOILET SEAT'],
  ];
  function credits(c: Ctx, u: number, t: number): void {
    rect(c, 0, 0, W, H, K);
    c.drawImage(nebulaA, 0, 0);
    dfill(c, K, 10);
    drawStars(c, t, 0, -u * 6, 12);
    const y0 = H - u * 60;
    CREDITS.forEach(([role, name], i) => {
      const y = y0 + i * 26;
      if (y < BAR - 20 || y > H) return;
      if (role) text(c, role, 160, y, { align: 'center', color: GREY });
      text(c, name, 160, y + 9, { font: FP, align: 'center', color: GOLD, shadows: [K] });
    });
    const lastY = y0 + CREDITS.length * 26;
    if (lastY > BAR && lastY < H) text(c, 'NO TAXPAYERS WERE CONSULTED IN THE MAKING OF THIS UNIVERSE.', 160, lastY, { align: 'center', color: '#8fa0c8' });
    if (u > 3.6) {
      rect(c, 0, BAR, W, H - BAR * 2, pat(K, clamp((u - 3.6) / 0.3) * 16));
      const a = u - 3.6, s = a < 0.04 ? 5 : a < 0.08 ? 4 : 3;
      text(c, 'THE END', 160, 62 - (s - 3) * 8, { font: FP, scale: s, align: 'center', spacing: 1, color: WHITE, outline: K, shadows: [RED, '#1f2f6e'] });
      if (u > 4.0) text(c, '(OF THE MONEY)', 160, 94, { font: FP, align: 'center', color: GOLD });
      spr(c, Math.floor(t * 10) % 23 === 0 ? P.blink : P.thumbs, 266, H - BAR - 46);
    }
    dfill(c, K, clamp((u - 4.9) / 0.5) * 16);
  }

  // ---------- Conclusion ----------
  const TITLE_Y = 48;
  const titleKicker = canvasOf(W, H, c => text(c, 'THE UNITED STATES DEPARTMENT OF WAR PRESENTS', 160, 18, { align: 'center', color: GREY_L, outline: K }));
  const titleOp = canvasOf(W, H, c => text(c, 'OPERATION', 160, 29, { font: FP, scale: 2, align: 'center', spacing: 1, color: GOLD, outline: K, shadows: [GOLD_DD, '#4a3008'] }));
  const titleMask = canvasOf(W, H, c => text(c, 'DEBT FURY', 160, TITLE_Y, { font: FP, scale: 4, align: 'center', spacing: 1, color: WHITE }));
  const titleTag = "SPEND THE TAXPAYER'S MONEY";
  const infoLine = (opts.conclusion?.line ?? '').toUpperCase();
  const planetDrop = 20;
  const surfaceY = (x: number) => 400 + planetDrop - Math.sqrt(280 * 280 - (x - 160) ** 2);
  const potusW = P.thumbs.canvas.width, potusH = P.thumbs.canvas.height;
  const taxW = taxpayer.canvas.width, taxH = taxpayer.canvas.height;

  /** Firework shells over the new world, on a fixed pseudo-random schedule. */
  function fireworks(c: Ctx, u: number): void {
    for (let k = 0; k < 3; k++) {
      const period = 2.6, local = u - 3 + k * 0.87;
      if (local < 0) continue;
      const n = Math.floor(local / period), age = local - n * period;
      if (age > 1.35) continue;
      const seed = n * 7 + k * 13;
      const fx = Math.round(24 + hash2(seed, 1, 3) * 272), fy = Math.round(26 + hash2(seed, 2, 3) * 52);
      const col = [GOLD, RED_L, '#6fd3f0', WHITE, '#ff6ad5'][Math.floor(hash2(seed, 3, 3) * 5)];
      if (age < 0.35) { rect(c, fx, fy + (1 - age / 0.35) * 70, 1, 2, pat(GOLD, 12)); continue; }
      const a = age - 0.35, r = easeOut(a / 0.9) * 24, fade = 16 * (1 - a / 1.0), drop = a * a * 10;
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        rect(c, fx + Math.cos(ang) * r, fy + Math.sin(ang) * r + drop, 1, 1, pat(col, fade));
        rect(c, fx + Math.cos(ang) * r * 0.75, fy + Math.sin(ang) * r * 0.75 + drop * 0.8, 1, 1, pat(col, fade * 0.45));
      }
      if (a < 0.08) star4(c, fx, fy, 2, WHITE);
    }
  }

  function conclusion(c: Ctx, u: number, t: number): void {
    // Sky, stars and the sun cresting the limb of the new world, with slowly turning rays.
    rect(c, 0, 0, W, H, K);
    c.drawImage(nebulaB, 0, 0);
    dfill(c, K, 8);
    drawStars(c, t, -t * 2, 0, 14);
    const sunY = 142;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI + Math.sin(t * 0.15) * 0.08, w = 0.05;
      poly(c, [[160, sunY], [160 + Math.cos(a - w) * 340, sunY + Math.sin(a - w) * 340], [160 + Math.cos(a + w) * 340, sunY + Math.sin(a + w) * 340]], pat(i % 2 ? GOLD : '#ff9a6a', 1));
    }
    glow(c, 160, sunY, 110, '#8a2f6e', 3);
    glow(c, 160, sunY, 70, '#ffd98a', 5);
    fireworks(c, u);
    // Shooting star every 7 seconds.
    const sh = (u + 2) % 7;
    if (sh < 0.5) {
      const x0 = 300 - sh * 260, y0 = 20 + sh * 60;
      line(c, x0, y0, x0 + 14, y0 - 3, pat(WHITE, 7));
      rect(c, x0, y0, 1, 1, WHITE);
    }
    disc(c, 160, sunY, 9, '#fff6c8');
    disc(c, 160, 400 + planetDrop, 285, pat('#7fd4ff', 4));
    disc(c, 160, 400 + planetDrop, 282, pat('#bfe9ff', 9));
    c.drawImage(newWorld, 0, planetDrop);
    // The President, a flag and the taxpayer stand on the new world.
    const px = 10, py = Math.round(surfaceY(px + potusW / 2)) - potusH + 2;
    spr(c, Math.floor(t * 10) % 31 === 0 ? P.blink : P.thumbs, px, py);
    const fx = px + potusW + 2, fy = Math.round(surfaceY(fx)) - 30;
    rect(c, fx, fy, 1, 30, GREY_L);
    spr(c, flag, fx + 1, fy + (Math.floor(t * 3) % 2));
    const tx = W - taxW - 14, ty = Math.round(surfaceY(tx + taxW / 2)) - taxH + 2;
    spr(c, taxpayerSad, tx, ty);
    dfill(c, K, (1 - clamp(u / 0.8)) * 16);

    // Title block.
    sprDither(c, titleKicker, 0, 0, clamp((u - 0.3) / 0.3) * 16);
    sprDither(c, titleOp, 0, 0, clamp((u - 0.5) / 0.3) * 16);
    if (u > 0.9) {
      const a = u - 0.9, s = a < 0.04 ? 6 : a < 0.08 ? 5 : 4;
      text(c, 'DEBT FURY', 160, TITLE_Y - (s - 4) * 12, { font: FP, scale: s, align: 'center', spacing: 1, color: WHITE, outline: K, shadows: [RED, '#1f2f6e'] });
      // A light sweep crosses the title every 5.5 seconds.
      const ph = (u - 1.6) % 5.5;
      if (u > 1.6 && ph < 1.1 && s === 4) {
        const sx = lerp(-40, 380, ease(ph / 1.1));
        sctx.clearRect(0, 0, W, H);
        sctx.drawImage(titleMask, 0, 0);
        sctx.globalCompositeOperation = 'source-atop';
        poly(sctx, [[sx, 0], [sx + 6, 0], [sx - 40, H], [sx - 46, H]], '#ffffff');
        poly(sctx, [[sx + 10, 0], [sx + 12, 0], [sx - 34, H], [sx - 36, H]], '#fff3c0');
        sctx.globalCompositeOperation = 'source-over';
        c.drawImage(sweep, 0, 0);
      }
      if (a < 0.07 && !reducedMotion) rect(c, 0, 0, W, H, pat(WHITE, 9));
    }
    const rw = Math.round(ease((u - 1.3) / 0.5) * 100);
    if (rw > 0) {
      rect(c, 160 - rw, 89, rw * 2 + 1, 1, GOLD_D);
      star4(c, 160, 89, 2, GOLD);
      if (rw >= 100) { star4(c, 59, 89, 1, GOLD_D); star4(c, 261, 89, 1, GOLD_D); }
    }
    if (u > 1.5) text(c, titleTag.slice(0, Math.floor((u - 1.5) * 40)), 160, 94, { font: FP, align: 'center', spacing: 1, color: GOLD, outline: K });
    if (u > 2.1 && infoLine) text(c, infoLine.slice(0, Math.floor((u - 2.1) * 50)), 160, 106, { align: 'center', color: '#c9d4ff', outline: K });
    // Twinkles around the title.
    if (u > 1.4) for (let k = 0; k < 4; k++) {
      const p = (u + k * 0.43) / 1.7, n = Math.floor(p), f = p - n;
      if (f > 0.35) continue;
      const x = Math.round(48 + hash2(n, k, 5) * 224), y = Math.round(28 + hash2(n, k, 6) * 58);
      star4(c, x, y, f < 0.12 || f > 0.24 ? 1 : 2, f < 0.12 || f > 0.24 ? GOLD : WHITE);
    }
  }

  const RENDER: Record<string, (c: Ctx, u: number, t: number) => void> = {
    ident: (c, u) => ident(c, u), establish, office, button, collapse, silence: (c, u) => silence(c, u), bang, universe, credits,
    conclusion,
  };

  // ---------- Score and sound cues ----------
  const cues: [number, () => void][] = [
    [0.1, () => { audio.music(null); audio.sfx('sting'); }],
    [1.15, () => audio.sfx('shimmer')],
    [START.establish, () => { audio.music('night'); audio.sfx('whoosh'); }],
    [START.establish + 3.2, () => audio.sfx('whoosh')],
    [START.office + 0.2, () => audio.music('brief')],
    [START.office + 5.4, () => audio.sfx('alarm')],
    [START.button, () => { audio.music('launch'); audio.sfx('whoosh'); }],
    [START.button + 0.3, () => audio.sfx('whoosh')],
    [START.button + 1.0, () => audio.sfx('thud')], [START.button + 1.6, () => audio.sfx('thud')], [START.button + 2.2, () => audio.sfx('thud')],
    [START.button + 2.3, () => audio.sfx('whoosh')],
    [START.button + 3.9, () => audio.sfx('whoosh')],
    [START.button + 4.05, () => { audio.music(null); audio.sfx('impact'); }],
    [START.button + 4.3, () => audio.sfx('click')],
    [START.collapse + 0.1, () => { audio.music('launch'); audio.sfx('riser'); }],
    [START.collapse + 1.6, () => audio.sfx('boomFar')], [START.collapse + 2.6, () => audio.sfx('riser')], [START.collapse + 3.2, () => audio.sfx('boomFar')],
    [START.collapse + 4.2, () => audio.sfx('boom')], [START.collapse + 5.0, () => audio.sfx('whoosh')],
    [START.silence, () => audio.music(null)],
    [START.silence + 0.1, () => audio.sfx('heart')], [START.silence + 0.9, () => audio.sfx('heart')],
    [START.bang, () => audio.sfx('impact')],
    [START.bang + 0.9, () => { audio.sfx('boom'); audio.music('anthem', ANTHEM_ROCKETS); }],
    [START.bang + 1.35, () => audio.sfx('shimmer')],
    [START.universe + 1.0, () => audio.sfx('shimmer')],
    [START.universe + 1.7, () => audio.sfx('thud')],
    [START.universe + 1.95, () => audio.sfx('thud')],
    [START.universe + 2.4, () => { audio.sfx('click'); audio.sfx('golden'); }],
    [START.credits + 3.6, () => audio.sfx('boom')],
    [START.credits + 4.0, () => audio.sfx('rank')],
    [START.credits + 4.7, () => audio.music(null)],
    // The closing title: the anthem drops back in from its first bar on the title slam.
    [FILM_LENGTH + 0.9, () => { audio.sfx('impact'); audio.music('anthem', ANTHEM_TOP); }],
    [FILM_LENGTH + 1.5, () => audio.sfx('shimmer')],
  ].sort((a, b) => (a[0] as number) - (b[0] as number)) as [number, () => void][];

  // Camera shake per scene, in whole pixels.
  const shakeAt = (scene: string, u: number) => {
    if (reducedMotion) return 0;
    if (scene === 'button') return u > 4.05 && u < 4.8 ? 4 : u > 2.3 && u < 2.5 ? 2 : u > 0.9 ? 1 : 0;
    if (scene === 'collapse') return Math.round(ease(u / 5) * 4);
    if (scene === 'bang') return u < 1.2 ? 4 : u > 0.9 && u < 1.15 ? 5 : 0;
    if (scene === 'credits') return u > 3.6 && u < 3.8 ? 3 : 0;
    if (scene === 'universe') return u > 1.7 && u < 1.85 ? 2 : 0;
    if (scene === 'conclusion') return u > 0.9 && u < 1.15 ? 3 : 0;
    return 0;
  };

  // ---------- Main loop ----------
  let t0 = 0, next = 0, done = false, raf = 0, started = false, settled = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', fit);
    removeEventListener('keydown', onKey);
    root.classList.add('out');
    setTimeout(() => root.remove(), 700);
  };
  /** Skips the rest of the film and goes straight to the closing title. */
  const toTitle = () => {
    if (!started || done || (performance.now() - t0) / 1000 >= FILM_LENGTH) return;
    t0 = performance.now() - FILM_LENGTH * 1000;
    while (next < cues.length && cues[next][0] < FILM_LENGTH) next++;
    audio.music(null);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toTitle(); };
  addEventListener('keydown', onKey);
  skip.addEventListener('click', toTitle);
  statsBtn.addEventListener('click', () => { if (!settled) return; audio.sfx('click'); finish(); opts.conclusion?.onStats(); });
  // Two-step confirmation: the first click arms the button, the second starts the new universe.
  let armed = 0;
  restartBtn.addEventListener('click', () => {
    if (!settled) return;
    audio.sfx('click');
    if (!armed) {
      restartBtn.textContent = '★ CONFIRM: RESET EVERYTHING ★';
      restartBtn.classList.add('armed');
      armed = window.setTimeout(() => { armed = 0; restartBtn.textContent = RESTART_LABEL; restartBtn.classList.remove('armed'); }, 4000);
      return;
    }
    clearTimeout(armed);
    finish();
    opts.conclusion?.onRestart();
  });

  /** Draws the frame for time t (seconds). */
  const render = (t: number) => {
    let scene = 'conclusion';
    for (const [id, d] of SCENES) if (t < START[id] + d) { scene = id; break; }
    const u = t - (scene === 'conclusion' ? FILM_LENGTH : START[scene]);
    const sh = shakeAt(scene, u);
    ctx.save();
    if (sh) ctx.translate(Math.round((hash2(Math.floor(t * 30), 1, 9) - 0.5) * 2 * sh), Math.round((hash2(Math.floor(t * 30), 2, 9) - 0.5) * 2 * sh));
    RENDER[scene](ctx, u, t);
    ctx.restore();
    dialogue(ctx, t);
    const impact = (scene === 'button' && u >= 4.05 && u < 4.3) || (scene === 'bang' && u < 0.2);
    if (!impact) ctx.drawImage(vignette, 0, 0);
    // The letterbox opens up for the closing title.
    const bar = scene === 'conclusion' ? Math.round(BAR * (1 - ease(u / 1.2))) : BAR;
    rect(ctx, 0, 0, W, bar, K);
    rect(ctx, 0, H - bar, W, bar, K);
  };
  const frame = (now: number) => {
    if (done) return;
    const t = (now - t0) / 1000;
    while (next < cues.length && cues[next][0] <= t) {
      // Cues missed while the tab was hidden keep their music changes but drop their sound effects.
      if (t - cues[next][0] > 0.5) {
        const live = audio;
        audio = { sfx: () => {}, music: live.music };
        cues[next++][1]();
        audio = live;
      } else cues[next++][1]();
    }
    render(t);
    if (t >= FILM_LENGTH) skip.hidden = true;
    if (!settled && t >= FILM_LENGTH + 2.6) { settled = true; root.classList.add('settled'); }
    raf = requestAnimationFrame(frame);
  };
  const begin = () => {
    if (started || done) return;
    started = true;
    if (opts.freezeAt !== undefined) {
      audio = { sfx: () => {}, music: () => {} };
      render(opts.freezeAt);
      opts.expose?.(render);
      return;
    }
    // Pre-render a frame every half second so every dither tile and glyph is cached before playback.
    const startAt = opts.startAt ?? 0;
    const live = audio;
    audio = { sfx: () => {}, music: () => {} };
    for (let w = startAt >= FILM_LENGTH ? FILM_LENGTH : 0; w < FILM_LENGTH + 4; w += 0.5) render(w);
    audio = live;
    typed.clear();
    rect(ctx, 0, 0, W, H, K);
    t0 = performance.now() - startAt * 1000;
    while (next < cues.length && cues[next][0] < startAt) next++;
    raf = requestAnimationFrame(frame);
  };
  rect(ctx, 0, 0, W, H, K);
  begin();
  return finish;
}
