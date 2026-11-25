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
   * Value the input reads: 'float' (one channel: masks, patterns, height), 'vec2' (flow
   * vectors in RG)… Absent: any image (RGBA). Links feeding another type are drawn as a
   * gradient.
   */
  readonly value?: NodeValueType;
  /** Parameters that only matter when this input is connected (greyed out otherwise). */
  readonly params?: readonly string[];
  /** Fallback values used only when this input is disconnected. */
  readonly fallbackParams?: readonly string[];
  /** Channel of the node's image shown in its preview while this pin is hovered (Pack RGBA). */
  readonly preview?: NodeChannel;
}

/**
 * Channel of an image: 0 = R, 1 = G, 2 = B, 3 = A (opaque grayscale), 4 = RGB (opaque),
 * 5 = RG (flow vectors, B = 0, opaque).
 */
export type NodeChannel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Value carried by a pin, Shader Graph-like: one channel (float), two (vec2: flow vectors),
 * RGB (vec3) or RGBA (vec4). Outputs: RGBA is vec4, RGB vec3, a channel float.
 */
export type NodeValueType = 'float' | 'vec2' | 'vec3' | 'vec4';

/** Value type of an output channel (null = the main RGBA output). */
export function channelType(channel: NodeChannel | null): NodeValueType {
  return channel === null ? 'vec4' : channel === 4 ? 'vec3' : channel === 5 ? 'vec2' : 'float';
}

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
  /** Channel of the node's image. */
  readonly channel: NodeChannel;
}

export function outputsOf(def: GeneratorDefinition): readonly NodeOutputDef[] {
  return def.outputs ?? [];
}

/**
 * Outputs every node without declared `outputs` offers besides its main RGBA output (links
 * name them in `output`): the opaque RGB and each channel as an opaque grayscale. They are
 * extracted from the node's image only when a link reads them.
 */
export const STANDARD_OUTPUTS: readonly NodeOutputDef[] = [
  {
    key: 'rgb',
    label: 'RGB',
    description: 'Colors without the alpha (opaque).',
    color: '#f08fd8',
    channel: 4,
  },
  {
    key: 'r',
    label: 'R',
    description: 'The red channel as a grayscale image.',
    color: '#ff6b6b',
    channel: 0,
  },
  {
    key: 'g',
    label: 'G',
    description: 'The green channel as a grayscale image.',
    color: '#6bff8a',
    channel: 1,
  },
  {
    key: 'b',
    label: 'B',
    description: 'The blue channel as a grayscale image.',
    color: '#6bb5ff',
    channel: 2,
  },
  {
    key: 'a',
    label: 'A',
    description: 'The alpha channel as a grayscale image.',
    color: '#e8e8e8',
    channel: 3,
  },
];

/** Output `key` of a `def` node (declared or standard); undefined = main output / unknown. */
export function outputDef(
  def: GeneratorDefinition,
  key: string | undefined,
): NodeOutputDef | undefined {
  if (key === undefined) return undefined;
  const declared = outputsOf(def);
  return (declared.length ? declared : STANDARD_OUTPUTS).find((o) => o.key === key);
}
