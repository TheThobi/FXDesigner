import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.int('radius', 'Kernel radius', 12, 4, 16, {
    group: 'Rule',
    unit: 'cells',
    description: 'Neighbourhood radius: the size of the creatures.',
  }),
  param.float('mu', 'Growth center (μ)', 0.15, 0.05, 0.45, { group: 'Rule', step: 0.001 }),
  param.float('sigma', 'Growth width (σ)', 0.016, 0.003, 0.08, { group: 'Rule', step: 0.001 }),
  param.float('dt', 'Time step', 0.1, 0.02, 0.4, { group: 'Rule' }),
  param.select('seedMode', 'Start from', ['Noise patches', 'Central blob', 'Sparse noise'], 0, {
    group: 'Start',
    resetOnChange: true,
  }),
  param.float('seedDensity', 'Patch density', 0.25, 0.02, 1, {
    group: 'Start',
    resetOnChange: true,
  }),
  param.select('view', 'View', ['Density', 'Density + trail', 'Membranes'], 0, {
    group: 'Display',
  }),
  param.float('trailFade', 'Trail fade', 0.4, 0.02, 1, { group: 'Display' }),
  param.float('gamma', 'Gamma', 1, 0.3, 3, { group: 'Display' }),
  param.stepsPerFrame(1, 8),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.04),
];

export const lenia: SimulationGenerator = {
  kind: 'simulation',
  id: 'lenia',
  name: 'Lenia',
  category: 'simulation',
  description:
    'Continuous cellular automaton (Bert Chan): soft organic creatures that glide, split and pulse. Paint to add matter.',
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'lenia', PARAMS, { seed, step, render }),
  groups: [
    {
      name: 'Rule',
      icon: 'tune',
      description: 'Small μ/σ changes switch between gliders, blobs, worms and chaos.',
      summary: (v) =>
        `R ${String(v.radius)} · μ ${Number(v.mu).toFixed(3)} · σ ${Number(v.sigma).toFixed(3)}`,
    },
  ],
  presets: [
    {
      name: 'Orbium gliders',
      values: { radius: 13, mu: 0.15, sigma: 0.015, dt: 0.1, seedMode: 0 },
    },
    { name: 'Amoebas', values: { radius: 10, mu: 0.2, sigma: 0.03, dt: 0.1 } },
    { name: 'Worms', values: { radius: 8, mu: 0.27, sigma: 0.045, dt: 0.15, seedMode: 2 } },
    { name: 'Cell colony', values: { radius: 6, mu: 0.13, sigma: 0.02, dt: 0.2, seedMode: 2 } },
    {
      name: 'Glowing membranes',
      values: { radius: 12, mu: 0.17, sigma: 0.022, view: 2, gamma: 0.7 },
    },
    {
      name: 'Comet trails',
      values: { radius: 13, mu: 0.15, sigma: 0.016, view: 1, trailFade: 0.1 },
    },
  ],
  featuredPreset: 'Glowing membranes',
};
