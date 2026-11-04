// Minimal typed event bus between the simulation and the UI.
import type { AssetDef } from '../data/assets';

export interface BusEvents {
  toast: { title: string; body?: string; icon?: string; tone?: 'good' | 'bad' | 'info' | 'gold' };
  achievement: { id: string; name: string; desc: string };
  briefcase: { kind: 'briefcase' | 'toilet' };
  audit: void;
  purchase: { asset?: AssetDef; kind: 'asset' | 'upgrade' | 'research' | 'lobby' | 'order' | 'contract' | 'geo'; id?: string };
  buff: void;
  prestige: { gain: number };
  rank: { name: string };
  refresh: void;
  /** The President publishes a post; `pose` picks the portrait. */
  post: { text: string; pose?: string; title?: string };
}

type Handler<T> = (payload: T) => void;
type AnyHandler = (payload: unknown) => void;
const handlers: Partial<Record<keyof BusEvents, AnyHandler[]>> = {};

export function on<K extends keyof BusEvents>(type: K, fn: Handler<BusEvents[K]>): void {
  const list: AnyHandler[] = handlers[type] ?? (handlers[type] = []);
  list.push(fn as AnyHandler);
}

export function emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]): void {
  for (const fn of handlers[type] ?? []) (fn as Handler<BusEvents[K]>)(payload);
}
