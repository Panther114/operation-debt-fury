import type { SpriteDef } from '../types';
import { PixelGrid } from '../pixel';

// Political caricature art: the President, the Taxpayer, a podium, flags and an eagle.
// Portraits are composed from shapes on a PixelGrid, then hand-detailed with stamps.

// ---------- The President (bust, 40 x 46) ----------

type Pose = 'idle' | 'talk' | 'blink' | 'point' | 'thumbs' | 'sign' | 'shout';

function presidentBase(): PixelGrid {
  const p = new PixelGrid(44, 46);
  const X = 2; // horizontal offset so raised hands fit
  // Suit and shoulders.
  p.ellipse(22, 55, 21, 20, 'n', (_x, y) => y >= 33);
  // Neck.
  p.rect(16, 28, 13, 8, 'u');
  // Shirt V.
  p.poly([[15, 33], [29, 33], [22, 44]], 'w');
  // Lapels.
  p.poly([[12, 35], [16, 33], [22, 45], [19, 46], [13, 46]], 'N');
  p.poly([[32, 35], [28, 33], [22, 45], [25, 46], [31, 46]], 'N');
  // Tie: knot and long blade.
  p.poly([[20, 33], [24, 33], [23.5, 36], [20.5, 36]], 'r');
  p.poly([[20.5, 36], [23.5, 36], [25, 45], [22, 46.5], [19, 45]], 'r');
  p.shade('r', 'R');
  // Flag lapel pin.
  p.stamp(12, 37, ['zW', 'Zz']);
  // Ears.
  p.ellipse(11.5, 21.5, 2.2, 3.2, 'u');
  p.ellipse(32.5, 21.5, 2.2, 3.2, 'u');
  // Face and jowls.
  p.ellipse(22, 20, 9.6, 11.2, 'u');
  p.ellipse(22, 25.5, 10.6, 6.2, 'u');
  // Hair: a large mass with a diagonal fringe swept to the viewer's left.
  const bang = (x: number) => 9.5 + (33 - x) * 0.27;
  p.ellipse(22, 10, 15.2, 9.6, 'h', (x, y) => y < bang(x) || ((x < 13 || x > 31) && y < 18));
  p.poly([[4, 12], [13, 12], [14.5, 16.5], [9, 18], [5, 16.5]], 'h');
  void X;
  return p;
}

function presidentFinish(p: PixelGrid, pose: Pose): PixelGrid {
  // Hair texture: comb lines following the sweep, a darker underside along the fringe.
  const layer = (x: number, y: number) => Math.round(y - (33 - x) * 0.27);
  p.recolor('h', 'H', (x, y) => y > 3 && ((layer(x, y) % 3) + 3) % 3 === 0);
  p.recolor('h', 'H', (x, y) => p.get(x, y + 1) === 'u' || p.get(x, y + 2) === 'u');
  p.recolor('H', 'j', (x, y) => p.get(x, y + 1) === 'u');
  p.recolor('h', 'W', (x, y) => y <= 4 && x >= 12 && x <= 24 && (p.get(x, y - 1) === '.' || p.get(x - 1, y) === '.'));
  // Face shading.
  p.shade('u', 'U');
  p.recolor('u', 'U', (x, y) => y >= 30 || (x >= 29 && y >= 16));
  // Ear detail.
  p.set(11, 21, 'U').set(11, 22, 'U').set(33, 21, 'U').set(33, 22, 'U');
  // Eyebrows (pale, furrowed).
  p.stamp(14, 15, ['HHHh.', '..HHH']);
  p.stamp(25, 15, ['.hHHH', 'HHH..']);
  // Pale eye circles and squinting eyes.
  const eyes = pose === 'blink'
    ? ['.iiii.', 'iUUUUi', '.iiii.']
    : ['.iiii.', 'ikkkWi', '.iiii.'];
  p.stamp(14, 17, eyes);
  p.stamp(25, 17, eyes.map(r => [...r].reverse().join('')));
  // Nose.
  p.stamp(21, 19, ['.U', '.U', 'UU', 'UUv', 'vUv']);
  // Cheek blush.
  p.stamp(15, 22, ['qU']);
  p.stamp(28, 22, ['Uq']);
  // Mouth.
  const mouths: Record<string, string[]> = {
    idle: ['.vqqv.', 'vqRRqv', '.vqqv.'],
    blink: ['.vqqv.', 'vqRRqv', '.vqqv.'],
    talk: ['.vqqqv.', 'vqkkkqv', 'vqkrkqv', '.vqqqv.'],
    shout: ['vqqqqqv', 'qkkkkkq', 'qkrrrkq', 'qkkkkkq', '.vqqqv.'],
  };
  const m = mouths[pose] ?? mouths.idle;
  p.stamp(pose === 'talk' || pose === 'shout' ? 19 : 19, 25, m);
  // Jowl and chin lines.
  p.stamp(14, 27, ['U']); p.stamp(30, 27, ['U']);
  p.stamp(18, 30, ['.UUUUUUU.']);
  return p;
}

