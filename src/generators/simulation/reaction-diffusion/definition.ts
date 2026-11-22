import type { NodeInputDef } from '../../../engine/nodes';
import type { SimulationGenerator } from '../../../engine/generator';
import { param } from '../../../params/define';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { rasterizeText } from '../../../engine/simulation/rasterize';
import { getNumber, getString } from '../../../params/values';
import type { ParamDef } from '../../../params/types';
import { RD_PRESETS } from './presets';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const SEED_MODE_TEXT = 4;

const PARAMS: readonly ParamDef[] = [
  param.float('feed', 'Feed (f)', 0.055, 0.0, 0.12, { step: 0.0001, group: 'Reaction' }),
  param.float('kill', 'Kill (k)', 0.062, 0.03, 0.075, { step: 0.0001, group: 'Reaction' }),
  param.float('diffA', 'Diffusion A', 1.0, 0.2, 1.0, { step: 0.01, group: 'Reaction' }),
  param.float('diffB', 'Diffusion B', 0.5, 0.1, 0.8, { step: 0.01, group: 'Reaction' }),

  param.select('mapMode', 'f/k variation', ['None', 'Gradient (f→X, k→Y)', 'Radial'], 0, {
    group: 'Spatial variation',
    description:
      'Vary feed/kill across the image to blend several regimes (Karl Sims "map"). The ' +
      'f/k map input replaces it with any image.',
  }),
  param.float('feedSpread', 'Feed spread', 0.02, 0, 0.06, {
    step: 0.0001,
    group: 'Spatial variation',
  }),
  param.float('killSpread', 'Kill spread', 0.005, 0, 0.02, {
    step: 0.0001,
    group: 'Spatial variation',
  }),

  param.float('anisotropy', 'Anisotropy', 0, 0, 0.6, {
    group: 'Direction',
    description: 'Diffuse faster along a direction to get oriented stripes.',
  }),
  param.select('directionMode', 'Direction field', ['Fixed angle', 'Swirl', 'Radial'], 0, {
    group: 'Direction',
  }),
  param.float('direction', 'Angle', 0, 0, 180, { group: 'Direction' }),

  param.stepsPerFrame(16),
  param.float('dt', 'Time step', 1.0, 0.1, 1.0, { step: 0.01, group: 'Simulation' }),
  param.simResolution(256),
  param.select(
    'seedMode',
    'Seed',
    ['Center square', 'Random spots', 'Noise', 'Ring', 'Text', 'Empty'],
    1,
    {
      group: 'Simulation',
      resetOnChange: true,
    },
  ),
  param.text('seedText', 'Seed text', 'RD', {
    group: 'Simulation',
    resetOnChange: true,
    maxLength: 32,
  }),
  param.brushSize(),

  param.select('view', 'View', ['Chemical B', 'Chemical A', 'A − B', 'Relief'], 0, {
    group: 'Display',
  }),
  param.float('gain', 'Gain', 2.5, 0.5, 6, { group: 'Display' }),
  param.float('lightAngle', 'Light angle', 45, 0, 360, { group: 'Display' }),
  param.float('relief', 'Relief', 1, 0, 4, { group: 'Display' }),
];

const RD_INPUTS: readonly NodeInputDef[] = [
  {
    key: 'seed',
    label: 'Seed',
    description: 'Bright areas of this input seed the simulation (restarts it when connected).',
    color: '#ffd166',
    value: 'gray',
  },
  {
    key: 'map',
    label: 'f/k map',
    description:
      'Brightness varies feed / kill across the image (± the spreads below), blending ' +
      'several patterns in one texture. Replaces the f/k variation mode.',
    color: '#c08cff',
    value: 'gray',
  },
];

export const reactionDiffusion: SimulationGenerator = {
  kind: 'simulation',
  id: 'reaction-diffusion',
  name: 'Reaction-Diffusion',
  category: 'simulation',
  description:
    'Gray-Scott model (see karlsims.com/rd.html). Paint with the mouse: left adds B, right/shift erases. Seamless.',
  animated: true,
  inputs: RD_INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'reaction-diffusion', PARAMS, {
      seed,
      inputs: RD_INPUTS,
      reseedInputs: ['seed'],
      step,
      render,
      seedImage: (params, size) =>
        getNumber(params, 'seedMode') === SEED_MODE_TEXT
          ? rasterizeText(getString(params, 'seedText'), size)
          : null,
    }),
  params: PARAMS,
  presets: RD_PRESETS,
  featuredPreset: 'Fingerprint',
};
