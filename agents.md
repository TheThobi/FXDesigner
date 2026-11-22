# AGENTS.md

FX Designer: procedural effect-texture generator (WebGL2, TypeScript, Vite, no UI framework). Static site,
deployed as an nginx container on an OpenMediaVault NAS. Read `docs/ARCHITECTURE.md` first.

## Commands

Local Node on the dev machine is too old (v12): use Docker via `make` (`make check`, `make e2e`,
`make build`, `make dev`). Docker is rootless here: do **not** pass `-u` to `docker run`.

- `make check` — tsc + eslint + vitest. Must pass before committing.
- `make e2e` — Playwright in `mcr.microsoft.com/playwright:v<version>-noble` (keep the image tag
  in Makefile and CI in sync with `@playwright/test`). Renders every generator with SwiftShader;
  screenshots in `test-results/generators/` — look at them after touching GLSL.

## Conventions

- Layering: `util ← params ← engine ← generators ← ui ← app`. UI widgets never mutate state;
  everything goes through `App.commit()`.
- A generator = `<name>.ts` (definition, params schema) + `<name>.glsl` (`vec4 generate(vec2 uv)`),
  registered in `src/generators/registry.ts`. Params become `u_<key>` uniforms automatically.
- Cellular simulations use `GridSimulation` (seed/step/render passes). In the seed pass use
  `gl_FragCoord` (u_state is a blank 1x1 there). Never name a param like an engine uniform
  (`RESERVED_UNIFORMS`) nor like a sampler a custom pass declares (e.g. Physarum `u_agents`).
- Explicit-Euler sims: check stability (stencil eigenvalue × dt < 2) when adding terms; see the
  RD anisotropy dt scaling.
- Stylized looks are often just presets with `post` overrides (posterize/outline/halftone).
- Art direction: "stylized" means Silksong / Dead Cells-like game textures, NOT toon/comic VFX
  and NOT procedural "hand-painted" templates (rejected: looked like 2010 WoW). Painterly
  smoothing = slope blur. Each node has one color ramp (Post Process); presets set it with
  `Preset.ramp`, never with a per-generator ramp param or a `post.gradient`.
- Post stages are modules with a `toggle` bool; presets may use the legacy shorthand
  (`posterize: 4`) which `upgradeLegacyPost` converts. Documents are v4 (node graph).
- Time: generators read the global `u_time` (set in main, not a uniform). Seamless loop and
  timeline duration are per-generator post values (`TIME_PARAMS`). Simulations should
  implement `snapshot/restore` for timeline keyframes.
- Grid simulation passes get `u_gridSize`; never use `stateSize()` in a seed pass (1×1 there).
  Multi-pass solvers: `step: [{ label, source, repeat }]`.
- Node graph (`app/state.ts`): the viewport shows every node as a card; the selected node is
  edited, timed and exported. Every node has its own params / post / ramp / `postEnabled` /
  `frozenAt`. Combining / transforming images is an **operator** node's job (Blend, Mask,
  Warp, Levels…, `generators/operators/`); never add engine-side inputs or per-node modules
  for it. Inputs are declared by the generator (`inputs`, sampled as `u_in_<key>` /
  `u_has_<key>`).
  Simulations live per node: get them with `App.liveSim()` (a new instance must be reset).
  Data generators: `dataOutput`.
- Non-square workspaces: shader generators are laid out `centered` (shapes stay round) or
  `tiled` (whole repeats); the default comes from calling `centered()`, override with
  `ShaderGenerator.layout`. Simulations size grids with `gpu.gridDims()`, never assume square.
- Multi-pass operators: `ShaderGenerator.passes` (read the previous one as `u_prev`; `precise`
  for data such as jump-flood coordinates). Channel outputs: `outputs` (links carry `output`).
  Settings tied to an input go in `NodeInputDef.params` (greyed out while unconnected).
- Sampling: derive tap counts from the radius (smooth at any size) instead of exposing a
  samples param; large Gaussian radii use multi-level passes (see the Blur operator).
