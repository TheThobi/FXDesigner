/**
 * Generator contract. A generator produces a source image that is then processed by the shared
 * post pass (levels, color ramp, alpha, normal map). Two flavours:
 *
 *  - `shader`: a stateless GLSL function `vec4 generate(vec2 uv)` evaluated per pixel. Uniforms
 *    are declared automatically from the parameter schema (`u_<key>`), plus the built-ins
 *    `u_resolution`, `u_time`, `u_seed`.
 *  - `simulation`: a stateful GPU process (e.g. reaction-diffusion) advanced every frame.
 */
import type { ParamDef, ParamGroupInfo, ParamValues, Preset, Vec2 } from '../params/types';
import type { GpuContext } from './gl/GpuContext';
import type { RenderTarget } from './gl/RenderTarget';
import type { NodeInputDef, NodeOutputDef } from './nodes';

export type GeneratorCategory =
  | 'simulation'
  | 'fire'
  | 'light'
  | 'impact'
  | 'water'
  | 'particle'
  | 'noise'
  | 'material'
  | 'pattern'
  | 'operator'
  | 'animation';

export const CATEGORY_LABELS: Readonly<Record<GeneratorCategory, string>> = {
  simulation: 'Simulations',
  fire: 'Fire & Smoke',
  light: 'Light & Magic',
  impact: 'Impacts & Motion',
  water: 'Water',
  particle: 'Particle Sprites',
  noise: 'Noise',
  material: 'Materials',
  pattern: 'Shapes & Patterns',
  operator: 'Operators',
  animation: 'Animation',
};

/** Operators transform or combine other nodes' images (Operators tab), static or animated. */
export function isOperator(def: { readonly category: GeneratorCategory }): boolean {
  return def.category === 'operator' || def.category === 'animation';
}

/** Top-level groups of the generator browser; categories are listed in display order. */
export const GENERATOR_FAMILIES: readonly {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly GeneratorCategory[];
}[] = [
  { id: 'simulations', label: 'Simulations', categories: ['simulation'] },
  { id: 'vfx', label: 'Effects', categories: ['fire', 'light', 'impact', 'water', 'particle'] },
  { id: 'surfaces', label: 'Noise & Materials', categories: ['noise', 'material'] },
  { id: 'patterns', label: 'Shapes & Patterns', categories: ['pattern'] },
  { id: 'operators', label: 'Operators', categories: ['operator', 'animation'] },
];

/** A vertical split of the preview controlled by a 0..1 float parameter (draggable handle). */
export interface ViewportSplit {
  readonly key: string;
  readonly visible: (params: ParamValues) => boolean;
  /** Labels shown on each side of the handle. */
  readonly labels?: readonly [string, string];
}

interface GeneratorBase {
  /** Stable identifier: persisted in documents and URLs. Never rename without a migration. */
  readonly id: string;
  readonly name: string;
  readonly category: GeneratorCategory;
  readonly description: string;
  readonly params: readonly ParamDef[];
  /** Whether the output depends on time (enables play/pause and flipbook export). */
  readonly animated: boolean;
  /** Overrides of the post-processing defaults (e.g. a fire color ramp). */
  readonly defaultPost?: ParamValues;
  readonly presets?: readonly Preset[];
  /** Optional module metadata (descriptions / summaries) for the params' groups. */
  readonly groups?: readonly ParamGroupInfo[];
  /** Parameter values forced when exporting (e.g. hide an editing-only preview). */
  readonly exportOverrides?: ParamValues;
  /** Draggable split handle in the viewport. */
  readonly split?: ViewportSplit;
  /** Preset shown in the browser thumbnail (its most characteristic look). */
  readonly featuredPreset?: string;
  /**
   * The output is data (e.g. an encoded flowmap), not an image: the shared Post Process look
   * is never applied to it.
   */
  readonly dataOutput?: boolean;
  /**
   * Node inputs (operators, simulation emitters…), sampled by its shaders as `u_in_<key>`
   * with `u_has_<key>` telling whether something is connected.
   */
  readonly inputs?: readonly NodeInputDef[];
  /** Channel outputs replacing the main output pin (see NodeOutputDef). */
  readonly outputs?: readonly NodeOutputDef[];
  /**
   * Graph utilities passing their input through: 'output' (what the system exports and shows
   * in the library once connected), 'reroute' (a dot that bends links, Unreal-like).
   */
  readonly role?: 'output' | 'reroute';
  /** New nodes start collapsed (header and pins only), e.g. Output. */
  readonly startCollapsed?: boolean;
}

