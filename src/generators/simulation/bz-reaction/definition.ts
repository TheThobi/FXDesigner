import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.float('alpha', 'α', 1.0, 0.2, 2, { group: 'Reaction' }),
  param.float('beta', 'β', 1.0, 0.2, 2, { group: 'Reaction' }),
  param.float('gamma', 'γ', 1.0, 0.2, 2, { group: 'Reaction' }),
  param.float('rate', 'Reaction rate', 1.0, 0.1, 1.5, { group: 'Reaction' }),
  param.float('diffusion', 'Diffusion', 1.0, 0.2, 1, {
    group: 'Reaction',
    description: 'Blend toward the 3x3 neighbourhood mean.',
  }),
  param.stepsPerFrame(2, 16),
  param.simResolution(256),
  param.brushSize(0.03),
  param.select('view', 'View', ['Species A', 'Species B', 'Species C', 'RGB'], 0, {
    group: 'Display',
  }),
];

export const bzReaction: SimulationGenerator = {
  kind: 'simulation',
  id: 'bz-reaction',
  name: 'BZ Spirals',
  category: 'simulation',
  description: 'Belousov-Zhabotinsky oscillating reaction: smooth rotating spiral waves.',
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'bz-reaction', PARAMS, { seed, step, render }),
  presets: [
    { name: 'Balanced spirals', values: { alpha: 1, beta: 1, gamma: 1, rate: 1, diffusion: 1 } },
    { name: 'Sharp waves', values: { alpha: 1.2, beta: 1, gamma: 1, rate: 1.2, diffusion: 1 } },
    { name: 'Turbulent', values: { alpha: 1.4, beta: 0.8, gamma: 1.1, rate: 1.0, diffusion: 0.6 } },
    { name: 'RGB tri-spiral', values: { view: 3, alpha: 1.2, beta: 1, gamma: 0.9 } },
    { name: 'Slow tides', values: { rate: 0.3, diffusion: 1, alpha: 0.8 } },
  ],
  defaultPost: { posterizeOn: true, posterize: 6 },
  featuredPreset: 'Balanced spirals',
};
