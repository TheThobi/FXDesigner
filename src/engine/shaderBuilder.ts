import type { NodeInputDef } from './nodes';
import type { ParamDef } from '../params/types';
import commonChunk from './glsl/common.glsl?raw';
import noiseChunk from './glsl/noise.glsl?raw';
import sdfChunk from './glsl/sdf.glsl?raw';
import simChunk from './glsl/sim.glsl?raw';
import type { ShaderGenerator, ShaderPass } from './generator';

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
    case 'image':
      return 'sampler2D';
    case 'text':
      return null;
  }
}

export function uniformDeclarations(defs: readonly ParamDef[]): string {
  return defs
    .map((def) => {
      const type = glslUniformType(def);
      if (!type) return null;
      const line = `uniform ${type} ${uniformName(def.key)};`;
      // Images also get their pixel size (0 while loading or empty).
      return def.type === 'image' ? `${line}\nuniform vec2 ${uniformName(def.key)}Size;` : line;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Generator-specific node inputs: `u_in_<key>` (the connected node's output, a blank texture
 * when nothing is connected) and `u_has_<key>`.
 */
export function inputDeclarations(inputs: readonly NodeInputDef[]): string {
  return inputs
    .map((i) => `uniform sampler2D u_in_${i.key};\nuniform bool u_has_${i.key};`)
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
  'u_uvScale',
  'u_centerScale',
  'u_prev',
  'u_passIndex',
  'u_passCount',
] as const;

/** Multi-pass generators: the previous pass and the iteration of a repeated pass. */
const PASS_DECLARATIONS = `uniform sampler2D u_prev;    // previous pass (blank before the first)
uniform int u_passIndex;   // iteration of a repeated pass
uniform int u_passCount;`;

/**
 * Fragment shader for one pass of a grid simulation: built-ins, auto-declared parameter
 * uniforms, shared chunks (common, noise, sim) then the pass source (which defines main()).
 */
export function buildSimulationShader(
  defs: readonly ParamDef[],
  passSource: string,
  label: string,
  inputs: readonly NodeInputDef[] = [],
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
${inputDeclarations(inputs)}
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
export function buildGeneratorShader(def: ShaderGenerator, code = '', pass?: ShaderPass): string {
  // Custom-code generators: the user GLSL replaces the marker (once).
  const source = pass ? pass.fragment : def.fragment;
  const fragment = def.codeParam ? source.replace('/*USER_CODE*/', code) : source;
  const multiPass = (def.passes?.length ?? 0) > 0;
  return `${SHADER_HEADER}

in vec2 v_uv;
out vec4 outColor;

// Built-ins
uniform vec2 u_resolution;
uniform float u_clock;
uniform vec3 u_loop;
uniform float u_seed;
uniform vec2 u_uvScale;      // non-square workspace, tiled generators: whole repeats
uniform vec2 u_centerScale;  // non-square workspace, centered generators: aspect
float u_time;
${multiPass ? PASS_DECLARATIONS : ''}
${inputDeclarations(def.inputs ?? [])}
// Parameters (${def.id})
${uniformDeclarations(def.params)}

${commonChunk}
${noiseChunk}
${sdfChunk}

// ---- generator: ${def.id}${pass ? ` / pass: ${pass.label}` : ''} ----
${fragment}

void main() {
  g_centerScale = u_centerScale;
  vec2 uv = v_uv * u_uvScale;
  if (u_loop.x < 0.5) {
    u_time = u_clock;
    outColor = generate(uv);
    return;
  }
  float period = max(u_loop.y, 1e-3);
  float t = mod(u_clock, period);
  float w = smoothstep(1.0 - u_loop.z, 1.0, t / period);
  u_time = t + period;
  vec4 a = generate(uv);
  if (w <= 0.0) {
    outColor = a;
    return;
  }
  u_time = t;
  outColor = mix(a, generate(uv), w);
}
`;
}

/** Signatures of the shared GLSL helpers (common, noise, sdf chunks) available to generators. */
export function helperSignatures(): string[] {
  const out: string[] = [];
  for (const chunk of [commonChunk, noiseChunk, sdfChunk]) {
    for (const m of chunk.matchAll(
      /^(float|vec2|vec3|vec4|mat2|int|bool)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm,
    ))
      out.push(`${m[1]} ${m[2]}(${m[3]!.replace(/\s+/g, ' ').trim()})`);
  }
  return out;
}

/**
 * What a generator's GLSL can use, as commented GLSL: built-ins, the node's parameters and
 * inputs as uniforms, and the shared helpers. Shown next to the code editor (and in docs).
 */
export function shaderReference(def: ShaderGenerator): string {
  const params = def.params
    .map((d) => {
      const type = glslUniformType(d);
      if (!type) return null;
      const extra =
        d.type === 'select'
          ? ` // ${d.label}: ${d.options.map((o) => `${o.value} = ${o.label}`).join(', ')}`
          : ` // ${d.label}`;
      return `uniform ${type} ${uniformName(d.key)};${extra}`;
    })
    .filter((l): l is string => l !== null);
  return [
    '// Entry point: vec4 generate(vec2 uv)  (uv in [0,1], y up; return grayscale, the',
    '// Post Process colorizes it; alpha = coverage)',
    '',
    '// Built-ins',
    'float u_time;        // seconds',
    'uniform vec2 u_resolution;',
    'uniform float u_seed;',
    ...(def.inputs?.length
      ? [
          '',
          '// Inputs',
          ...def.inputs.map(
            (i) => `uniform sampler2D u_in_${i.key}; uniform bool u_has_${i.key}; // ${i.label}`,
          ),
        ]
      : []),
    '',
    `// Parameters (${def.name})`,
    ...(params.length ? params : ['// none']),
    '',
    '// Helpers',
    ...helperSignatures().map((sig) => `${sig};`),
  ].join('\n');
}
