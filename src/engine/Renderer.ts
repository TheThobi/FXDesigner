import type { GradientValue } from '../params/gradient';
import type { ParamValues } from '../params/types';
import { defaultValues, getNumber } from '../params/values';
import type {
  GeneratorDefinition,
  ShaderGenerator,
  ShaderPass,
  Simulation,
  SimulationGenerator,
} from './generator';
import { GpuContext } from './gl/GpuContext';
import { GradientTextureCache } from './gl/GradientTexture';
import { ImageTextures } from './gl/ImageTextures';
import type { RenderTarget } from './gl/RenderTarget';
import type { PendingProgram, ShaderProgram } from './gl/ShaderProgram';
import commonChunk from './glsl/common.glsl?raw';
import noiseChunk from './glsl/noise.glsl?raw';
import { ShaderCompileError } from './gl/ShaderProgram';
import channelFragment from './node/channel.frag?raw';
import copyFragment from './node/copy.frag?raw';
import displayFragment from './node/display.frag?raw';
import preview3dFragment from './node/preview3d.frag?raw';
import preview3dVertex from './node/preview3d.vert?raw';
import kuwaharaFragment from './post/kuwahara.frag?raw';
import postFragment from './post/post.frag?raw';
import { POST_PARAMS } from './post/schema';
import slopeBlurFragment from './post/slope-blur.frag?raw';
import slopeFragment from './post/slope.frag?raw';
import {
  buildGeneratorShader,
  SHADER_HEADER,
  uniformDeclarations,
  uniformName,
} from './shaderBuilder';
import { gradientParams, imageParams, paramUniforms } from './uniforms';
import { outputDef, type NodeChannel } from './nodes';

/** Thrown while user GLSL is still compiling in the background: try again next frame. */
export class ProgramPending extends Error {
  constructor(label: string) {
    super(`${label}: compiling`);
    this.name = 'ProgramPending';
  }
}

interface LiveSimulation {
  readonly defId: string;
  readonly sim: Simulation;
  /** Not reset yet. */
  fresh: boolean;
}

type CodeProgram =
  | { readonly pending: PendingProgram }
  | { readonly program: ShaderProgram }
  | { readonly error: unknown };

/** Everything needed to produce one node's image. */
export interface FrameRequest {
  readonly generator: GeneratorDefinition;
  readonly params: ParamValues;
  readonly post: ParamValues;
  /** Color ramp applied by the post pass in gradient-map mode. */
  readonly ramp: GradientValue;
  /** Seconds. */
  readonly time: number;
  readonly seed: number;
  /** Simulation instance key (one live simulation per node). Defaults to the generator id. */
  readonly key?: string;
  /** False: the Post Process is bypassed (raw source). Default true. */
  readonly postEnabled?: boolean;
  /** Connected inputs: input key -> upstream node output. */
  readonly inputs?: Readonly<Record<string, RenderTarget>>;
  /** Custom GLSL replacing the generator's main fragment (node converted to code). */
  readonly code?: string;
}

/** A node card of the viewport: where (device pixels, top-left origin) to draw which image. */
export interface DisplayItem {
  readonly texture: WebGLTexture;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: number;
  readonly nearest: boolean;
  readonly dim: number;
  /** Shows one channel of the image (hovered channel pin); absent = the image itself. */
  readonly channel?: NodeChannel;
}

/** Shapes of the 3D preview (index = shader `u_shape`). */
export const PREVIEW_SHAPES = ['Plane', 'Sphere', 'Cube', 'Cylinder'] as const;

/** One view of the 3D preview. */
export interface Preview3DView {
  /** Index into PREVIEW_SHAPES. */
  readonly shape: number;
  /** Column-major view-projection matrix. */
  readonly viewProj: readonly number[];
  readonly eye: readonly [number, number, number];
  /** Direction toward the light. */
  readonly light: readonly [number, number, number];
  readonly relief: number;
  readonly tiles: number;
  /** Glowing sprite (additive over black) instead of a lit material. */
  readonly additive: boolean;
}

