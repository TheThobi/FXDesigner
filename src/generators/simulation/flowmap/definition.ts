import type { SimulationGenerator } from '../../../engine/generator';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PATTERNS = ['Water (lit)', 'Water normal map', 'Checker', 'Grid', 'Noise'] as const;

const PARAMS: readonly ParamDef[] = [
  param.toggle('preview', 'Preview', true, 'Show the flow applied to a pattern.'),
  param.select('previewLayout', 'Layout', ['Split (drag the bar)', 'Full'], 0, {
    group: 'Preview',
  }),
  param.float('splitPos', 'Split position', 0.5, 0.02, 0.98, { group: 'Preview' }),
  param.select('previewPattern', 'Pattern', PATTERNS, 0, { group: 'Preview' }),
  param.float('previewScale', 'Pattern scale', 4, 1, 32, { group: 'Preview' }),
  param.float('flowSpeed', 'Cycle speed', 0.6, 0, 3, {
    group: 'Preview',
    description: 'Flow cycles per second (the shader loops with two blended phases).',
  }),
  param.float('flowStrength', 'Flow strength', 1, 0, 4, { group: 'Preview' }),
  param.bool('arrows', 'Direction arrows', true, {
    group: 'Flowmap',
    description: 'Overlay on the encoded map (never exported).',
  }),
  param.int('arrowDensity', 'Arrow grid', 16, 4, 48, { group: 'Flowmap' }),
  param.bool('flipGreen', 'Flip green (DirectX)', false, {
    group: 'Flowmap',
    description: 'Encode +Y as down, as expected by DirectX-convention engines.',
  }),
  param.float('brushStrength', 'Flow magnitude', 1, 0, 1, { group: 'Brush' }),
  param.float('brushOpacity', 'Opacity', 0.6, 0.02, 1, { group: 'Brush' }),
  param.float('brushSoftness', 'Softness', 0.7, 0, 1, { group: 'Brush' }),
  param.brushSize(0.06),
  param.float('relax', 'Smoothing', 0.1, 0, 1, {
    group: 'Field',
    description: 'Continuously relaxes the field.',
  }),
  param.select('initial', 'Start from', ['Neutral', 'Fixed direction', 'Swirl', 'Curl noise'], 1, {
    group: 'Field',
    resetOnChange: true,
    description: 'Initial field, painted over. A gentle base flow keeps the preview moving.',
  }),
  param.float('baseStrength', 'Start strength', 0.35, 0, 1, {
    group: 'Field',
    resetOnChange: true,
  }),
  param.angle('baseAngle', 'Direction', 0, { group: 'Field', resetOnChange: true }),
  param.stepsPerFrame(1, 4),
  param.simResolution(256, [128, 256, 512]),
];

export const flowmapPainter: SimulationGenerator = {
  kind: 'simulation',
  id: 'flowmap-painter',
  name: 'Flowmap Painter',
  category: 'simulation',
  description:
    'Paint flow directions by dragging and watch them animate a water surface. Exports the encoded flowmap (RG = direction). Right-drag erases.',
  animated: true,
  params: PARAMS,
  create: (gpu) => new GridSimulation(gpu, 'flowmap-painter', PARAMS, { seed, step, render }),
  groups: [
    {
      name: 'Preview',
      icon: 'eye',
      description:
        'Two-phase looping flow applied to a pattern. Drag the bar in the viewport to move the split.',
      summary: (v) =>
        `${v.previewLayout === 1 ? 'Full' : 'Split'} · ${PATTERNS[Number(v.previewPattern)] ?? ''}`,
    },
    { name: 'Flowmap', icon: 'flow', description: 'Encoded map: R = +X, G = +Y, 0.5 = still.' },
    {
      name: 'Brush',
      icon: 'brush',
      description: 'Drag in the viewport; the stroke direction becomes the flow.',
    },
  ],
  // Exports and thumbnails always contain the plain encoded map.
  exportOverrides: { preview: false, arrows: false },
  split: {
    key: 'splitPos',
    visible: (v) => v.preview === true && v.previewLayout !== 1,
    labels: ['Flowmap', 'Preview'],
  },
  defaultPost: { colorMode: 0 },
  dataOutput: true,
  presets: [
    {
      name: 'River (lit water)',
      values: { initial: 1, baseStrength: 0.5, baseAngle: 0, previewPattern: 0, flowSpeed: 0.6 },
    },
    {
      name: 'Whirlpool',
      values: { initial: 2, baseStrength: 0.6, previewPattern: 0, previewScale: 5 },
    },
    {
      name: 'Turbulent curl',
      values: { initial: 3, baseStrength: 0.7, previewPattern: 1, flowStrength: 1.4 },
    },
    {
      name: 'Debug checker',
      values: { previewPattern: 2, previewScale: 8, arrows: true, arrowDensity: 24 },
    },
    { name: 'Paint from scratch', values: { initial: 0, relax: 0.05, brushSize: 0.08 } },
  ],
  featuredPreset: 'Whirlpool',
};
