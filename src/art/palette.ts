// Shared pixel-art palette. Each character in a sprite row maps to one colour.
// '.' is transparent. 'a', 'b', 'c' are the paint trio (body, shade, highlight)
// and are swapped per paint scheme and per variant.

export const FIXED: Record<string, string> = {
  k: '#14161a', // outline
  d: '#3a3f47', // dark grey
  m: '#5a616b', // mid grey
  e: '#8f99a3', // light grey
  l: '#c4ccd3', // very light grey
  w: '#f2f4f5', // white
  g: '#6fd3f0', // glass highlight
  G: '#2a7a9a', // glass dark
  r: '#c8322d', // red
  R: '#7a1c1a', // dark red
  o: '#f08a24', // orange
  y: '#f5d33f', // yellow
  n: '#2a4a8a', // navy blue
  N: '#18305e', // dark navy
  s: '#e3b48a', // skin
  S: '#a8714a', // skin shade
  t: '#c9b27c', // khaki
  T: '#8e7a4e', // dark khaki
  f: '#5d6b3a', // olive
  F: '#3c4626', // dark olive
  $: '#5fae4e', // money green
  '%': '#2f6e2f', // dark money green
  '&': '#b8e0a0', // light money green
  p: '#8a5cc8', // purple (sci-fi energy)
  P: '#4e2f80', // dark purple
};

export type Trio = [body: string, shade: string, highlight: string];

export const PAINTS = {
  grey: ['#7f8a94', '#5b646d', '#a9b3bc'],
  stealth: ['#4c535b', '#343a40', '#6c747d'],
  olive: ['#5f6e3b', '#424e28', '#7f8f52'],
  tan: ['#c2a874', '#93804f', '#dcc89a'],
  haze: ['#8a949e', '#646d76', '#b1bac2'],
  black: ['#2b2e33', '#1b1d20', '#44484f'],
  white: ['#e8ecef', '#b9c0c6', '#ffffff'],
  orange: ['#d9772b', '#a5531a', '#f2a05a'],
} satisfies Record<string, Trio>;

export type PaintId = keyof typeof PAINTS;

const GOLD: Trio = ['#d4a52a', '#9a7414', '#ffe27a'];

// Variant 0 is the base paint; variants 1-2 are alternate schemes; variant 3 is gold-plated.
export const VARIANTS: Record<PaintId, Trio[]> = {
  grey: [PAINTS.grey, ['#9fb3c4', '#7189a0', '#c8d6e2'], ['#5c7fa8', '#41618a', '#86a6cc'], GOLD],
  stealth: [PAINTS.stealth, ['#5e5470', '#433b52', '#7d7392'], ['#2e3a4a', '#1f2833', '#465668'], GOLD],
  olive: [PAINTS.olive, PAINTS.tan, ['#3f5a3a', '#2a3d27', '#5b7a54'], GOLD],
  tan: [PAINTS.tan, PAINTS.olive, ['#a88b64', '#7a6243', '#c7ab85'], GOLD],
  haze: [PAINTS.haze, ['#6e7f8f', '#506070', '#93a3b2'], ['#4a5563', '#343c47', '#6a7686'], GOLD],
  black: [PAINTS.black, ['#3b3348', '#28222f', '#564b66'], ['#2a3a2a', '#1c281c', '#3d523d'], GOLD],
  white: [PAINTS.white, ['#cfd9e3', '#9fb0c0', '#ffffff'], ['#e6e0cf', '#b8b09a', '#fffaf0'], GOLD],
  orange: [PAINTS.orange, PAINTS.white, PAINTS.grey, GOLD],
};

export const VARIANT_LABELS = ['Standard Issue', 'Low-Visibility Scheme', 'Special Livery', 'Gold-Plated'];
