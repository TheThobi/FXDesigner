<h1 align="center">
  <img src="public/favicon.svg" alt="" width="48" height="48" align="absmiddle" />
  FX Designer
</h1>

<p align="center">
  <strong>Procedural textures · Animated effects · Node-based creation</strong><br />
  A GPU-powered creative workspace, right in your browser.
</p>

<p align="center">
  <a href="https://fx.thobi.fr"><strong>Open FX Designer ↗</strong></a>
  &nbsp; · &nbsp;
  <a href="#getting-started">Getting started</a>
  &nbsp; · &nbsp;
  <a href="docs/development/nodes.md">Node catalog</a>
  &nbsp; · &nbsp;
  <a href="#local-development">Development</a>
</p>

<p align="center">
  <sub>WebGL2 &nbsp; / &nbsp; TypeScript &nbsp; / &nbsp; Vite &nbsp; / &nbsp; No UI framework</sub>
</p>

---

The application is currently hosted at **[fx.thobi.fr](https://fx.thobi.fr)**.

FX Designer lets you build effects, materials, masks, and animations by connecting generators
and operators. Each node displays its output live; shaders and simulations run on your
browser’s GPU through WebGL2. Export the results as PNG textures, height maps, or animation
sprite sheets for use in a game engine.

The editor works without an account and stores your projects in a local library. An optional
Node.js server backed by PostgreSQL adds accounts and synchronization across devices.

| Compose                                                           | Animate                                           | Export                                                     |
| :---------------------------------------------------------------- | :------------------------------------------------ | :--------------------------------------------------------- |
| Connect generators, simulations, and operators in a visual graph. | Use the timeline, loops, and time-driven effects. | Save PNGs, normal maps, 16-bit height maps, and flipbooks. |

**In this guide:** [Creation](#creation-and-composition) ·
[Workspace](#workspace-and-saving) · [Export](#export) ·
[Development](#local-development) · [Hosting](#hosting) · [Code](#code-structure)

## Getting started

1. Open [fx.thobi.fr](https://fx.thobi.fr) in a browser with WebGL2 support.
2. Double-click a generator in the node browser to add it to the graph.
   A single click replaces the selected node’s generator.
3. Choose a preset and adjust its settings in **Generator**.
4. Add an operator, then drag a connection from an output to its input.
5. Set the color ramp and modules in **Post Process**, then the aspect ratio and resolution
   in **Output**.
6. Use **Export** to save the result or the editable document.

For example, a noise texture connected to **Warp** can distort a shape; **Blend** can then
combine that shape with another texture. **Paint Mask** can feed the Emitter input of
**Smoke & Fire**, letting you paint a simulation’s emission areas.

The interface is in English.

## Creation and composition

### Generators

The catalog covers several texture families. Presets provide starting points for exploring
shapes without having to adjust every parameter.

| Family              | Available examples                                                               |
| ------------------- | -------------------------------------------------------------------------------- |
| Fire and smoke      | Flames, explosions, smoke, soul flames, embers                                   |
| Light and magic     | Glows, rings, rays, lasers, lightning, magic circles, auras                      |
| Impacts and motion  | Slashes, speed lines, shockwaves, impact cracks                                  |
| Water and particles | Caustics, ripples, bubbles, sparks, trails, splashes                             |
| Noise               | Fractal, cellular, domain warp, Gabor, anisotropic noise                         |
| Materials           | Weave, creased sheets, crystals, bricks, brushed metal, scratches, cracked glass |
| Shapes and patterns | Gradients, polygons, checkerboards, Truchet, geometric patterns, hatching, spots |

The **Image** node also lets you import an image and use it in the graph.
The [node reference](docs/development/nodes.md), generated from the code registry, describes each
generator’s parameters, inputs, and presets.

### GPU simulations and painting

The registry includes 13 simulation and painting tools:

- Gray-Scott reaction-diffusion, with seed and parameter-map inputs.
- Physarum, with a food source and multiple species.
- Marbling, cyclic automata, BZ reaction, Lenia, and Life automata.
- Ink fluid, crystal growth, and simulated water caustics.
- Smoke and fire, with emitter and flow inputs.
- Persistent mask painting and flowmap painting.

Tools with brush support can be painted directly in their previews. Simulations can feed
operators just like other textures.

### Operators and animation

Operators process connected images: **Blend**, **Mask**, **Levels & Math**, **Transform 2D**,
**Warp**, **Blur**, **Slope Blur**, **Distance**, and **Edge Detect**.
**Unpack RGBA** exposes one output per channel; **Pack RGBA** combines them again.
**Custom Code** processes inputs with custom GLSL.

The animation operators **Hue Shift**, **Color Cycle**, **Flicker**, **Scroll**, and
**Dissolve** add color changes, flickering, motion, or dissolution. The timeline offers
playback, pause, frame stepping, and previews. Duration and loop settings belong to each
node. Simulations with snapshot support can restore earlier states when scrubbing through time.

### Color and post-processing

Each node has its own color ramp and post-processing: levels, slope blur, Kuwahara, color
grading, relief lighting, watercolor, posterization, dithering, halftone, pixelation,
paper or canvas grain, outlines, and supersampling anti-aliasing.
Modules can be enabled independently, and look presets provide ready-made combinations.

Generator presets control shape; look presets control post-processing. When a generator
preset includes a palette or look, applying it is offered separately. A node’s settings can
also be saved as a personal preset in the browser.

### GLSL editing

The **Code** panel lets you edit shaders on supported nodes, with a reference to the available
uniforms and helper functions. You can also create custom parameters: floats, integers,
toggles, and colors, with defaults, ranges, and groups. These parameters become `u_<key>`
uniforms. Code compiles in the background: an error only affects its own node, which keeps its
last image and shows the message in a small panel.

**Custom Shader** provides a starting point for creating a texture; **Custom Code** lets you
write processing code for connected images. **Revert** restores a modified node’s original
shader.

## Workspace and saving

The graph displays textures inside node cards. It supports multiple selection, group movement,
duplication, collapsible cards, and freezing a node at a specific time. Dropping a connection
onto empty space opens a menu to add an already-connected node. Pins and links distinguish
color images from grayscale values.

Panels can be resized, moved, and grouped into tabs: drag a tab onto the center of any panel
to stack it, or onto an edge to split that panel (**Layout → Reset layout** restores the default). The workspace supports square, landscape,
and portrait aspect ratios: **1:1, 2:1, 3:1, 1:2, and 1:3**.

The **Library** holds multiple independent systems, organized into folders, with names,
thumbnails, and automatic saving to the browser’s local storage. Export a system as JSON or
the entire library through **File → Save library**, then import it again later. Documents
are versioned, and supported older formats are migrated when opened. Share links embed the
document in the URL.

With a configured server, signing in with a username/email and password, or through Discord,
enables synchronization of systems and folders. Changes are reconciled at sign-in and when
the tab regains focus; the most recently updated version wins in a conflict. Personal presets
remain stored locally.

### Useful shortcuts

| Action                                     | Shortcut                          |
| ------------------------------------------ | --------------------------------- |
| Play / pause                               | `Space`                           |
| Previous / next frame                      | `,` / `.`                         |
| Show / hide timeline                       | `T`                               |
| Frame the graph / selected node            | `F` / `Shift+F`                   |
| Zoom to 1:1                                | `1`                               |
| Zoom                                       | Mouse wheel or `+` / `-`          |
| Pan the view                               | Middle mouse drag or `Alt` + drag |
| Add / remove a node from the selection     | `Shift` + click                   |
| Duplicate the selected node                | `Ctrl+D`                          |
| Delete selected nodes or the selected link | `Delete`                          |
| Undo / redo                                | `Ctrl+Z` / `Ctrl+Shift+Z`         |

## Export

The **Export** button brings together the available output formats:

| Output           | Contents                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- |
| PNG              | The selected node’s image, including its dependencies and alpha                    |
| Maps             | Color, OpenGL/DirectX normals, and height; individual PNGs or a ZIP                |
| 16-bit height    | Grayscale PNG for greater precision                                                |
| Flipbook         | PNG animation sprite sheet with grid, time offset, and simulation warm-up settings |
| Nodes as ZIP     | Images of the system’s nodes                                                       |
| Document / share | Editable JSON or a link containing the document                                    |

Available resolutions range from **128 to 4096 pixels on the long side**. Previews are capped
at 1024 pixels; exports are rendered at the selected resolution. Map exports also support
flipping the R/G channels to match the target engine’s flowmap conventions.

## Local development

The project uses **TypeScript, Vite, and WebGL2**, with no UI framework. The optional server
uses Node.js and `pg`, with no HTTP framework. The reference Node version is **22**, specified
in `.nvmrc` and used by the repository’s Docker images.

### With Docker and Make

From the repository root, with Docker and Make installed:

```bash
make install
make dev
```

The editor is available at [localhost:5173](http://localhost:5173). Linux dependencies are
isolated in a Docker volume to avoid conflicts with modules installed on the host.

| Command      | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `make check` | TypeScript checks, ESLint, and Vitest tests                      |
| `make e2e`   | Chromium/Playwright tests with WebGL2 through SwiftShader        |
| `make build` | Build the client into `dist/` and the server into `server-dist/` |
| `make up`    | Build and start the static site on port 8080                     |
| `make down`  | Stop the local static deployment                                 |

### With Node.js 22

```bash
npm ci
npm run dev
```

To work on account features too, copy `.env.example` to `.env`, configure a development
PostgreSQL database, then run `npm run dev:server` in a second terminal. In this mode the
`DEV_` variables of `.env` replace the deployment ones: `DEV_PGHOST` / `DEV_PGPORT` reach the
database through a local port (a local PostgreSQL, or an SSH tunnel to the server) instead
of the container name. Vite forwards `/api` requests to the server (`PORT`, 3000 by default). `npm run dev` alone is enough to work on the editor
without accounts.

After `npm run build`, `npm start` serves the compiled client and API from the Node server.

### Checks

Run `make check` before proposing a change. Tests cover parameters, documents, graphs,
the library, gradients, the node registry, and server components.

`make e2e` compiles and renders every generator, checks pixels, the graph, and share links,
and detects WebGL errors. Screenshots are written to `test-results/generators/`: inspect
them after changing shaders. SwiftShader uses software rendering, so its execution times
do not represent performance on a real GPU.

After changing node definitions, regenerate their reference with `npm run docs` in the
Node 22 environment; a test checks that the reference matches the registry.

## Hosting

The repository provides two deployment options. Texture computation stays in the browser
in both cases.

| Mode          | Files                                      | Behavior                                                                                              |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Static        | Root `Dockerfile` and `docker-compose.yml` | nginx on port 8080; editor and local library, without accounts                                        |
| With accounts | `deploy/autoupdate/`                       | Node server on internal port 3000, external PostgreSQL, synchronization, and optional Discord sign-in |

The deployment with accounts fetches the configured Git branch, builds the new version
alongside the running version, then switches to it if the server starts successfully.
If the HTTP health check fails, it attempts to restore the previous version.

For this deployment, copy `.env.example` next to the Compose file in `deploy/autoupdate/`,
then configure `REPO_URL`, `PUBLIC_URL`, `DB_NETWORK`, and the PostgreSQL connection
(`DATABASE_URL` or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`). The database
container must join the same external Docker network. Internal connections use its network
name and PostgreSQL port, usually **5432**.

Without `PGHOST` or `DATABASE_URL`, accounts are disabled. If the initial connection fails,
the server keeps serving the editor and retries in the background. `/healthz` checks the
HTTP server; `/api/health` reports whether accounts have access to a working database.

Full instructions are in the [server deployment guide](docs/deployment/server.md) and the
[OpenMediaVault static hosting guide](docs/deployment/static.md).

## Code structure

| Directory         | Responsibility                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| `src/app/`        | Graph state, documents, history, library, synchronization, and exports |
| `src/ui/`         | Visual graph, panels, controls, timeline, and dialogs                  |
| `src/generators/` | Definitions and shaders for generators, operators, and simulations     |
| `src/engine/`     | WebGL2 rendering, GPU passes, simulations, and post-processing         |
| `src/params/`     | Schemas, parameter validation, and color ramps                         |
| `src/util/`       | PNG encoding, ZIP files, downloads, and utilities                      |
| `server/src/`     | HTTP server, authentication, remote library, and PostgreSQL migrations |
| `tests/`          | Unit tests, server component tests, and browser tests                  |
| `deploy/`         | nginx configuration and deployment with automatic updates              |

For contributors: [architecture](docs/development/architecture.md), [node authoring](docs/development/authoring.md),
and the [generated node reference](docs/development/nodes.md). The [roadmap](docs/project/roadmap.md) and
[community library design](docs/project/community.md) describe possible future work.
[AGENTS.md](agents.md) is the entry point for contributors and development assistants; [docs/README.md](docs/README.md) indexes the documentation. Some supporting documents
are in French.

## License

FX Designer is **source-available** under **PolyForm Noncommercial 1.0.0**, with an additional
**Commercial Output Permission**. See [LICENSE.md](LICENSE.md) for the full terms and the
[unchanged base license](LICENSE-POLYFORM-NONCOMMERCIAL.txt).

- **Make and sell games:** use textures, maps, and animations generated with FX Designer
  in commercial games, including paid releases. This also applies when you use a modified
  version of the tool. You owe no royalties to FX Designer and do not have to credit it or
  disclose your game's source code merely because it includes rendered output.
- **Other commercial artwork:** client projects and sales of generated texture packs are
  also permitted. Third-party rights, including those in imported images, still apply.
- **Fork and contribute:** modify and share the software for noncommercial purposes under
  the license terms, preserving both license files and the required notices.
- **Commercialize the software:** selling forks, incorporating the code into commercial
  software products, or offering monetized access to its generation functionality is not
  covered by the output permission and requires separate authorization unless independently
  permitted by the base license. The base license includes specific permissions for certain
  educational, charitable, and public organizations.
