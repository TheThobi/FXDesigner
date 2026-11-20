import type { ParamValues } from '../params/types';
import { defaultValues, getNumber } from '../params/values';
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
import commonChunk from './glsl/common.glsl?raw';
import noiseChunk from './glsl/noise.glsl?raw';
import postFragment from './post/post.frag?raw';
import slopeBlurFragment from './post/slope-blur.frag?raw';
import slopeFragment from './post/slope.frag?raw';
import kuwaharaFragment from './post/kuwahara.frag?raw';
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
/** Supersampled source targets never exceed this size (memory / time guard). */
const MAX_SOURCE_SIZE = 8192;
const REF_SIZE = 512;

/** Intermediate targets of the pipeline (source, optional slope-blur maps). */
class PipelineTargets {
  private source: RenderTarget | null = null;
  private slope: RenderTarget | null = null;
  private blurred: RenderTarget | null = null;
  private painted: RenderTarget | null = null;

  constructor(private readonly gpu: GpuContext) {}

  sourceTarget(size: number): RenderTarget {
    this.source = this.ensure(this.source, size);
    return this.source;
  }

  slopeTarget(size: number): RenderTarget {
    this.slope = this.ensure(this.slope, size);
    return this.slope;
  }

  blurredTarget(size: number): RenderTarget {
    this.blurred = this.ensure(this.blurred, size);
    return this.blurred;
  }

  paintedTarget(size: number): RenderTarget {
    this.painted = this.ensure(this.painted, size);
    return this.painted;
  }

  dispose(): void {
    this.painted?.dispose();
    this.source?.dispose();
    this.slope?.dispose();
    this.blurred?.dispose();
  }

  private ensure(target: RenderTarget | null, size: number): RenderTarget {
    if (target) {
      target.resize(size, size);
      return target;
    }
    return this.gpu.createTarget({
      width: size,
      height: size,
      format: this.gpu.imageFormat,
      filter: 'linear',
      wrap: 'repeat',
    });
  }
}

/**
 * Runs the pipeline:  generator -> source -> [slope map -> slope blur] -> post -> canvas/capture.
 * The source is rendered N times larger when supersampling is enabled. Owns GPU resources
 * (program cache, gradient textures, the live simulation instance).
 */