/** Quads per side of each shape's grid (curved shapes need more). */
const PREVIEW_SEGMENTS = [1, 64, 1, 64];
const PREVIEW_FACES = [1, 1, 6, 1];

/** Offscreen renderer at a fixed size, reusable for many frames (exports, thumbnails). */
export interface Capture {
  readonly width: number;
  readonly height: number;
  /**
   * Straight (non-premultiplied) RGBA8, top-down rows, ready for ImageData. A chain renders
   * each request in order; `links` (input -> index of an earlier request) wire them, and the
   * last one is the captured image.
   */
  render(req: FrameRequest | readonly ChainStep[]): Uint8ClampedArray<ArrayBuffer>;
  /**
   * The red channel at full precision (top-down rows), for 16-bit exports such as height
   * maps.
   */
  renderRed(req: FrameRequest | readonly ChainStep[]): Float32Array;
  dispose(): void;
}

/** Input of a chain step: an earlier step, and which of its outputs (main when absent). */
export interface ChainInput {
  readonly step: number;
  readonly output?: string;
}

/** One request of a chain, with its inputs given as earlier steps. */
export interface ChainStep {
  readonly req: FrameRequest;
  readonly links: Readonly<Record<string, ChainInput>>;
}

/** Built-in passes; `post` ones share the post parameter uniforms and the common chunks. */
const CORE_PASSES = {
  post: { post: true, fragment: postFragment },
  slope: { post: true, fragment: slopeFragment },
  slopeBlur: { post: true, fragment: slopeBlurFragment },
  kuwahara: { post: true, fragment: kuwaharaFragment },
  copy: { post: false, fragment: copyFragment },
  channel: { post: false, fragment: channelFragment },
  display: { post: false, fragment: displayFragment },
} as const;
type CorePass = keyof typeof CORE_PASSES;

function coreSource(key: CorePass): string {
  const { post, fragment } = CORE_PASSES[key];
  return post
    ? [
        SHADER_HEADER,
        'uniform float u_seed;',
        uniformDeclarations(POST_PARAMS),
        commonChunk,
        noiseChunk,
        fragment,
      ].join('\n')
    : [SHADER_HEADER, fragment].join('\n');
}

/** Sources of every built-in pass, by name (offline shader checks: `make glsl`). */
export function builtinPassSources(): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(CORE_PASSES) as CorePass[]).map((k) => [k, coreSource(k)]),
  );
}

const POST_DEFAULTS = defaultValues(POST_PARAMS);
/** Sources of the post passes (built once, on demand). */
let postSources: string | undefined;
const POST_SOURCES = (): string =>
  (postSources ??= (Object.keys(CORE_PASSES) as CorePass[])
    .filter((key) => CORE_PASSES[key].post)
    .map(coreSource)
    .join('\n'));
/** Supersampled source targets never exceed this size (memory / time guard). */
const MAX_SOURCE_SIZE = 8192;
const REF_SIZE = 512;
/** Compiled programs kept per custom-code generator (one per distinct code). */
const MAX_CODE_PROGRAMS = 12;

/** Intermediate and output targets of one node's pipeline. */
export class NodeTargets {
  private readonly targets = new Map<string, RenderTarget>();

  constructor(private readonly gpu: GpuContext) {}

  /**
   * Target `name` of `width`×`height`, created on demand and resized in place. Precise
   * targets (data passes) use the full-precision format with nearest filtering.
   */
  get(name: string, width: number, height: number, precise = false): RenderTarget {
    const existing = this.targets.get(name);
    if (existing) {
      existing.resize(width, height);
      return existing;
    }
    const target = this.gpu.createTarget({
      width,
      height,
      format: precise ? this.gpu.precisionFormat : this.gpu.imageFormat,
      filter: precise ? 'nearest' : 'linear',
      wrap: 'repeat',
    });
    this.targets.set(name, target);
    return target;
  }

  /** The node's final image (valid after a render). */
  get output(): RenderTarget | undefined {
    return this.targets.get('output');
  }

  dispose(): void {
    for (const t of this.targets.values()) t.dispose();
    this.targets.clear();
  }
}

