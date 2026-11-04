// A small character-grid canvas used to compose larger pixel portraits from shapes.
// Shapes are filled with palette characters; outline() and shade() then add the
// hand-drawn look (1 px dark outline, lower-right shading). The result is plain
// sprite rows, so it renders and validates exactly like hand-written sprites.

export class PixelGrid {
  readonly g: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }

  get(x: number, y: number): string {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.g[y][x];
  }

  set(x: number, y: number, c: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
    return this;
  }

  /** Fills every cell for which `pred` holds. */
  fill(c: string, pred: (x: number, y: number) => boolean): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (pred(x, y)) this.g[y][x] = c;
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, clip?: (x: number, y: number) => boolean): this {
    return this.fill(c, (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && (!clip || clip(x, y)));
  }

  rect(x0: number, y0: number, w: number, h: number, c: string): this {
    return this.fill(c, (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h);
  }

  poly(pts: [number, number][], c: string, clip?: (x: number, y: number) => boolean): this {
    return this.fill(c, (x, y) => inPoly(x + 0.5, y + 0.5, pts) && (!clip || clip(x, y)));
  }

  /** Recolours existing cells of colour `from` that satisfy `pred`. */
  recolor(from: string, to: string, pred: (x: number, y: number) => boolean = () => true): this {
    return this.fill(to, (x, y) => this.g[y][x] === from && pred(x, y));
  }

  /** Stamps a hand-drawn patch; '.' in the patch leaves the cell untouched, ' ' clears it. */
  stamp(x0: number, y0: number, rows: string[]): this {
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch === '.') return;
      this.set(x0 + dx, y0 + dy, ch === ' ' ? '.' : ch);
    }));
    return this;
  }

  /** Adds a 1 px outline around all filled cells (4-neighbour). */
  outline(c = 'k'): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y][x] !== '.') continue;
      const n = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
      if (n.some(v => v !== '.' && v !== c)) add.push([x, y]);
    }
    for (const [x, y] of add) this.g[y][x] = c;
    return this;
  }

  /**
   * Darkens cells of colour `from` that border a different colour (or empty space)
   * on their right or lower side, giving a light-from-upper-left look.
   */
  shade(from: string, to: string, depth = 1): this {
    const hits: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y][x] !== from) continue;
      for (let d = 1; d <= depth; d++) {
        const r = this.get(x + d, y), b = this.get(x, y + d);
        if ((r !== from && r !== to) || (b !== from && b !== to)) { hits.push([x, y]); break; }
      }
    }
    for (const [x, y] of hits) this.g[y][x] = to;
    return this;
  }

  /** Lightens cells of colour `from` bordering another colour on their left or upper side. */
  light(from: string, to: string): this {
    const hits: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y][x] !== from) continue;
      const l = this.get(x - 1, y), t = this.get(x, y - 1);
      if ((l !== from && l !== to) || (t !== from && t !== to)) hits.push([x, y]);
    }
    for (const [x, y] of hits) this.g[y][x] = to;
    return this;
  }

  clone(): PixelGrid {
    const p = new PixelGrid(this.w, this.h);
    this.g.forEach((row, y) => row.forEach((c, x) => { p.g[y][x] = c; }));
    return p;
  }

  rows(): string[] {
    return this.g.map(r => r.join(''));
  }
}

export function inPoly(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
