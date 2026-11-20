import type { ParamDef } from '../params/types';
import commonChunk from './glsl/common.glsl?raw';
import noiseChunk from './glsl/noise.glsl?raw';
import sdfChunk from './glsl/sdf.glsl?raw';
import simChunk from './glsl/sim.glsl?raw';
import type { ShaderGenerator } from './generator';

const CHUNKS: Readonly<Record<string, string>> = {
  common: commonChunk,
  noise: noiseChunk,
  sdf: sdfChunk,
  sim: simChunk,
};

/** Replaces `#include <name>` lines with the corresponding shared chunk. */
export function resolveIncludes(source: string): string {
  return source.replace(/^[ \t]*#include\s+<(\w+)>[ \t]*$/gm, (_line, name: string) => {
    const chunk = CHUNKS[name];
    if (chunk === undefined) throw new Error(`Unknown GLSL include <${name}>`);
    return chunk;
  });
}

export function uniformName(key: string): string {
  return `u_${key}`;
}

/** GLSL type of the uniform backing a parameter, or null when it isn't exposed to shaders. */
export function glslUniformType(def: ParamDef): string | null {
  switch (def.type) {
    case 'float':
      return 'float';
    case 'int':
    case 'select':
      return 'int';
    case 'bool':
      return 'bool';
    case 'color':
      return 'vec3';
    case 'vec2':
      return 'vec2';
    case 'gradient':
      return 'sampler2D';
    case 'text':
      return null;
  }
}

export function uniformDeclarations(defs: readonly ParamDef[]): string {
  return defs
    .map((def) => {
      const type = glslUniformType(def);
      return type ? `uniform ${type} ${uniformName(def.key)};` : null;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

export const SHADER_HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;`;

/** Uniform names provided by the engine; parameter keys must not map onto them. */
export const RESERVED_UNIFORMS = [
  'u_resolution',
  'u_time',
  'u_clock',
  'u_loop',
  'u_seed',
  'u_state',
  'u_seedTexture',
  'u_frame',
  'u_brush',
  'u_brushDir',
  'u_gridSize',
] as const;

/**
 * Fragment shader for one pass of a grid simulation: built-ins, auto-declared parameter
 * uniforms, shared chunks (common, noise, sim) then the pass source (which defines main()).
 */
export function buildSimulationShader(
  defs: readonly ParamDef[],
  passSource: string,
  label: string,
): string {
  return `${SHADER_HEADER}

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_state;
uniform sampler2D u_seedTexture;
uniform float u_seed;
uniform float u_frame;
uniform vec4 u_brush;
uniform vec2 u_brushDir;
uniform vec2 u_gridSize;    // state grid size in cells (valid in every pass, unlike stateSize())

// Parameters
${uniformDeclarations(defs)}

${commonChunk}
${noiseChunk}
${simChunk}

// ---- pass: ${label} ----
${resolveIncludes(passSource)}
`;
}

/**
 * Assembles the full fragment shader for a shader generator.
 *
 * `u_time` is a global the engine sets before each `generate()` call (not a uniform), so time
 * can be remapped generically. Seamless loop (u_loop = [enabled, duration, blend window]):
 * over one period T, out(t) = mix(f(t + T), f(t), w(t)) with w(0) = 0 and w(T) = 1, hence
 * out(T) = f(T) = out(0) for any generator, at the cost of a crossfade (two evaluations)
 * during the last `blend` fraction of the loop.
 */
export function buildGeneratorShader(def: ShaderGenerator): string {
  return `${SHADER_HEADER}

in vec2 v_uv;
out vec4 outColor;

// Built-ins
uniform vec2 u_resolution;
uniform float u_clock;
uniform vec3 u_loop;
uniform float u_seed;
float u_time;

// Parameters (${def.id})
${uniformDeclarations(def.params)}

${commonChunk}
${noiseChunk}
${sdfChunk}

// ---- generator: ${def.id} ----
${def.fragment}

void main() {
  if (u_loop.x < 0.5) {
    u_time = u_clock;
    outColor = generate(v_uv);
    return;
  }
  float period = max(u_loop.y, 1e-3);
  float t = mod(u_clock, period);
  float w = smoothstep(1.0 - u_loop.z, 1.0, t / period);
  u_time = t + period;
  vec4 a = generate(v_uv);
  if (w <= 0.0) {
    outColor = a;
    return;
  }
  u_time = t;
  outColor = mix(a, generate(v_uv), w);
}
`;
}
