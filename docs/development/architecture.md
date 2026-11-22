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

## Node graph

The editor state is a **graph of generator nodes** (`app/state.ts`: `EditorState.nodes`,
`links`, `selectedId`, plus the workspace `aspect`). Each node has its own generator, params,
Post Process values, color ramp, a Post Process bypass (`postEnabled`, the wand on the card),
and a freeze frame (`frozenAt`: the time the node is frozen at; frozen simulations stop
stepping).
The selected node is the one shown in the Details panel, driven by the timeline and exported
(with everything it depends on). Clicking a generator in the browser swaps the selected node's
generator (look and ramp kept); double-click or drag-and-drop adds a node.

**Generators and operators.** Generators create images; **operators** (`generators/operators/`,
browser tab "Operators", category `operator`) transform or combine them: Blend (modes, opacity,
mask), Mask, Levels & Math, Transform 2D, Warp (slope / vector / directional), Blur, Slope Blur,
Distance, Edge Detect, Unpack RGBA, Pack RGBA, Custom Code. Operators are plain shader generators
that declare `inputs` and sample them; their Post Process defaults to a pass-through (source
colors and alpha). Any generator may declare inputs (`engine/nodes.ts`): each one is bound as
`u_in_<key>` with `u_has_<key>` (shader generators, `GridSimulationSpec.inputs`,
`Simulation.setInputs`); simulations may restart when a seed input is (dis)connected
(`GridSimulationSpec.reseedInputs`: Reaction-Diffusion and Ink Marbling seeds). Custom Code
uses `ShaderGenerator.codeParam`: the text param is spliced into the fragment at the USER_CODE
marker (one program per distinct code; compile errors are reported on the node and cleared
when it is edited). Links never form cycles (`state.ts#withLink`). An input may list the
`params` that only matter when it is connected (greyed out otherwise, e.g. Physarum Food
strength).

**Multi-pass shader generators.** `ShaderGenerator.passes` are rendered before the main
fragment, each built like it (same params, inputs, chunks) and reading the previous pass as
`u_prev` (blank before the first), with `u_passIndex` / `u_passCount` when a pass repeats
(`repeat(params, width, height)`, 0 skips it). `precise` passes use full-precision, nearest
targets (coordinates, distances). The Renderer ping-pongs them in the node's `NodeTargets`.
Used by Distance (seed + jump flood, log2 steps covering Max distance) and the Blur (H + V
passes per level, each level doubling sigma; variances add up to the requested radius).

**Channel outputs.** A generator declaring `outputs` (`NodeOutputDef`: key, label, channel) has
one output pin per channel instead of the main one; links then carry `output`. After the node's
output, the Renderer writes each channel as an opaque grayscale target (`out:<key>`,
`NodeTargets.outputFor`). Used by Unpack RGBA.

**Value types.** An input may declare the value it reads (`NodeInputDef.value`: `'gray'` for
masks, patterns, seeds; `'color'` for flow vectors; absent = any image). Outputs are not
declared: App detects them (`App.detectValueTypes` → `Renderer.isGrayscale`, a 16×16 read-back
of the node image, re-checked when the image changes, at most twice a second per node). Pins
and links are colored by type; a link whose source type differs from the input's is drawn as a
gradient. Channel outputs are grayscale.

## Rendering pipeline

```
per node, upstream first (state.ts#fullEvaluationOrder):
generator ─► source ─► [slope blur] ─► [kuwahara] ─► post ─► output   (inputs: upstream outputs)
viewport: one canvas behind the DOM cards; Renderer.display() draws each output at its card
exports:  Capture.render(chain) renders the selected node and its upstream nodes offscreen
```

**Imported images** (`image` params, e.g. the Image node) are downscaled to 1024 px WebP data
URLs on import and decoded asynchronously (`gl/ImageTextures.ts`); when one becomes ready,
`App.assetVersion` changes every node signature so they re-render once.

**User presets** (`app/userPresets.ts`): named snapshots of a node (params, post, ramp,
adjustments) per generator in localStorage, listed under "My presets" in the preset menu.

**Workspace aspect** (Output tab): images are `imageDims(size, aspect)` (size = long side).
Shader generators get `u_uvScale` / `u_centerScale`: `layout: 'centered'` generators (default
when the fragment calls `centered()`) keep uv in [0,1] and `centered()` is aspect-corrected;
`'tiled'` ones repeat a whole number of times along the long axis (seamless, never stretched).
Simulations size their grids with `gpu.gridDims(simResolution)` (short side) and restart.

