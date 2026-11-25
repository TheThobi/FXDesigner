import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.select('view', 'View', ['Burning paper', 'Burn mask', 'Fire'], 0),
  param.select('start', 'Ignition', ['Center', 'Bottom edge', 'Random sparks', 'Brush only'], 0, {
    group: 'Fire',
    resetOnChange: true,
  }),
  param.float('spread', 'Spread', 0.5, 0.05, 1, {
    group: 'Fire',
    description: 'How eagerly the fire catches: lower gives a more ragged front.',
  }),
  param.float('burnSpeed', 'Burn speed', 1, 0.1, 4, { group: 'Fire' }),
  param.float('wind', 'Wind', 0, 0, 1, { group: 'Fire' }),
  param.angle('windAngle', 'Wind direction', 90, {
    group: 'Fire',
    visibleWhen: (v) => Number(v.wind) > 0,
  }),
  param.float('fibers', 'Paper fibers', 0.6, 0, 1, { group: 'Paper', resetOnChange: true }),
  param.bool('holes', 'Burn through', true, {
    group: 'Paper',
    description: 'Consumed paper becomes transparent (off: gray ash).',
  }),
  param.stepsPerFrame(2, 16),
  param.simResolution(256),
  param.brushSize(0.02),
];

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'paper',
    label: 'Paper',
    description: 'Shape of the sheet (bright = paper); restarts when connected.',
    color: '#ffd166',
    value: 'float',
  },
  {
    key: 'ignite',
    label: 'Ignite',
    description: 'Bright areas catch fire.',
    color: '#ff8a5c',
    value: 'float',
  },
];

export const burningPaper: SimulationGenerator = {
  kind: 'simulation',
  id: 'burning-paper',
  name: 'Burning Paper',
  category: 'simulation',
  description:
    'A fire front eating through paper: scorch, glowing edge, char, then a hole. Paint to ' +
    'ignite. The burn mask view drives dissolves of other nodes.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'burning-paper', PARAMS, {
      seed,
      step,
      render,
      inputs: INPUTS,
      reseedInputs: ['paper'],
    }),
  defaultPost: { alphaMode: 3 },
  presets: [
    { name: 'Smouldering sheet', values: { start: 0, spread: 0.5 } },
    { name: 'Rising flames', values: { start: 1, spread: 0.7, wind: 0.5, windAngle: 90 } },
    { name: 'Embers everywhere', values: { start: 2, spread: 0.35, burnSpeed: 0.6 } },
    { name: 'Ash', values: { start: 0, holes: false, spread: 0.6 } },
  ],
  featuredPreset: 'Smouldering sheet',
};
