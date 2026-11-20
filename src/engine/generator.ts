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

export type GeneratorCategory =
  'particle' | 'simulation' | 'stylized' | 'underworld' | 'noise' | 'light' | 'fire' | 'pattern';

export const CATEGORY_LABELS: Readonly<Record<GeneratorCategory, string>> = {
  particle: 'Sprites & Impacts',
  stylized: 'Stylized FX',
  underworld: 'Underworld FX',
  noise: 'Noise',
  light: 'Light & Energy',
  fire: 'Fire & Smoke',
  pattern: 'Shapes & Patterns',
  simulation: 'Simulations',
};

/** Top-level groups of the generator browser; categories are listed in display order. */
export const GENERATOR_FAMILIES: readonly {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly GeneratorCategory[];
}[] = [
  { id: 'simulations', label: 'Simulations', categories: ['simulation'] },
  {
    id: 'vfx',
    label: 'Particles & VFX',
    categories: ['underworld', 'particle', 'fire', 'light', 'stylized'],
  },
  { id: 'noise', label: 'Noise', categories: ['noise'] },
  { id: 'patterns', label: 'Shapes & Patterns', categories: ['pattern'] },
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
}

export interface ShaderGenerator extends GeneratorBase {
  readonly kind: 'shader';
  /** GLSL ES 3.0 snippet defining `vec4 generate(vec2 uv)`, uv in [0,1], y up. */
  readonly fragment: string;
}

export interface SimulationGenerator extends GeneratorBase {
  readonly kind: 'simulation';
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
  dispose(): void;
}
