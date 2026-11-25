import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.select('view', 'View', ['Cracks', 'Distance from origin'], 0),
  param.select('start', 'Start', ['Impact', 'Random'], 0, { group: 'Cracks', resetOnChange: true }),
  param.int('branches', 'Main cracks', 6, 1, 16, { group: 'Cracks', resetOnChange: true }),
  param.float('length', 'Length', 0.5, 0.05, 2, {
    group: 'Cracks',
    description: 'Longest path, as a fraction of the image.',
  }),
  param.float('wiggle', 'Wiggle', 0.6, 0, 2, { group: 'Cracks' }),
  param.float('branching', 'Branching', 0.5, 0, 2, { group: 'Cracks' }),
  param.float('stop', 'Random stops', 0.2, 0, 2, { group: 'Cracks' }),
  param.float('width', 'Width', 2.5, 1, 4, { group: 'Look', unit: 'cells' }),
  param.float('fade', 'Thin out', 0.5, 0, 1, { group: 'Look' }),
  param.stepsPerFrame(1, 8),
  param.simResolution(256),
  param.brushSize(0.01),
];

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'hardness',
    label: 'Hardness',
    description: 'Bright areas stop the cracks.',
    color: '#9ad1ff',
    value: 'float',
  },
];

export const crackGrowth: SimulationGenerator = {
  kind: 'simulation',
  id: 'crack-growth',
  name: 'Crack Growth',
  category: 'simulation',
  description:
    'Cracks spreading from an impact (or random points), wandering and branching over time: ' +
    'animated breaking ground or ice. Paint to start new cracks.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'crack-growth', PARAMS, { seed, step, render, inputs: INPUTS }),
  presets: [
    { name: 'Impact', values: { start: 0, branches: 6, length: 0.5 } },
    { name: 'Shattered ice', values: { start: 0, branches: 10, branching: 1.5, wiggle: 0.3 } },
    {
      name: 'Dry earth',
      values: { start: 1, branches: 16, length: 0.3, branching: 1.2, wiggle: 1 },
    },
    { name: 'Lightning crack', values: { start: 0, branches: 3, wiggle: 1.4, branching: 0.8 } },
  ],
  featuredPreset: 'Impact',
};
