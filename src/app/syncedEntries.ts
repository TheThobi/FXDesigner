/**
 * Keyed entries synced with the account, last write wins per entry: every entry carries the
 * time it was written, every removal leaves a tombstone with its time, so two devices merge
 * without losing each other's changes (like the library, see cloud.ts).
 */

export interface Stamped<T> {
  readonly value: T;
  readonly updated: number;
}

export interface SyncedState<T> {
  readonly entries: Readonly<Record<string, Stamped<T>>>;
  /** Removed keys -> removal time. */
  readonly removed: Readonly<Record<string, number>>;
}

/** Tombstones older than this are forgotten (every device has synced by then). */
export const TOMBSTONE_MAX_AGE = 180 * 24 * 3600_000;

/** What the local side must apply so that it matches the newest of both sides. */
export function mergeEntries<T>(
  local: SyncedState<T>,
  remote: SyncedState<T>,
): { set: [string, Stamped<T>][]; remove: [string, number][] } {
  const keys = new Set([
    ...Object.keys(local.entries),
    ...Object.keys(local.removed),
    ...Object.keys(remote.entries),
    ...Object.keys(remote.removed),
  ]);
  const set: [string, Stamped<T>][] = [];
  const remove: [string, number][] = [];
  for (const key of keys) {
    const mine = Math.max(local.entries[key]?.updated ?? -1, local.removed[key] ?? -1);
    const entry = remote.entries[key];
    const theirs = entry?.updated ?? -1;
    const removed = remote.removed[key] ?? -1;
    if (entry && theirs > mine && theirs >= removed) set.push([key, entry]);
    else if (removed > mine && removed > theirs) remove.push([key, removed]);
  }
  return { set, remove };
}

/** Recent tombstones only. */
export function pruneRemoved(
  removed: Readonly<Record<string, number>>,
  now = Date.now(),
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(removed).filter(([, at]) => now - at < TOMBSTONE_MAX_AGE),
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validated synced state (unknown or broken entries dropped). */
export function parseSyncedState<T>(
  raw: unknown,
  parseValue: (v: unknown) => T | null,
): SyncedState<T> {
  const o = isRecord(raw) ? raw : {};
  const entries: Record<string, Stamped<T>> = {};
  if (isRecord(o.entries))
    for (const [key, e] of Object.entries(o.entries)) {
      if (!isRecord(e) || typeof e.updated !== 'number' || !Number.isFinite(e.updated)) continue;
      const value = parseValue(e.value);
      if (value !== null) entries[key] = { value, updated: e.updated };
    }
  const removed: Record<string, number> = {};
  if (isRecord(o.removed))
    for (const [key, at] of Object.entries(o.removed))
      if (typeof at === 'number' && Number.isFinite(at)) removed[key] = at;
  return { entries, removed };
}
