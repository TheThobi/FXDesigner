# Authoring nodes

How to write generators, operators and simulations for FX Designer. Written so that a person
can follow it step by step, and so that an AI assistant given this file (plus
[nodes.md](nodes.md) for examples and [architecture.md](architecture.md) for the engine) can
produce a working node in one go. Every rule below is enforced by a test or by review.

## 1. Pick the kind of node

| You want…                                                 | Write                                                             | Example to copy                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| An image computed per pixel (noise, shape, VFX sprite)    | shader generator                                                  | `generators/pattern/gradient.ts`                  |
| To transform / combine other nodes                        | operator (shader generator with `inputs`)                         | `generators/operators/index.ts` (Blend, Mask)     |
| Something animated from other nodes (colors cycling…)     | animation operator                                                | `op-hue-shift` in `generators/operators/index.ts` |
| A process with memory (cellular automaton, fluid, agents) | simulation                                                        | `generators/simulation/bz-reaction/`              |
| A quick experiment                                        | no code change: **Custom Shader** node, or any shader node → Code | in the app                                        |

In the editor, the **Code** button of the Generator page shows the GLSL of any shader node;
editing it turns the node into a custom node (its sliders stay, as uniforms). That is the
fastest way to prototype: write it in the app, then move the code into a `.glsl` file.

## 2. Shader generator recipe

1. `src/generators/<folder>/<name>.glsl` — one function:

   ```glsl
   // One-line description of the technique (what it looks like, how it is made).
   vec4 generate(vec2 uv) {             // uv in [0,1], y up
     vec2 p = centered(uv);              // [-1,1], stays round in wide workspaces
     float v = radialFalloff(length(p), u_radius, u_falloff);
     return vec4(vec3(v), 1.0);          // grayscale in rgb; alpha = coverage
   }
   ```

   - Return **grayscale**: the Post Process colorizes with the node's color ramp. Output real
     colors only when they are data (flow vectors) or the point of the node, and set
     `defaultPost: { colorMode: 0 }`.
   - Sprites on a transparent background: `defaultPost: { alphaMode: 1 }` (alpha from
     luminance) or return coverage in alpha with `alphaMode: 3`.
   - Seamless patterns: build on a lattice of whole periods (`gradientNoise(p, period, …)`,
     `voronoi(p, period, …)`, `wrapCell(cell, period)` before hashing) and set
     `layout: 'tiled'`.
   - Available without `#include`: built-ins `u_time`, `u_resolution`, `u_seed`; every param
     as `u_<key>`; the helpers of `src/engine/glsl/common.glsl`, `noise.glsl`, `sdf.glsl`
     (`hash12`, `hash22`, `fbm`, `voronoi`, `sdCircle`, `rotate2d`, `saturate`…). The Code view
     lists them with signatures.
   - GLSL ES 3.00: no `%` on negative ints; loops need a constant bound (`for (int i = 0; i
< 8; i++) { if (i >= u_count) break; … }`).

2. `src/generators/<folder>/<name>.ts`:

   ```ts
   import type { ShaderGenerator } from '../../engine/generator';
   import { param } from '../../params/define';
   import fragment from './<name>.glsl?raw';

   export const myGenerator: ShaderGenerator = {
     kind: 'shader',
     id: 'my-generator', // persisted in documents: never rename without a migration
     name: 'My Generator',
     category: 'light', // see GeneratorCategory (engine/generator.ts)
     description: 'What it looks like and what it is for (one or two sentences).',
     animated: false, // true when it reads u_time
     fragment,
     params: [
       param.float('radius', 'Radius', 0.8, 0.05, 1.5),
       param.float('falloff', 'Falloff', 2, 0.3, 8, { description: 'Edge softness.' }),
     ],
     presets: [/* 4–8, see below */],
     featuredPreset: 'Soft orb',
   };
   ```

3. Register it in `src/generators/registry.ts` (`GENERATORS`, display order).
4. `npm run docs` (regenerates `docs/development/nodes.md`), then `make check`.