function hand(p: PixelGrid, kind: 'point' | 'thumbs'): void {
  if (kind === 'point') {
    // Raised hand pointing sideways at the viewer's left, sleeve below.
    p.poly([[3, 34], [8, 33], [11, 46], [4, 46]], 'n');
    p.rect(3, 31, 6, 3, 'w');
    p.rect(3, 25, 6, 6, 'u');
    p.rect(0, 25, 3, 2, 'u');
    p.stamp(3, 27, ['UUUUU', '....U', 'UUUUU']);
    p.set(8, 25, 'U');
  } else {
    p.poly([[0, 37], [6, 34], [9, 46], [1, 46]], 'n');
    p.rect(0, 33, 7, 2, 'w');
    p.rect(0, 27, 7, 6, 'u');
    p.rect(2, 22, 3, 5, 'u');
    p.stamp(0, 28, ['UUUUUU', '......U', 'UUUUUU', '......U']);
  }
}

function folder(p: PixelGrid): void {
  // A signed executive order held up in a black folder, signature facing out.
  p.rect(5, 29, 34, 17, 'k');
  p.rect(6, 30, 32, 16, 'd');
  p.rect(7, 31, 30, 15, 'W');
  p.stamp(9, 32, [
    'mmmmmmmmmmmmmmmmmmmmmmmmm',
    '.........................',
    'mmmmmmmmmmmmmmmmmmmmm....',
    '.........................',
    'mmmmmmmmmmmmmmmmmmmmmmmm.',
    '.........................',
    'k..k.kk...k..kk..k....k..',
    'kk.kk.kk.kkk.k.kk.kk.kk.k',
    '.kk.k..kk.k.kk..k..kkk.kk',
    '..k.....k.........k......',
    'mmmmmmmmmmmmmmmmmm.......',
  ]);
  // Hands gripping the folder edges.
  p.rect(2, 33, 4, 6, 'u');
  p.rect(38, 33, 4, 6, 'u');
  p.set(2, 38, 'U').set(41, 38, 'U');
}

function president(pose: Pose): string[] {
  const p = presidentBase();
  if (pose === 'point') hand(p, 'point');
  if (pose === 'thumbs') hand(p, 'thumbs');
  presidentFinish(p, pose === 'point' || pose === 'thumbs' ? 'talk' : pose === 'sign' ? 'talk' : pose);
  if (pose === 'sign') folder(p);
  p.outline('k');
  return p.rows();
}

// ---------- The Taxpayer (24 x 32), four stages of despair ----------

