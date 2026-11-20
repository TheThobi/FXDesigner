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
     // optional: defaultPost: { alphaMode: 1 }, presets: [...], featuredPreset: 'Name'
   };
   ```

3. Register it in `src/generators/registry.ts` (`GENERATORS` array, display order).

4. `make check` — the registry tests verify ids, defaults, presets and that each param is
   actually used by the shader. `make e2e` compiles it in a real browser and saves a screenshot.

## Grid simulations (cellular automata, reaction-diffusion…)

Write `seed.frag`, `step.frag`, `render.frag` (each with `void main()` writing `outColor`) and a
definition; `generators/simulation/bz-reaction/` is a ~40-line reference:

```ts
const PARAMS = [
  param.float('rate', 'Rate', 1, 0.1, 2),
  param.stepsPerFrame(2, 16), // iterations per displayed frame
  param.simResolution(256), // grid size, restarts the simulation
  param.brushSize(0.03), // radius used by brushMode() in GLSL
];

export const mySim: SimulationGenerator = {
  kind: 'simulation',
  id: 'my-sim',
  name: 'My Sim',
  category: 'simulation',
  description: '…',
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'my-sim', PARAMS, { seed, step, render }),
};
```

In GLSL use `neighbor(dx, dy)`, `sampleState(uv)`, `boxAverage()`, `brushMode()`, `u_frame`,
`hash12()`… In the **seed** pass use `gl_FragCoord` (u_state is blank there). Don't name a param
after an engine uniform (`seed`, `state`, `frame`, `brush`, `time`, `resolution`): a unit test
enforces it.

For anything else (agents, particles) implement `Simulation` directly, like
`generators/simulation/physarum/`.

## Presets

Give every generator 3–6 presets that produce clearly different results (named after the
look: "Torch", "Hairline cracks" — never after another generator), and set `featuredPreset`
to the most characteristic one: it becomes the browser thumbnail, and hovering the tile cycles
through all presets.

## Stylized looks without new code

A new "effect" is often just a preset on an existing generator:
`{ name: 'Toon flame', values: {…}, post: { posterize: 4, outline: 1, gradient: GRADIENTS.toonFire } }`.

## Modules in generator params

Group optional features behind a switch: `param.toggle('mossOn', 'Moss')` plus params with
`group: 'Moss'`; add `groups: [{ name: 'Moss', description: '…', summary: (v) => '…' }]` to the
definition for a header description and live summary. Units: `param.float(…, { unit: 'px' })`,
`param.angle(…)`.

## Colors

Don't set `gradient` in `defaultPost`: generators share the app-wide ramp. Output grayscale
(or meaningful colors with `defaultPost: { colorMode: 0 }`, e.g. the flowmap).
