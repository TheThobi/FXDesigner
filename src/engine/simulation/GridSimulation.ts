import type { ParamDef, ParamValues } from '../../params/types';
import { getNumber } from '../../params/values';
import type { Simulation, SimulationPointer, SimulationSnapshot } from '../generator';
import type { GpuContext } from '../gl/GpuContext';
import type { PingPong, RenderTarget } from '../gl/RenderTarget';
import type { ShaderProgram } from '../gl/ShaderProgram';
import type { NodeInputDef } from '../nodes';
import { buildSimulationShader } from '../shaderBuilder';
import { paramUniforms } from '../uniforms';
import { fnv1a } from '../../util/hash';

/**
 * Declarative description of a cellular/grid simulation. Each pass is a GLSL source defining
 * `void main()` that writes `outColor`. In the seed pass u_state is a blank 1x1 texture: address
 * cells with gl_FragCoord and use u_gridSize, not stateSize(). Every pass sees:
 *   v_uv, u_state (previous state; step & render), u_seedTexture, u_seed, u_frame, u_brush,
 *   all parameters as u_<key>, and the common / noise / sim chunks (stateAt, neighbor,
 *   sampleState, boxAverage, brushMode…).
 *
 * Parameter conventions read by the engine:
 *   simResolution (grid size), stepsPerFrame (iterations per displayed frame), brushSize.
 */
/** One pass of a multi-pass step (e.g. a fluid solver: advect, pressure ×N, project). */
export interface GridPass {
  readonly label: string;
  readonly source: string;
  /** Times the pass runs per iteration (default 1), e.g. Jacobi pressure iterations. */
  readonly repeat?: (params: ParamValues) => number;
}

export interface GridSimulationSpec {
  readonly seed: string;
  /** Single step pass, or a sequence of passes run in order for every iteration. */
  readonly step: string | readonly GridPass[];
  readonly render: string;
  /** Optional image fed to the seed pass as u_seedTexture (e.g. rasterized text). */
  readonly seedImage?: (params: ParamValues, size: number) => TexImageSource | null;
  /** Node inputs sampled by every pass as u_in_<key> / u_has_<key> (same as the definition's). */
  readonly inputs?: readonly NodeInputDef[];
  /** Inputs read by the seed pass: connecting / disconnecting one restarts the simulation. */
  readonly reseedInputs?: readonly string[];
  /** Supports the `boundaries` enum (0: wrap, 1: open) in the grid helpers. */
  readonly openBoundaries?: boolean;
  /**
   * A second RGBA state per cell (`u_state2`, `stateAt2` / `neighbor2` / `sampleState2`):
   * the seed and every step pass must write it to `outColor2` (two render targets at once).
   */
  readonly extraState?: boolean;
}

/**
 * A simulation pass program, shared by every instance with the same source (owned by the
 * GpuContext, never disposed here). Compiles start at construction, in parallel.
 */
export class SimProgram {
  private readonly key: string;

  constructor(
    private readonly gpu: GpuContext,
    /** Shown in compile errors, e.g. `physarum/step`. */
    label: string,
    private readonly fragment: string,
    private readonly vertex?: string,
  ) {
    this.key = `sim:${label}:${fnv1a(`${vertex ?? ''}\n${fragment}`)}`;
    gpu.prepareProgram(this.key, () => fragment, vertex);
  }

  /** Compiled (or failed: `get` then throws the error). */
  ready(): boolean {
    try {
      return this.gpu.tryProgram(this.key, () => this.fragment, this.vertex) !== null;
    } catch {
      return true;
    }
  }

  /** The program, waiting for its compile if needed. */
  get(): ShaderProgram {
    return this.gpu.program(this.key, () => this.fragment, this.vertex);
  }
}

const BRUSH_MODES = { paint: 1, erase: 2 } as const;

class GridSnapshot implements SimulationSnapshot {
  constructor(
    readonly owner: GridSimulation,
    readonly state: RenderTarget,
    readonly state2: RenderTarget | null,
    readonly frame: number,
  ) {}

  dispose(): void {
    this.state.dispose();
    this.state2?.dispose();
  }
}

