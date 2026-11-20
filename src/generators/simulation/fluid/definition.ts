import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import { getNumber } from '../../../params/values';
import type { ParamDef, ParamValues } from '../../../params/types';
import advect from './advect.frag?raw';
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
  param.select('view', 'View', ['Ink', 'Speed', 'Vorticity'], 0, { group: 'Ink' }),
  param.stepsPerFrame(1, 4),
  param.simResolution(256, [128, 256, 512]),
  param.brushSize(0.04),
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
  create: (gpu) =>
    new GridSimulation(gpu, 'fluid', PARAMS, {
      seed,
      step: [
        { label: 'advect', source: advect },
        {
          label: 'pressure',
          source: pressure,
          repeat: (p: ParamValues) => getNumber(p, 'pressureIterations', 20),
        },
        { label: 'project', source: project },
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
      name: 'Silky clouds',
      values: { force: 0, stirStrength: 0.6, dyeStart: 3, viscosity: 0.6, inkContrast: 1 },
    },
  ],
  featuredPreset: 'Marbled ink',
};
