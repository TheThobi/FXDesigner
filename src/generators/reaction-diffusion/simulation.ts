import type { Simulation, SimulationPointer } from '../../engine/generator';
import type { GpuContext } from '../../engine/gl/GpuContext';
import type { PingPong, RenderTarget } from '../../engine/gl/RenderTarget';
import type { ShaderProgram } from '../../engine/gl/ShaderProgram';
import { resolveIncludes, SHADER_HEADER } from '../../engine/shaderBuilder';
import { getNumber, getString } from '../../params/values';
import type { ParamValues } from '../../params/types';
import renderSource from './render.frag?raw';
import seedSource from './seed.frag?raw';
import stepSource from './step.frag?raw';

export const SEED_MODE_TEXT = 4;

const BRUSH_OFF = 0;
const BRUSH_PAINT = 1;
const BRUSH_ERASE = 2;

function program(gpu: GpuContext, source: string, label: string): ShaderProgram {
  return gpu.createProgram(`${SHADER_HEADER}\n${resolveIncludes(source)}`, label);
}

/** Rasterizes text, white on black, scaled to fit ~80% of the width. */
function rasterizeText(text: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const content = text.trim() || ' ';
  let fontSize = size * 0.4;
  ctx.font = `bold ${fontSize}px sans-serif`;
  const width = ctx.measureText(content).width;
  if (width > size * 0.8) fontSize *= (size * 0.8) / width;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(content, size / 2, size / 2);
  return canvas;
}

/** Gray-Scott reaction-diffusion on a toroidal grid, double-buffered on the GPU. */
export class ReactionDiffusionSimulation implements Simulation {
  private readonly seedProgram: ShaderProgram;
  private readonly stepProgram: ShaderProgram;
  private readonly renderProgram: ShaderProgram;
  private state: PingPong | null = null;
  private seedTexture: WebGLTexture | null = null;
  private pointer: SimulationPointer | null = null;

  constructor(private readonly gpu: GpuContext) {
    this.seedProgram = program(gpu, seedSource, 'reaction-diffusion/seed');
    this.stepProgram = program(gpu, stepSource, 'reaction-diffusion/step');
    this.renderProgram = program(gpu, renderSource, 'reaction-diffusion/render');
  }

  reset(params: ParamValues, seed: number): void {
    const { gpu } = this;
    const size = getNumber(params, 'simResolution', 256);
    if (!this.state || this.state.width !== size) {
      this.state?.dispose();
      this.state = gpu.createPingPong({
        width: size,
        height: size,
        format: gpu.precisionFormat,
        filter: 'nearest',
        wrap: 'repeat',
      });
    }

    const seedMode = getNumber(params, 'seedMode');
    if (this.seedTexture) {
      gpu.gl.deleteTexture(this.seedTexture);
      this.seedTexture = null;
    }
    if (seedMode === SEED_MODE_TEXT) {
      this.seedTexture = gpu.createImageTexture(
        rasterizeText(getString(params, 'seedText'), size),
        'nearest',
      );
    }

    const p = this.seedProgram.use();
    p.set('u_seed', seed)
      .set('u_seedMode', seedMode)
      .texture('u_seedTexture', this.seedTexture ?? gpu.blankTexture, 0);
    gpu.bindTarget(this.state.write);
    gpu.drawFullscreen();
    this.state.swap();
  }

  step(params: ParamValues): void {
    const { gpu, state } = this;
    if (!state) return;
    const brush = this.pointer;
    const brushMode = brush ? (brush.mode === 'paint' ? BRUSH_PAINT : BRUSH_ERASE) : BRUSH_OFF;
    const p = this.stepProgram.use();
    p.setAll({
      u_feed: getNumber(params, 'feed'),
      u_kill: getNumber(params, 'kill'),
      u_diffA: getNumber(params, 'diffA'),
      u_diffB: getNumber(params, 'diffB'),
      u_dt: getNumber(params, 'dt'),
      u_mapMode: getNumber(params, 'mapMode'),
      u_feedSpread: getNumber(params, 'feedSpread'),
      u_killSpread: getNumber(params, 'killSpread'),
      u_anisotropy: getNumber(params, 'anisotropy'),
      u_directionMode: getNumber(params, 'directionMode'),
      u_direction: getNumber(params, 'direction'),
      u_brush: [
        brush?.uv[0] ?? 0,
        brush?.uv[1] ?? 0,
        getNumber(params, 'brushSize', 0.03),
        brushMode,
      ],
    });
    const iterations = getNumber(params, 'stepsPerFrame', 8);
    for (let i = 0; i < iterations; i++) {
      p.texture('u_state', state.read.texture, 0);
      gpu.bindTarget(state.write);
      gpu.drawFullscreen();
      state.swap();
    }
  }

  render(target: RenderTarget, params: ParamValues): void {
    if (!this.state) return;
    this.renderProgram
      .use()
      .setAll({
        u_view: getNumber(params, 'view'),
        u_gain: getNumber(params, 'gain', 2.5),
        u_lightAngle: getNumber(params, 'lightAngle', 45),
        u_relief: getNumber(params, 'relief', 1),
      })
      .texture('u_state', this.state.read.texture, 0);
    this.gpu.bindTarget(target);
    this.gpu.drawFullscreen();
  }

  setPointer(pointer: SimulationPointer | null): void {
    this.pointer = pointer;
  }

  dispose(): void {
    this.state?.dispose();
    if (this.seedTexture) this.gpu.gl.deleteTexture(this.seedTexture);
    this.seedProgram.dispose();
    this.stepProgram.dispose();
    this.renderProgram.dispose();
  }
}
