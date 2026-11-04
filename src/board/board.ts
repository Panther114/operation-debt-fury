// The animated force board: every owned asset appears in its domain lane and takes part
// in a never-ending, extremely expensive live-fire exercise.
import { ASSETS, ASSET_BY_ID, type AssetDef } from '../data/assets';
import { raster } from '../art/sprite';
import type { GameState } from '../core/state';
import { assetVariant, mods } from '../core/economy';

interface Unit {
  asset: AssetDef;
  x: number;
  /** Baseline (bottom of sprite) in board pixels. */
  y: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  depth: number;
  fireAt: number;
  /** Muzzle-flash timer. */
  flash: number;
}

type PKind = 'px' | 'smoke' | 'glow' | 'ring' | 'bill';

interface Particle {
  kind: PKind;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string; size: number;
  grav?: number; drag?: number; grow?: number; spin?: number;
}

interface Projectile {
  kind: 'missile' | 'shell' | 'bomb' | 'interceptor' | 'icbm' | 'beam';
  x: number; y: number; vx: number; vy: number;
  ttl: number;
  /** Ground/water level at which the projectile detonates. */
  floor: number;
  size: number;
  trail: string;
  /** For beams: end point. */
  x2?: number; y2?: number;
}

interface Deploy { asset: AssetDef; t: number; dur: number; variant: number }

interface Lanes { space: [number, number]; air: [number, number]; ground: [number, number]; sea: [number, number] }

const LANE_LABEL: Record<string, string> = { space: 'ORBIT', air: 'AIR', ground: 'GROUND', sea: 'SEA' };
const MAX_PARTICLES = 1400;

export class Board {
  private ctx: CanvasRenderingContext2D;
  private units: Unit[] = [];
  private particles: Particle[] = [];
  private shots: Projectile[] = [];
  private clouds: { x: number; y: number; w: number; s: number }[] = [];
  private stars: { x: number; y: number; t: number }[] = [];
  /** Board pixel scale: one sprite pixel is `px` canvas pixels. */
  private px = 2;
  private W = 0;
  private H = 0;
  private lanes!: Lanes;
  private t = 0;
  private hover: Unit | null = null;
  private trauma = 0;
  private flashLight = 0;
  private deploys: Deploy[] = [];
  /** Recent explosion count, used to throttle the distant-boom sound. */
  private boomBudget = 0;
  onUnitClick: (a: AssetDef, clientX: number, clientY: number) => void = () => {};
  /** Called for large on-board blasts so the game can shake the screen and play sound. */
  onBlast: (size: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private state: () => GameState) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    canvas.addEventListener('click', e => {
      const u = this.unitAt(e);
      if (u) this.onUnitClick(u.asset, e.clientX, e.clientY);
    });
    canvas.addEventListener('mousemove', e => {
      this.hover = this.unitAt(e);
      canvas.style.cursor = this.hover ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => { this.hover = null; });
  }