`App.draw` re-renders a node only when its *signature* changes (params, post, ramp, io, size,
time for animated shaders, simulation version, upstream versions). The selected node renders
at `min(resolution, 1024)`; others at a power of two matching their on-screen size (≤ 512).
Node outputs are straight-alpha RGBA16F (`NodeTargets`); `node/display.frag` composites them
over a checkerboard (tiling preview, nearest sampling when magnified).

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

   **Color ramp**: each node has one ramp (`GraphNode.ramp`, Post Process tab), passed to the
   post pass as `FrameRequest.ramp` (`u_ramp`). Generator presets may set it (`Preset.ramp`);
   generator definitions never ship their own ramp, to keep a unified look.

   **Presets** fully define the result: params and the Post Process look restart from the
   generator defaults (a module enabled by a previous preset never lingers); output settings
   are kept. A confirmation appears when the node was modified since its last preset.

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
| image         | `sampler2D` | data URL; + `vec2 u_<key>Size` (0 while loading) |

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
setPointer / dispose, optional setInputs / snapshot / restore). The renderer keeps **one live
simulation per node** (`Renderer.simulationFor(def, nodeId)`, `retainSimulations`); every
simulation node steps while playing, painting and keyframes apply to the selected one. Use
`App.liveSim()` to get one: a newly created instance must be reset. Params flagged
`resetOnChange` restart it.

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

The timeline does not destroy history while scrubbing: rewinding to a keyframe keeps the later
ones until the simulation steps again from there. Flipbooks can start later (time offset for
shaders; warm-up run, optionally from a restart, for simulations).

The look modules (`SCOPED_POST_PARAMS`, every Post Process param except color mode) are what a
look preset resets and what a node keeps when its generator is swapped; generators flagged
`dataOutput` (flowmap) get their own defaults instead.

Browser thumbnails use the generator's `featuredPreset`; hovering a tile renders every preset
once (64 px) and cycles through them.

Generators can declare `exportOverrides` (values forced in exports/thumbnails, e.g. the flowmap
preview off) and a `split` (float param driving a draggable split handle in the viewport).

Multi-pass steps: `GridSimulationSpec.step` may be a list of passes (`{ label, source,
repeat? }`) run in order for every iteration on the same state texture — the ink fluid packs
velocity, pressure and dye in one RGBA texel (advect → pressure Jacobi ×N → project), the
crystal growth relaxes its potential N times before each growth pass. `u_gridSize` gives the
grid size in every pass (in the seed pass `stateSize()` is 1×1).

