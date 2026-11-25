import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import { getNumber } from '../../../params/values';
import type { ParamDef, ParamValues } from '../../../params/types';
import advect from './advect.frag?raw';
import obstacles from './obstacles.glsl?raw';
import pressure from './pressure.frag?raw';
import project from './project.frag?raw';
import render from './render.frag?raw';
import seed from './seed.frag?raw';

const PARAMS: readonly ParamDef[] = [
  param.select(
    'force',
    'Driving force',
    ['Curl stirring', 'Rising plume', 'Shear jets', 'Brush only'],
    0,
    {
      group: 'Flow',
    },
  ),
  param.float('stirStrength', 'Strength', 1, 0, 4, { group: 'Flow' }),
  param.float('stirScale', 'Stir scale', 3, 1, 8, { group: 'Flow', step: 1 }),
  param.float('stirSpeed', 'Stir evolution', 1, 0, 6, { group: 'Flow' }),
  param.float('viscosity', 'Viscosity', 0.2, 0, 2, { group: 'Flow' }),
  param.float('dtScale', 'Time step', 1, 0.2, 3, { group: 'Flow' }),
  param.int('pressureIterations', 'Pressure iterations', 20, 4, 60, {
    group: 'Flow',
    description: 'More = more incompressible (rounder swirls), slower.',
  }),
  param.select('dyeStart', 'Ink start', ['Empty', 'Stripes', 'Checker', 'Clouds'], 1, {
    group: 'Ink',
    resetOnChange: true,
  }),
  param.int('dyeBands', 'Bands', 6, 1, 24, { group: 'Ink', resetOnChange: true }),
  param.float('dissipation', 'Ink fade', 0.2, 0, 5, { group: 'Ink' }),
  param.float('inkContrast', 'Ink contrast', 1.5, 1, 12, { group: 'Ink' }),
  param.bool('colorInk', 'Colored inks', false, {
    group: 'Ink',
    description: 'Inks of several colors mixing in the flow (Post Process color mode: Source).',
  }),
  param.color('inkA', 'Color 1', '#2f6fd6', {
    group: 'Ink',
    resetOnChange: true,
    visibleWhen: (v) => v.colorInk === true,
  }),
  param.color('inkB', 'Color 2', '#e2513a', {
    group: 'Ink',
    resetOnChange: true,
    visibleWhen: (v) => v.colorInk === true,
  }),
  param.color('inkC', 'Color 3', '#f2c14e', {
    group: 'Ink',
    resetOnChange: true,
    visibleWhen: (v) => v.colorInk === true,
  }),
  param.select('brushInk', 'Brush color', ['Color 1', 'Color 2', 'Color 3'], 0, {
    group: 'Ink',
    visibleWhen: (v) => v.colorInk === true,
  }),
  param.select('view', 'View', ['Ink', 'Speed', 'Vorticity'], 0, { group: 'Ink' }),
  param.stepsPerFrame(1, 4),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.04),
];

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'obstacles',
    label: 'Obstacles',
    description: 'Bright areas are walls the fluid flows around (paint them with Paint Mask).',
    color: '#9ad1ff',
    value: 'float',
  },
];

export const fluid: SimulationGenerator = {
  kind: 'simulation',
  id: 'fluid',
  name: 'Ink Fluid',
  category: 'simulation',
  description:
    'Incompressible 2D fluid (stable fluids) advecting ink: swirls, plumes and rolls. Drag to push the fluid.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  create: (gpu) =>
    new GridSimulation(gpu, 'fluid', PARAMS, {
      inputs: INPUTS,
      extraState: true,
      seed,
      step: [
        { label: 'advect', source: `${obstacles}\n${advect}` },
        {
          label: 'pressure',
          source: `${obstacles}\n${pressure}`,
          repeat: (p: ParamValues) => getNumber(p, 'pressureIterations', 20),
        },
        { label: 'project', source: `${obstacles}\n${project}` },
      ],
      render,
    }),
  groups: [
    {
      name: 'Flow',
      icon: 'flow',
      summary: (v) =>
        `${['Stir', 'Plume', 'Shear', 'Brush'][Number(v.force)] ?? ''} · ${Number(v.stirStrength).toFixed(1)}`,
    },
  ],
  presets: [
    {
      name: 'Marbled ink',
      values: { force: 0, stirStrength: 1, dyeStart: 1, dyeBands: 8, inkContrast: 3 },
    },
    {
      name: 'Smoke plume',
      values: { force: 1, stirStrength: 1.5, dyeStart: 0, dissipation: 1, inkContrast: 1.2 },
    },
    {
      name: 'Kelvin–Helmholtz',
      values: { force: 2, stirStrength: 1.2, dyeStart: 1, dyeBands: 2, inkContrast: 2 },
    },
    {
      name: 'Vortex soup',
      values: { force: 0, stirStrength: 2.5, stirScale: 5, view: 2, inkContrast: 2 },
    },
    {
      name: 'Paint it yourself',
      values: { force: 3, dyeStart: 0, dissipation: 0.1, brushSize: 0.05 },
    },
    {
      name: 'Colored inks',
      values: {
        force: 0,
        stirStrength: 1,
        dyeStart: 1,
        dyeBands: 9,
        inkContrast: 3,
        colorInk: true,
      },
      post: { colorMode: 0 },
    },
    {
      name: 'Silky clouds',
      values: { force: 0, stirStrength: 0.6, dyeStart: 3, viscosity: 0.6, inkContrast: 1 },
    },
  ],
  featuredPreset: 'Marbled ink',
};
