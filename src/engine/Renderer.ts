import { defaultValues } from '../params/values';
import type { ParamValues } from '../params/types';
import type {
  GeneratorDefinition,
  ShaderGenerator,
  Simulation,
  SimulationGenerator,
} from './generator';
import { GpuContext } from './gl/GpuContext';
import { GradientTextureCache } from './gl/GradientTexture';
import type { RenderTarget } from './gl/RenderTarget';
import type { ShaderProgram } from './gl/ShaderProgram';
import postFragment from './post/post.frag?raw';
import { POST_PARAMS } from './post/schema';
import {
  buildGeneratorShader,
  SHADER_HEADER,
  uniformDeclarations,
  uniformName,
} from './shaderBuilder';
import { gradientParams, paramUniforms } from './uniforms';

/** Everything needed to produce one image. */
export interface FrameRequest {
  readonly generator: GeneratorDefinition;
  readonly params: ParamValues;
  readonly post: ParamValues;
  /** Seconds. */
  readonly time: number;
  readonly seed: number;
}

export interface PresentOptions {
  /** Canvas/back-buffer size in pixels (square). */
  readonly size: number;
  /** Repeat the texture NxN in the preview to check tiling. */
  readonly viewTiles: number;
}

/** Offscreen renderer at a fixed size, reusable for many frames (exports, thumbnails). */
export interface Capture {
  readonly width: number;
  readonly height: number;
  /** Straight (non-premultiplied) RGBA8, top-down rows, ready for ImageData. */
  render(req: FrameRequest): Uint8ClampedArray<ArrayBuffer>;
  dispose(): void;
}

const POST_DEFAULTS = defaultValues(POST_PARAMS);

/**
 * Runs the two-stage pipeline:  generator -> source target -> post pass -> canvas/capture.
 * Owns GPU resources (program cache, gradient textures, the live simulation instance).
 */
export class Renderer {
  readonly gpu: GpuContext;
  private readonly programs = new Map<string, ShaderProgram>();
  private readonly gradients: GradientTextureCache;
  private readonly postProgram: ShaderProgram;
  private previewSource: RenderTarget | null = null;
  private live: { id: string; sim: Simulation } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.gpu = new GpuContext(canvas);
    this.gradients = new GradientTextureCache(this.gpu.gl);
    const postSource = `${SHADER_HEADER}\n${uniformDeclarations(POST_PARAMS)}\n${postFragment}`;
    this.postProgram = this.gpu.createProgram(postSource, 'post');
  }

  /** Compiles (once) the program of a shader generator. Throws ShaderCompileError. */
  programFor(def: ShaderGenerator): ShaderProgram {
    let program = this.programs.get(def.id);
    if (!program) {
      program = this.gpu.createProgram(buildGeneratorShader(def), def.id);
      this.programs.set(def.id, program);
    }
    return program;
  }

  /**
   * Returns the live simulation for `def`, creating it (and disposing any other one) if needed.
   * `created` tells the caller it must call reset().
   */
  simulationFor(def: SimulationGenerator): { sim: Simulation; created: boolean } {
    if (this.live?.id === def.id) return { sim: this.live.sim, created: false };
    this.live?.sim.dispose();
    const sim = def.create(this.gpu);
    this.live = { id: def.id, sim };
    return { sim, created: true };
  }

  /** Releases the live simulation, if any (e.g. when switching to a shader generator). */
  releaseSimulation(): void {
    this.live?.sim.dispose();
    this.live = null;
  }

  /** Renders the request to the canvas, for display. */
  present(req: FrameRequest, opts: PresentOptions): void {
    const { gpu } = this;
    const canvas = gpu.canvas;
    if (canvas.width !== opts.size || canvas.height !== opts.size) {
      canvas.width = opts.size;
      canvas.height = opts.size;
    }
    if (!this.previewSource) {
      this.previewSource = gpu.createTarget({
        width: opts.size,
        height: opts.size,
        format: gpu.imageFormat,
        filter: 'linear',
        wrap: 'repeat',
      });
    } else {
      this.previewSource.resize(opts.size, opts.size);
    }
    this.renderSource(req, this.previewSource);
    this.renderPost(req.post, this.previewSource, null, opts.viewTiles, true);
  }

  createCapture(width: number, height: number): Capture {
    const { gpu } = this;
    const max = gpu.caps.maxTextureSize;
    if (width > max || height > max) throw new Error(`Size exceeds GPU limit (${max}px)`);
    const source = gpu.createTarget({
      width,
      height,
      format: gpu.imageFormat,
      filter: 'linear',
      wrap: 'repeat',
    });
    const output = gpu.createTarget({ width, height, format: 'rgba8' });
    const rowBytes = width * 4;
    return {
      width,
      height,
      render: (req) => {
        this.renderSource(req, source);
        this.renderPost(req.post, source, output, 1, false);
        const raw = gpu.readPixels(output);
        // GL rows are bottom-up; images are top-down.
        const flipped = new Uint8ClampedArray(raw.length);
        for (let y = 0; y < height; y++) {
          flipped.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
        }
        return flipped;
      },
      dispose: () => {
        source.dispose();
        output.dispose();
      },
    };
  }

  private renderSource(req: FrameRequest, target: RenderTarget): void {
    const { generator } = req;
    if (generator.kind === 'simulation') {
      const { sim, created } = this.simulationFor(generator);
      if (created) sim.reset(req.params, req.seed);
      sim.render(target, req.params);
      return;
    }
    const program = this.programFor(generator).use();
    program
      .set('u_resolution', [target.width, target.height])
      .set('u_time', req.time)
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
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  private renderPost(
    post: ParamValues,
    source: RenderTarget,
    target: RenderTarget | null,
    viewTiles: number,
    premultiply: boolean,
  ): void {
    const values = { ...POST_DEFAULTS, ...post };
    const program = this.postProgram.use();
    program
      .setAll(paramUniforms(POST_PARAMS, values))
      .set('u_texel', [1 / source.width, 1 / source.height])
      .set('u_viewTiles', viewTiles)
      .set('u_premultiply', premultiply)
      .texture('u_source', source.texture, 0);
    let unit = 1;
    for (const { def, value } of gradientParams(POST_PARAMS, values)) {
      program.texture(uniformName(def.key), this.gradients.get(`post:${def.key}`, value), unit++);
    }
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  dispose(): void {
    this.releaseSimulation();
    for (const p of this.programs.values()) p.dispose();
    this.programs.clear();
    this.postProgram.dispose();
    this.previewSource?.dispose();
    this.gradients.dispose();
    this.gpu.dispose();
  }
}
