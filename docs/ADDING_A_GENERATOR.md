# Adding a generator

1. Create `src/generators/<category>/<name>.glsl`:

   ```glsl
   // One-line description of the technique.
   vec4 generate(vec2 uv) {
     vec2 p = centered(uv);                       // [-1, 1]
     float v = radialFalloff(length(p), u_radius, u_falloff);
     return vec4(vec3(v), 1.0);                   // grayscale; post pass colorizes
   }
   ```

   Available: `u_time`, `u_seed`, `u_resolution`, every param as `u_<key>`, plus the helpers in
   `src/engine/glsl/*.glsl` (no need to `#include`, they are always prepended).

2. Create `src/generators/<category>/<name>.ts`:

   ```ts
   import type { ShaderGenerator } from '../../engine/generator';
   import { param } from '../../params/define';
   import fragment from './<name>.glsl?raw';

   export const myGenerator: ShaderGenerator = {
     kind: 'shader',
     id: 'my-generator', // stable forever (stored in documents/links)
     name: 'My Generator',
     category: 'light',
     description: 'Shown in the inspector and as tooltip.',
     animated: false, // true if it uses u_time
     fragment,
     params: [
       param.float('radius', 'Radius', 0.8, 0.05, 1.5),
       param.float('falloff', 'Falloff', 2, 0.3, 8),
     ],
     // optional: defaultPost: { gradient: GRADIENTS.fire, alphaMode: 1 }, presets: [...]
   };
   ```

3. Register it in `src/generators/registry.ts` (`GENERATORS` array, display order).

4. `make check` — the registry tests verify ids, defaults, presets and that each param is
   actually used by the shader. `make e2e` compiles it in a real browser and saves a screenshot.

## Simulations

Implement `SimulationGenerator` / `Simulation` (see `engine/generator.ts` and
`generators/reaction-diffusion/` as reference). Use `gpu.createPingPong` with
`gpu.precisionFormat`, write internal shaders with `#include <common>` / `<noise>` and compile
them via `gpu.createProgram(SHADER_HEADER + resolveIncludes(src), label)`.
