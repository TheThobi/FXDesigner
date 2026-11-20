/**
 * Generator contract. A generator produces a source image that is then processed by the shared
 * post pass (levels, color ramp, alpha, normal map). Two flavours:
 *
 *  - `shader`: a stateless GLSL function `vec4 generate(vec2 uv)` evaluated per pixel. Uniforms
 *    are declared automatically from the parameter schema (`u_<key>`), plus the built-ins
 *    `u_resolution`, `u_time`, `u_seed`.
 *  - `simulation`: a stateful GPU process (e.g. reaction-diffusion) advanced every frame.
 */
import type { ParamDef, ParamValues, Preset, Vec2 } from '../params/types';
import type { GpuContext } from './gl/GpuContext';
import type { RenderTarget } from './gl/RenderTarget';

export type GeneratorCategory = 'noise' | 'light' | 'fire' | 'pattern' | 'simulation';

export const CATEGORY_LABELS: Readonly<Record<GeneratorCategory, string>> = {
  noise: 'Noise',
  light: 'Light & Energy',
  fire: 'Fire & Smoke',
  pattern: 'Shapes & Patterns',
  simulation: 'Simulations',
};

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
}

export interface Simulation {
  /** (Re)initializes state. Called on creation, on reset and when a `resetOnChange` param changes. */
  reset(params: ParamValues, seed: number): void;
  /** Advances one display frame (the simulation decides how many internal iterations). */
  step(params: ParamValues): void;
  /** Writes the visual representation into `target` (any size). */
  render(target: RenderTarget, params: ParamValues): void;
  /** Interactive painting; null when the pointer is released. */
  setPointer(pointer: SimulationPointer | null): void;
  dispose(): void;
}
