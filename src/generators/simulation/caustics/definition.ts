import type { SimulationGenerator } from '../../../engine/generator';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import { CausticsSimulation } from './simulation';

const PARAMS: readonly ParamDef[] = [
  param.float('waveSpeed', 'Wave speed', 0.6, 0.05, 1, { group: 'Water' }),
  param.float('damping', 'Damping', 0.006, 0, 0.05, {
    group: 'Water',
    step: 0.001,
    description: 'Energy lost per step: low values keep ripples alive longer.',
  }),
  param.float('rain', 'Rain', 0.1, 0, 1, { group: 'Water', description: 'Drop frequency.' }),
  param.float('dropSize', 'Drop size', 0.025, 0.005, 0.1, { group: 'Water' }),
  param.float('dropStrength', 'Drop strength', 0.6, 0, 2, { group: 'Water' }),
  param.float('wind', 'Wind', 0.5, 0, 1, {
    group: 'Water',
    description: 'Continuous swell driven by moving noise.',
  }),
  param.float('windScale', 'Wind scale', 4, 1, 12, { group: 'Water', step: 1 }),
  param.float('depth', 'Floor depth', 2, 0.1, 4, {
    group: 'Light',
    description: 'Distance light travels below the surface: deeper focuses sharper lines.',
  }),
  param.float('dispersion', 'Dispersion', 0, 0, 0.3, {
    group: 'Light',
    description: 'Per-channel refraction index spread (rainbow fringes; use source colors).',
  }),
  param.float('brightness', 'Brightness', 1.5, 0.1, 4, { group: 'Light' }),
  param.float('sharpness', 'Contrast', 2.2, 0.5, 4, { group: 'Light' }),
  param.select(
    'meshDensity',
    'Light mesh',
    [64, 128, 256, 512].map((n) => ({ label: `${n}²`, value: n })),
    256,
    { group: 'Light', description: 'Resolution of the refracted light mesh.' },
  ),
  param.select('view', 'View', ['Caustics', 'Height'], 0, { group: 'Light' }),
  param.stepsPerFrame(2, 8),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.03),
];

export const causticsSimulation: SimulationGenerator = {
  kind: 'simulation',
  id: 'caustics-sim',
  name: 'Water Caustics',
  category: 'simulation',
  description: 'Seamless caustics from simulated water. Paint to add ripples.',
  animated: true,
  defaultPost: { alphaMode: 1 },
  params: PARAMS,
  create: (gpu) => new CausticsSimulation(gpu, PARAMS),
  presets: [
    { name: 'Pool floor', values: {} },
    {
      name: 'Rainy puddle',
      values: { rain: 0.8, wind: 0.1, dropSize: 0.015, depth: 1.2, damping: 0.01, sharpness: 1.6 },
    },
    {
      name: 'Sharp sunlight',
      values: { depth: 2.8, sharpness: 2.8, brightness: 1.8, wind: 0.6 },
    },
    {
      name: 'Soft shallows',
      values: { depth: 1, sharpness: 1.4, brightness: 1.2, wind: 0.4, windScale: 3 },
    },
    {
      name: 'Rainbow fringes',
      values: { dispersion: 0.12, depth: 2, wind: 0.4 },
      post: { colorMode: 0 },
    },
    { name: 'Calm swell', values: { rain: 0, wind: 0.7, windScale: 2, depth: 2.2 } },
  ],
};
