import type { GeneratorDefinition } from '../engine/generator';
import { POST_PARAMS } from '../engine/post/schema';
import type { ParamValues } from '../params/types';
import { defaultValues, sanitizeValues } from '../params/values';

export const RESOLUTIONS = [128, 256, 512, 1024, 2048, 4096] as const;
export const DEFAULT_RESOLUTION = 512;
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
}

export function postDefaults(def: GeneratorDefinition): ParamValues {
  return sanitizeValues(POST_PARAMS, def.defaultPost ?? {}, defaultValues(POST_PARAMS));
}

export function paramsOf(state: EditorState, def: GeneratorDefinition): ParamValues {
  return state.params[def.id] ?? defaultValues(def.params);
}

export function postOf(state: EditorState, def: GeneratorDefinition): ParamValues {
  return state.post[def.id] ?? postDefaults(def);
}

export function nearestResolution(size: number): number {
  let best: number = DEFAULT_RESOLUTION;
  for (const r of RESOLUTIONS) if (Math.abs(r - size) < Math.abs(best - size)) best = r;
  return best;
}
