# Architecture

Single-page app, **TypeScript + WebGL2**, no UI framework, built with Vite into static files.
Everything runs in the browser: the server only serves files (nginx).

## Layers

Dependencies point downwards only:

```
app/         Controller (App.ts), editor state, documents, undo, persistence, export
ui/          DOM widgets: toolbar, generator list, param panels, gradient editor, dialogs
generators/  Concrete generators (one .ts definition + one .glsl per generator) and the registry
engine/      WebGL2 runtime: GpuContext, ShaderProgram, RenderTarget/PingPong, Renderer,
             shader assembly, shared GLSL chunks, post-processing pass, generator contract
params/      Parameter schema types, builders, validation, gradients
util/        Small pure helpers (math, color, base64, download…)
```

`ui/` never mutates state: widgets call back into `App`, which commits a new immutable
`EditorState` (recorded for undo, autosaved, re-rendered).

## Rendering pipeline

```
generator ──► source target (RGBA16F, preview size) ──► post pass ──► canvas
                                                      └──► capture (RGBA8, export size) ──► PNG
```

1. **Source**: a _shader generator_ runs its `vec4 generate(vec2 uv)` fragment; a _simulation_
   renders its state via `Simulation.render()`.
2. **Post** (`engine/post/`): levels → invert → gradient map → alpha mode, or height → normal map.
   Shared by every generator; its parameters live in `POST_PARAMS`.

The preview renders at `min(resolution, 1024)`; exports re-render at full resolution
(shader generators are resolution independent; simulations are upsampled from their grid).

### Texture units

Passes bind their inputs on units `0..14`. Unit 15 (`UPLOAD_UNIT`) is reserved for creating and
uploading textures, so resource updates in the middle of a pass never replace its inputs.
Samplers with nothing to read get `gpu.blankTexture`.

## Parameters are the single source of truth

A generator declares `params: ParamDef[]`. From that list we derive:

- the **UI** (`ui/controls` picks a widget per type, grouped by `group`),
- the **GLSL uniforms** (`u_<key>`; declared automatically by `shaderBuilder.ts`),
- **validation** of documents / URLs / autosave (`params/values.ts#sanitizeValues`),
- **presets** (partial value sets, validated by unit tests).

| ParamDef type | GLSL        | Notes                        |
| ------------- | ----------- | ---------------------------- |
| float         | `float`     | slider + numeric input       |
| int           | `int`       |                              |
| bool          | `bool`      |                              |
| select        | `int`       | option values                |
| color         | `vec3`      | `#rrggbb` in documents       |
| vec2          | `vec2`      |                              |
| gradient      | `sampler2D` | baked 256×1 lookup texture   |
| text          | —           | CPU-side only (e.g. RD seed) |

## Shader generators

`engine/shaderBuilder.ts#buildGeneratorShader` assembles:

```
#version 300 es + precision
built-ins: u_resolution, u_time (s), u_seed
auto-declared parameter uniforms
glsl/common.glsl  (PI, TAU, rotate2d, centered, radialFalloff…)
glsl/noise.glsl   (seeded hashes, periodic gradient/value noise, fbm, polarNoise, voronoi)
glsl/sdf.glsl     (sdStar, strokeMask, fillMask…)
<generator snippet>
void main() { outColor = generate(v_uv); }
```

Conventions: `uv` in [0,1] with **y up**; `centered(uv)` gives [-1,1]. Return grayscale
intensity in rgb (the post pass colorizes) unless the generator is intrinsically colored.

**Seamless tiling**: lattice noises take a `period` (in cells); with integer scale and integer
lacunarity the output tiles exactly. Use the "Tiled 2×2" preview to check.

## Simulations (reaction-diffusion)

`SimulationGenerator.create(gpu)` returns a stateful `Simulation` (reset / step / render /
setPointer / dispose). The renderer keeps **one live simulation**; it is disposed when switching
to another generator. Params flagged `resetOnChange` restart it.

Reaction-diffusion (`generators/reaction-diffusion/`) implements Karl Sims' Gray-Scott
formulation on a ping-pong pair of float32 textures (r = A, g = B), toroidal wrap (so results
tile), with extras: spatial f/k variation maps, anisotropic diffusion (fixed/swirl/radial),
text/noise/spot seeds, mouse painting, relief shading.

## Documents & persistence

`app/document.ts` defines a **versioned** JSON format (`format`, `version`, `generator`,
`params`, `post`, `resolution`, `seed`) used by Save/Open, share links (`#doc=<base64url>`) and
localStorage autosave. All inputs go through `parseDocument` (validation + `migrate()`).

> Generator ids and param keys are part of the persisted format. Renaming one requires a
> migration step (bump `DOCUMENT_VERSION`).

## Testing

- `tests/unit` (Vitest, Node): params, gradients, documents, history, and **registry integrity**
  (unique ids, valid defaults/presets, every GLSL-visible param is referenced in its shader).
- `tests/e2e` (Playwright + SwiftShader): every generator compiles and renders without error;
  screenshots in `test-results/generators/`.
