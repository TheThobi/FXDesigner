import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef, Preset } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.int('states', 'States', 14, 3, 24, { group: 'Rule', resetOnChange: true }),
  param.int('range', 'Range', 1, 1, 3, { group: 'Rule' }),
  param.int('threshold', 'Threshold', 1, 1, 12, { group: 'Rule' }),
  param.select('neighborhood', 'Neighborhood', ['Moore (square)', 'von Neumann (diamond)'], 0, {
    group: 'Rule',
  }),
  param.stepsPerFrame(1, 8),
  param.simResolution(256),
  param.brushSize(0.04),
  param.bool('smooth', 'Smooth bands', false, { group: 'Display' }),
];

/** Rules as range / threshold / states / neighborhood (after Mirek Wójtowicz's catalogue). */
function rule(
  name: string,
  range: number,
  threshold: number,
  states: number,
  neighborhood: number,
): Preset {
  return { name, values: { range, threshold, states, neighborhood } };
}

export const cyclicAutomaton: SimulationGenerator = {
  kind: 'simulation',
  id: 'cyclic-automaton',
  name: 'Cyclic Automaton',
  category: 'simulation',
  description:
    'Cyclic cellular automaton: crisp spiral waves and patchwork bands. Paint to inject chaos, right-drag to clear.',
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'cyclic-automaton', PARAMS, { seed, step, render }),
  presets: [
    rule('Classic spirals', 1, 1, 14, 0),
    rule('313', 1, 3, 3, 0),
    rule('Perfect spirals', 1, 3, 4, 0),
    rule('Cyclic spirals', 3, 5, 8, 0),
    rule('Turbulent phase', 2, 5, 8, 0),
    rule('Lava lamp', 2, 10, 3, 0),
    rule('Cubism', 2, 5, 3, 1),
    rule('Maps', 2, 3, 5, 1),
  ],
  featuredPreset: 'Classic spirals',
};