/**
 * Runs one node's pipeline:
 *   generator -> source -> [slope blur] -> [kuwahara] -> post -> output
 * Combining images is the job of operator nodes (generators whose shaders read their inputs).
 * The source is rendered N times larger when supersampling is enabled. Owns GPU resources
 * (program cache, gradient textures, one live simulation per node).
 */
export class Renderer {
  private readonly outputChannels = new WeakMap<RenderTarget, NodeChannel>();
  readonly gpu: GpuContext;
  private readonly gradients: GradientTextureCache;
  /** Imported images (image params); `onLoad` tells the app to re-render. */
  readonly images: ImageTextures;
  /**
   * > 0 while a capture renders: programs still compiling are waited for (exports must not
   * come out empty). Otherwise a pending compile throws ProgramPending (retry next frame).
   */
  private waiting = 0;
  /** 3D preview image (created on first use). */
  private previewTarget: RenderTarget | null = null;
  /** Small target for grayscale detection (created on first use). */
  private probe: RenderTarget | null = null;
  private readonly simulations = new Map<string, LiveSimulation>();
  /** Programs of custom-code generators, keyed by `${id}\n${code}`. */
  private readonly codePrograms = new Map<string, CodeProgram>();

  constructor(canvas: HTMLCanvasElement) {
    this.gpu = new GpuContext(canvas);
    this.gradients = new GradientTextureCache(this.gpu.gl);
    this.images = new ImageTextures(this.gpu);
    // Every built-in pass starts compiling now, in parallel, without blocking the page.
    for (const key of Object.keys(CORE_PASSES) as CorePass[]) this.prepareCore(key);
  }

  private prepareCore(key: CorePass): void {
    this.gpu.prepareProgram(`core:${key}`, () => coreSource(key));
  }

  /**
   * Built-in pass. Post passes may still be compiling (ProgramPending, unless waiting); the
   * tiny node passes (copy, channel, display) are always waited for.
   */
  private core(key: CorePass): ShaderProgram {
    const build = () => coreSource(key);
    if (this.waiting > 0 || !CORE_PASSES[key].post) return this.gpu.program(`core:${key}`, build);
    const program = this.gpu.tryProgram(`core:${key}`, build);
    if (!program) throw new ProgramPending(key);
    return program;
  }

  /** Runs `fn` waiting for the programs it needs instead of throwing ProgramPending. */
  private waitingFor<T>(fn: () => T): T {
    this.waiting++;
    try {
      return fn();
    } finally {
      this.waiting--;
    }
  }

  /**
   * Starts compiling every program `def` needs (no-op for simulations and custom code) and
   * tells whether they are all ready: background work (thumbnails) renders once it is.
   */
  prepare(def: GeneratorDefinition): boolean {
    if (def.kind !== 'shader' || def.codeParam) return true;
    const keys: [string, () => string][] = [
      ...(def.passes ?? []).map((pass): [string, () => string] => [
        `gen:${def.id}/${pass.label}`,
        () => buildGeneratorShader(def, '', pass),
      ]),
      [`gen:${def.id}`, () => buildGeneratorShader(def, '')],
      ['core:post', () => coreSource('post')],
    ];
    let ready = true;
    for (const [key, build] of keys) {
      try {
        if (!this.gpu.tryProgram(key, build)) ready = false;
      } catch {
        // Broken shader: the render reports it.
      }
    }
    return ready;
  }

  /**
   * Every shader source a render of `def` uses (generator passes and post passes): changes
   * with the GLSL, for caches of rendered images (browser thumbnails).
   */
  shaderSources(def: ShaderGenerator): string {
    const own = [...(def.passes ?? []), undefined].map((pass) =>
      buildGeneratorShader(def, '', pass),
    );
    return [...own, POST_SOURCES()].join('\n');
  }

