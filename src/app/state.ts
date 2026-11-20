import type { GeneratorDefinition } from '../engine/generator';
import { POST_PARAMS, POST_PROCESS_PARAMS } from '../engine/post/schema';
import { param } from '../params/define';
import type { GradientValue } from '../params/gradient';
import type { ParamDef, ParamValues } from '../params/types';
import { MAX_SEED } from '../util/random';
import { defaultValues, sanitizeValues } from '../params/values';

export const RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;
export const DEFAULT_RESOLUTION = 512;
/** Settings shared by every generator, edited in the Output tab (stored as EditorState fields). */
export const GLOBAL_PARAMS: readonly ParamDef[] = [
  param.int('seed', 'Seed', 1, 0, MAX_SEED, {
    group: 'General',
    description: 'Random seed shared by generators and simulations.',
  }),
  param.select(
    'resolution',
    'Export resolution',
    RESOLUTIONS.map((r) => ({ label: `${r} × ${r}`, value: r })),
    DEFAULT_RESOLUTION,
    { group: 'General', description: 'PNG / flipbook export size. The preview is capped at 1024.' },
  ),
];

/** The live preview never renders larger than this (exports use the full resolution). */
export const MAX_PREVIEW_SIZE = 1024;

/**
 * Editable state. Parameter values are kept per generator so switching back and forth doesn't
 * lose tweaks. Must stay plain JSON-compatible data (it is snapshotted for undo).
 */
export interface EditorState {
  readonly generatorId: string;
  readonly params: Readonly<Record<string, ParamValues>>;
  readonly post: Readonly<Record<string, ParamValues>>;
  readonly resolution: number;
  readonly seed: number;
  /** Shared color ramp used by every generator unless it overrides it. */
  readonly ramp: GradientValue;
  /**
   * 'global': the Post Process look (modules) is shared by every generator and survives
   * switching; 'local': each generator keeps its own look.
   */
  readonly postScope: PostScope;
  /** The shared look (scoped post keys only), used in global scope. */
  readonly sharedPost: ParamValues;
}

export type PostScope = 'global' | 'local';

/**
 * Post values that follow the scope: the look modules. Color mode, ramp override, output and
 * animation settings always stay per generator (they depend on what the generator outputs).
 */
export const SCOPED_POST_PARAMS: readonly ParamDef[] = POST_PROCESS_PARAMS.filter(
  (d) => d.key !== 'colorMode',
);
const SCOPED_KEYS = new Set(SCOPED_POST_PARAMS.map((d) => d.key));

export function pickScoped(values: ParamValues): ParamValues {
  return Object.fromEntries(Object.entries(values).filter(([k]) => SCOPED_KEYS.has(k)));
}

function omitScoped(values: ParamValues): ParamValues {
  return Object.fromEntries(Object.entries(values).filter(([k]) => !SCOPED_KEYS.has(k)));
}

export function defaultSharedPost(): ParamValues {
  return defaultValues(SCOPED_POST_PARAMS);
}

export function postDefaults(def: GeneratorDefinition): ParamValues {
  return sanitizeValues(POST_PARAMS, def.defaultPost ?? {}, defaultValues(POST_PARAMS));
}

export function paramsOf(state: EditorState, def: GeneratorDefinition): ParamValues {
  return state.params[def.id] ?? defaultValues(def.params);
}

/**
 * Post values as seen by `def`. Global scope: the shared look always wins. Local scope: the
 * generator's own look wins, and a generator never edited locally inherits the last shared
 * look (so switching scope never makes looks disappear).
 */
export function postOf(state: EditorState, def: GeneratorDefinition): ParamValues {
  const own = state.post[def.id];
  const base = postDefaults(def);
  if (def.dataOutput) return own ?? base;
  const shared = sanitizeValues(SCOPED_POST_PARAMS, state.sharedPost, defaultSharedPost());
  return state.postScope === 'global'
    ? { ...base, ...own, ...shared }
    : { ...base, ...shared, ...own };
}

/** Stores full post `values` for `def`, routing the look to the shared slot in global scope. */
export function withPostValues(
  state: EditorState,
  def: GeneratorDefinition,
  values: ParamValues,
): EditorState {
  if (state.postScope !== 'global' || def.dataOutput)
    return { ...state, post: { ...state.post, [def.id]: values } };
  return {
    ...state,
    sharedPost: pickScoped(values),
    post: { ...state.post, [def.id]: { ...(state.post[def.id] ?? {}), ...omitScoped(values) } },
  };
}

/** Switches scope without changing what `def` currently looks like. */
export function withPostScope(
  state: EditorState,
  def: GeneratorDefinition,
  scope: PostScope,
): EditorState {
  if (scope === state.postScope) return state;
  const current = postOf(state, def);
  const next: EditorState = { ...state, postScope: scope };
  return scope === 'global'
    ? { ...next, sharedPost: pickScoped(current) }
    : { ...next, post: { ...state.post, [def.id]: current } };
}

export function nearestResolution(size: number): number {
  let best: number = DEFAULT_RESOLUTION;
  for (const r of RESOLUTIONS) if (Math.abs(r - size) < Math.abs(best - size)) best = r;
  return best;
}
