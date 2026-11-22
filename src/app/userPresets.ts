/**
 * User preset library, kept in localStorage: named snapshots of a node's settings (params,
 * Post Process look, ramp) per generator id, plus shared scopes ('@look' Post Process looks,
 * '@color' ramps). Values are re-validated when applied (presets are sanitized like built-in
 * ones), so stale entries after a schema change are safe.
 */
import { sanitizeGradient } from '../params/gradient';
import type { ParamValues, Preset } from '../params/types';
import { readStorage, writeStorage } from '../util/storage';

const STORAGE_KEY = 'ptm.userPresets';
const MAX_PER_GENERATOR = 64;

type Store = Record<string, Preset[]>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePreset(raw: unknown): Preset | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || !isRecord(raw.values)) return null;
  const ramp = sanitizeGradient(raw.ramp);
  return {
    name: raw.name.slice(0, 64),
    values: raw.values as ParamValues,
    ...(isRecord(raw.post) ? { post: raw.post as ParamValues } : {}),
    ...(ramp ? { ramp } : {}),
  };
}

export class UserPresets {
  private store: Store = {};

  constructor() {
    try {
      const raw: unknown = JSON.parse(readStorage(STORAGE_KEY) ?? '{}');
      if (!isRecord(raw)) return;
      for (const [id, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) continue;
        const presets = list.map(parsePreset).filter((p): p is Preset => p !== null);
        if (presets.length > 0) this.store[id] = presets;
      }
    } catch {
      // Corrupted storage: start with an empty library.
    }
  }

  list(generatorId: string): readonly Preset[] {
    return this.store[generatorId] ?? [];
  }

  /** Adds `preset`, replacing a preset with the same name. */
  save(generatorId: string, preset: Preset): void {
    const others = this.list(generatorId).filter((p) => p.name !== preset.name);
    this.store[generatorId] = [...others, preset].slice(-MAX_PER_GENERATOR);
    this.persist();
  }

  rename(generatorId: string, from: string, to: string): void {
    const name = to.trim().slice(0, 64);
    if (!name || name === from) return;
    this.store[generatorId] = this.list(generatorId)
      .filter((p) => p.name !== name)
      .map((p) => (p.name === from ? { ...p, name } : p));
    this.persist();
  }

  remove(generatorId: string, name: string): void {
    this.store[generatorId] = this.list(generatorId).filter((p) => p.name !== name);
    if (this.store[generatorId]!.length === 0) delete this.store[generatorId];
    this.persist();
  }

  private persist(): void {
    writeStorage(STORAGE_KEY, JSON.stringify(this.store));
  }
}
