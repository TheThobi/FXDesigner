import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.float('hardness', 'Hardness', 0.4, 0, 0.98, { group: 'Brush' }),
  param.float('strength', 'Flow', 0.6, 0.05, 1, {
    group: 'Brush',
    description: 'Paint added per frame under the brush.',
  }),
  param.brushSize(0.04),
  param.float('fade', 'Fade', 0, 0, 5, {
    group: 'Canvas',
    description: '0 = strokes stay forever; otherwise they fade out over time.',
  }),
  param.float('softness', 'Softness', 0, 0, 1, { group: 'Canvas', description: 'Output blur.' }),
  param.select('start', 'Start from', ['Empty', 'Filled', 'Noise blobs'], 0, {
    group: 'Canvas',
    resetOnChange: true,
    description: 'Changing it clears the canvas.',
  }),
  param.simResolution(512, [256, 512, 1024]),
];

export const paintMask: SimulationGenerator = {
  kind: 'simulation',
  id: 'paint-mask',
  name: 'Paint Mask',
  category: 'pattern',
  description: 'Paint a persistent mask. Right-drag or Shift-drag to erase.',
  animated: true,
  seedless: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'paint-mask', PARAMS, { seed, step, render }),
  presets: [
    { name: 'Hard brush', values: { hardness: 0.85, strength: 1 } },
    { name: 'Soft airbrush', values: { hardness: 0, strength: 0.15, brushSize: 0.08 } },
    { name: 'Fading trails', values: { fade: 1.5, hardness: 0.5, strength: 0.8 } },
    { name: 'Soft blobs', values: { start: 2, softness: 0.5 } },
  ],
  featuredPreset: 'Soft blobs',
};
