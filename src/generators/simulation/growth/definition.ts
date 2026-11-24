import type { SimulationGenerator } from '../../../engine/generator';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import { DifferentialGrowth } from './simulation';

const PARAMS: readonly ParamDef[] = [
  param.select('start', 'Start', ['Ring', 'Several rings', 'Line'], 0, {
    group: 'Growth',
    resetOnChange: true,
  }),
  param.float('radius', 'Spacing', 0.012, 0.004, 0.04, {
    group: 'Growth',
    resetOnChange: true,
    description: 'Distance kept between folds: smaller gives finer, denser meanders.',
  }),
  param.float('repulsion', 'Repulsion', 1, 0.1, 3, { group: 'Growth' }),
  param.float('cohesion', 'Smoothness', 0.5, 0, 1, {
    group: 'Growth',
    description: 'Pull toward the neighbours along the curve: higher gives rounder folds.',
  }),
  param.float('jitter', 'Jitter', 0.2, 0, 2, { group: 'Growth' }),
  param.int('maxNodes', 'Max nodes', 8000, 500, 30000, {
    group: 'Growth',
    description: 'Growth stops at this many nodes (cost grows with it).',
  }),
  param.float('lineWidth', 'Line width', 2, 0.5, 12, { unit: 'px' }),
  param.stepsPerFrame(1, 8),
  param.brushSize(0.03),
];

export const differentialGrowth: SimulationGenerator = {
  kind: 'simulation',
  id: 'differential-growth',
  name: 'Differential Growth',
  category: 'simulation',
  description:
    'A closed curve that keeps growing and folding into coral / brain-like meanders. Paint to drop new rings. Seamless.',
  animated: true,
  params: PARAMS,
  create: (gpu) => new DifferentialGrowth(gpu),
  presets: [
    { name: 'Coral', values: { start: 0, radius: 0.012, cohesion: 0.5, lineWidth: 2 } },
    {
      name: 'Brain folds',
      values: { start: 1, radius: 0.008, cohesion: 0.7, lineWidth: 3, maxNodes: 16000 },
    },
    {
      name: 'Meander band',
      values: { start: 2, radius: 0.015, cohesion: 0.3, jitter: 0.6, lineWidth: 2.5 },
    },
    {
      name: 'Fine labyrinth',
      values: { start: 1, radius: 0.005, cohesion: 0.6, lineWidth: 1.2, maxNodes: 30000 },
    },
  ],
  featuredPreset: 'Coral',
};
