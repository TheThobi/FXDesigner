import type { Simulation, SimulationPointer, SimulationSnapshot } from '../../../engine/generator';
import type { GpuContext } from '../../../engine/gl/GpuContext';
import type { RenderTarget } from '../../../engine/gl/RenderTarget';
import commonChunk from '../../../engine/glsl/common.glsl?raw';
import noiseChunk from '../../../engine/glsl/noise.glsl?raw';
import { buildSimulationShader, SHADER_HEADER } from '../../../engine/shaderBuilder';
import { GridSimulation, SimProgram } from '../../../engine/simulation/GridSimulation';
import { paramUniforms } from '../../../engine/uniforms';
import type { ParamDef, ParamValues } from '../../../params/types';
import { getNumber } from '../../../params/values';
import meshFrag from './mesh.frag?raw';
import meshVert from './mesh.vert?raw';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const CHANNELS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/**
 * Real caustics: a wave simulation on a toroidal height field (GridSimulation: rain, wind,
 * brush) whose surface refracts light onto a floor. Rendering projects a triangle mesh of the
 * surface along the refracted rays and accumulates, per triangle, (surface area / projected
 * area) with additive blending — the classic caustic-mapping method (Evan Wallace, WebGL
 * Water). With dispersion, each color channel is projected with a slightly different index.
 */
export class CausticsSimulation implements Simulation {
  private readonly waves: GridSimulation;
  private readonly meshProgram: SimProgram;
  private readonly renderProgram: SimProgram;
  private accum: RenderTarget | null = null;
  /** Swell clock (advances with the simulation). */
  private swellTime = 0;
  private seedValue = 0;

  constructor(
    private readonly gpu: GpuContext,
    private readonly defs: readonly ParamDef[],
  ) {
    // The wave solver's own render pass is unused (light is projected below).
    this.waves = new GridSimulation(gpu, 'caustics', defs, {
      seed,
      step,
      render: 'void main() { outColor = neighbor(0, 0); }',
    });
    const vertex = [SHADER_HEADER, 'uniform float u_seed;', commonChunk, noiseChunk, meshVert];
    this.meshProgram = new SimProgram(gpu, 'caustics/mesh', meshFrag, vertex.join('\n'));
    this.renderProgram = new SimProgram(
      gpu,
      'caustics/render',
      buildSimulationShader(defs, render, 'caustics/render'),
    );
  }

  ready(): boolean {
    return this.waves.ready() && this.meshProgram.ready() && this.renderProgram.ready();
  }

  reset(params: ParamValues, seedValue: number): void {
    this.waves.reset(params, seedValue);
    this.swellTime = 0;
    this.seedValue = seedValue;
  }

  step(params: ParamValues): void {
    this.waves.step(params);
    this.swellTime += 0.02 * getNumber(params, 'waveSpeed', 0.6);
  }

  render(target: RenderTarget, params: ParamValues): void {
    const { gpu } = this;
    const state = this.waves.stateTexture;
    if (!state) return;
    const view = getNumber(params, 'view');
    if (view === 0) this.projectLight(target.width, target.height, params, state);

    this.renderProgram
      .get()
      .use()
      .setAll(paramUniforms(this.defs, params))
      .texture('u_state', state, 0)
      .texture('u_seedTexture', gpu.blankTexture, 1)
      .texture('u_caustics', this.accum?.texture ?? gpu.blankTexture, 2);
    gpu.bindTarget(target);
    gpu.drawFullscreen();
  }

  /** Accumulates the refracted light of the surface mesh into `accum` (width×height). */
  private projectLight(
    width: number,
    height: number,
    params: ParamValues,
    state: WebGLTexture,
  ): void {
    const { gpu } = this;
    const { gl } = gpu;
    if (!this.accum) {
      this.accum = gpu.createTarget({
        width,
        height,
        format: gpu.imageFormat,
        filter: 'linear',
        wrap: 'repeat',
      });
    } else this.accum.resize(width, height);
    gpu.clearTarget(this.accum);

    const mesh = getNumber(params, 'meshDensity', 128);
    const depth = getNumber(params, 'depth', 1);
    const dispersion = getNumber(params, 'dispersion', 0);
    const program = this.meshProgram
      .get()
      .use()
      .set('u_mesh', mesh)
      .set('u_depth', depth)
      .set('u_seed', this.seedValue)
      .set('u_swellTime', this.swellTime)
      .set('u_wind', getNumber(params, 'wind'))
      .set('u_windScale', getNumber(params, 'windScale', 4))
      .texture('u_state', state, 0);
    const passes =
      dispersion > 0
        ? CHANNELS.map((channel, i) => ({ channel, eta: 1 + (i - 1) * dispersion }))
        : [{ channel: [1, 1, 1] as const, eta: 1 }];
    for (const pass of passes) {
      program.set('u_eta', pass.eta).set('u_channel', [...pass.channel]);
      gl.colorMask(pass.channel[0] > 0, pass.channel[1] > 0, pass.channel[2] > 0, false);
      gpu.drawTriangles(mesh * mesh * 6, 9, true);
    }
    gl.colorMask(true, true, true, true);
  }

  snapshot(): SimulationSnapshot {
    return this.waves.snapshot();
  }

  restore(snapshot: SimulationSnapshot): void {
    this.waves.restore(snapshot);
  }

  setPointer(pointer: SimulationPointer | null): void {
    this.waves.setPointer(pointer);
  }

  dispose(): void {
    this.waves.dispose();
    this.accum?.dispose();
  }
}