/** Generic ping-pong implementation of GridSimulationSpec. */
export class GridSimulation implements Simulation {
  private readonly seedProgram: SimProgram;
  private readonly stepPrograms: readonly {
    readonly program: SimProgram;
    readonly repeat?: (params: ParamValues) => number;
  }[];
  private readonly renderProgram: SimProgram;
  private state: PingPong | null = null;
  /** Second state (spec.extraState), swapped in lockstep with `state`. */
  private state2: PingPong | null = null;
  /** Framebuffers writing both states at once, by `state.write` target. */
  private readonly mrt = new Map<RenderTarget, WebGLFramebuffer>();
  /** Texture unit of u_state2 (after the inputs). */
  private readonly state2Unit: number;
  private seedTexture: WebGLTexture | null = null;
  private pointer: SimulationPointer | null = null;
  private frame = 0;
  private lastSeed = 0;
  private inputs: Readonly<Record<string, WebGLTexture | null>> = {};
  /** A seed input was (dis)connected: reseed at the next render. */
  private reseedPending = false;

  constructor(
    private readonly gpu: GpuContext,
    id: string,
    private readonly defs: readonly ParamDef[],
    private readonly spec: GridSimulationSpec,
  ) {
    const build = (src: string, pass: string) =>
      new SimProgram(
        gpu,
        `${id}/${pass}`,
        buildSimulationShader(
          defs,
          src,
          `${id}/${pass}`,
          spec.inputs ?? [],
          spec.openBoundaries,
          spec.extraState,
        ),
      );
    this.seedProgram = build(spec.seed, 'seed');
    const passes: readonly GridPass[] =
      typeof spec.step === 'string' ? [{ label: 'step', source: spec.step }] : spec.step;
    this.stepPrograms = passes.map((pass) => ({
      program: build(pass.source, pass.label),
      repeat: pass.repeat,
    }));
    this.renderProgram = build(spec.render, 'render');
    this.state2Unit = 2 + (spec.inputs?.length ?? 0);
  }

  ready(): boolean {
    return [this.seedProgram, this.renderProgram, ...this.stepPrograms.map((s) => s.program)].every(
      (p) => p.ready(),
    );
  }

  reset(params: ParamValues, seed: number): void {
    const { gpu } = this;
    const [width, height] = gpu.gridDims(getNumber(params, 'simResolution', 256));
    if (!this.state || this.state.width !== width || this.state.height !== height) {
      this.disposeState();
      const options = {
        width,
        height,
        format: gpu.precisionFormat,
        filter: 'nearest',
        wrap: 'repeat',
      } as const;
      this.state = gpu.createPingPong(options);
      if (this.spec.extraState) this.state2 = gpu.createPingPong(options);
    }
    if (this.seedTexture) gpu.gl.deleteTexture(this.seedTexture);
    const image = this.spec.seedImage?.(params, Math.min(width, height)) ?? null;
    this.seedTexture = image ? gpu.createImageTexture(image, 'nearest') : null;

    this.frame = 0;
    this.bindCommon(this.seedProgram.get(), params, seed, true)
      .texture('u_state', gpu.blankTexture, 0)
      .texture('u_seedTexture', this.seedTexture ?? gpu.blankTexture, 1);
    this.bindWrite();
    gpu.drawFullscreen();
    this.swap();
    this.lastSeed = seed;
  }

  step(params: ParamValues): void {
    const { gpu, state } = this;
    if (!state) return;
    const iterations = getNumber(params, 'stepsPerFrame', 1);
    for (let i = 0; i < iterations; i++) {
      for (const { program, repeat } of this.stepPrograms) {
        const p = this.bindCommon(program.get(), params, this.lastSeed);
        p.texture('u_seedTexture', this.seedTexture ?? gpu.blankTexture, 1);
        const times = repeat ? Math.max(1, Math.round(repeat(params))) : 1;
        for (let r = 0; r < times; r++) {
          p.set('u_frame', this.frame).texture('u_state', state.read.texture, 0);
          if (this.state2) p.texture('u_state2', this.state2.read.texture, this.state2Unit);
          this.bindWrite();
          gpu.drawFullscreen();
          this.swap();
        }
      }
      this.frame++;
    }
  }

