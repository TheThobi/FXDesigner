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
2. **Slope blur** (optional module, `post/slope.frag` + `post/slope-blur.frag`): a slope map
   (periodic fBm or the image luminance) is rendered, then each pixel walks along its gradient
   accumulating the source (average / min / max) — Substance Designer's painterly smoothing.
3. **Post** (`engine/post/post.frag`), shared by every generator. Per evaluation point:
   levels → posterize/dither → halftone → color ramp → relief lighting → alpha → outline.
   The point is then either supersampled (SSAA k×k, the source being rendered k× larger) or
   evaluated once per pixel block (pixel-art mode: every neighbour lookup uses the block grid,
   so outlines are exactly one block wide). Output can be color, normal or height.

   **Modules**: every optional stage is a parameter group whose `toggle` bool (`levelsOn`,
   `slopeBlurOn`, `lightingOn`, `posterizeOn`, `halftoneOn`, `pixelateOn`, `outlineOn`,
   `antialiasOn`) is shown as a switch in the group header; `POST_MODULES` gives each module a
   description and a live summary. The same mechanism works for generator params
   (`param.toggle`, `GeneratorDefinition.groups`).

   **Color ramp**: one shared ramp (`EditorState.ramp`, Post Process tab) colors every
   generator; a generator may override it (`overrideRamp` + `gradient`, Generator tab). The
   app resolves the effective ramp before rendering (`App.effectivePost`). Generator
   definitions should not set their own ramp, to keep a unified look.

   Sizes are in "px @512" so the preview and a 4K export look the same. Presets may override
   post values using a shorthand (`posterize: 4` enables the module; see
   `post/legacy.ts#upgradeLegacyPost`, also used to migrate v1 documents).

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
built-ins: u_resolution, u_seed, u_clock (s), u_loop; global `float u_time`
auto-declared parameter uniforms
glsl/common.glsl  (PI, TAU, rotate2d, centered, radialFalloff…)
glsl/noise.glsl   (seeded hashes, periodic gradient/value noise, fbm, polarNoise, voronoi)
glsl/sdf.glsl     (sdStar, strokeMask, fillMask…)
<generator snippet>
void main() { u_time = …; outColor = generate(v_uv); }
```

`u_time` is a plain global set by `main()`, so the engine can remap time for any generator.
**Seamless loop** (`seamlessLoop` / `loopDuration` / `loopBlend`, per-generator values in
`TIME_PARAMS`): over a period T, `out(t) = mix(f(t + T), f(t), w(t))` with `w(0) = 0`,
`w(T) = 1`, so the end matches the start exactly; `generate()` runs twice only inside the blend
window. The timeline spans `[0, loopDuration]` and flipbooks default to that duration.

Conventions: `uv` in [0,1] with **y up**; `centered(uv)` gives [-1,1]. Return grayscale
intensity in rgb (the post pass colorizes) unless the generator is intrinsically colored.

**Seamless tiling**: lattice noises take a `period` (in cells); with integer scale and integer
lacunarity the output tiles exactly. Use the "Tiled 2×2" preview to check.

## Simulations

`SimulationGenerator.create(gpu)` returns a stateful `Simulation` (reset / step / render /
setPointer / dispose). The renderer keeps **one live simulation**; it is disposed when switching
to another generator. Params flagged `resetOnChange` restart it.

### Grid simulations (`engine/simulation/GridSimulation.ts`)

Most simulations are cellular: a state texture updated in place. They are declared with three
GLSL passes (`seed`, `step`, `render`) and a param schema; `GridSimulation` handles ping-pong
buffers, iterations, uniforms and the brush. Each pass gets `u_state`, `u_seed`, `u_frame`,
`u_brush`, `u_seedTexture`, every param as `u_<key>`, and the `common`/`noise`/`sim` chunks
(`neighbor()`, `stateAt()`, `sampleState()` bilinear + wrapped, `boxAverage()`, `brushMode()`).
Param conventions: `simResolution`, `stepsPerFrame`, `brushSize` (builders in `param.*`).
In the seed pass `u_state` is a blank 1×1 texture: address cells with `gl_FragCoord`.

Built this way: reaction-diffusion (Karl Sims' Gray-Scott + anisotropic tensor diffusion with
automatic dt scaling for stability), cyclic automaton, BZ spirals, ink marbling. All use toroidal
wrap, so results tile.

Simulations may implement `snapshot()` / `restore()` (GPU copies via `gpu.cloneTarget` /
`copyTarget`): the timeline keeps up to 16 keyframes, thinned to every other one (and the
interval doubled) when full, so they cover the whole run and the user can jump back.

Post Process scope (`app/state.ts`): the look modules (`SCOPED_POST_PARAMS`, i.e. every Post
Process param except color mode) live in `EditorState.sharedPost` in **global** scope and in
each generator's own post values in **local** scope; color mode, ramp override, output and
animation settings always stay per generator. `postOf()` merges them (global: shared wins;
local: own wins, untouched generators inherit the shared look). Generators flagged
`dataOutput` (flowmap) never receive the shared look. Documents store the full effective post
plus `postScope`.

Browser thumbnails use the generator's `featuredPreset`; hovering a tile renders every preset
once (64 px) and cycles through them.

Generators can declare `exportOverrides` (values forced in exports/thumbnails, e.g. the flowmap
preview off) and a `split` (float param driving a draggable split handle in the viewport).

Multi-pass steps: `GridSimulationSpec.step` may be a list of passes (`{ label, source,
repeat? }`) run in order for every iteration on the same state texture — the ink fluid packs
velocity, pressure and dye in one RGBA texel (advect → pressure Jacobi ×N → project), the
crystal growth relaxes its potential N times before each growth pass. `u_gridSize` gives the
grid size in every pass (in the seed pass `stateSize()` is 1×1).

### Agent simulations

Physarum (`generators/simulation/physarum/`) implements `Simulation` directly: agents live in a
float texture (position, heading) updated by a fullscreen pass, and deposit into the trail map as
additively blended `gl.POINTS` (the vertex shader fetches the agent texture by `gl_VertexID`).

## Documents & persistence

`app/document.ts` defines a **versioned** JSON format (`format`, `version`, `generator`,
`params`, `post`, `resolution`, `seed`) used by Save/Open, share links (`#doc=<base64url>`) and
localStorage autosave. All inputs go through `parseDocument` (validation + `migrate()`).

