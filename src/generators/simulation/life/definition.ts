import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const RULES = [
  'Conway (B3/S23)',
  "Brian's Brain (B2/S/C3)",
  'Star Wars (B2/S345/C4)',
  'Day & Night (B3678/S34678)',
  'Seeds (B2/S)',
  'Sparks (B36/S3456/C5)',
  'Bosco (Larger than Life)',
] as const;

const PARAMS: readonly ParamDef[] = [
  param.select('rule', 'Rule', RULES, 1, { group: 'Rule' }),
  param.select('seedMode', 'Start from', ['Random', 'Central square'], 0, {
    group: 'Start',
    resetOnChange: true,
  }),
  param.float('seedDensity', 'Density', 0.3, 0.02, 0.9, { group: 'Start', resetOnChange: true }),
  param.float('afterglow', 'Afterglow fade', 0.08, 0.005, 1, {
    group: 'Display',
    description: 'How fast the history of past cells fades (low = long trails).',
  }),
  param.float('history', 'History intensity', 0.5, 0, 1, { group: 'Display' }),
  param.bool('crisp', 'Crisp cells', true, { group: 'Display' }),
  param.stepsPerFrame(1, 8),
  param.simResolution(256, [64, 128, 256, 512]),
  param.brushSize(0.03),
];

export const lifeAutomata: SimulationGenerator = {
  kind: 'simulation',
  id: 'life-automata',
  name: 'Life Automata',
  category: 'simulation',
  description:
    "Game of Life and its cousins (Brian's Brain, Star Wars, Day & Night, Larger than Life) with glowing history trails.",
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'life-automata', PARAMS, { seed, step, render }),
  groups: [{ name: 'Rule', icon: 'tune', summary: (v) => RULES[Number(v.rule)] ?? '' }],
  presets: [
    { name: 'Classic Life', values: { rule: 0, seedDensity: 0.3, history: 0.3 } },
    { name: 'Brain storm', values: { rule: 1, seedDensity: 0.2, afterglow: 0.05 } },
    { name: 'Star Wars', values: { rule: 2, seedDensity: 0.35, history: 0.6 } },
    {
      name: 'Day & Night blobs',
      values: { rule: 3, seedDensity: 0.5, history: 0.2, crisp: false },
    },
    {
      name: 'Seeds explosion',
      values: { rule: 4, seedMode: 1, seedDensity: 0.1, afterglow: 0.02 },
    },
    { name: 'Sparks', values: { rule: 5, seedDensity: 0.25, afterglow: 0.04, history: 0.8 } },
    { name: 'Bosco amoebas', values: { rule: 6, seedDensity: 0.5, history: 0.4, crisp: false } },
  ],
  featuredPreset: 'Star Wars',
};
