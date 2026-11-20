import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef, ParamValues } from '../../../params/types';
import { getNumber } from '../../../params/values';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import relax from './relax.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.float('eta', 'Branching (η)', 2, 0.3, 6, {
    group: 'Growth',
    description: 'Low = bushy coral, ~1 = DLA dendrites, high = thin lightning branches.',
  }),
  param.float('growthRate', 'Growth rate', 0.5, 0.02, 1, { group: 'Growth' }),
  param.float('farField', 'Far-field pull', 0.15, 0, 2, {
    group: 'Growth',
    description: 'How strongly empty space is held at full potential (screening).',
  }),
  param.bool('diagonal', 'Diagonal sticking', true, { group: 'Growth' }),
  param.int('relaxIterations', 'Field iterations', 12, 2, 40, {
    group: 'Growth',
    description: 'Potential relaxation per growth step: more = longer-range, finer branches.',
  }),
  param.select('seedMode', 'Seed', ['Center point', 'Bottom line', 'Scattered', 'Ring'], 0, {
    group: 'Growth',
    resetOnChange: true,
  }),
  param.float('tipFade', 'Tip glow length', 600, 10, 3000, {
    group: 'Display',
    unit: 'frames',
  }),
  param.float('trunk', 'Old growth tone', 0.35, 0, 1, { group: 'Display' }),
  param.float('fieldGlow', 'Field glow', 0, 0, 1, { group: 'Display' }),
  param.stepsPerFrame(8, 32),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.01),
];

export const crystalGrowth: SimulationGenerator = {
  kind: 'simulation',
  id: 'crystal-growth',
  name: 'Crystal Growth',
  category: 'simulation',
  description:
    'Dendritic growth (dielectric breakdown / DLA family): frost, coral, roots and branching lightning. Paint to add seeds.',
  animated: true,
  params: PARAMS,
  create: (gpu) =>
    new GridSimulation(gpu, 'crystal-growth', PARAMS, {
      seed,
      step: [
        {
          label: 'relax',
          source: relax,
          repeat: (p: ParamValues) => getNumber(p, 'relaxIterations', 12),
        },
        { label: 'grow', source: step },
      ],
      render,
    }),
  groups: [
    {
      name: 'Growth',
      icon: 'tune',
      summary: (v) => `η ${Number(v.eta).toFixed(1)} · rate ${Number(v.growthRate).toFixed(2)}`,
    },
  ],
  presets: [
    { name: 'Frost dendrite', values: { eta: 1.2, growthRate: 0.6, seedMode: 0, diagonal: true } },
    { name: 'Coral bush', values: { eta: 0.5, growthRate: 0.4, farField: 0.1, trunk: 0.6 } },
    {
      name: 'Lightning tree',
      values: { eta: 4, growthRate: 1, seedMode: 1, tipFade: 120, trunk: 0.2 },
    },
    { name: 'Root network', values: { eta: 2, growthRate: 0.5, seedMode: 1, diagonal: false } },
    { name: 'Snow scatter', values: { eta: 1.5, seedMode: 2, growthRate: 0.7, fieldGlow: 0.3 } },
    { name: 'Inward ring', values: { eta: 1.8, seedMode: 3, growthRate: 0.6, tipFade: 600 } },
  ],
  featuredPreset: 'Frost dendrite',
};