/**
 * Extra pass of a shader generator, rendered before its main fragment (multi-pass operators
 * such as the jump-flood Distance or the separable Blur). It is built like the main fragment
 * (same parameters, inputs and chunks) and defines `vec4 generate(vec2 uv)` too. Every pass and
 * the main fragment read the previous pass as `u_prev` (blank before the first one), with
 * `u_passIndex` / `u_passCount` for repeated passes.
 */
type PassInputs = Readonly<Partial<Record<string, Pick<RenderTarget, 'width' | 'height'>>>>;

export interface ShaderPass {
  readonly label: string;
  readonly fragment: string;
  /** Iterations (u_passCount) for these values and target size (default 1; 0 skips the pass). */
  readonly repeat?: (
    params: ParamValues,
    width: number,
    height: number,
    inputs?: PassInputs,
  ) => number;
  /** Custom dimensions for each iteration, e.g. a shrinking reduction pyramid. */
  readonly size?: (
    width: number,
    height: number,
    iteration: number,
    inputs?: PassInputs,
  ) => readonly [number, number];
  /** Data pass (coordinates, distances): full-precision target, nearest filtering. */
  readonly precise?: boolean;
}

export interface ShaderGenerator extends GeneratorBase {
  readonly kind: 'shader';
  /**
   * Non-square workspaces: 'centered' keeps uv in [0,1] and corrects centered() (shapes stay
   * round), 'tiled' repeats the pattern a whole number of times along the long axis.
   * Default: 'centered' when the fragment calls centered(), else 'tiled'.
   */
  readonly layout?: 'centered' | 'tiled';
  /**
   * Text param holding user GLSL spliced into the fragment at the USER_CODE marker
   * (one program per distinct code; compile errors are shown on the node).
   */
  readonly codeParam?: string;
  /** GLSL ES 3.0 snippet defining `vec4 generate(vec2 uv)`, uv in [0,1], y up. */
  readonly fragment: string;
  /** Passes rendered before `fragment` (read as `u_prev`). */
  readonly passes?: readonly ShaderPass[];
}

export interface SimulationGenerator extends GeneratorBase {
  readonly kind: 'simulation';
  /**
   * User-made content (e.g. a painted canvas): not restarted by seed changes or the global
   * restart, only by its own reset (selected + restart, or a `resetOnChange` param).
   */
  readonly seedless?: boolean;
  create(gpu: GpuContext): Simulation;
}

export type GeneratorDefinition = ShaderGenerator | SimulationGenerator;

export interface SimulationPointer {
  /** Texture coordinates in [0,1], y up. */
  readonly uv: Vec2;
  readonly mode: 'paint' | 'erase';
  /** Stroke direction (uv delta since the previous event, wrapped); zero when not moving. */
  readonly velocity: Vec2;
}

/** Opaque copy of a simulation's GPU state (timeline keyframes). */
export interface SimulationSnapshot {
  dispose(): void;
}

export interface Simulation {
  /** (Re)initializes state. Called on creation, on reset and when a `resetOnChange` param changes. */
  reset(params: ParamValues, seed: number): void;
  /** Advances one display frame (the simulation decides how many internal iterations). */
  step(params: ParamValues): void;
  /** Writes the visual representation into `target` (any size). */
  render(target: RenderTarget, params: ParamValues): void;
  /** Copies the current state, so the timeline can jump back to it. Optional. */
  snapshot?(): SimulationSnapshot;
  /** Restores a snapshot taken from this same instance (and grid size). */
  restore?(snapshot: SimulationSnapshot): void;
  /** Interactive painting; null when the pointer is released. */
  setPointer(pointer: SimulationPointer | null): void;
  /**
   * Generator-specific node inputs (key -> connected node output, null when unconnected),
   * set before rendering; used by the following steps.
   */
  setInputs?(inputs: Readonly<Record<string, WebGLTexture | null>>): void;
  /**
   * False while its programs compile in the background: the app neither steps nor renders it
   * yet (keeps the page responsive). Absent = always ready.
   */
  ready?(): boolean;
  dispose(): void;
}
