import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.select('view', 'View', ['Height', 'Relief', 'Water', 'Erosion / deposit'], 1),
  param.int('terrainScale', 'Terrain scale', 3, 1, 12, { group: 'Terrain', resetOnChange: true }),
  param.bool('ridged', 'Ridged', false, { group: 'Terrain', resetOnChange: true }),
  param.float('relief', 'Relief', 120, 10, 400, {
    group: 'Terrain',
    description: 'Height range in grid cells: steeper terrain erodes faster.',
  }),
  param.float('rain', 'Rain', 1, 0, 5, { group: 'Water' }),
  param.float('evaporation', 'Evaporation', 0.5, 0.05, 3, { group: 'Water' }),
  param.float('capacity', 'Capacity', 4, 0.5, 20, {
    group: 'Erosion',
    description: 'Sediment a flow can carry: more digs deeper channels.',
  }),
  param.float('erosion', 'Erosion', 0.3, 0, 1, { group: 'Erosion' }),
  param.float('deposition', 'Deposition', 0.3, 0, 1, { group: 'Erosion' }),
  param.float('strata', 'Strata', 0, 0, 1, {
    group: 'Erosion',
    description: 'Hard rock layers alternating with height: terraced canyons.',
  }),
  param.int('layers', 'Layers', 8, 2, 32, {
    group: 'Erosion',
    visibleWhen: (v) => Number(v.strata) > 0,
  }),
  param.float('talus', 'Talus angle', 50, 15, 85, {
    group: 'Erosion',
    unit: '°',
    description: 'Steeper slopes crumble (thermal erosion): lower gives rounder screes.',
  }),
  param.float('softening', 'Softening', 0.05, 0, 1, {
    group: 'Erosion',
    description: 'Thermal smoothing of sharp spikes and pits.',
  }),
  param.stepsPerFrame(8, 64),
  param.simResolution(512),
  param.brushSize(0.03),
];

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'terrain',
    label: 'Terrain',
    description:
      'Height map to erode instead of the built-in terrain (restarts it when connected).',
    color: '#ffd166',
    value: 'float',
  },
  {
    key: 'hardness',
    label: 'Hardness',
    description: 'Bright areas are hard rock that resists erosion (strata, ridges).',
    color: '#9ad1ff',
    value: 'float',
  },
];

export const erosion: SimulationGenerator = {
  kind: 'simulation',
  id: 'erosion',
  name: 'Hydraulic Erosion',
  category: 'simulation',
  description:
    'Rain carves river channels and deposits sediment into a height map. Paint pours water. Seamless.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'erosion', PARAMS, {
      seed,
      step,
      render,
      inputs: INPUTS,
      reseedInputs: ['terrain'],
    }),
  presets: [
    { name: 'River valleys', values: { terrainScale: 3, rain: 1, capacity: 4 } },
    {
      name: 'Badlands',
      values: {
        terrainScale: 5,
        ridged: true,
        relief: 200,
        capacity: 10,
        erosion: 0.5,
        talus: 70,
      },
    },
    {
      name: 'Gentle hills',
      values: { terrainScale: 2, relief: 60, capacity: 2, softening: 0.2, talus: 30 },
    },
    {
      name: 'Sediment fans',
      values: { view: 3, terrainScale: 4, deposition: 0.7, evaporation: 1.5 },
    },
    {
      name: 'Terraced canyon',
      values: { terrainScale: 3, relief: 220, capacity: 8, strata: 0.9, layers: 10, talus: 75 },
    },
    { name: 'Height map', values: { view: 0, terrainScale: 3, stepsPerFrame: 16 } },
  ],
  featuredPreset: 'River valleys',
};
