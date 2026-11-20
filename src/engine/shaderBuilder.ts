import type { ParamDef } from '../params/types';
import commonChunk from './glsl/common.glsl?raw';
import noiseChunk from './glsl/noise.glsl?raw';
import sdfChunk from './glsl/sdf.glsl?raw';
import type { ShaderGenerator } from './generator';

const CHUNKS: Readonly<Record<string, string>> = {
  common: commonChunk,
  noise: noiseChunk,
  sdf: sdfChunk,
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

/** Assembles the full fragment shader for a shader generator. */
export function buildGeneratorShader(def: ShaderGenerator): string {
  return `${SHADER_HEADER}

in vec2 v_uv;
out vec4 outColor;

// Built-ins
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

// Parameters (${def.id})
${uniformDeclarations(def.params)}

${commonChunk}
${noiseChunk}
${sdfChunk}

// ---- generator: ${def.id} ----
${def.fragment}

void main() {
  outColor = generate(v_uv);
}
`;
}
