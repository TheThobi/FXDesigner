/**
 * Node inputs. A generator declares the inputs its shaders sample (`GeneratorDefinition.inputs`):
 * operators (Blend, Warp, Mask…) and some simulations (Smoke & Fire emitter). Each one is
 * bound as `sampler2D u_in_<key>` (the connected node's output, a blank texture otherwise)
 * with `bool u_has_<key>`. Combining images is always an operator's job.
 */
import type { GeneratorDefinition } from './generator';

export interface NodeInputDef {
  /** Stable key (persisted in links). Sampled as `u_in_<key>`. */
  readonly key: string;
  readonly label: string;
  readonly description: string;
  /** Link color (CSS). */
  readonly color: string;
  /**
   * Value the input reads: 'gray' (one channel: masks, patterns, height) or 'color' (RGB, e.g.
   * flow vectors). Absent: any image. Links feeding another kind are drawn as a gradient.
   */
  readonly value?: NodeValueType;
  /** Parameters that only matter when this input is connected (greyed out otherwise). */
  readonly params?: readonly string[];
}

/** Kind of value an image carries (detected on node outputs, declared on inputs). */
export type NodeValueType = 'gray' | 'color';

export function inputsOf(def: GeneratorDefinition): readonly NodeInputDef[] {
  return def.inputs ?? [];
}

/**
 * Extra node outputs (e.g. Unpack RGBA): each one is a channel of the node's image as an opaque
 * grayscale. A generator declaring outputs has no main output pin; links name the output key.
 */
export interface NodeOutputDef {
  /** Stable key (persisted in links). */
  readonly key: string;
  readonly label: string;
  readonly description: string;
  /** Pin / link color (CSS). */
  readonly color: string;
  /** Channel of the node's image: 0 = R, 1 = G, 2 = B, 3 = A. */
  readonly channel: 0 | 1 | 2 | 3;
}

export function outputsOf(def: GeneratorDefinition): readonly NodeOutputDef[] {
  return def.outputs ?? [];
}