export class Renderer {
  readonly gpu: GpuContext;
  private readonly programs = new Map<string, ShaderProgram>();
  private readonly gradients: GradientTextureCache;
  private readonly postProgram: ShaderProgram;
  private readonly slopeProgram: ShaderProgram;
  private readonly slopeBlurProgram: ShaderProgram;
  private readonly kuwaharaProgram: ShaderProgram;
  private readonly preview: PipelineTargets;
  private live: { id: string; sim: Simulation } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.gpu = new GpuContext(canvas);
    this.gradients = new GradientTextureCache(this.gpu.gl);
    this.preview = new PipelineTargets(this.gpu);
    // Post passes share the post parameter uniforms and the common/noise chunks.
    const postPass = (fragment: string) =>
      [
        SHADER_HEADER,
        'uniform float u_seed;',
        uniformDeclarations(POST_PARAMS),
        commonChunk,
        noiseChunk,
        fragment,
      ].join('\n');
    this.postProgram = this.gpu.createProgram(postPass(postFragment), 'post');
    this.slopeProgram = this.gpu.createProgram(postPass(slopeFragment), 'post/slope');
    this.slopeBlurProgram = this.gpu.createProgram(postPass(slopeBlurFragment), 'post/slope-blur');
    this.kuwaharaProgram = this.gpu.createProgram(postPass(kuwaharaFragment), 'post/kuwahara');
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
    const canvas = this.gpu.canvas;
    if (canvas.width !== opts.size || canvas.height !== opts.size) {
      canvas.width = opts.size;
      canvas.height = opts.size;
    }
    const input = this.renderInput(req, this.preview, opts.size);
    this.renderPost(req, input, null, opts.size, opts.viewTiles, true);
  }

  createCapture(width: number, height: number): Capture {
    const { gpu } = this;
    const max = gpu.caps.maxTextureSize;
    if (width > max || height > max) throw new Error(`Size exceeds GPU limit (${max}px)`);
    const targets = new PipelineTargets(gpu);
    const output = gpu.createTarget({ width, height, format: 'rgba8' });
    const rowBytes = width * 4;
    return {
      width,
      height,
      render: (req) => {
        const input = this.renderInput(req, targets, width);
        this.renderPost(req, input, output, width, 1, false);
        const raw = gpu.readPixels(output);
        // GL rows are bottom-up; images are top-down.
        const flipped = new Uint8ClampedArray(raw.length);
        for (let y = 0; y < height; y++) {
          flipped.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
        }
        return flipped;
      },
      dispose: () => {
        targets.dispose();
        output.dispose();
      },
    };
  }

  /** Supersampling factor per axis for this request (pixelation disables it). */
  private supersample(post: ParamValues): number {
    const values = { ...POST_DEFAULTS, ...post };
    if (values.pixelateOn === true || values.antialiasOn !== true) return 1;
    return getNumber(values, 'antialias') + 1;
  }

  /** Renders the source (and the slope blur if enabled); returns the post input. */
  private renderInput(
    req: FrameRequest,
    targets: PipelineTargets,
    outputSize: number,
  ): RenderTarget {
    const limit = Math.min(this.gpu.caps.maxTextureSize, MAX_SOURCE_SIZE);
    const sourceSize = Math.min(outputSize * this.supersample(req.post), limit);
    const source = targets.sourceTarget(sourceSize);
    this.renderSource(req, source);

    const values = { ...POST_DEFAULTS, ...req.post };
    let input = source;
    if (values.slopeBlurOn === true) input = this.slopeBlur(req, values, source, targets);
    if (values.kuwaharaOn === true) {
      const painted = targets.paintedTarget(sourceSize);
      this.kuwaharaProgram
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
    targets: PipelineTargets,
  ): RenderTarget {
    const sourceSize = source.width;
    const uniforms = paramUniforms(POST_PARAMS, values);

    const slope = targets.slopeTarget(sourceSize);
    this.slopeProgram
      .use()
      .setAll(uniforms)
      .set('u_seed', req.seed)
      .texture('u_source', source.texture, 0);
    this.gpu.bindTarget(slope);
    this.gpu.drawFullscreen();

    const blurred = targets.blurredTarget(sourceSize);
    this.slopeBlurProgram
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

  private renderSource(req: FrameRequest, target: RenderTarget): void {
    const { generator } = req;
    if (generator.kind === 'simulation') {
      const { sim, created } = this.simulationFor(generator);
      if (created) sim.reset(req.params, req.seed);
      sim.render(target, req.params);
      return;
    }
    const program = this.programFor(generator).use();
    const post = { ...POST_DEFAULTS, ...req.post };
    program
      .set('u_resolution', [target.width, target.height])
      .set('u_clock', req.time)
      .set('u_loop', [
        post.seamlessLoop === true ? 1 : 0,
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
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  private renderPost(
    req: FrameRequest,
    input: RenderTarget,
    target: RenderTarget | null,
    outputSize: number,
    viewTiles: number,
    premultiply: boolean,
  ): void {
    const values = { ...POST_DEFAULTS, ...req.post };
    const program = this.postProgram.use();
    program
      .setAll(paramUniforms(POST_PARAMS, values))
      .set('u_seed', req.seed)
      .set('u_pixelSize', [viewTiles / outputSize, viewTiles / outputSize])
      .set('u_viewTiles', viewTiles)
      .set('u_premultiply', premultiply)
      .texture('u_source', input.texture, 0);
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
    this.slopeProgram.dispose();
    this.slopeBlurProgram.dispose();
    this.kuwaharaProgram.dispose();
    this.preview.dispose();
    this.gradients.dispose();
    this.gpu.dispose();
  }
}
