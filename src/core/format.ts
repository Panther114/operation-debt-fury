const LONG = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
  'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion',
  'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion',
];
const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.?0+$/, '');
}

/** Formats a number: commas below one million, named suffixes above, scientific beyond vigintillion. */
export function fmt(n: number, short = false): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const neg = n < 0;
  n = Math.abs(n);
  let s: string;
  if (n < 1e6) {
    s = n < 100 && n % 1 !== 0 ? trim(n, 1) : Math.floor(n).toLocaleString('en-US');
  } else {
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier >= LONG.length) {
      s = n.toExponential(2).replace('e+', 'e');
    } else {
      const v = n / 10 ** (tier * 3);
      s = `${trim(v, v < 10 ? 3 : v < 100 ? 2 : 1)}${short ? ' ' + SHORT[tier] : ' ' + LONG[tier]}`;
    }
  }
  return (neg ? '-' : '') + s;
}

export function money(n: number, short = false): string {
  return (n < 0 ? '-$' : '$') + fmt(Math.abs(n), short);
}

export function duration(sec: number): string {
  if (!Number.isFinite(sec)) return 'never';
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function pct(mult: number): string {
  return `${fmt(Math.round((mult - 1) * 100))}%`;
}
