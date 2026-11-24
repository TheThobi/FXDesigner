# AGENTS.md

Entry point for contributors and AI assistants. FX Designer is a browser-based procedural
effect-texture designer: node graphs of GPU generators, operators and simulations, exported
as textures, maps and flipbooks for games (WebGL2, TypeScript, Vite, no UI framework). The
client is a static site; an optional Node server adds accounts and library sync (PostgreSQL).

Read next: [docs/development/architecture.md](docs/development/architecture.md) (how it works),
[docs/development/authoring.md](docs/development/authoring.md) (writing nodes),
[docs/development/nodes.md](docs/development/nodes.md) (generated node reference). Index of all
docs: [docs/README.md](docs/README.md).

## Repository map

- `src/`: the client, layered `util ← params ← engine ← generators ← ui ← app`.
  `generators/**/<id>.ts + .glsl` are the nodes (`registry.ts` lists them).
- `server/src/`: accounts + library API and static file server (Node ESM, `pg` only).
- `tests/unit` (vitest), `tests/server` (vitest, Node), `tests/e2e` (Playwright, SwiftShader).
- `Dockerfile` / `docker-compose.yml`: one image running the Node server (port 8080): the app
  alone without `.env`, accounts with PostgreSQL settings.
- `docs/`: `development/`, `deployment/`, `project/` (see docs/README.md).

## Commands

npm scripts need Node ≥ 20 (local Node 22 works); `make <target>` runs the same in Docker
(rootless here: never pass `-u` to `docker run`).

- `npm run check` (`make check`): tsc (client, e2e, server) + eslint + vitest. Must pass before
  committing.
- `npm run docs`: regenerates `docs/development/nodes.md` after any node change (a unit test
  fails otherwise).
- `npm run test:e2e` (`make e2e`): Playwright against the production build, one worker; the
  app runs with `?e2e` (no background thumbnails) and the generator sweep is split in 4 tests.
  Every test is tagged `@part1`…`@part4` (similar durations): CI runs the parts on 4 parallel
  jobs (`--grep @partN`); tag new tests to keep them balanced.
  Screenshots in `test-results/generators/`: look at them after touching GLSL.
  `PW_BASE_URL=http://localhost:5173` runs against the dev server (no build). Keep the
  Playwright image tag in Makefile and CI in sync with `@playwright/test`.
- `npm run dev` (editor) and `npm run dev:server` (API with the `DEV_` settings of `.env`).
- `make glsl`: compiles every shader (generators, passes, simulations, post) with glslang in
  a few seconds (`scripts/check-glsl.sh`, `tests/unit/glsl-dump.test.ts`). Run it after any
  GLSL change.
- AI assistants never run the e2e suite locally (slow, costly): GitHub CI runs it and the user
  reports failures. Local verification stops at `npm run check` + `make glsl`.

## Architecture rules

- UI widgets never mutate state: everything goes through `App.commit()`.
- Node graph (`app/state.ts`): every node is a card; the selected one is edited, timed and
  exported. Each node has its own params, post, ramp, `postEnabled`, `frozenAt`, optional
  `collapsed`, `code` and `customParams`.
- Combining / transforming images is an **operator** node's job (`generators/operators/`),
  never engine-side inputs or per-node modules. Inputs are declared by the generator (`inputs`,
  sampled as `u_in_<key>` / `u_has_<key>`); one-channel inputs declare `value: 'float'`
  (pin / link colors follow Shader Graph: float blue, vec2 green, vec3 yellow, vec4 pink).
  Settings tied to an input go in `NodeInputDef.params` (greyed out while unconnected).
- Multi-pass shaders: `ShaderGenerator.passes` (previous pass as `u_prev`, `precise` for data).
  Data generators: `dataOutput`.
- Outputs: every node has RGBA plus `STANDARD_OUTPUTS` (rgb, r, g, b, a), extracted on demand
  by `Renderer.outputOf`; declared `outputs` replace them (Unpack RGBA). Links carry `output`.
- Exports and the library thumbnail use the connected Output node, else the selection
  (`App.exportNode`). Output / Reroute are pass-through operators marked by `role`. The
  selection may be empty (`selectedId` = '').
- User presets (`app/userPresets.ts`) are keyed by generator id, or the shared scopes `@look`
  (Post Process) and `@color` (ramps).
- Simulations live per node: `App.liveSim()` (a new instance must be reset).
- Non-square workspaces: shader generators are `centered` (shapes stay round) or `tiled`
  (whole repeats), default from calling `centered()`; simulations size grids with
  `gpu.gridDims()`.
- Time: generators read the global `u_time`; loop and timeline duration are per-node post
  values (`TIME_PARAMS`). Simulations implement `snapshot/restore` (timeline keyframes).
- Generator **ids and param keys are persisted** (documents, share links, library). Renaming
  requires a migration in `app/document.ts` (bump `DOCUMENT_VERSION`).

## Generators, parameters, presets

- A generator = `<id>.ts` (definition, params) + `<id>.glsl` (`vec4 generate(vec2 uv)`),
  registered in `generators/registry.ts`. Params become `u_<key>` uniforms. Never name a param
  like an engine uniform (`RESERVED_UNIFORMS`) or a sampler a custom pass declares.
- GLSL: uv in [0,1], y up; return grayscale (the post pass colorizes). Keep patterns periodic
  (`wrapCell`, periodic noises). Avoid `%` on negative ints.
