/**
 * Writes every shader of the app (generators and their passes, simulation passes, built-in
 * passes) to $GLSL_DUMP, for `make glsl` to compile them with glslangValidator: a fast WebGL2
 * compile check without a browser. Skipped in normal test runs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { GpuContext } from '../../src/engine/gl/GpuContext';
import { builtinPassSources } from '../../src/engine/Renderer';
import { buildGeneratorShader, SHADER_HEADER } from '../../src/engine/shaderBuilder';
import preview3dFrag from '../../src/engine/node/preview3d.frag?raw';
import preview3dVert from '../../src/engine/node/preview3d.vert?raw';
import { GENERATORS } from '../../src/generators/registry';
import { defaultValues } from '../../src/params/values';

const dir = process.env.GLSL_DUMP;

test.skipIf(!dir)('dump every shader', () => {
  const out = dir ?? '';
  mkdirSync(out, { recursive: true });
  const write = (name: string, source: string, stage: 'frag' | 'vert' = 'frag') =>
    writeFileSync(join(out, `${name.replace(/[^\w-]+/g, '_')}.${stage}`), source);
  let count = 0;

  for (const [name, source] of Object.entries(builtinPassSources())) write(`core-${name}`, source);
  write('core-preview3d', `${SHADER_HEADER}\n${preview3dFrag}`);
  write('core-preview3d', `${SHADER_HEADER}\n${preview3dVert}`, 'vert');
  for (const def of GENERATORS) {
    count++;
    if (def.kind === 'shader') {
      const raw = def.codeParam ? defaultValues(def.params)[def.codeParam] : '';
      const code = typeof raw === 'string' ? raw : '';
      for (const pass of def.passes ?? [])
        write(`${def.id}-${pass.label}`, buildGeneratorShader(def, code, pass));
      write(def.id, buildGeneratorShader(def, code));
      continue;
    }
    // Simulations start their compiles at construction: record them with a fake context.
    let index = 0;
    const gpu = {
      gridDims: (n: number) => [n, n],
      prepareProgram: (key: string, fragment: () => string, vertex?: string) => {
        const name = `sim-${def.id}-${index++}-${key.split(':')[1] ?? ''}`;
        write(name, fragment());
        if (vertex) write(name, vertex, 'vert');
      },
    } as unknown as GpuContext;
    def.create(gpu);
  }
  expect(count).toBe(GENERATORS.length);
});
