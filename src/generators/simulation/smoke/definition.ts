import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import { getNumber } from '../../../params/values';
import type { ParamDef, ParamValues } from '../../../params/types';
import pressure from '../fluid/pressure.frag?raw';
import project from '../fluid/project.frag?raw';
import advect from './advect.frag?raw';
import forces from './forces.frag?raw';
import render from './render.frag?raw';
import seed from './seed.frag?raw';

/** Post alpha mode "source alpha": the density becomes the sprite's opacity. */
const SOURCE_ALPHA = 3;

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'emitter',
    label: 'Emitter',
    description: 'Bright areas of this input emit smoke (e.g. a shape, text or glow node).',
    color: '#ffb347',
    value: 'gray',
  },
  {
    key: 'flow',
    label: 'Flow',
    description: 'Flowmap (RG around 0.5) pushing the fluid, e.g. the Flowmap Painter.',
    color: '#ff6fd0',
    value: 'color',
  },
];

const PARAMS: readonly ParamDef[] = [
  param.select('emitter', 'Emitter', ['Point', 'Line', 'Ring', 'None (inputs / brush)'], 0, {
    group: 'Emitter',
  }),
  param.vec2('emitterPos', 'Position', [0.5, 0.15], 0, 1, { group: 'Emitter' }),
  param.float('emitterSize', 'Size', 0.05, 0.01, 0.25, { group: 'Emitter' }),
  param.float('emission', 'Density', 0.9, 0, 1, { group: 'Emitter' }),
  param.float('emitSpeed', 'Velocity', 0.6, 0, 3, {
    group: 'Emitter',
    description: 'Initial push along the up direction.',
  }),
  param.float('orbitRadius', 'Orbit radius', 0, 0, 0.45, {
    group: 'Emitter',
    description: 'Moves the emitter in a circle: the smoke draws trails.',
  }),
  param.float('orbitSpeed', 'Orbit speed', 0.25, -2, 2, {
    group: 'Emitter',
    description: 'Turns per second (negative = clockwise).',
  }),
  param.float('puffRate', 'Puffs / s', 0, 0, 6, {
    group: 'Emitter',
    description: '0 = continuous emission; otherwise periodic bursts.',
  }),
  param.float('buoyancy', 'Buoyancy', 1, 0, 4, { group: 'Forces' }),
  param.angle('upAngle', 'Up direction', 0, { group: 'Forces' }),
  param.float('vorticity', 'Vorticity', 0.6, 0, 3, {
    group: 'Forces',
    description: 'Vorticity confinement: crisp curls instead of a blurry plume.',
  }),
  param.float('turbulence', 'Turbulence', 0.4, 0, 3, { group: 'Forces' }),
  param.float('turbulenceScale', 'Turbulence scale', 4, 1, 12, { group: 'Forces', step: 1 }),
  param.float('flowStrength', 'Flow input strength', 1, 0, 4, { group: 'Forces' }),
  param.float('dissipation', 'Density fade', 0.6, 0, 12, { group: 'Fluid' }),
  param.float('drag', 'Velocity drag', 0.3, 0, 3, { group: 'Fluid' }),
  param.float('dtScale', 'Time step', 1, 0.2, 3, { group: 'Fluid' }),
  param.int('pressureIterations', 'Pressure iterations', 20, 4, 60, {
    group: 'Fluid',
    description: 'More = more incompressible (rounder swirls), slower.',
  }),
  param.select('boundaries', 'Boundaries', ['Wrap (seamless)', 'Open'], 1, { group: 'Fluid' }),
  param.select('view', 'Output', ['Density', 'Motion vectors', 'Vorticity'], 0, {
    group: 'Output',
    description:
      'Motion vectors encode the velocity around 0.5 (export a second flipbook with the same ' +
      'settings to blend frames, FluidNinja-style).',
  }),
  param.float('densityGain', 'Density gain', 1.5, 0.5, 6, { group: 'Output' }),
  param.float('vectorScale', 'Vector scale', 1, 0.1, 8, { group: 'Output' }),
  param.stepsPerFrame(1, 4),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.04),
];

export const smokeFire: SimulationGenerator = {
  kind: 'simulation',
  id: 'smoke-fire',
  name: 'Smoke & Fire',
  category: 'simulation',
  description:
    'FluidNinja-style smoke solver: emitters, buoyancy, vorticity confinement, turbulence. ' +
    'Feed shapes into its Emitter input or a flowmap into Flow; outputs density with alpha or ' +
    'motion vectors for flipbooks.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'smoke-fire', PARAMS, {
      seed,
      step: [
        { label: 'forces', source: forces },
        { label: 'advect', source: advect },
        {
          label: 'pressure',
          source: pressure,
          repeat: (p: ParamValues) => getNumber(p, 'pressureIterations', 20),
        },
        { label: 'project', source: project },
      ],
      render,
      inputs: INPUTS,
    }),
  defaultPost: { alphaMode: SOURCE_ALPHA },
  groups: [
    {
      name: 'Emitter',
      icon: 'drop',
      summary: (v) =>
        `${['Point', 'Line', 'Ring', 'Inputs'][Number(v.emitter)] ?? ''}${Number(v.puffRate) > 0 ? ' · puffs' : ''}`,
    },
  ],
  presets: [
    { name: 'Rising smoke', values: {} },
    {
      name: 'Campfire',
      values: {
        emitter: 1,
        emitterSize: 0.03,
        buoyancy: 3,
        emitSpeed: 1.4,
        vorticity: 1.2,
        turbulence: 1.2,
        dissipation: 9,
        densityGain: 1,
      },
      ramp: {
        stops: [
          { pos: 0, color: '#000000', alpha: 1 },
          { pos: 0.35, color: '#8a1c06', alpha: 1 },
          { pos: 0.65, color: '#ff7a1a', alpha: 1 },
          { pos: 1, color: '#fff1b0', alpha: 1 },
        ],
      },
    },
    {
      name: 'Puff trail',
      values: { puffRate: 2, emitSpeed: 1.6, buoyancy: 0.6, vorticity: 1.4, dissipation: 0.8 },
    },
    {
      name: 'Magic vortex ring',
      values: { emitter: 2, emitterSize: 0.04, buoyancy: 0.3, vorticity: 2.2, turbulence: 0.2 },
    },
    {
      name: 'Side wind',
      values: { upAngle: 70, buoyancy: 1.4, turbulence: 1, emitterPos: [0.15, 0.4] },
    },
    {
      name: 'Comet trail',
      values: {
        emitterPos: [0.5, 0.5],
        orbitRadius: 0.3,
        orbitSpeed: 0.3,
        buoyancy: 0,
        emitSpeed: 0.2,
        vorticity: 1.6,
        turbulence: 0.3,
        dissipation: 1.2,
        boundaries: 0,
      },
    },
    {
      name: 'Spiral wisps',
      values: {
        emitterPos: [0.5, 0.5],
        orbitRadius: 0.18,
        orbitSpeed: -0.6,
        emitter: 2,
        emitterSize: 0.02,
        buoyancy: 0.2,
        vorticity: 2.4,
        dissipation: 2,
        boundaries: 0,
      },
    },
    {
      name: 'Motion vectors',
      values: { view: 1, vectorScale: 2 },
      post: { colorMode: 0 },
    },
  ],
  featuredPreset: 'Rising smoke',
};