function taxpayer(stage: 0 | 1 | 2 | 3): string[] {
  const p = new PixelGrid(26, 32);
  if (stage < 3) {
    // Legs and shoes.
    p.rect(8, 23, 4, 7, 'n'); p.rect(14, 23, 4, 7, 'n');
    p.rect(7, 29, 5, 2, 'd'); p.rect(14, 29, 5, 2, 'd');
    // Torso: a work shirt.
    p.rect(7, 14, 12, 10, stage === 2 ? 'e' : 'l');
    p.rect(12, 14, 2, 10, stage === 2 ? 'm' : 'e');
    // Arms.
    if (stage === 0) {
      p.rect(4, 15, 3, 7, 'l'); p.rect(19, 13, 3, 4, 'l'); p.rect(20, 9, 3, 4, 's');
      // Wallet held up proudly, stuffed with bills.
      p.rect(19, 5, 6, 5, 'X'); p.rect(20, 4, 4, 2, '$');
    } else if (stage === 1) {
      p.rect(4, 15, 3, 7, 'l'); p.rect(19, 15, 3, 7, 'l');
      p.rect(4, 22, 3, 2, 's'); p.rect(19, 22, 3, 2, 's');
      p.rect(20, 22, 5, 3, 'X');
    } else {
      // Pockets turned out, arms raised in despair.
      p.rect(3, 9, 3, 6, 'e'); p.rect(20, 9, 3, 6, 'e');
      p.rect(3, 6, 3, 3, 's'); p.rect(20, 6, 3, 3, 's');
      p.rect(6, 22, 3, 3, 'w'); p.rect(17, 22, 3, 3, 'w');
    }
  } else {
    // Wearing only a barrel held up by suspenders.
    p.rect(9, 27, 3, 3, 's'); p.rect(14, 27, 3, 3, 's');
    p.ellipse(13, 21, 8.5, 7.5, 'x');
    p.recolor('x', 'X', (_x, y) => y === 17 || y === 24);
    p.recolor('x', 'X', (x) => x === 8 || x === 18);
    p.rect(6, 12, 3, 5, 's'); p.rect(17, 12, 3, 5, 's');
    p.rect(9, 12, 8, 3, 's');
    p.rect(10, 13, 1, 4, 'r'); p.rect(15, 13, 1, 4, 'r');
  }
  // Head.
  p.ellipse(13, 7, 5, 5.5, 's');
  p.rect(8, 1, 10, 3, stage === 3 ? 'm' : 'X');
  p.rect(7, 3, 2, 3, stage === 3 ? 'm' : 'X'); p.rect(17, 3, 2, 3, stage === 3 ? 'm' : 'X');
  p.shade('s', 'S');
  const faces = [
    ['k...k', '.....', 'k...k', '.kkk.'],
    ['k...k', '.g...', 'k..gk', '.kkk.', 'k...k'],
    ['k...k', 'g...g', 'g...g', '.kkk.', 'k...k'],
    ['kk.kk', 'g...g', 'g...g', '.....', '.kkk.', 'k...k'],
  ];
  p.stamp(11, 6, faces[stage]);
  if (stage >= 1) p.set(8, 4, 'g').set(8, 5, 'g');
  p.outline('k');
  return p.rows();
}

// ---------- Podium with an eagle seal (44 x 30) ----------

function podium(): string[] {
  const p = new PixelGrid(44, 30);
  p.poly([[4, 0], [40, 0], [37, 30], [7, 30]], 'x');
  p.rect(2, 0, 40, 3, 'X');
  p.shade('x', 'X', 2);
  p.ellipse(22, 15, 9, 9, 'Z');
  p.ellipse(22, 15, 7.5, 7.5, 'n');
  p.recolor('Z', 'y', (x, y) => (x + y) % 3 === 0);
  p.stamp(15, 10, [
    '.....kWk......',
    '....kWWWk.....',
    'kk..kWyWk..kk.',
    'AAk.kAAAk.kAA.',
    '.AAkAAAAAkAA..',
    '..AAzWzWzAA...',
    '...AZZZZZA....',
    '....zWzWz.....',
    '....A.A.A.....',
  ]);
  p.outline('k');
  return p.rows();
}