  /**
   * Compiles (once) the program of a shader generator. Generators with a `codeParam` get one
   * program per distinct code (user GLSL spliced in); their compile errors are reported as
   * "Custom code error". Throws otherwise (ShaderCompileError).
   */
  programFor(
    def: ShaderGenerator,
    params?: ParamValues,
    pass?: ShaderPass,
    nodeCode?: string,
  ): ShaderProgram {
    // A node converted to code: its GLSL replaces the generator's main fragment. Its params
    // may be custom too, so their declarations are part of the program's identity.
    if (nodeCode !== undefined && !def.codeParam) {
      const fragment = pass?.fragment ?? nodeCode;
      const key = `${def.id}\nnode\n${pass?.label ?? ''}\n${uniformDeclarations(def.params)}\n${fragment}`;
      return this.codeProgram(
        key,
        () => buildGeneratorShader({ ...def, fragment }, '', pass),
        def.id,
      );
    }
    if (!def.codeParam || pass) {
      const key = `gen:${pass ? `${def.id}/${pass.label}` : def.id}`;
      const build = () => buildGeneratorShader(def, '', pass);
      if (this.waiting > 0) return this.gpu.program(key, build);
      const program = this.gpu.tryProgram(key, build);
      if (!program) throw new ProgramPending(def.id);
      return program;
    }
    const raw = params?.[def.codeParam];
    const code = typeof raw === 'string' ? raw : '';
    return this.codeProgram(`${def.id}\n${code}`, () => buildGeneratorShader(def, code), def.id);
  }

  /**
   * Program of user GLSL, compiled in the background: throws ProgramPending until it is ready
   * (the node keeps its last image), and the compile error, remembered, once it failed (a
   * broken code is never compiled again until it changes).
   */
  private codeProgram(key: string, source: () => string, label: string): ShaderProgram {
    let entry = this.codePrograms.get(key);
    if (!entry) {
      try {
        entry = { pending: this.gpu.startProgram(source(), `${label} (custom)`) };
      } catch (e) {
        entry = { error: e };
      }
      this.rememberCodeProgram(key, entry);
    }
    if ('program' in entry) return entry.program;
    if ('error' in entry) throw entry.error;
    try {
      const program = entry.pending.poll();
      if (!program) throw new ProgramPending(label);
      this.codePrograms.set(key, { program });
      return program;
    } catch (e) {
      if (e instanceof ProgramPending) throw e;
      const error =
        e instanceof ShaderCompileError
          ? new Error(`Custom code error:\n${e.log}`, { cause: e })
          : e;
      this.codePrograms.set(key, { error });
      throw error;
    }
  }

  /** Keeps the most recent custom-code programs (older ones are disposed). */
  private rememberCodeProgram(key: string, entry: CodeProgram): void {
    if (this.codePrograms.size >= MAX_CODE_PROGRAMS) {
      const [oldest] = this.codePrograms.keys();
      if (oldest !== undefined) {
        const old = this.codePrograms.get(oldest);
        if (old && 'program' in old) old.program.dispose();
        this.codePrograms.delete(oldest);
      }
    }
    this.codePrograms.set(key, entry);
  }

  /**
   * Returns the live simulation of node `key` running `def`, creating it (and disposing the
   * node's previous one) if needed. `created` tells the caller it must call reset().
   */
  simulationFor(
    def: SimulationGenerator,
    key: string = def.id,
  ): { sim: Simulation; created: boolean } {
    const live = this.liveSimulation(def, key);
    const created = live.fresh;
    live.fresh = false;
    return { sim: live.sim, created };
  }

  /**
   * False while the programs of node `key`'s simulation compile in the background (the
   * instance is created if needed, its reset left to the next simulationFor).
   */
  simulationReady(def: SimulationGenerator, key: string = def.id): boolean {
    return this.liveSimulation(def, key).sim.ready?.() ?? true;
  }

  private liveSimulation(def: SimulationGenerator, key: string): LiveSimulation {
    const live = this.simulations.get(key);
    if (live?.defId === def.id) return live;
    live?.sim.dispose();
    const created: LiveSimulation = { defId: def.id, sim: def.create(this.gpu), fresh: true };
    this.simulations.set(key, created);
    return created;
  }

  /** Disposes the simulations whose key is not in `keep`. */
  retainSimulations(keep: ReadonlySet<string>): void {
    for (const [key, live] of this.simulations) {
      if (keep.has(key)) continue;
      live.sim.dispose();
      this.simulations.delete(key);
    }
  }