- Custom GLSL: `ShaderGenerator.codeParam` (the Custom Code operator); the USER_CODE marker
  must appear only once in the fragment (comments included).
- No mode enum whose values use different params: every param must matter in every mode. If
  modes need different settings, make separate generators (Surface Wear became Brushed Metal,
  Scratches and Cracked Glass).
- Animation operators: category `animation` (`isOperator()` covers both), `animated: true`,
  they read `u_time`; Color Cycle outputs a value colored by the node's own ramp.
- Browser categories (`GeneratorCategory`): fire, light (light & magic), impact, water,
  particle (sprites), noise, material, pattern, simulation, operator, animation. Categories are
  not persisted (ids are): regroup freely, keep CSS `--cat-<id>` colors in sync.
- Generator presets set generator params only; Post Process looks are separate (a preset's own
  `post` / `ramp` is offered from a toast, never applied silently).
- Inputs reading one channel declare `value: 'gray'` (masks, patterns, seeds); outputs are
  detected (grayscale vs color) and color pins / links.
- No native HTML drag & drop in the UI: use pointer events (the browser cancels the pointer
  stream when it starts its own drag).
- `docs/NODES.md` is generated from the registry: after changing a node run `npm run docs`
  (a unit test fails otherwise). How to write nodes: `docs/AUTHORING.md`.
- Slider ranges (min / max) should be generous; typed values may go to `numericLimits`
  (`limit` overrides it for unsafe params such as loop counts).
- Keep UI text short: no explanatory paragraphs where a label or tooltip does the job.
- Generator presets describe shapes only: no stylizing `post` overrides (toon, halftone,
  pixel… are Post Process looks in `POST_PRESETS`); a preset `ramp` / data `colorMode` is
  offered to the user, not applied.
- Server (`server/src`, Node ESM, `tsconfig.server.json`): imports end in `.js`; no framework,
  only `pg`. Secrets only in `.env` (never committed; `.env.example` is the template). Schema
  changes: append to `MIGRATIONS` in `server/src/db.ts`, never edit an applied one. Library
  sync is last-write-wins by `updated` with tombstones (`src/app/cloud.ts`).
- Every generator should have several presets (named by the look, not by other generators)
  and a `featuredPreset` (browser thumbnail).
- Fast e2e iteration: `PW_BASE_URL=http://localhost:5173` runs Playwright against the dev
  server (no build); Playwright wipes `test-results/` on each run.
- Gradient preset names describe colors, never generators (unit test enforces it). The
  default ramp is plain black → white.
- Post sizes are in "px @512" (resolution independent). Post params are split into
  `POST_PROCESS_PARAMS` / `OUTPUT_PARAMS`; seed + export size are `GLOBAL_PARAMS` (app/state.ts).
- SwiftShader e2e runs are slow with SSAA materials; judge performance on a real GPU.
- UI follows the UE5-like design tokens at the top of `styles/main.css`; keep new widgets on them.
- Generator **ids and param keys are persisted** (documents, share links, autosave). Renaming
  requires a migration in `app/document.ts` (bump `DOCUMENT_VERSION`).
- GLSL: uv in [0,1], y up; return grayscale, the post pass colorizes. Keep noises periodic when a
  `tileable` option exists. Avoid `%` on negative ints (undefined in GLSL ES).
- WebGL texture-unit rules (both bugs happened, see `engine/gl/units.ts`):
  1. Creating/uploading a texture must go through `activateUploadUnit(gl)` — a bare
     `bindTexture` clobbers the input a pass bound on the active unit.
  2. Every sampler a program declares must be bound before drawing; bind `gpu.blankTexture`
     when there is nothing to read (otherwise it defaults to unit 0 → feedback loop).
     The e2e suite fails on `GL_INVALID_*` console output and probes pixels to catch these.
- Code, comments and UI strings in English; user-facing docs (README, docs/DEPLOY_OMV.md,
  docs/ROADMAP.md) in French.