// ---------- Bald eagle (48 x 30), wings spread ----------

function eagle(): string[] {
  const p = new PixelGrid(52, 32);
  // Wings.
  p.poly([[26, 12], [14, 4], [2, 2], [6, 7], [1, 9], [7, 12], [3, 15], [10, 17], [8, 20], [18, 19], [24, 20]], 'A');
  p.poly([[26, 12], [38, 4], [50, 2], [46, 7], [51, 9], [45, 12], [49, 15], [42, 17], [44, 20], [34, 19], [28, 20]], 'A');
  p.recolor('A', 'B', (x, y) => (x + y * 2) % 5 === 0);
  // Body.
  p.ellipse(26, 18, 5.5, 8, 'A');
  // Tail.
  p.poly([[22, 24], [30, 24], [32, 31], [20, 31]], 'W');
  // Head.
  p.ellipse(26, 8, 4.5, 4.5, 'W');
  p.poly([[29, 7], [34, 8], [33, 11], [29, 10]], 'y');
  p.set(33, 10, 'o').set(28, 7, 'k');
  // Talons with a shield.
  p.rect(22, 23, 9, 2, 'y');
  p.rect(23, 15, 7, 7, 'W');
  p.rect(23, 15, 7, 2, 'Z');
  p.recolor('W', 'z', (x, y) => y >= 17 && y <= 21 && x >= 23 && x <= 29 && x % 2 === 1);
  p.outline('k');
  return p.rows();
}

// ---------- Small flags ----------

const FLAG_PIN = [
  'kk........',
  'kZZWzzzzz.',
  'kZWZWWWWW.',
  'kZZWzzzzz.',
  'kWWWWWWWW.',
  'kzzzzzzzz.',
  'k.........',
  'k.........',
  'kk........',
];

const FLAG = [
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  'kZWZWZWZWZzzzzzzzzzzzzzk',
  'kZZWZWZWZZWWWWWWWWWWWWWk',
  'kZWZWZWZWZzzzzzzzzzzzzzk',
  'kZZWZWZWZZWWWWWWWWWWWWWk',
  'kZWZWZWZWZzzzzzzzzzzzzzk',
  'kZZZZZZZZZWWWWWWWWWWWWWk',
  'kzzzzzzzzzzzzzzzzzzzzzzk',
  'kWWWWWWWWWWWWWWWWWWWWWWk',
  'kzzzzzzzzzzzzzzzzzzzzzzk',
  'kWWWWWWWWWWWWWWWWWWWWWWk',
  'kzzzzzzzzzzzzzzzzzzzzzzk',
  'kkkkkkkkkkkkkkkkkkkkkkkk',
];

// A red campaign-style cap, used as an icon.
const CAP = [
  '.....kkkkkkk......',
  '...kkzzzzzzzkk....',
  '..kzzzWzzzzzzzk...',
  '.kzzzzzzzzzzzzzk..',
  '.kzzWWWWWWWWzzzk..',
  'kzzzzzzzzzzzzzzzk.',
  'kzzzzzzzzzzzzzzzkk',
  'kRRRRRRRRRRRRRRRRRk',
].map(r => r.padEnd(19, '.'));

export const SPRITES: Record<string, SpriteDef> = {
  potus: { rows: president('idle') },
  potus_blink: { rows: president('blink') },
  potus_talk: { rows: president('talk') },
  potus_shout: { rows: president('shout') },
  potus_point: { rows: president('point') },
  potus_thumbs: { rows: president('thumbs') },
  potus_sign: { rows: president('sign') },
  taxpayer0: { rows: taxpayer(0) },
  taxpayer1: { rows: taxpayer(1) },
  taxpayer2: { rows: taxpayer(2) },
  taxpayer3: { rows: taxpayer(3) },
  podium: { rows: podium() },
  eagle: { rows: eagle() },
  flagpin: { rows: FLAG_PIN },
  flag: { rows: FLAG },
  cap: { rows: CAP },
};