  private resize(): void {
    const box = this.canvas.parentElement!.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(box.width * dpr));
    const hgt = Math.max(1, Math.floor(box.height * dpr));
    // Assigning canvas dimensions clears it, so only do so when they actually change.
    if (w === this.canvas.width && hgt === this.canvas.height && this.lanes) return;
    this.canvas.width = w;
    this.canvas.height = hgt;
    this.px = Math.max(1, Math.round(Math.min(hgt / 300, w / 420)));
    this.W = Math.ceil(this.canvas.width / this.px);
    this.H = Math.ceil(this.canvas.height / this.px);
    const H = this.H;
    this.lanes = {
      space: [0, Math.round(H * 0.17)],
      air: [Math.round(H * 0.17), Math.round(H * 0.58)],
      ground: [Math.round(H * 0.58), Math.round(H * 0.76)],
      sea: [Math.round(H * 0.76), H],
    };
    this.clouds = Array.from({ length: 8 }, () => ({ x: Math.random() * this.W, y: this.lanes.air[0] + 6 + Math.random() * (this.lanes.air[1] - this.lanes.air[0] - 30), w: 16 + Math.random() * 34, s: 2 + Math.random() * 3 }));
    this.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.lanes.space[1], t: Math.random() * 6 }));
    for (const u of this.units) this.placeY(u);
  }

  private shown(owned: number, cap: number): number {
    return owned <= 0 ? 0 : Math.min(cap, Math.ceil(Math.sqrt(owned)));
  }

  private placeY(u: Unit): void {
    const r = raster(u.asset.id);
    const [top, bot] = this.lanes[u.asset.domain];
    const span = bot - top;
    switch (u.asset.domain) {
      case 'air': u.y = top + r.h + 4 + u.depth * Math.max(1, span - r.h - 12); break;
      case 'ground': u.y = top + 8 + u.depth * (span - 10); break;
      case 'sea': u.y = top + 7 + u.depth * (span - 9); break;
      case 'space': u.y = top + r.h + 2 + u.depth * Math.max(1, span - r.h - 4); break;
    }
    if (u.asset.behaviour === 'fixed') u.y = u.asset.id === 'dyson' ? top + Math.min(span, 40) : top + span - 1;
  }

  /** Reconciles the sprite population with what the player owns. */
  sync(): void {
    const s = this.state();
    for (const a of ASSETS) {
      const want = this.shown(s.owned[a.id] ?? 0, a.cap);
      const have = this.units.filter(u => u.asset === a);
      for (let i = have.length; i < want; i++) this.units.push(this.spawn(a, i));
      if (have.length > want) {
        const drop = new Set(have.slice(want));
        this.units = this.units.filter(u => !drop.has(u));
      }
    }
    // Draw back-to-front: deeper units (higher depth) are closer to the viewer.
    this.units.sort((p, q) => p.depth - q.depth);
  }

  private spawn(a: AssetDef, i: number): Unit {
    const moving = a.speed > 0;
    const dir: 1 | -1 = a.domain === 'air' || a.domain === 'space' ? (Math.random() < 0.5 ? 1 : -1) : Math.random() < 0.75 ? 1 : -1;
    const u: Unit = {
      asset: a,
      x: moving ? Math.random() * this.W : this.staticX(a, i),
      y: 0,
      dir: a.behaviour === 'static' || a.behaviour === 'silo' || a.behaviour === 'fixed' ? 1 : dir,
      speed: a.speed * (0.8 + Math.random() * 0.4),
      phase: Math.random() * Math.PI * 2,
      depth: a.behaviour === 'fixed' ? 0 : Math.random(),
      fireAt: 2 + Math.random() * 10,
      flash: 0,
    };
    this.placeY(u);
    return u;
  }

  private staticX(a: AssetDef, i: number): number {
    if (a.id === 'lunar') return this.W - 60;
    if (a.id === 'dyson') return 4;
    const slot = { patriot: 0.08, thaad: 0.3, sentinel: 0.55 }[a.id as 'patriot'] ?? 0.5;
    return this.W * slot + i * 26;
  }

  private unitAt(e: MouseEvent): Unit | null {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const x = ((e.clientX - rect.left) * scaleX) / this.px;
    const y = ((e.clientY - rect.top) * scaleX) / this.px;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const r = raster(u.asset.id);
      const top = u.y - r.h + this.bob(u);
      if (x >= u.x - 2 && x <= u.x + r.w + 2 && y >= top - 2 && y <= u.y + this.bob(u) + 2) return u;
    }
    return null;
  }

  private bob(u: Unit): number {
    switch (u.asset.behaviour) {
      case 'fly': return Math.sin(this.t * 0.8 + u.phase) * 2;
      case 'hover': return Math.sin(this.t * 1.6 + u.phase) * 2.5;
      case 'sail': case 'submarine': return Math.round(Math.sin(this.t * 1.2 + u.phase) * 0.6);
      case 'orbit': return Math.sin(this.t * 0.4 + u.phase) * 3;
      default: return 0;
    }
  }

  // ---------- Effects API ----------

  private add(p: Particle): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
  }

  /** Adds camera trauma (0-1); shake magnitude is trauma squared. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** A full explosion: light flash, fireball, smoke, debris, shockwave and, naturally, cash. */
  explode(x: number, y: number, size = 1, cash = true): void {
    const s = this.state();
    const n = Math.round(10 * size);
    this.add({ kind: 'glow', x, y, vx: 0, vy: 0, life: 0, max: 0.35 + 0.1 * size, color: '255,200,90', size: 14 * size });
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0, max: 0.45, color: 'rgba(255,240,200,0.7)', size: 2, grow: 45 * size });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (20 + Math.random() * 60) * Math.sqrt(size);
      this.add({ kind: 'px', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0, max: 0.4 + Math.random() * 0.4, color: ['#fff6c8', '#f5d33f', '#f08a24', '#c8322d'][i % 4], size: Math.random() < 0.3 ? 2 : 1, drag: 3 });
    }
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      this.add({ kind: 'smoke', x: x + (Math.random() - 0.5) * 6 * size, y: y + (Math.random() - 0.5) * 4 * size, vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 10, life: 0, max: 1.4 + Math.random() * 1.2, color: Math.random() < 0.5 ? '70,70,74' : '110,106,100', size: 2 + Math.random() * 2 * size, grow: 5 + 4 * size });
    }
    for (let i = 0; i < Math.round(4 * size); i++) {
      this.add({ kind: 'px', x, y, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 60, life: 0, max: 1.2, color: '#3a3f47', size: 1, grav: 140 });
    }
    if (cash && !s.settings.reducedMotion) {
      for (let i = 0; i < Math.round(3 * size); i++) {
        this.add({ kind: 'bill', x, y, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 0, max: 2.2, color: '#5fae4e', size: 1, grav: 30, drag: 1.5, spin: Math.random() * 10 });
      }
    }
    this.flashLight = Math.min(0.5, this.flashLight + 0.06 * size);
    this.shake(0.04 * size);
    this.boomBudget += size;
    if (size >= 2.5) this.onBlast(size);
  }

  private muzzle(x: number, y: number, dir: number): void {
    this.add({ kind: 'glow', x, y, vx: 0, vy: 0, life: 0, max: 0.12, color: '255,220,140', size: 6 });
    for (let i = 0; i < 4; i++) this.add({ kind: 'px', x, y, vx: dir * (40 + Math.random() * 40), vy: (Math.random() - 0.5) * 20, life: 0, max: 0.12, color: '#fff6c8', size: 1 });
    this.add({ kind: 'smoke', x: x + dir * 3, y, vx: dir * 6, vy: -4, life: 0, max: 0.9, color: '150,150,150', size: 2, grow: 6 });
  }

  /** Cash burst on the board (pallet clicks). */
  burst(fx: number, count = 6): void {
    const x = fx * this.W;
    for (let i = 0; i < count; i++) {
      this.add({ kind: 'bill', x: x + (Math.random() - 0.5) * 40, y: this.lanes.air[0] - 4, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, life: 0, max: 3, color: '#5fae4e', size: 1, grav: 15, drag: 0.8, spin: Math.random() * 10 });
    }
  }

  /** Starts the letterboxed "new asset deployed" cinematic. */
  deploy(a: AssetDef): void {
    if (this.state().settings.reducedMotion) return;
    this.deploys = this.deploys.filter(d => d.asset !== a);
    this.deploys.push({ asset: a, t: 0, dur: 3.6, variant: assetVariant(this.state(), a.id) });
  }

  /** Removes all particles, projectiles and cinematics (used when a new administration starts). */
  clearFx(): void {
    this.particles = [];
    this.shots = [];
    this.deploys = [];
  }

  // ---------- Combat behaviours ----------

  private fire(u: Unit): void {
    const a = u.asset, r = raster(a.id);
    const tags = a.tags;
    const bob = this.bob(u);
    const top = u.y - r.h + bob;
    const front = u.dir > 0 ? u.x + r.w : u.x;
    const gTop = this.lanes.ground[0], gBot = this.lanes.ground[1];
    const sea = this.lanes.sea[0];
    u.flash = 0.12;
    if (tags.includes('bomber')) {
      // Carpet bombing run: a stick of bombs released along the flight path.
      for (let i = 0; i < 6; i++) {
        this.shots.push({ kind: 'bomb', x: u.x + r.w / 2 - u.dir * i * 4, y: u.y + bob - 1, vx: u.dir * u.speed * 0.6, vy: 4 + i * 2, ttl: 8, floor: gTop + 4 + Math.random() * (gBot - gTop - 6), size: 1.6, trail: '' });
      }
    } else if (a.id === 'a10') {
      // BRRRT: a tracer stream raking the ground.
      const gx = front + u.dir * 50, gy = gTop + 6 + Math.random() * 10;
      this.shots.push({ kind: 'beam', x: front, y: u.y - 3 + bob, vx: 0, vy: 0, ttl: 0.35, floor: 0, size: 1, trail: '#f5d33f', x2: gx, y2: gy });
      for (let i = 0; i < 6; i++) setTimeout(() => this.explode(gx + u.dir * i * 5, gy + (Math.random() - 0.5) * 3, 0.6, false), i * 50);
    } else if (tags.includes('fighter') || a.id === 'ah64' || a.id === 'mq9') {
      this.shots.push({ kind: 'missile', x: front, y: u.y - 2 + bob, vx: u.dir * (120 + Math.random() * 40), vy: a.id === 'ah64' || a.id === 'mq9' ? 30 : (Math.random() - 0.5) * 10, ttl: 0.6 + Math.random() * 0.6, floor: gTop + 8 + Math.random() * 12, size: 1.2, trail: 'rgba(230,230,230,0.8)' });
    } else if (tags.includes('tank') || a.id === 'stryker') {
      this.muzzle(front, top + 3, u.dir);
      this.shots.push({ kind: 'shell', x: front, y: top + 3, vx: u.dir * 140, vy: -25, ttl: 3, floor: u.y + (Math.random() - 0.5) * 4, size: 1.2, trail: '' });
      this.shake(0.03);
    } else if (a.id === 'himars') {
      for (let i = 0; i < 3; i++) setTimeout(() => this.shots.push({ kind: 'missile', x: u.x + r.w * 0.35, y: top, vx: u.dir * (55 + i * 12), vy: -90, ttl: 6, floor: gTop + 4 + Math.random() * 14, size: 1.8, trail: 'rgba(210,210,210,0.85)' }), i * 160);
    } else if (tags.includes('air-defense')) {
      // Interceptors climb and airburst in a flash of light.
      const n = a.id === 'thaad' ? 2 : 3;
      for (let i = 0; i < n; i++) setTimeout(() => this.shots.push({ kind: 'interceptor', x: u.x + r.w * 0.6, y: top, vx: 25 + Math.random() * 30, vy: -150, ttl: 0.7 + Math.random() * 0.7, floor: -999, size: 1.6, trail: 'rgba(235,235,235,0.9)' }), i * 220);
    } else if (a.id === 'sentinel') {
      this.shots.push({ kind: 'icbm', x: u.x + r.w / 2, y: top, vx: 6, vy: -40, ttl: 6, floor: -999, size: 3, trail: 'rgba(240,240,240,0.95)' });
      this.shake(0.25);
      this.onBlast(2.6);
    } else if (a.id === 'ddg' || a.id === 'lcs' || a.id === 'csg' || a.id === 'lha') {
      // Vertical launch, then pitch over towards the horizon.
      this.add({ kind: 'glow', x: u.x + r.w * 0.6, y: top, vx: 0, vy: 0, life: 0, max: 0.2, color: '255,210,120', size: 10 });
      this.shots.push({ kind: 'missile', x: u.x + r.w * 0.6, y: top, vx: u.dir * 10, vy: -110, ttl: 5, floor: gTop + 6 + Math.random() * 14, size: 1.8, trail: 'rgba(225,225,225,0.85)' });
    } else if (a.id === 'cvn') {
      // Catapult launch: a steam plume and a jet rocketing off the bow.
      for (let i = 0; i < 6; i++) this.add({ kind: 'smoke', x: front - u.dir * i * 4, y: top + 4, vx: -u.dir * 10, vy: -6, life: 0, max: 1, color: '235,235,235', size: 2, grow: 4 });
      this.shots.push({ kind: 'missile', x: front, y: top + 3, vx: u.dir * 120, vy: -30, ttl: 4, floor: -999, size: 0, trail: 'rgba(255,255,255,0.6)' });
    } else if (a.domain === 'space') {
      const tx = Math.random() * this.W, ty = this.lanes.air[0] + Math.random() * (gTop - this.lanes.air[0]);
      this.shots.push({ kind: 'beam', x: u.x + r.w / 2, y: u.y - r.h / 2 + bob, vx: 0, vy: 0, ttl: 0.5, floor: 0, size: 2, trail: a.id === 'dyson' ? '#f5d33f' : '#b48cff', x2: tx, y2: ty });
      setTimeout(() => this.explode(tx, ty, a.id === 'dyson' ? 3 : 1.8), 120);
    } else if (tags.includes('ship')) {
      this.muzzle(front, top + 4, u.dir);
      this.shots.push({ kind: 'shell', x: front, y: top + 4, vx: u.dir * 120, vy: -40, ttl: 3, floor: sea + 2 + Math.random() * 10, size: 1, trail: '' });
    }
  }

  private fireInterval(a: AssetDef): number {
    if (a.id === 'sentinel') return 25 + Math.random() * 30;
    if (a.tags.includes('bomber')) return 9 + Math.random() * 10;
    if (a.domain === 'space') return 5 + Math.random() * 7;
    if (a.tags.includes('transport') || a.tags.includes('support') || a.tags.includes('trainer') || a.tags.includes('infantry') || a.tags.includes('sub') || a.id === 'humvee' || a.id === 'mk6') return Infinity;
    return 5 + Math.random() * 9;
  }

  update(dt: number): void {
    const s = this.state();
    const reduced = s.settings.reducedMotion;
    this.t += dt;
    const W = this.W;
    // Combat tempo rises with spending intensity.
    const tempo = 0.6 + Math.min(1.4, Math.log10(1 + mods(s).rate) / 15);
    for (const u of this.units) {
      const r = raster(u.asset.id);
      const b = u.asset.behaviour;
      u.flash = Math.max(0, u.flash - dt);
      u.fireAt -= dt * tempo;
      const visible = u.x > 0 && u.x + r.w < W;
      if (u.fireAt <= 0) {
        u.fireAt = this.fireInterval(u.asset);
        if (!reduced && visible && this.shots.length < 60) this.fire(u);
      }
      if (b === 'static' || b === 'silo' || b === 'fixed') continue;
      let v = u.speed * dt * (reduced ? 0.4 : 1);
      if (b === 'hover') v *= 0.6 + 0.4 * Math.sin(this.t * 0.3 + u.phase);
      u.x += v * u.dir;
      if (u.dir > 0 && u.x > W + 10) u.x = -r.w - 10 - Math.random() * 40;
      if (u.dir < 0 && u.x < -r.w - 10) u.x = W + 10 + Math.random() * 40;
      if (b === 'hover' && Math.random() < dt * 0.05) u.dir = u.dir > 0 ? -1 : 1;
      if (reduced) continue;
      // Contrails and engine glow.
      if ((b === 'fly' || b === 'orbit') && r.def.exhaust && Math.random() < dt * 14) {
        const ex = r.def.exhaust;
        const x = u.dir > 0 ? u.x + ex.x : u.x + r.w - ex.x;
        this.add({ kind: b === 'orbit' ? 'px' : 'smoke', x, y: u.y - r.h + ex.y + this.bob(u), vx: -u.dir * 6, vy: 0, life: 0, max: b === 'orbit' ? 0.6 : 1.6, color: b === 'orbit' ? '#6fd3f0' : '235,240,245', size: b === 'orbit' ? 1 : 0.8, grow: 1.5 });
      }
      if (b === 'sail' && Math.random() < dt * 10) {
        this.add({ kind: 'px', x: u.dir > 0 ? u.x : u.x + r.w, y: u.y - 1, vx: -u.dir * 4, vy: 0, life: 0, max: 1.4, color: 'rgba(242,244,245,0.8)', size: 1 });
        this.add({ kind: 'px', x: u.dir > 0 ? u.x + r.w : u.x, y: u.y - 1, vx: u.dir * 3, vy: -3, life: 0, max: 0.5, color: 'rgba(242,244,245,0.9)', size: 1 });
      }
      if ((u.asset.tags.includes('vehicle')) && Math.random() < dt * 3) {
        this.add({ kind: 'smoke', x: u.dir > 0 ? u.x : u.x + r.w, y: u.y - 1, vx: -u.dir * 3, vy: -2, life: 0, max: 0.8, color: '160,140,100', size: 1, grow: 3 });
      }
    }
    this.updateShots(dt);
    for (const p of this.particles) {
      p.life += dt;
      if (p.drag) { p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); }
      if (p.grav) p.vy += p.grav * dt;
      if (p.grow) p.size += p.grow * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.particles = this.particles.filter(p => p.life < p.max);
    for (const c of this.clouds) { c.x += c.s * dt; if (c.x > W + 10) c.x = -c.w - 10; }
    this.trauma = Math.max(0, this.trauma - dt * 1.2);
    this.flashLight = Math.max(0, this.flashLight - dt * 1.5);
    this.boomBudget = Math.max(0, this.boomBudget - dt * 2);
    for (const d of this.deploys) d.t += dt;
    this.deploys = this.deploys.filter(d => d.t < d.dur);
  }

  private updateShots(dt: number): void {
    const keep: Projectile[] = [];
    for (const p of this.shots) {
      p.ttl -= dt;
      if (p.kind === 'beam') { if (p.ttl > 0) keep.push(p); continue; }
      if (p.kind === 'shell' || p.kind === 'bomb') p.vy += 60 * dt;
      if (p.kind === 'missile' && p.vy < -20 && p.y < this.lanes.air[0] + 30) p.vy += 140 * dt;
      if (p.kind === 'missile' && p.size > 1.5 && p.vy < 40) { p.vy += 70 * dt; p.vx *= 1 + dt * 0.8; }
      if (p.kind === 'icbm') { p.vy -= 90 * dt; p.vx += 4 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.trail && Math.random() < 0.9) {
        this.add({ kind: 'smoke', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 0, max: p.kind === 'icbm' ? 3.5 : 1.3, color: p.kind === 'icbm' ? '240,240,240' : '220,220,220', size: p.kind === 'icbm' ? 2.5 : 1, grow: p.kind === 'icbm' ? 4 : 2 });
        this.add({ kind: 'px', x: p.x, y: p.y, vx: 0, vy: 0, life: 0, max: 0.08, color: '#f5d33f', size: p.kind === 'icbm' ? 2 : 1 });
      }
      const hitFloor = p.floor > -999 && p.vy > 0 && p.y >= p.floor;
      if (hitFloor || p.ttl <= 0) {
        if (p.kind === 'icbm') this.explode(p.x, p.y, 1.5);
        else if (p.size > 0) this.explode(p.x, p.y, p.kind === 'interceptor' ? 1.4 : p.size, p.kind !== 'shell');
        if (p.y >= this.lanes.sea[0] && hitFloor) this.splash(p.x, p.y);
        continue;
      }
      if (p.x < -40 || p.x > this.W + 40 || p.y < -60) continue;
      keep.push(p);
    }
    this.shots = keep;
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 10; i++) this.add({ kind: 'px', x, y, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0, max: 0.8, color: '#e8f4fa', size: 1, grav: 120 });
  }

  // ---------- Drawing ----------

  draw(): void {
    const { ctx, px } = this;
    const s = this.state();
    const shake = this.trauma * this.trauma * 6;
    const ox = (Math.random() - 0.5) * shake, oy = (Math.random() - 0.5) * shake;
    ctx.setTransform(px, 0, 0, px, Math.round(ox * px), Math.round(oy * px));
    ctx.imageSmoothingEnabled = false;
    this.drawBackground();
    const lead = new Map<string, Unit>();
    for (const u of this.units) {
      const v = assetVariant(s, u.asset.id);
      const r = raster(u.asset.id, v, u.dir < 0);
      const bob = this.bob(u);
      const x = Math.round(u.x), y = Math.round(u.y - r.h + bob);
      if (u.asset.id === 'dyson') {
        const cx = x + r.w / 2, cy = this.lanes.space[0] + 2 + r.h / 2;
        this.glow(cx, cy, r.w * (0.9 + 0.05 * Math.sin(this.t * 2)), '255,200,80', 0.35);
        ctx.drawImage(r.canvas, x, Math.round(this.lanes.space[0] + 2));
      } else if (u.asset.behaviour === 'submarine') {
        ctx.drawImage(r.canvas, x, y + 3);
      } else {
        ctx.drawImage(r.canvas, x, y);
      }
      this.drawRotors(u, r.w, x, y);
      if (r.def.exhaust && (u.asset.behaviour === 'fly' || u.asset.behaviour === 'orbit')) {
        const ex = r.def.exhaust;
        const ex0 = u.dir > 0 ? x + ex.x - 3 : x + r.w - ex.x;
        const flick = 0.6 + 0.4 * Math.sin(this.t * 45 + u.phase);
        this.glow(ex0 + 1.5, y + ex.y + 0.5, 4 * flick, u.asset.behaviour === 'orbit' ? '110,210,240' : '255,150,60', 0.6);
        ctx.fillStyle = flick > 0.7 ? '#fff6c8' : '#f08a24';
        ctx.fillRect(ex0, y + ex.y, 3, 1);
      }
      if (u.flash > 0) this.glow(u.dir > 0 ? x + r.w : x, y + r.h / 2, 5, '255,220,140', u.flash * 6);
      const onScreen = (q: Unit) => q.x > -5 && q.x < this.W - 40;
      const prev = lead.get(u.asset.id);
      if (!prev || (onScreen(u) && !onScreen(prev))) lead.set(u.asset.id, u);
    }
    this.drawShots();
    this.drawParticles();
    // Global light flash from explosions.
    if (this.flashLight > 0.01) {
      ctx.fillStyle = `rgba(255,220,160,${this.flashLight * 0.35})`;
      ctx.fillRect(-10, -10, this.W + 20, this.H + 20);
    }
    // Frenzy tint: the whole theatre glows gold while spending is boosted.
    if (s.buffs.some(b => b.good && (b.rate ?? 1) >= 7)) {
      ctx.fillStyle = `rgba(245,211,63,${0.06 + 0.04 * Math.sin(this.t * 6)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (s.buffs.some(b => !b.good)) {
      ctx.fillStyle = `rgba(200,40,40,${0.08 + 0.06 * Math.sin(this.t * 8)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    this.drawVignette();
    this.drawLabels(lead);
    this.drawDeploys();
    if (!this.units.length) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(10, px * 5)}px Silkscreen, monospace`;
      ctx.fillText('No assets deployed. Click the pallet, then buy a Recruit.', this.canvas.width / 2, this.canvas.height * 0.45);
      ctx.textAlign = 'left';
    }
  }

  private glow(x: number, y: number, r: number, rgb: string, a: number): void {
    if (r <= 0 || a <= 0) return;
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prev;
  }

  private drawShots(): void {
    const ctx = this.ctx;
    for (const p of this.shots) {
      if (p.kind === 'beam') {
        const a = Math.max(0, p.ttl / 0.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.trail;
        ctx.globalAlpha = a;
        ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2!, p.y2!); ctx.stroke();
        ctx.lineWidth = p.size * 3; ctx.globalAlpha = a * 0.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2!, p.y2!); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (p.size === 0) {
        // Catapult-launched jet: draw a tiny F/A-18 silhouette.
        const r = raster('f18', 0, p.vx < 0);
        ctx.drawImage(r.canvas, Math.round(p.x - r.w / 2), Math.round(p.y - r.h / 2));
        continue;
      }
      ctx.fillStyle = p.kind === 'bomb' ? '#2b2e33' : p.kind === 'shell' ? '#fff6c8' : '#e8ecef';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.kind === 'icbm' ? 2 : p.kind === 'bomb' ? 2 : 1, p.kind === 'icbm' ? 5 : 1);
      if (p.kind !== 'bomb') this.glow(p.x, p.y, p.kind === 'icbm' ? 9 : 3, '255,190,90', 0.8);
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      switch (p.kind) {
        case 'px':
          ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.5));
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
          break;
        case 'smoke':
          ctx.fillStyle = `rgba(${p.color},${0.32 * k})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'glow':
          this.glow(p.x, p.y, p.size * (0.6 + 0.4 * k), p.color, k);
          break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.globalAlpha = k; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'bill': {
          ctx.globalAlpha = Math.min(1, k * 2);
          const w = Math.abs(Math.cos(this.t * (p.spin ?? 5) + p.x)) * 4 + 1;
          ctx.fillStyle = '#2f6e2f'; ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y), Math.round(w), 2);
          ctx.fillStyle = '#b8e0a0'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawVignette(): void {
    const { ctx, W, H } = this;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  private drawLabels(lead: Map<string, Unit>): void {
    const { ctx, px } = this;
    const s = this.state();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(9, Math.round(px * 4.5));
    ctx.font = `${fs}px Silkscreen, monospace`;
    ctx.textBaseline = 'bottom';
    for (const [k, lab] of Object.entries(LANE_LABEL)) {
      const [top] = this.lanes[k as keyof Lanes];
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(lab, 6, (top + 1) * px + fs + 2);
    }
    // Labels: every type when enabled in settings, otherwise only the hovered type.
    const hovered = this.hover?.asset.id;
    for (const [id, u] of lead) {
      if (!s.settings.labels && id !== hovered) continue;
      const owned = s.owned[id] ?? 0;
      const r = raster(id);
      const text = `${ASSET_BY_ID[id].short} ×${owned.toLocaleString('en-US')}`;
      const w = ctx.measureText(text).width;
      const x = Math.round((u.x + r.w / 2) * px - w / 2);
      const yTop = u.asset.id === 'dyson' ? (this.lanes.space[0] + 2) * px : (u.y - r.h + this.bob(u) - 1) * px;
      if (x < -w || x > this.canvas.width) continue;
      ctx.fillStyle = 'rgba(10,14,18,0.6)';
      ctx.fillRect(x - 3, yTop - fs - 1, w + 6, fs + 2);
      ctx.fillStyle = u === this.hover ? '#f5d33f' : '#e8ecef';
      ctx.fillText(text, x, yTop);
    }
  }

  /** Letterboxed cinematic: bars slide in, the new asset sweeps across in close-up, a title card types out. */
  private drawDeploys(): void {
    const d = this.deploys[0];
    if (!d) return;
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const p = d.t / d.dur;
    const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
    const inOut = Math.min(ease(d.t / 0.35), ease((d.dur - d.t) / 0.35));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Darken and letterbox.
    ctx.fillStyle = `rgba(0,0,0,${0.55 * inOut})`;
    ctx.fillRect(0, 0, cw, ch);
    const bar = ch * 0.14 * inOut;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, bar);
    ctx.fillRect(0, ch - bar, cw, bar);
    // Speed lines.
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * inOut})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const y = bar + ((i * 97 + Math.floor(d.t * 60) * 13) % Math.max(1, ch - bar * 2));
      const x = ((i * 211 - d.t * 2400) % (cw + 400)) + cw;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120 + (i % 3) * 60, y); ctx.stroke();
    }
    // Hero sprite: big, sweeping slowly across the centre.
    const r = raster(d.asset.id, d.variant);
    const scale = Math.max(2, Math.floor(Math.min((cw * 0.55) / r.w, (ch * 0.38) / r.h)));
    const sw = r.w * scale, sh = r.h * scale;
    const travel = d.asset.speed > 0 ? (p - 0.5) * cw * 0.35 : 0;
    const hx = cw / 2 - sw / 2 + travel;
    const hy = ch * 0.47 - sh / 2 + Math.sin(d.t * 3) * scale;
    ctx.globalAlpha = inOut;
    ctx.imageSmoothingEnabled = false;
    // Spotlight behind the hero.
    const g = ctx.createRadialGradient(cw / 2, hy + sh / 2, 0, cw / 2, hy + sh / 2, Math.max(sw, sh));
    g.addColorStop(0, 'rgba(245,211,63,0.35)');
    g.addColorStop(1, 'rgba(245,211,63,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bar, cw, ch - bar * 2);
    ctx.drawImage(r.canvas, Math.round(hx), Math.round(hy), sw, sh);
    // Title card.
    const title = d.asset.name.toUpperCase();
    const typed = title.slice(0, Math.floor(Math.max(0, d.t - 0.4) * 28));
    const fs = Math.max(14, Math.round(cw / 26));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(fs * 0.55)}px Silkscreen, monospace`;
    ctx.fillStyle = '#f08a24';
    ctx.fillText('NEW ASSET DEPLOYED', cw / 2, bar + fs * 0.9);
    ctx.font = `${fs}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText(typed, cw / 2 + 3, ch - bar - fs * 1.2 + 3);
    ctx.fillStyle = '#f5d33f';
    ctx.fillText(typed, cw / 2, ch - bar - fs * 1.2);
    ctx.font = `${Math.round(fs * 0.45)}px Silkscreen, monospace`;
    ctx.fillStyle = '#c5ced6';
    if (d.t > 1.2) ctx.fillText(`Unit cost (real world): ${d.asset.realCost}`, cw / 2, ch - bar - fs * 0.35);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
  }

  private drawRotors(u: Unit, w: number, x: number, y: number): void {
    const def = raster(u.asset.id).def;
    const ctx = this.ctx;
    for (const rot of [def.rotor, def.rotor2]) {
      if (!rot) continue;
      const rx = u.dir > 0 ? x + rot.x : x + w - 1 - rot.x;
      const phase = Math.floor(this.t * 30 + u.phase * 10) % 3;
      const len = [rot.len, Math.round(rot.len * 0.6), Math.round(rot.len * 0.85)][phase];
      ctx.fillStyle = 'rgba(30,34,40,0.85)';
      ctx.fillRect(Math.round(rx - len / 2), y + rot.y - 1, len, 1);
      ctx.fillStyle = 'rgba(200,210,220,0.35)';
      ctx.fillRect(Math.round(rx - rot.len / 2), y + rot.y - 2, rot.len, 1);
    }
  }

  private drawBackground(): void {
    const { ctx, W, lanes } = this;
    const s = this.state();
    const intensity = Math.min(1, Math.log10(1 + mods(s).rate) / 30);
    // Space.
    const sp = ctx.createLinearGradient(0, 0, 0, lanes.space[1]);
    sp.addColorStop(0, '#05060d'); sp.addColorStop(1, '#141a33');
    ctx.fillStyle = sp; ctx.fillRect(-10, -10, W + 20, lanes.space[1] + 10);
    for (const st of this.stars) {
      ctx.fillStyle = Math.sin(this.t * 2 + st.t) > 0.6 ? '#ffffff' : '#7f8aa8';
      ctx.fillRect(Math.round(st.x), Math.round(st.y), 1, 1);
    }
    // Sky: warms towards a burning sunset as spending intensity rises.
    const sky = ctx.createLinearGradient(0, lanes.air[0], 0, lanes.air[1]);
    sky.addColorStop(0, '#1d2f55');
    sky.addColorStop(0.55, mix('#4f86b8', '#b8664a', intensity));
    sky.addColorStop(1, mix('#a7cbe0', '#f0b070', intensity));
    ctx.fillStyle = sky; ctx.fillRect(-10, lanes.air[0], W + 20, lanes.air[1] - lanes.air[0]);
    // A sun low on the horizon.
    const sunY = lanes.ground[0] - 14 + intensity * 6;
    this.glow(W * 0.78, sunY, 40, intensity > 0.4 ? '255,150,80' : '255,240,200', 0.5);
    ctx.fillStyle = intensity > 0.4 ? '#ffb070' : '#fff2c8';
    ctx.beginPath(); ctx.arc(W * 0.78, sunY, 7, 0, Math.PI * 2); ctx.fill();
    for (const c of this.clouds) {
      ctx.fillStyle = 'rgba(242,244,245,0.55)';
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), 3);
      ctx.fillRect(Math.round(c.x + c.w * 0.2), Math.round(c.y - 2), Math.round(c.w * 0.5), 2);
      ctx.fillStyle = 'rgba(200,210,225,0.45)';
      ctx.fillRect(Math.round(c.x + 2), Math.round(c.y + 3), Math.round(c.w - 4), 1);
    }
    // Distant mountains on the horizon.
    const gTop = lanes.ground[0];
    ctx.fillStyle = '#5d6f86';
    for (let x = -10; x < W + 10; x++) {
      const h = 6 + Math.round(5 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.13 + 1));
      ctx.fillRect(x, gTop - h, 1, h);
    }
    // Ground strip.
    ctx.fillStyle = '#8a7a52'; ctx.fillRect(-10, gTop, W + 20, lanes.ground[1] - gTop);
    ctx.fillStyle = '#6f8a3e'; ctx.fillRect(-10, gTop, W + 20, 2);
    ctx.fillStyle = '#7a6b46';
    for (let x = 0; x < W; x += 7) ctx.fillRect(x, gTop + 4 + ((x * 13) % 9), 2, 1);
    ctx.fillStyle = '#a08f63'; ctx.fillRect(-10, lanes.ground[1] - 3, W + 20, 3);
    // Sea.
    const sea = ctx.createLinearGradient(0, lanes.sea[0], 0, lanes.sea[1]);
    sea.addColorStop(0, '#2a5f8a'); sea.addColorStop(1, '#10304d');
    ctx.fillStyle = sea; ctx.fillRect(-10, lanes.sea[0], W + 20, lanes.sea[1] - lanes.sea[0] + 10);
    ctx.fillStyle = 'rgba(180,220,240,0.35)';
    for (let row = 0; row < 6; row++) {
      const y = lanes.sea[0] + 3 + row * Math.max(3, Math.floor((lanes.sea[1] - lanes.sea[0]) / 6));
      const off = (this.t * (6 + row * 2)) % 16;
      for (let x = -16; x < W; x += 16) ctx.fillRect(Math.round(x + off + row * 5), y, 4, 1);
    }
  }

  /** Whether enough explosions have happened recently to justify a distant boom sound. */
  takeBoom(): boolean {
    if (this.boomBudget > 3) { this.boomBudget -= 3; return true; }
    return false;
  }
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