- Every param must matter in every mode: if modes need different settings, make separate
  generators (Surface Wear became Brushed Metal / Scratches / Cracked Glass). A setting that does
  nothing for the current value of an enum must be hidden (`ParamDef.visibleWhen`,
  `PresetGalleryOptions.visibleWhen`).
- Slider ranges should be generous; typed values may go to `numericLimits` (`limit` overrides
  it for unsafe params such as loop counts).
- Sampling: derive tap counts from the radius instead of exposing a samples param.
- Presets: several per generator, named by the look (never after another generator), plus a
  `featuredPreset` (browser thumbnail). They describe shapes only: no stylizing `post`
  overrides (toon, halftone, pixel… are Post Process looks, `POST_PRESETS`); a preset `ramp` or
  data `colorMode` is offered to the user, never applied silently.
- Gradient preset names describe colors (unit test). The default ramp is black → white.
- Categories (`GeneratorCategory`) are not persisted: regroup freely, keep the CSS
  `--cat-<id>` colors in sync. Animation operators: category `animation`, `animated: true`.

## Post Process

- Modules with a `toggle` bool, in pipeline order; presets may use the legacy shorthand
  (`posterize: 4`) that `upgradeLegacyPost` converts. Sizes are "px @512".
- Params split into `POST_PROCESS_PARAMS` / `OUTPUT_PARAMS`; seed and export size are
  `GLOBAL_PARAMS`. One color ramp per node (`Preset.ramp`, never a per-generator ramp param or
  `post.gradient`).

## Simulations

- Cellular ones use `GridSimulation` (seed / step / render passes,
  `step: [{ label, source, repeat }]` for multi-pass solvers). In the seed pass use
  `gl_FragCoord` / `u_gridSize` (`u_state` is a blank 1×1 there, never call `stateSize()`).
- Explicit Euler: check stability (stencil eigenvalue × dt < 2) when adding terms.

## Custom code

- `ShaderGenerator.codeParam` (Custom Code operator): the USER_CODE marker appears once in the
  fragment (comments included).
- Node code (Code view) and Custom Code compile in the background (`Renderer.codeProgram`,
  `ProgramPending`): never compile user GLSL synchronously in the frame.
- Built-in programs too: get them through `GpuContext.program / tryProgram` (shared per
  context, never disposed by their users; `SimProgram` for simulation passes). Frame-loop code
  must tolerate `ProgramPending`; captures wait. Never call `new ShaderProgram` directly.
- Custom parameters live in `GraphNode.customParams`; use `effectiveGenerator(def, node)`
  wherever a node's param schema is needed.

## UI

- UE5-like design tokens at the top of `styles/main.css`. Chrome stays neutral (`--focus`
  grey); flat violet `--accent` for a few states only; graph selection is `--select` orange; no
  gradients (logo only): category colors stay the strongest cue. Window tabs carry no color.
- Keep UI text short: no explanatory paragraphs where a label or tooltip does the job.
- No native HTML drag & drop: pointer events only (the browser cancels the pointer stream when
  it starts its own drag).
- Panels are docked by `ui/Dock.ts` (tree of splits and tab stacks). Hidden panels stay in
  the tree (not drawn): never remove them to hide them, sizes would drift.
- Right-click menus use `ui/ContextMenu.ts` (pass the dialog as container inside a modal);
  anything listable (cards, tiles, nodes, links) should offer its actions there.

## WebGL pitfalls (both happened, see `engine/gl/units.ts`)

1. Creating / uploading a texture goes through `activateUploadUnit(gl)`: a bare `bindTexture`
   clobbers the input a pass bound on the active unit.
2. Every sampler a program declares must be bound before drawing (`gpu.blankTexture` when there
   is nothing to read), otherwise it defaults to unit 0 → feedback loop. The e2e suite fails on
   `GL_INVALID_*` console output and probes pixels to catch these.

SwiftShader (e2e) is slow with SSAA materials: judge performance on a real GPU.
Simulation defaults must stay affordable on SwiftShader too (CI renders on the CPU): grid 256,
a few steps per frame, and fetch a stencil once rather than per neighbour; heavier settings
belong in presets. A 512² grid × 8 steps × ~30 fetches stalled the e2e page for minutes.

## Server

- `server/src`, Node ESM (`tsconfig.server.json`): imports end in `.js`; no framework.
- Secrets only in `.env` (never committed); `.env.example` is the template. `DEV_` variables
  replace the deployment ones under `npm run dev:server`.
- Schema changes: append to `MIGRATIONS` (`server/src/db.ts`), never edit an applied one.
- Library sync is last-write-wins by `updated`, deletions as tombstones (`src/app/cloud.ts`).
- Community (`server/src/community.ts`): categories live on the server (`COMMUNITY_CATEGORIES`,
  ids are stored); the client never trusts a community document before `parseDocument`.
  Library systems link to their publication (`SystemEntry.published`, hash from
  `contentHash`): keep local and published states visibly apart in the UI.

## Art direction

"Stylized" means Silksong / Dead Cells-like game textures, NOT toon / comic VFX and NOT
procedural "hand-painted" templates (rejected: looked like 2010 WoW). Painterly smoothing =
slope blur.

## Language

Code, comments and UI strings in English. README and `docs/development/` in English;
`docs/deployment/` and `docs/project/` in French.
