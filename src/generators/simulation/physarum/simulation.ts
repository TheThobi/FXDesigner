import type { Simulation, SimulationPointer, SimulationSnapshot } from '../../../engine/generator';
import type { GpuContext } from '../../../engine/gl/GpuContext';
import type { PingPong, RenderTarget } from '../../../engine/gl/RenderTarget';
import type { ShaderProgram } from '../../../engine/gl/ShaderProgram';
import type { NodeInputDef } from '../../../engine/nodes';
import { buildSimulationShader } from '../../../engine/shaderBuilder';
import { SimProgram } from '../../../engine/simulation/GridSimulation';
import { paramUniforms } from '../../../engine/uniforms';
import type { ParamDef, ParamValues } from '../../../params/types';
import { getNumber } from '../../../params/values';
import agentsSeed from './agents-seed.frag?raw';
import agentsStep from './agents-step.frag?raw';
import depositFrag from './deposit.frag?raw';
import depositVert from './deposit.vert?raw';
import diffuse from './diffuse.frag?raw';
import render from './render.frag?raw';

/**
 * Physarum polycephalum (slime mold) transport network, after Jeff Jones (2010):
 * agents (float texture: position + heading) sense and follow a trail map that they deposit
 * into; the trail diffuses and decays. Per iteration:
 *   1. agents step (sense trail.read, steer, move)       agents.read -> agents.write
 *   2. deposit: one additive point per agent              -> trail.read
 *   3. diffuse + decay (+ brush)                          trail.read -> trail.write
 */
interface PhysarumSnapshot extends SimulationSnapshot {
  readonly owner: PhysarumSimulation;
  readonly copies: readonly [RenderTarget, RenderTarget];
  readonly frame: number;
}

export class PhysarumSimulation implements Simulation {
  private readonly programs: Record<'seed' | 'step' | 'deposit' | 'diffuse' | 'render', SimProgram>;
  private agents: PingPong | null = null;
  private trail: PingPong | null = null;
  private pointer: SimulationPointer | null = null;
  private frame = 0;
  private seed = 0;
  /** Connected node inputs (food), null when unconnected. */
  private inputs: Readonly<Record<string, WebGLTexture | null>> = {};

  constructor(
    private readonly gpu: GpuContext,
    private readonly defs: readonly ParamDef[],
    private readonly inputDefs: readonly NodeInputDef[] = [],
  ) {
    const build = (src: string, pass: string) =>
      new SimProgram(
        gpu,
        `physarum/${pass}`,
        buildSimulationShader(defs, src, `physarum/${pass}`, inputDefs),
      );
    const depositFragment = buildSimulationShader(defs, depositFrag, 'physarum/deposit', inputDefs);
    this.programs = {
      seed: build(agentsSeed, 'seed'),
      step: build(agentsStep, 'step'),
      deposit: new SimProgram(gpu, 'physarum/deposit', depositFragment, depositVert),
      diffuse: build(diffuse, 'diffuse'),
      render: build(render, 'render'),
    };
  }

  ready(): boolean {
    return Object.values(this.programs).every((p) => p.ready());
  }

  reset(params: ParamValues, seed: number): void {
    const { gpu } = this;
    const agentRes = getNumber(params, 'agentCount', 256);
    const [width, height] = gpu.gridDims(getNumber(params, 'simResolution', 512));
    if (!this.agents || this.agents.width !== agentRes) {
      this.agents?.dispose();
      this.agents = gpu.createPingPong({
        width: agentRes,
        height: agentRes,
        format: gpu.precisionFormat,
        filter: 'nearest',
      });
    }
    if (!this.trail || this.trail.width !== width || this.trail.height !== height) {
      this.trail?.dispose();
      this.trail = gpu.createPingPong({
        width,
        height,
        format: gpu.imageFormat,
        filter: 'linear',
        wrap: 'repeat',
      });
    }
    this.seed = seed;
    this.frame = 0;
    this.bind(this.programs.seed, params);
    gpu.bindTarget(this.agents.write);
    gpu.drawFullscreen();
    this.agents.swap();
    gpu.clearTarget(this.trail.read);
    gpu.clearTarget(this.trail.write);
  }

