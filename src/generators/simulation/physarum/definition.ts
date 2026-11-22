import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { param } from '../../../params/define';
import type { ParamDef, Preset } from '../../../params/types';
import { PhysarumSimulation } from './simulation';

const PARAMS: readonly ParamDef[] = [
  param.float('sensorAngle', 'Sensor angle', 30, 5, 90, { group: 'Agents' }),
  param.float('sensorDistance', 'Sensor distance', 9, 1, 40, {
    group: 'Agents',
    description: 'In trail pixels.',
  }),
  param.float('turnAngle', 'Turn angle', 30, 5, 90, { group: 'Agents' }),
  param.float('moveSpeed', 'Speed', 1, 0.2, 4, {
    group: 'Agents',
    description: 'Pixels per step.',
  }),
  param.float('wander', 'Wander', 5, 0, 60, {
    group: 'Agents',
    description: 'Random heading jitter (degrees).',
  }),
  param.select(
    'agentCount',
    'Agent count',
    [
      { label: '4k', value: 64 },
      { label: '16k', value: 128 },
      { label: '65k', value: 256 },
      { label: '262k', value: 512 },
    ],
    256,
    { group: 'Agents', resetOnChange: true },
  ),
  param.select('spawn', 'Spawn', ['Uniform', 'Disc (outward)', 'Ring (inward)'], 0, {
    group: 'Agents',
    resetOnChange: true,
  }),
  param.select(
    'species',
    'Species',
    [
      { label: '1', value: 1 },
      { label: '2 (R, G)', value: 2 },
      { label: '3 (R, G, B)', value: 3 },
    ],
    1,
    {
      group: 'Species',
      description:
        'Competing populations, each with its own trail channel: they follow their own trail ' +
        'and avoid the others’ (graphic RGB networks; use source colors to see them).',
    },
  ),
  param.float('repulsion', 'Repulsion', 1, 0, 3, {
    group: 'Species',
    description: 'How strongly an agent avoids the other species’ trails.',
  }),
  param.float('deposit', 'Deposit', 0.3, 0.01, 2, { group: 'Trail' }),
  param.float('decay', 'Decay', 0.1, 0.005, 0.5, { group: 'Trail' }),
  param.float('diffuse', 'Diffusion', 0.6, 0, 1, { group: 'Trail' }),
  param.stepsPerFrame(2, 8),
  param.simResolution(512),
  param.brushSize(0.03),
  param.float('gain', 'Exposure', 0.6, 0.05, 4, { group: 'Display' }),
  param.float('foodStrength', 'Food strength', 0.4, 0, 3, {
    group: 'Food',
    description:
      'Bright areas of the Food input keep emitting attractant: the network grows toward ' +
      'them and links them (Karl Sims / Jones "nutrients").',
  }),
];

export const PHYSARUM_INPUTS: readonly NodeInputDef[] = [
  {
    key: 'food',
    label: 'Food',
    description: 'Bright areas attract the agents (e.g. an Image, Paint Mask or pattern).',
    color: '#9be86a',
    value: 'gray',
    params: ['foodStrength'],
  },
];

function preset(
  name: string,
  sensorAngle: number,
  sensorDistance: number,
  turnAngle: number,
  extra = {},
): Preset {
  return { name, values: { sensorAngle, sensorDistance, turnAngle, ...extra } };
}

export const physarum: SimulationGenerator = {
  kind: 'simulation',
  id: 'physarum',
  name: 'Physarum',
  category: 'simulation',
  description:
    'Slime-mold transport networks (Jeff Jones model): veins, webs, organic lattices. Paint food to attract agents.',
  animated: true,
  params: PARAMS,
  inputs: PHYSARUM_INPUTS,
  create: (gpu) => new PhysarumSimulation(gpu, PARAMS, PHYSARUM_INPUTS),
  presets: [
    preset('Veins', 30, 9, 30),
    preset('Fine web', 22.5, 5, 45, { decay: 0.2 }),
    preset('Coarse network', 45, 25, 20, { moveSpeed: 1.5 }),
    preset('Cells / Voronoi', 60, 30, 60, { decay: 0.05 }),
    preset('Rings', 20, 15, 10, { spawn: 2, wander: 0 }),
    {
      name: 'Dense mycelium',
      values: {
        sensorAngle: 22,
        sensorDistance: 14,
        turnAngle: 18,
        agentCount: 512,
        deposit: 0.15,
        decay: 0.06,
        diffuse: 0.4,
      },
    },
    {
      name: 'Lightning roots',
      values: {
        sensorAngle: 45,
        sensorDistance: 25,
        turnAngle: 12,
        moveSpeed: 2,
        wander: 2,
        spawn: 1,
        decay: 0.2,
      },
    },
    {
      name: 'Soft fog',
      values: {
        sensorAngle: 60,
        sensorDistance: 4,
        turnAngle: 45,
        wander: 30,
        diffuse: 1,
        decay: 0.03,
        gain: 0.3,
      },
    },
    {
      name: 'Rival colonies',
      values: { species: 2, repulsion: 1.2, sensorAngle: 30, sensorDistance: 12, turnAngle: 30 },
      post: { colorMode: 0 },
    },
    {
      name: 'RGB territories',
      values: {
        species: 3,
        repulsion: 1,
        sensorAngle: 35,
        sensorDistance: 15,
        turnAngle: 25,
        decay: 0.08,
        gain: 0.8,
      },
      post: { colorMode: 0 },
    },
  ],
  featuredPreset: 'Veins',
};
