<h1 align="center">
  <img src="public/favicon.svg" alt="" width="48" height="48" align="absmiddle" />
  FX Designer
</h1>

<p align="center">
  <strong>A node-based tool to make animated procedural textures for game developpers</strong><br />
  A GPU-powered creative workspace, right in your browser.
</p>

<p align="center">
  <a href="https://fx.thobi.fr"><strong>Open FX Designer ↗</strong></a>
  &nbsp;·&nbsp;
  <a href="#getting-started">Getting started</a>
  &nbsp;·&nbsp;
  <a href="docs/development/nodes.md">Node catalog</a>
  &nbsp;·&nbsp;
  <a href="#development">Development</a>
</p>

<p align="center">
  <sub>WebGL2 &nbsp;/&nbsp; TypeScript &nbsp;/&nbsp; Vite &nbsp;/&nbsp; No UI framework</sub>
</p>

---

Build effects, materials, masks and animations by connecting nodes in a graph. Everything
renders live on your GPU, then exports as textures, maps or flipbooks for your game engine.

No account needed: projects live in a local library. An optional server adds accounts and
sync across devices.

<br />

## Getting started

1. Open **[fx.thobi.fr](https://fx.thobi.fr)** in a WebGL2 browser.
2. **Double-click** a generator in the Browser to add it (a single click swaps the selected
   node's generator).
3. Pick a preset, tweak it in **Details → Generator**.
4. Add an operator and drag a link from an output pin to its input.
5. Color it in **Post Process**, set size and aspect in **Output**.
6. **Export**.

> Example: Noise → **Warp** distorts a shape, **Blend** mixes it with another texture.

<br />

## Features

**Generators** — fire and smoke, light and magic, impacts, water and particles, noises,
materials, shapes and patterns, plus imported images. Each comes with presets.

**Simulations** — reaction-diffusion, Physarum, fluids (colored inks), smoke & fire, Lenia,
cellular automata, crystals, caustics, hydraulic erosion, differential growth, burning paper,
growing cracks, flowmap painting… Most can be painted in their preview; fluids flow around
connected obstacles.

**Operators** — compositing (Blend, Mask, Height Blend, Levels, Math), shaping (Transform,
Warp, Polar, Make It Tile), filters (Blur, Glow, Radial and Slope Blur), analysis (Distance,
Curvature & Occlusion, Edge Detect), Substance-style Tile Sampler and Flood Fill family,
Trim Sheet, channel Pack / Unpack, Custom Code.

**Animation** — timeline with per-node loops (noises loop natively), frame stepping,
animated Tile Sampler copies and animation operators (Hue Shift, Color Cycle, Flicker,
Scroll, Dissolve).

**Post Process** — one color ramp per node and stackable modules: slope blur, Kuwahara,
grading, relief lighting, watercolor, posterize, dithering, halftone, pixel art, grain,
outlines, anti-aliasing. Look presets combine them.

**GLSL** — the **Code** view edits any node's shader, with custom parameters. Code compiles
in the background: errors stay on their node.

**3D Preview** — a dockable panel (Layout menu) shows the result on a plane, sphere, cube or
cylinder, lit with its relief, or as an additive sprite; a Material Output node feeds it
color, normal, height and roughness.

**Graph** — comment frames (`C` around the selection) group and name parts of a system;
dragging a frame moves its nodes.

**Library** — systems in folders, autosaved in the browser, exportable as JSON, shareable as
links. Signing in syncs them across devices and opens the **community** (publish systems and
custom shader nodes, install shared nodes into the node browser, subscribe, report).
Installable as an app; works offline.

The full list of nodes and parameters is in the [node reference](docs/development/nodes.md).

<br />

## Export

| Output          | Contents                                                           |
| --------------- | ------------------------------------------------------------------ |
| PNG             | Selected node (or connected Output) with alpha                     |
| Maps            | Color, normal (OpenGL / DirectX) and height, PNGs or ZIP           |
| 16-bit height   | Grayscale PNG with full precision                                  |
| Flipbook        | Sprite sheet (grid, time offset, warm-up), optional motion vectors |
| Video / GIF     | The loop (repeated) or a simulation run, WebM or animated GIF      |
| Variations      | Sprite sheet with one random seed per cell                         |
| Nodes as ZIP    | Every node's image                                                 |
| Document / link | Editable JSON, or a URL containing the document                    |

Exports go from **128 to 4096 px** on the long side; previews are capped at 1024 px.

<br />

## Shortcuts

| Action                  | Shortcut                  |
| ----------------------- | ------------------------- |
| Play / pause            | `Space`                   |
| Previous / next frame   | `,` / `.`                 |
| Toggle timeline         | `T`                       |
| Frame graph / selection | `F` / `Shift+F`           |
| Zoom 1:1                | `1`                       |
| Pan                     | Middle drag, `Alt` + drag |
| Add to selection        | `Shift` + click           |
| Duplicate               | `Ctrl+D`                  |
| Comment frame           | `C`                       |
| Delete node or link     | `Delete`                  |
| Undo / redo             | `Ctrl+Z` / `Ctrl+Shift+Z` |

<br />

## Development

Node **22** (see `.nvmrc`), or only Docker and Make:

```bash
make install
make dev        # http://localhost:5173
```

| Command      | Purpose                                         |
| ------------ | ----------------------------------------------- |
| `make check` | Typecheck, lint and unit tests (before commits) |
| `make glsl`  | Compile every shader (fast, no browser)         |
| `make e2e`   | Browser tests (Playwright, run by CI)           |
| `make build` | Client in `dist/`, server in `server-dist/`     |
| `make up`    | Static site on port 8080                        |

With Node installed, the same scripts run as `npm run dev`, `npm run check`…
After changing a node, run `npm run docs` to regenerate the node reference.

For accounts locally: copy `.env.example` to `.env`, point the `DEV_PG*` variables at a
PostgreSQL database, and run `npm run dev:server` beside `npm run dev`.

<br />

## Hosting

Rendering always happens in the browser. The Docker image runs a small Node server:

```bash
docker compose up -d --build    # http://localhost:8080
```

Without a `.env` it serves the editor alone (local library). With PostgreSQL settings in
`.env` (copy `.env.example`) it adds accounts, sync, Discord sign-in and the community.

Guides (in French): [accounts and PostgreSQL](docs/deployment/server.md) ·
[OpenMediaVault](docs/deployment/static.md).

<br />

## Documentation

| Document                                         | For                                   |
| ------------------------------------------------ | ------------------------------------- |
| [agents.md](agents.md)                           | Contributors and AI assistants: rules |
| [Architecture](docs/development/architecture.md) | How the app works                     |
| [Node authoring](docs/development/authoring.md)  | Writing generators and operators      |
| [Node reference](docs/development/nodes.md)      | Every node, generated from the code   |
| [Roadmap](docs/project/roadmap.md)               | Future ideas (French)                 |

<br />

## About AI

Most of FX Designer's code and documentation was written by AI assistants (**Claude** and
**ChatGPT**). That's what made a tool of this size possible in a reasonable time for one
person, who is also its first user: it was built as a texture production tool for real game
work, not as a demo.

The author decides what gets built and how it should look and behave, tests every feature in
production and reports what breaks; the assistants write the code, the tests and the docs.
The repository is organised for that: [agents.md](agents.md) is the entry point for AI
assistants, [the authoring guide](docs/development/authoring.md) explains how to write a node,
and the CI runs every generator in a real browser on each push.

<br />

## Contributing

Anyone can contribute, with or without AI help:

- **Ideas and bugs**: open an [issue](https://github.com/TheThobi/FXDesigner/issues).
- **Nodes and fixes**: pull requests are welcome. Start with [agents.md](agents.md) and the
  [authoring guide](docs/development/authoring.md); `npm run check` must pass.
- **Effects**: share your systems and custom shader nodes in the app's **Community** window.

<br />

## License

**Source-available** under [PolyForm Noncommercial 1.0.0](LICENSE-POLYFORM-NONCOMMERCIAL.txt)
with a **Commercial Output Permission** ([LICENSE.md](LICENSE.md) has the full terms).

- ✅ Use generated textures, maps and animations in commercial games and artwork, royalty-free
  and without credit (third-party rights in imported images still apply).
- ✅ Modify and share the software for noncommercial purposes, keeping both license files.
- ❌ Selling the software or forks, embedding the code in commercial products, or selling
  access to its generation features requires separate permission.