  createTargets(): NodeTargets {
    return new NodeTargets(this.gpu);
  }

  /** Renders one node into `targets` (output `width`×`height`) or into `final`. */
  renderNode(
    req: FrameRequest,
    targets: NodeTargets,
    width: number,
    height: number,
    final?: RenderTarget,
  ): RenderTarget {
    const postOn = req.postEnabled !== false;
    const input = this.renderInput(req, targets, width, height, postOn);
    const out = final ?? targets.get('output', width, height);
    const source = req.inputs?.image;
    const channel =
      req.generator.role === 'reroute' && source ? this.outputChannels.get(source) : undefined;
    if (channel === undefined) this.outputChannels.delete(out);
    else this.outputChannels.set(out, channel);
    if (postOn) this.renderPost(req, input, out);
    else {
      this.core('copy').use().texture('u_source', input.texture, 0);
      this.gpu.bindTarget(out);
      this.gpu.drawFullscreen();
    }
    return out;
  }

  /**
   * Output `key` of a rendered node (main output when absent): channel outputs (RGB, R, G, B,
   * A, Unpack RGBA's…) are extracted from its image on demand, when a link reads them.
   */
  outputOf(
    def: GeneratorDefinition,
    targets: NodeTargets,
    key: string | undefined,
  ): RenderTarget | undefined {
    const out = targets.output;
    const o = outputDef(def, key);
    if (!out || !o) return key === undefined ? out : undefined;
    const dst = targets.get(`out:${o.key}`, out.width, out.height);
    this.outputChannels.set(dst, o.channel);
    this.core('channel').use().set('u_channel', o.channel).texture('u_source', out.texture, 0);
    this.gpu.bindTarget(dst);
    this.gpu.drawFullscreen();
    return dst;
  }

  /**
   * True when a node image has (partly) transparent pixels, judged on
   * a 16×16 resampling read back from the GPU (cheap, but a sync point: call sparingly).
   */
  isTransparent(texture: WebGLTexture): boolean {
    this.probe ??= this.gpu.createTarget({ width: 16, height: 16, format: 'rgba8' });
    this.core('copy').use().texture('u_source', texture, 0);
    this.gpu.bindTarget(this.probe);
    this.gpu.drawFullscreen();
    const px = this.gpu.readPixels(this.probe);
    for (let i = 3; i < px.length; i += 4) if (px[i]! < 250) return true;
    return false;
  }