## 3. Parameters

- `param.float / int / bool / select / color / vec2 / angle / text / image / gradient`
  (`src/params/define.ts`). The key becomes the uniform `u_<key>` (select → int index).
- min / max are the **slider** range: be generous. Typed values may go further
  (`numericLimits`: 4× the range for floats, 2× for ints, never below a min ≥ 0); set
  `limit: [lo, hi]` when going further would be unsafe (huge loop counts) or meaningless.
- **Every param must matter in every mode.** If a mode select needs its own settings, make
  separate generators. (Settings tied to an input go in `NodeInputDef.params`; settings shown
  for one value of another param use `visibleWhen` — reserve it for engine settings such as
  the Output tab.)
- Never name a param like an engine uniform (`RESERVED_UNIFORMS`: time, seed, resolution,
  prev, passIndex…) — a unit test checks it.
- Group optional features behind a module switch: `param.toggle('mossOn', 'Moss')` plus
  params with `group: 'Moss'`, and `groups: [{ name: 'Moss', description, summary }]`.

## 4. Presets

- 4–8 per generator, clearly different results, **named by the look** ("Torch", "Hairline
  cracks"), never after another generator. `featuredPreset` = the most characteristic one (it
  is the browser thumbnail).
- A preset sets generator params only (`values`). A preset may also carry a look (`post`
  overrides, `ramp`): it is offered to the user, never applied silently. Never set a ramp
  through `post.gradient`.
- Values are validated by the registry tests (existing keys, valid values).

## 5. Operators (nodes with inputs)

```ts
inputs: [
  { key: 'image', label: 'Image', description: 'The image to process.', color: '#e8e8e8' },
  { key: 'mask', label: 'Mask', description: 'White keeps.', color: '#9be86a', value: 'float' },
],
```

- Sampled as `sampler2D u_in_<key>` with `bool u_has_<key>` (false when unconnected: use a
  sensible fallback).
- `value: 'float'` for inputs read as one channel (masks, patterns, heights), `'vec2'` for
  flow vectors in RG; absent = any image (RGBA). Links feeding another type are drawn as
  gradients.
- Operators default to a pass-through Post Process (`PASS_THROUGH` in operators/index.ts).
- Multi-pass (blur, distance): `passes: [{ label, fragment, repeat, precise }]`, each reads the
  previous as `u_prev`.
- Category `operator` (or `animation` with `animated: true` for time-based ones). Combining
  images is always an operator's job: never add engine-side inputs.

## 6. Simulations

Grid simulations (`GridSimulation`): `seed.frag`, `step.frag` (repeat with `stepsPerFrame`),
`render.frag`. In the seed pass use `gl_FragCoord` / `u_gridSize` (the state is a 1×1 blank
there). Explicit-Euler solvers must stay stable (stencil eigenvalue × dt < 2). Implement
`snapshot / restore` for timeline keyframes. See `generators/simulation/bz-reaction/` (short)
and `physarum/` (agents, custom passes).

## 7. Checklist before committing

- [ ] `make check` (tsc, eslint, vitest: registry, presets, uniforms, docs up to date).
- [ ] `npm run docs` if a node changed (nodes.md is generated).
- [ ] `make e2e`, then look at `test-results/generators/<id>.png`.
- [ ] Seamless? Check the 2×2 / 3×3 tiling preview in the viewport.
- [ ] Wide / tall workspace: shapes stay round (`centered`) or patterns repeat (`tiled`).

## 8. Prompt template for an AI assistant

> Read `agents.md`, `docs/development/authoring.md` and two similar nodes from `docs/development/nodes.md` (and their
> source files). Create a shader generator `<id>` in category `<category>` that looks like
> `<description of the look>`. Grayscale output, seamless if it is a pattern, 5–8 params that
> each change the result visibly, 5 presets named by their look. Register it, run
> `npm run docs` and `make check`.
