import type { NodeInputDef } from '../../../engine/nodes';
import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.select('pattern', 'Initial ink', ['Stripes', 'Rings', 'Checker', 'Noise contours'], 0, {
    group: 'Ink',
    resetOnChange: true,
  }),
  param.int('bands', 'Bands', 6, 1, 24, { group: 'Ink', resetOnChange: true }),
  param.float('inkValue', 'Brush ink value', 1, 0, 1, { group: 'Ink' }),
  param.select('flow', 'Flow', ['Curl noise', 'Combing', 'Vortices'], 0, { group: 'Flow' }),
  param.int('scale', 'Flow scale', 2, 1, 8, { group: 'Flow' }),
  param.float('strength', 'Strength', 1, 0, 4, { group: 'Flow' }),
  param.float('evolution', 'Evolution', 0.5, 0, 4, {
    group: 'Flow',
    description: 'How fast the flow field changes.',
  }),
  param.stepsPerFrame(2, 16),
  param.simResolution(512),
  param.brushSize(0.02),
];

const SEED_INPUTS: readonly NodeInputDef[] = [
  {
    key: 'seed',
    label: 'Seed',
    description: 'Bright areas of this input seed the ink pattern (restarts it when connected).',
    color: '#ffd166',
    value: 'gray',
  },
];

export const marbling: SimulationGenerator = {
  kind: 'simulation',
  id: 'marbling',
  name: 'Ink Marbling',
  category: 'simulation',
  description:
    'Paper marbling (ebru / suminagashi): ink bands swirled by a flow field. Paint drops ink. Seamless.',
  animated: true,
  params: PARAMS,
  inputs: SEED_INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'marbling', PARAMS, {
      seed,
      step,
      render,
      inputs: SEED_INPUTS,
      reseedInputs: ['seed'],
    }),
  presets: [
    { name: 'Ebru swirls', values: { pattern: 0, bands: 6, flow: 0, scale: 2, strength: 1 } },
    { name: 'Combed', values: { pattern: 0, bands: 10, flow: 1, scale: 3, strength: 1.5 } },
    { name: 'Suminagashi', values: { pattern: 1, bands: 8, flow: 0, scale: 1, strength: 0.6 } },
    { name: 'Vortex garden', values: { pattern: 2, bands: 6, flow: 2, strength: 1 } },
    { name: 'Fine combs', values: { pattern: 0, bands: 16, flow: 1, scale: 4, strength: 1.5 } },
    {
      name: 'Agate rings',
      values: { pattern: 1, bands: 12, flow: 0, scale: 2, strength: 0.8, evolution: 0.3 },
    },
    { name: 'Checker storm', values: { pattern: 2, bands: 8, flow: 2, strength: 2 } },
  ],
  defaultPost: { posterizeOn: true, posterize: 5 },
  featuredPreset: 'Ebru swirls',
};