  /**
   * Renders the 3D preview of a node image (`height`: the image its relief comes from) and
   * reads it back (straight RGBA8, top-down rows). Null while its program compiles.
   */
  renderPreview3D(
    color: WebGLTexture,
    height: WebGLTexture,
    view: Preview3DView,
    width: number,
    heightPx: number,
  ): Uint8ClampedArray<ArrayBuffer> | null {
    const program = this.gpu.tryProgram(
      'core:preview3d',
      () => [SHADER_HEADER, preview3dFragment].join('\n'),
      [SHADER_HEADER, preview3dVertex].join('\n'),
    );
    if (!program) return null;
    const { gl } = this.gpu;
    if (!this.previewTarget)
      this.previewTarget = this.gpu.createTarget({ width, height: heightPx, format: 'rgba8' });
    else this.previewTarget.resize(width, heightPx);
    const target = this.previewTarget;
    this.gpu.bindTarget(target);
    const bg = view.additive ? 0.02 : 0.13;
    gl.clearColor(bg, bg, bg + 0.01, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    program
      .use()
      .set('u_viewProj', view.viewProj)
      .set('u_shape', view.shape)
      .set('u_segments', PREVIEW_SEGMENTS[view.shape] ?? 1)
      .set('u_eye', view.eye)
      .set('u_light', view.light)
      .set('u_relief', view.relief)
      .set('u_tiles', view.tiles)
      .set('u_twoSided', view.shape === 0)
      .set('u_additive', view.additive)
      .texture('u_color', color, 0)
      .texture('u_height', height, 1);
    const segments = PREVIEW_SEGMENTS[view.shape] ?? 1;
    const count = (PREVIEW_FACES[view.shape] ?? 1) * segments * segments * 6;
    if (view.additive) this.gpu.drawTriangles(count, 1, true);
    else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.gpu.drawTriangles(count);
      gl.disable(gl.BLEND);
    }
    const raw = this.gpu.readPixels(target);
    const rowBytes = width * 4;
    const out = new Uint8ClampedArray(raw.length);
    for (let y = 0; y < heightPx; y++)
      out.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), (heightPx - 1 - y) * rowBytes);
    return out;
  }

  /** Draws node images into their cards on the canvas (resized to `width`×`height`). */
  display(items: readonly DisplayItem[], width: number, height: number): void {
    const { gl, canvas } = this.gpu;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.gpu.bindTarget(null);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    const program = this.core('display').use();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    for (const item of items) {
      const x = Math.round(item.x);
      const w = Math.round(item.width);
      const h = Math.round(item.height);
      const y = height - Math.round(item.y) - h;
      if (w <= 0 || h <= 0 || x >= width || y >= height || x + w <= 0 || y + h <= 0) continue;
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);
      program
        .set('u_tiles', item.tiles)
        .set('u_nearest', item.nearest)
        .set('u_checker', 8 * dpr)
        .set('u_dim', item.dim)
        .set('u_channel', item.channel ?? -1)
        .texture('u_source', item.texture, 0);
      this.gpu.drawFullscreen();
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  createCapture(width: number, height: number): Capture {
    const { gpu } = this;
    const max = gpu.caps.maxTextureSize;
    if (width > max || height > max) throw new Error(`Size exceeds GPU limit (${max}px)`);
    const pool: NodeTargets[] = [];
    const output = gpu.createTarget({ width, height, format: 'rgba8' });
    let precise: RenderTarget | null = null;
    const rowBytes = width * 4;
    const renderChain = (request: FrameRequest | readonly ChainStep[], final: RenderTarget) =>
      this.waitingFor(() => renderSteps(request, final));
    const renderSteps = (request: FrameRequest | readonly ChainStep[], final: RenderTarget) => {
      const chain: readonly ChainStep[] =
        'generator' in request ? [{ req: request, links: {} }] : request;
      chain.forEach((step, i) => {
        pool[i] ??= this.createTargets();
        const inputs: Record<string, RenderTarget> = {};
        for (const [key, link] of Object.entries(step.links)) {
          const from = pool[link.step];
          const upstream =
            link.step < i && from
              ? this.outputOf(chain[link.step]!.req.generator, from, link.output)
              : undefined;
          if (upstream) inputs[key] = upstream;
        }
        const req = { ...step.req, inputs };
        if (i === chain.length - 1) this.renderNode(req, pool[i]!, width, height, final);
        else this.renderNode(req, pool[i]!, width, height);
      });
    };
    return {
      width,
      height,
      renderRed: (request) => {
        precise ??= gpu.createTarget({ width, height, format: gpu.precisionFormat });
        renderChain(request, precise);
        const rgba = gpu.readPixelsFloat(precise);
        const red = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
          const src = (height - 1 - y) * width; // GL rows are bottom-up
          for (let x = 0; x < width; x++) red[y * width + x] = rgba[(src + x) * 4]!;
        }
        return red;
      },
      render: (request) => {
        renderChain(request, output);
        const raw = gpu.readPixels(output);
        // GL rows are bottom-up; images are top-down.
        const flipped = new Uint8ClampedArray(raw.length);
        for (let y = 0; y < height; y++) {
          flipped.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
        }
        return flipped;
      },
      dispose: () => {
        for (const t of pool) t.dispose();
        output.dispose();
        precise?.dispose();
      },
    };
  }

  /** Supersampling factor per axis for this request (pixelation disables it). */
  private supersample(req: FrameRequest): number {
    if (req.postEnabled === false) return 1;
    const values = { ...POST_DEFAULTS, ...req.post };
    if (values.pixelateOn === true || values.antialiasOn !== true) return 1;
    return getNumber(values, 'antialias') + 1;
  }

  /** Renders the source (slope blur, kuwahara if enabled); returns the post input. */
  private renderInput(
    req: FrameRequest,
    targets: NodeTargets,
    width: number,
    height: number,
    postOn: boolean,
  ): RenderTarget {
    const limit = Math.min(this.gpu.caps.maxTextureSize, MAX_SOURCE_SIZE);
    const ss = this.supersample(req);
    const sw = Math.min(width * ss, limit);
    const sh = Math.min(height * ss, limit);
    const source = targets.get('source', sw, sh);
    this.renderSource(req, source, targets);

    let input = source;
    if (!postOn) return input;

    const values = { ...POST_DEFAULTS, ...req.post };
    if (values.slopeBlurOn === true) input = this.slopeBlur(req, values, input, targets);
    if (values.kuwaharaOn === true) {
      const painted = targets.get('painted', sw, sh);
      this.core('kuwahara')
        .use()
        .setAll(paramUniforms(POST_PARAMS, values))
        .set('u_radius', getNumber(values, 'kuwaharaRadius') / REF_SIZE)
        .texture('u_source', input.texture, 0);
      this.gpu.bindTarget(painted);
      this.gpu.drawFullscreen();
      input = painted;
    }
    return input;
  }

  private slopeBlur(
    req: FrameRequest,
    values: ParamValues,
    source: RenderTarget,
    targets: NodeTargets,
  ): RenderTarget {
    const { width, height } = source;
    const uniforms = paramUniforms(POST_PARAMS, values);

    const slope = targets.get('slope', width, height);
    this.core('slope')
      .use()
      .setAll(uniforms)
      .set('u_seed', req.seed)
      .texture('u_source', source.texture, 0);
    this.gpu.bindTarget(slope);
    this.gpu.drawFullscreen();

    const blurred = targets.get('blurred', width, height);
    this.core('slopeBlur')
      .use()
      .setAll(uniforms)
      .set('u_texel', 1.5 / REF_SIZE)
      .set('u_distance', getNumber(values, 'slopeIntensity') / REF_SIZE)
      .texture('u_source', source.texture, 0)
      .texture('u_slope', slope.texture, 1);
    this.gpu.bindTarget(blurred);
    this.gpu.drawFullscreen();
    return blurred;
  }

  /** Declared inputs of the generator: connected node output, or null. */
  private customInputs(req: FrameRequest): Record<string, WebGLTexture | null> {
    const out: Record<string, WebGLTexture | null> = {};
    for (const def of req.generator.inputs ?? []) {
      out[def.key] = req.inputs?.[def.key]?.texture ?? null;
    }
    return out;
  }

  private renderSource(req: FrameRequest, target: RenderTarget, targets: NodeTargets): void {
    const { generator } = req;
    if (generator.kind === 'simulation') {
      if (this.waiting === 0 && !this.simulationReady(generator, req.key))
        throw new ProgramPending(generator.id);
      const { sim, created } = this.simulationFor(generator, req.key);
      // Inputs first: a seed pass may read them (e.g. a seed image).
      sim.setInputs?.(this.customInputs(req));
      if (created) sim.reset(req.params, req.seed);
      sim.render(target, req.params);
      return;
    }
    const passes = generator.passes ?? [];
    if (passes.length === 0) {
      this.drawShader(req, generator, target);
      return;
    }
    // Multi-pass: ping-pong through pass targets, each pass reading the previous one.
    let prev: RenderTarget | null = null;
    let flip = 0;
    for (const pass of passes) {
      const repeat = pass.repeat?.(req.params, target.width, target.height, req.inputs) ?? 1;
      const count = Math.max(0, Math.floor(repeat));
      for (let i = 0; i < count; i++) {
        const size = pass.size?.(target.width, target.height, i, req.inputs);
        const name = size
          ? `pass:sized:${pass.label}:${i}`
          : `pass:${pass.precise === true ? 'data' : 'image'}:${flip++ % 2}`;
        const [width, height] = size ?? [target.width, target.height];
        const dst = targets.get(name, width, height, pass.precise);
        this.drawShader(req, generator, dst, { pass, prev, index: i, count });
        prev = dst;
      }
    }
    this.drawShader(req, generator, target, { prev, index: 0, count: 1 });
  }

  /** Draws one pass (or the main fragment) of a shader generator into `target`. */
  private drawShader(
    req: FrameRequest,
    generator: ShaderGenerator,
    target: RenderTarget,
    multi?: { pass?: ShaderPass; prev: RenderTarget | null; index: number; count: number },
  ): void {
    const program = this.programFor(generator, req.params, multi?.pass, req.code).use();
    const post = { ...POST_DEFAULTS, ...req.post };
    // Non-square targets: centered generators stay round, tiled ones repeat a whole number of
    // times along the long axis (seamless, never stretched).
    const aspect = target.width / target.height;
    const centeredLayout = (generator.layout ?? defaultLayout(generator)) === 'centered';
    const uvScale = centeredLayout
      ? [1, 1]
      : aspect >= 1
        ? [Math.max(1, Math.round(aspect)), 1]
        : [1, Math.max(1, Math.round(1 / aspect))];
    const centerScale = !centeredLayout ? [1, 1] : aspect >= 1 ? [aspect, 1] : [1, 1 / aspect];
    program
      .set('u_uvScale', uvScale)
      .set('u_centerScale', centerScale)
      .set('u_resolution', [target.width, target.height])
      .set('u_clock', req.time)
      .set('u_loop', [
        post.seamlessLoop !== true ? 0 : generator.nativeLoop?.(req.params) === true ? 2 : 1,
        getNumber(post, 'loopDuration'),
        getNumber(post, 'loopBlend'),
      ])
      .set('u_seed', req.seed)
      .setAll(paramUniforms(generator.params, req.params));
    let unit = 0;
    for (const { def, value } of gradientParams(generator.params, req.params)) {
      program.texture(
        uniformName(def.key),
        this.gradients.get(`${generator.id}:${def.key}`, value),
        unit++,
      );
    }
    for (const { def, value } of imageParams(generator.params, req.params)) {
      const image = this.images.get(value);
      program
        .set(`${uniformName(def.key)}Size`, image ? [image.width, image.height] : [0, 0])
        .texture(uniformName(def.key), image?.texture ?? this.gpu.blankTexture, unit++);
    }
    for (const [key, texture] of Object.entries(this.customInputs(req))) {
      const input = req.inputs?.[key];
      program
        .set(`u_has_${key}`, texture !== null)
        .set(`u_channel_${key}`, input ? (this.outputChannels.get(input) ?? -1) : -1)
        .texture(`u_in_${key}`, texture ?? this.gpu.blankTexture, unit++);
    }
    if (multi) {
      program
        .set('u_passIndex', multi.index)
        .set('u_passCount', multi.count)
        .texture('u_prev', multi.prev?.texture ?? this.gpu.blankTexture, unit);
    }
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  private renderPost(req: FrameRequest, input: RenderTarget, target: RenderTarget): void {
    const values = { ...POST_DEFAULTS, ...req.post };
    const program = this.core('post').use();
    program
      .setAll(paramUniforms(POST_PARAMS, values))
      .set('u_seed', req.seed)
      .set('u_pixelSize', [1 / target.width, 1 / target.height])
      .set('u_viewTiles', 1)
      .set('u_premultiply', false)
      .texture('u_source', input.texture, 0)
      .texture('u_ramp', this.gradients.get('post:ramp', req.ramp), 1);
    let unit = 2;
    for (const { def, value } of gradientParams(POST_PARAMS, values)) {
      program.texture(uniformName(def.key), this.gradients.get(`post:${def.key}`, value), unit++);
    }
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  dispose(): void {
    this.retainSimulations(new Set());
    for (const p of this.codePrograms.values()) if ('program' in p) p.program.dispose();
    this.codePrograms.clear();
    this.probe?.dispose();
    this.previewTarget?.dispose();
    this.gradients.dispose();
    this.images.dispose();
    this.gpu.dispose();
  }
}

/** Generators calling centered() are laid out around the center; others are tiled patterns. */
function defaultLayout(def: ShaderGenerator): 'centered' | 'tiled' {
  return def.fragment.includes('centered(') ? 'centered' : 'tiled';
}
