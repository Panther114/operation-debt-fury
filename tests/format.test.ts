import { describe, expect, it } from 'vitest';
import { duration, fmt, money } from '../src/core/format';

describe('fmt', () => {
  it('uses commas below one million', () => {
    expect(fmt(999_999)).toBe('999,999');
    expect(money(1234)).toBe('$1,234');
  });
  it('keeps one decimal for small fractional values', () => {
    expect(fmt(2.5)).toBe('2.5');
  });
  it('uses named suffixes', () => {
    expect(fmt(1.5e6)).toBe('1.5 million');
    expect(fmt(2e9)).toBe('2 billion');
    expect(fmt(3.25e12, true)).toBe('3.25 T');
    expect(fmt(4.2e63)).toBe('4.2 vigintillion');
  });
  it('falls back to scientific notation', () => {
    expect(fmt(1.23e70)).toBe('1.23e70');
  });
  it('formats negatives and durations', () => {
    expect(money(-5e6)).toBe('-$5 million');
    expect(duration(3725)).toBe('1h 2m');
    expect(duration(65)).toBe('1m 5s');
  });
});