  step(params: ParamValues): void {
    const { gpu, agents, trail, programs } = this;
    if (!agents || !trail) return;
    const count = agents.width * agents.width;
    const iterations = getNumber(params, 'stepsPerFrame', 1);
    for (let i = 0; i < iterations; i++) {
      this.frame++;
      this.bind(programs.step, params)
        .texture('u_agents', agents.read.texture, 0)
        .texture('u_trail', trail.read.texture, 1);
      gpu.bindTarget(agents.write);
      gpu.drawFullscreen();
      agents.swap();

      this.bind(programs.deposit, params).texture('u_agents', agents.read.texture, 0);
      gpu.bindTarget(trail.read);
      gpu.drawPoints(count, true);

      this.bind(programs.diffuse, params).texture('u_trail', trail.read.texture, 0);
      gpu.bindTarget(trail.write);
      gpu.drawFullscreen();
      trail.swap();
    }
  }

  render(target: RenderTarget, params: ParamValues): void {
    if (!this.trail) return;
    this.bind(this.programs.render, params).texture('u_trail', this.trail.read.texture, 0);
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  snapshot(): SimulationSnapshot {
    const { agents, trail, gpu } = this;
    if (!agents || !trail) throw new Error('Simulation not initialized');
    const copies = [gpu.cloneTarget(agents.read), gpu.cloneTarget(trail.read)] as const;
    const snapshot: PhysarumSnapshot = {
      owner: this,
      copies,
      frame: this.frame,
      dispose: () => copies.forEach((c) => c.dispose()),
    };
    return snapshot;
  }

  restore(snapshot: SimulationSnapshot): void {
    const s = snapshot as Partial<PhysarumSnapshot>;
    const { agents, trail, gpu } = this;
    if (s.owner !== this || !s.copies || !agents || !trail) return;
    const [a, t] = s.copies;
    if (a.width !== agents.width || t.width !== trail.width || t.height !== trail.height) return;
    gpu.copyTarget(a, agents.read);
    gpu.copyTarget(t, trail.read);
    this.frame = s.frame ?? 0;
  }

  setPointer(pointer: SimulationPointer | null): void {
    this.pointer = pointer;
  }

  setInputs(inputs: Readonly<Record<string, WebGLTexture | null>>): void {
    this.inputs = inputs;
  }

  dispose(): void {
    this.agents?.dispose();
    this.trail?.dispose();
  }

  /**
   * Common uniforms; unused samplers (u_state, u_seedTexture, unconnected inputs) point at the
   * blank texture.
   */
  private bind(pass: SimProgram, params: ParamValues): ShaderProgram {
    const program = pass.get();
    const brush = this.pointer;
    const blank = this.gpu.blankTexture;
    let unit = 4;
    for (const input of this.inputDefs) {
      const texture = this.inputs[input.key] ?? null;
      program
        .use()
        .set(`u_has_${input.key}`, texture !== null)
        .texture(`u_in_${input.key}`, texture ?? blank, unit++);
    }
    return program
      .use()
      .setAll(paramUniforms(this.defs, params))
      .set('u_seed', this.seed)
      .set('u_frame', this.frame)
      .set('u_gridSize', [this.trail?.width ?? 1, this.trail?.height ?? 1])
      .set('u_brush', [
        brush?.uv[0] ?? 0,
        brush?.uv[1] ?? 0,
        getNumber(params, 'brushSize', 0.03),
        brush ? (brush.mode === 'paint' ? 1 : 2) : 0,
      ])
      .texture('u_state', blank, 2)
      .texture('u_seedTexture', blank, 3);
  }
}
