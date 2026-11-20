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