> Generator ids and param keys are part of the persisted format. Renaming one requires a
> migration step (bump `DOCUMENT_VERSION`).

## Voronoi

`noise.glsl` feature points rest in the central 60% of their cell and orbit around that rest
position when animated (`cellPoint`), so neighbours never merge. `voronoiNearest` returns the
**exact distance to the cell border** (two-pass, after Inigo Quilez): lines drawn from it have
a uniform width, unlike F2 − F1.

## UI

Unreal Engine 5-inspired (design tokens at the top of `styles/main.css`): docked panels built
with `ui/Panel.ts#dockPanel`, Content-Browser tiles with a category color stripe (simulation
thumbnails are captured from the live preview after 240 frames and cached in localStorage),
Details panel with three tabs — Generator / Post Process / Output (`ui/Panel.ts#tabbedPanel`;
seed and export size are `GLOBAL_PARAMS` in the Output tab) — shared search, per-row reset
arrows (compared with the generator's own defaults) and modified-value badges on tabs, Unreal-style numeric fields (`ui/controls/number.ts`: drag to scrub, Shift = fine,
click to type), viewport overlay toolbar and status bar. Icons are inline SVG (`ui/icons.ts`);
module groups (`ParamGroupInfo.icon`) show one in their header and chip.

Viewport (`ui/Viewport.ts`): CSS-transform zoom/pan of the canvas frame (wheel at cursor,
middle/Alt-drag, 1:1, fit); pointer → uv uses `getBoundingClientRect`, so painting works at any
zoom. `ui/Timeline.ts` is driven by `App` (time mode: seek/scrub/step + filmstrip rendered a
few frames per tick; frames mode: simulation keyframes). `ui/Layout.ts` hides parts with
`hide-<part>` classes on `.app` (persisted); the dock grid collapses tracks through CSS vars.
The browser groups categories into families (`GENERATOR_FAMILIES`).

## Testing

- `tests/unit` (Vitest, Node): params, gradients, documents, history, and **registry integrity**
  (unique ids, valid defaults/presets, every GLSL-visible param is referenced in its shader).
- `tests/e2e` (Playwright + SwiftShader): every generator compiles and renders without error;
  screenshots in `test-results/generators/`.
