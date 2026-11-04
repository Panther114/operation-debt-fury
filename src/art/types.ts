import type { PaintId } from './palette';

export interface Anchor { x: number; y: number }

/**
 * A palette-indexed pixel sprite. Rows face right (nose/bow towards +x).
 * Every row must have the same length; '.' is transparent.
 */
export interface SpriteDef {
  rows: string[];
  /** Paint scheme used for the 'a'/'b'/'c' characters. Defaults to 'grey'. */
  paint?: PaintId;
  /** Optional dedicated 32x32 store icon for sprites wider than 40 px. */
  icon?: string[];
  /** Main rotor hub; a flickering blade line of `len` px is drawn centred on it. */
  rotor?: Anchor & { len: number };
  /** Second rotor (tandem helicopters, tiltrotors). */
  rotor2?: Anchor & { len: number };
  /** Engine exhaust point for an afterburner/thruster flicker. */
  exhaust?: Anchor;
  /** Draw extra copies of other sprites as one formation (used by the strike group). */
  composite?: { id: string; dx: number; dy: number }[];
}