Water Caustics (`simulation/caustics/`) wraps a `GridSimulation` (wave equation + rain + brush)
and renders real caustics: a triangle mesh of the surface (plus an analytic swell) is projected
along the refracted rays (`gpu.drawTriangles`, 9 instances for seamless wrap) and each triangle
adds (surface area / projected area) with additive blending (Evan Wallace's method); dispersion
projects each channel with its own index. Smoke & Fire (`simulation/smoke/`) is a
FluidNinja-style solver: forces (vorticity confinement, buoyancy, turbulence, emitters, Emitter
/ Flow inputs, open boundaries) → advect → pressure → project; it outputs density with alpha,
motion vectors or vorticity; its emitter can orbit (trails). Paint Mask
(`simulation/paint/`) is a canvas whose strokes persist (capsule brush between pointer
positions); it is `seedless`: seed changes and the global restart keep its content.

### Agent simulations

Physarum (`generators/simulation/physarum/`) implements `Simulation` directly: agents live in a
float texture (position, heading) updated by a fullscreen pass, and deposit into the trail map as
additively blended `gl.POINTS` (the vertex shader fetches the agent texture by `gl_VertexID`).

## Documents & persistence

`app/document.ts` defines a **versioned** JSON format (v7, `format: 'fx-designer'`, the
pre-rename `procedural-texture-maker` is still accepted: `nodes`, `links` (with an optional
`output`), `selected`, `resolution`, `seed`, `aspect`) used by Save/Open, share links (`#doc=<base64url>`)
and the autosave. Nodes may carry `collapsed` (optional, no version bump). All inputs go through `parseDocument` (validation; unknown nodes,
invalid links and cycles dropped; `migrate()`: v1 legacy post → v2 modules → v3 ramp override
removed → v4 the single generator becomes the only node → v5 generic Base / Mask / Warp inputs
and Generator-tab adjustments become chains of operator nodes → v6 Channels becomes Unpack RGBA,
whose links leave the chosen channel output; its Luminance mode becomes Custom Code → v7
Surface Wear is split into Brushed Metal / Scratches / Cracked Glass by its mode).

**Library.** `app/library.ts` keeps several **systems** (one document each) in localStorage
(index with name / date / thumbnail + one key per document); the current one receives the
autosave (the pre-library session key is still written and adopted as a system on first run).
Opening a file or a share link creates a new system. Switching systems replaces the state and
clears the undo history (`App.loadState`). `exportAll / importAll` read and write a whole
library file (`format: 'fx-designer-library'`, File → Save / Open library).

**Code view.** Shader nodes can carry `GraphNode.code`: GLSL replacing the generator's main
fragment (`FrameRequest.code` → `Renderer.programFor` compiles `{ ...def, fragment: code }`,
cached with the custom-code programs). The Generator page's Code button shows
`ui/CodePanel.ts` (the code + `shaderReference(def)`: built-ins, uniforms, helper signatures);
edited code that differs from the generator's (`codeDiffers`) makes the node custom, Revert
removes it. Simulations and `codeParam` generators are not convertible. `GraphNode.customParams`
(Code view parameter editor, `ui/ParamEditor.ts`) adds params to the node's schema:
`effectiveGenerator(def, node)` is the definition a node really runs (panels, presets,
documents, requests); renaming one renames its uniform in the code. User GLSL never compiles
in the frame: `Renderer.codeProgram` starts a `PendingProgram` (KHR_parallel_shader_compile)
and throws `ProgramPending` until it is ready (the node keeps its last image); failures are
cached per code, so a broken shader is not recompiled every frame.

**Exports.** One toolbar button opens `ui/ExportDialog.ts` (every export kind: PNG, maps,
flipbook, every node as a ZIP, document, share link). `app/exporter.ts` renders through a `Capture` (offscreen chain at a fixed size):
RGBA8 PNGs via the canvas (optional channel flips for flowmap conventions), and 16-bit
grayscale PNGs (`Capture.renderRed` on a float target + `util/png16.ts`, zlib by
`CompressionStream`) for height maps.

> Generator ids and param keys are part of the persisted format. Renaming one requires a
> migration step (bump `DOCUMENT_VERSION`).

## Server and accounts

`server/src` is a small Node server (no framework, `pg` only; built by `tsconfig.server.json`
into `server-dist/`, started with `npm start`). It serves the built app (`dist/`, same cache
headers as `deploy/nginx.conf`) and, when PostgreSQL is configured (`DATABASE_URL` or `PG*`),
the API:

- `auth.ts`: email / password accounts (pseudo, email, scrypt hashes) and Discord OAuth
  (`identify email`; accounts are never merged by email since password emails are not
  verified). Sessions are random tokens in an HttpOnly SameSite=Lax cookie, stored hashed.
  Login / registration are rate limited per IP and per login.
- `library.ts`: folders and systems (document as jsonb + thumbnail) per user, last write wins
  by `updated`, deletions as tombstones; size and count limits.
- Writes require `Content-Type: application/json` and, when present, an `Origin` equal to
  `PUBLIC_URL` (CSRF). `db.ts` holds the ordered `MIGRATIONS`, applied at startup under an
  advisory lock.

Client side, `app/cloud.ts` checks `/api/health` (no server = no account UI), restores the
session, pushes every local library change (debounced, `Library.onChange`) and reconciles the
whole library at sign-in and on window focus (`applyRemote*` methods write server data
without echoing it back). `ui/AccountUI.ts` is the toolbar button and sign-in window.
Deployment: [deployment/server.md](../deployment/server.md) (`deploy/autoupdate`: build next to the live
version, swap on success, health check and rollback).

## Voronoi

`noise.glsl` feature points rest in the central 60% of their cell and orbit around that rest
position when animated (`cellPoint`), so neighbours never merge. `voronoiNearest` returns the
**exact distance to the cell border** (two-pass, after Inigo Quilez): lines drawn from it have
a uniform width, unlike F2 − F1.

## UI

Unreal Engine 5-inspired (design tokens at the top of `styles/main.css`; neutral chrome, a flat
violet `--accent` for a few active states, orange `--select` for the graph selection). Panels are docked by `ui/Dock.ts`: a persisted tree of
splits (rows / columns with relative sizes and splitters) and tab stacks; dragging a tab onto
a stack's center adds it there, onto an edge splits that stack (`insertBeside`); panels hidden
from the Layout menu leave the tree and come back next to where they were. Docked panels built
with `ui/Panel.ts#dockPanel`, Content-Browser tiles with a category color stripe (simulation
thumbnails are captured from the live preview after 240 frames and cached in localStorage),
Details panel with three pages switched by a full-width segmented control (like the browser's
Generators / Operators) — Generator / Post Process / Output (`ui/Panel.ts#tabbedPanel`;
seed and export size are `GLOBAL_PARAMS` in the Output tab) — shared search, per-row reset
arrows (compared with the generator's own defaults) and modified-value badges on tabs, Unreal-style numeric fields (`ui/controls/number.ts`: drag to scrub, Shift = fine,
click to type; typed values may exceed the slider up to `numericLimits`), viewport overlay
toolbar and the Stats bar (bottom, hidden by default). `ParamPanel` renders a **preset
gallery** above the params (thumbnails from `App.presetThumbnail`: the node's chain rendered
offscreen with the preset applied, queued and cached; hovering a tile sets `hoverPreview`,
which `App.liveNode` substitutes while drawing) and honours `ParamDef.visibleWhen`. The ramp
editor (`controls/gradient.ts`) keeps its stop markers alive during drags and handles Del on
a focused stop itself; colors use `controls/colorPicker.ts` (SV square, hue / alpha, hex,
RGB, HSV). Cards are rasterized as one GPU layer only while the view moves
(`.vp-stage.moving`), so text and icons are redrawn sharp at the final zoom. Icons are inline SVG (`ui/icons.ts`);
module groups (`ParamGroupInfo.icon`) show one in their header.

Viewport (`ui/Viewport.ts`) **is the node graph**: DOM cards (header with post eye and delete,
input pins in the left gutter, output pin in the right gutter, never over the image) in a
CSS-transformed world (wheel zoom at cursor, middle / Alt-drag pan, F fit all,
Shift+F frame selected, 1:1). Stacking: links SVG, then the WebGL canvas (node images at each
card's rect, so links pass behind images), then the cards. Cards have a z order (the selected
one comes to the front); the canvas draws images back to front and each card is clipped
(`clip-path`, `rectMinusHoles`) where the image of a card in front of it lies, so overlapping
cards look stacked. The background dot grid is in graph space (`applyBackground`: spacing
doubles / halves with the zoom, finer level fading in) and cards snap to it (`GRID`; Ctrl
while dragging = free). Collapsed cards show one pin row per input (no image). Links are
clickable (wide invisible hit path): a click selects one, Del removes it; dragging from an output pin onto an input pin (or from a free input onto an
output) connects, pressing a linked input detaches it. Multi-selection is view state
(`Viewport.selection`, always containing the edited node): background drag = selection box,
Shift+click toggles, dragging a card moves the whole selection in world coordinates (zooming
mid-drag keeps it under the cursor) and commits all moves at once; App covers the Details
panel with a "N nodes selected" summary. Native drag is disabled on the stage, and generator tiles are dragged with pointer events
(`GeneratorList.dropTarget` → `Viewport.dropPosition`): native HTML drag & drop was cancelled
by the browser (pointercancel) and could leave the drop broken. Del deletes the
selection (unless text is being typed; clicking the graph takes focus back from the Details
panel), Ctrl+D duplicates. Links are axis-aligned with rounded corners (`roundedPolyline`).
A link released on empty space raises `onLinkDrop`: App opens `ui/QuickAddMenu.ts` (most
used nodes from `app/nodeUsage.ts` + search) and creates the node already connected. Pointer → uv on the selected card uses
`getBoundingClientRect`, so painting works at any zoom. `ui/Timeline.ts` is driven by `App` (time mode: seek/scrub/step + filmstrip rendered a
few frames per tick; frames mode: simulation keyframes). `ui/Layout.ts` hides parts with
`hide-<part>` classes on `.app` (persisted); the dock grid collapses tracks through CSS vars.
The browser groups categories into families (`GENERATOR_FAMILIES`).

## Testing

- `tests/unit` (Vitest, Node): params, gradients, documents, history, and **registry integrity**
  (unique ids, valid defaults/presets, every GLSL-visible param is referenced in its shader).
- `tests/e2e` (Playwright + SwiftShader): every generator compiles and renders without error;
  screenshots in `test-results/generators/`.
