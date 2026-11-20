# AGENTS.md

Procedural effect-texture generator (WebGL2, TypeScript, Vite, no UI framework). Static site,
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
  smoothing = slope blur. Generators share one color ramp; don't add per-generator ramps.
- Post stages are modules with a `toggle` bool; presets may use the legacy shorthand
  (`posterize: 4`) which `upgradeLegacyPost` converts. Documents are v2 (shared `ramp`).
- Time: generators read the global `u_time` (set in main, not a uniform). Seamless loop and
  timeline duration are per-generator post values (`TIME_PARAMS`). Simulations should
  implement `snapshot/restore` for timeline keyframes.
- Grid simulation passes get `u_gridSize`; never use `stateSize()` in a seed pass (1×1 there).
  Multi-pass solvers: `step: [{ label, source, repeat }]`.
- Post look scope: `SCOPED_POST_PARAMS` follow global/local scope (`state.ts#postOf`); output,
  color mode and animation values are always per generator. Data generators: `dataOutput`.
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
