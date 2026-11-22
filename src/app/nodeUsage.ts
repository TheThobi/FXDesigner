import type { GeneratorDefinition } from '../engine/generator';

const STORAGE_KEY = 'ptm.ui.nodeUsage';
/** Shown first until the user's own habits take over. */
const DEFAULT_ORDER = [
  'op-blend',
  'op-levels',
  'op-blur',
  'op-warp',
  'op-mask',
  'op-transform',
  'op-distance',
  'op-edges',
];
const SUGGESTIONS = 8;

function load(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Counts one more use of generator `id` (quick-add suggestions). */
export function recordNodeUsage(id: string): void {
  const counts = load();
  counts[id] = (typeof counts[id] === 'number' ? counts[id] : 0) + 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Storage full or disabled: suggestions just stay at their defaults.
  }
}

/** The most used of `candidates` (then the default operators), at most 8. */
export function mostUsedNodes<T extends GeneratorDefinition>(
  candidates: readonly T[],
  counts: Readonly<Record<string, number>> = load(),
): T[] {
  const rank = (id: string) => {
    const i = DEFAULT_ORDER.indexOf(id);
    return i < 0 ? DEFAULT_ORDER.length : i;
  };
  return candidates
    .filter((d) => (counts[d.id] ?? 0) > 0 || DEFAULT_ORDER.includes(d.id))
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || rank(a.id) - rank(b.id))
    .slice(0, SUGGESTIONS);
}