  render(target: RenderTarget, params: ParamValues): void {
    if (!this.state) return;
    if (this.reseedPending) {
      this.reseedPending = false;
      this.reset(params, this.lastSeed);
    }
    this.bindCommon(this.renderProgram.get(), params, this.lastSeed)
      .texture('u_state', this.state.read.texture, 0)
      .texture('u_seedTexture', this.seedTexture ?? this.gpu.blankTexture, 1);
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  snapshot(): SimulationSnapshot {
    if (!this.state) throw new Error('Simulation not initialized');
    return new GridSnapshot(
      this,
      this.gpu.cloneTarget(this.state.read),
      this.state2 ? this.gpu.cloneTarget(this.state2.read) : null,
      this.frame,
    );
  }

  restore(snapshot: SimulationSnapshot): void {
    if (!(snapshot instanceof GridSnapshot) || snapshot.owner !== this || !this.state) return;
    if (snapshot.state.width !== this.state.width || snapshot.state.height !== this.state.height)
      return;
    this.gpu.copyTarget(snapshot.state, this.state.read);
    if (snapshot.state2 && this.state2) this.gpu.copyTarget(snapshot.state2, this.state2.read);
    this.frame = snapshot.frame;
  }

  /** Current state texture (for custom render passes); null before the first reset. */
  get stateTexture(): WebGLTexture | null {
    return this.state?.read.texture ?? null;
  }

  setPointer(pointer: SimulationPointer | null): void {
    this.pointer = pointer;
  }

  setInputs(inputs: Readonly<Record<string, WebGLTexture | null>>): void {
    for (const key of this.spec.reseedInputs ?? []) {
      if (Boolean(this.inputs[key]) !== Boolean(inputs[key])) this.reseedPending = true;
    }
    this.inputs = inputs;
  }

  dispose(): void {
    this.disposeState();
    if (this.seedTexture) this.gpu.gl.deleteTexture(this.seedTexture);
  }

  private disposeState(): void {
    this.state?.dispose();
    this.state2?.dispose();
    this.state = null;
    this.state2 = null;
    for (const fbo of this.mrt.values()) this.gpu.gl.deleteFramebuffer(fbo);
    this.mrt.clear();
  }

  private swap(): void {
    this.state?.swap();
    this.state2?.swap();
  }

  /** Binds the write side: one target, or both states at once (two color attachments). */
  private bindWrite(): void {
    const { gpu, state, state2 } = this;
    if (!state) return;
    if (!state2) {
      gpu.bindTarget(state.write);
      return;
    }
    const { gl } = gpu;
    let fbo = this.mrt.get(state.write);
    if (!fbo) {
      fbo = gl.createFramebuffer();
      if (!fbo) throw new Error('Failed to create framebuffer');
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        state.write.texture,
        0,
      );
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT1,
        gl.TEXTURE_2D,
        state2.write.texture,
        0,
      );
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.mrt.set(state.write, fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, state.width, state.height);
  }

  private bindCommon(
    program: ShaderProgram,
    params: ParamValues,
    seed: number,
    seeding = false,
  ): ShaderProgram {
    const brush = this.pointer;
    program.use();
    // Every declared sampler must be bound (blank while seeding: no previous state).
    if (this.state2)
      program.texture(
        'u_state2',
        seeding ? this.gpu.blankTexture : this.state2.read.texture,
        this.state2Unit,
      );
    // Units 0 (state) and 1 (seed texture) are bound by the callers; inputs follow.
    (this.spec.inputs ?? []).forEach((input, i) => {
      const texture = this.inputs[input.key] ?? null;
      program
        .set(`u_has_${input.key}`, texture !== null)
        .texture(`u_in_${input.key}`, texture ?? this.gpu.blankTexture, 2 + i);
    });
    return program
      .setAll(paramUniforms(this.defs, params))
      .set('u_seed', seed)
      .set('u_frame', this.frame)
      .set('u_gridSize', [this.state?.width ?? 1, this.state?.height ?? 1])
      .set('u_brushDir', brush?.velocity ?? [0, 0])
      .set('u_brush', [
        brush?.uv[0] ?? 0,
        brush?.uv[1] ?? 0,
        getNumber(params, 'brushSize', 0.03),
        brush ? BRUSH_MODES[brush.mode] : 0,
      ]);
  }
}
