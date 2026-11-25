import type { SimulationGenerator } from '../../../engine/generator';
import type { NodeInputDef } from '../../../engine/nodes';
import { GridSimulation } from '../../../engine/simulation/GridSimulation';
import { param } from '../../../params/define';
import type { ParamDef } from '../../../params/types';
import render from './render.frag?raw';
import seed from './seed.frag?raw';
import step from './step.frag?raw';

const PATTERNS = ['Water (lit)', 'Water normal map', 'Checker', 'Grid', 'Noise'] as const;

const INPUTS: readonly NodeInputDef[] = [
  {
    key: 'image',
    label: 'Image',
    description: 'Texture moved along the flow (Flowing image output).',
    color: '#e8e8e8',
  },
];

const PARAMS: readonly ParamDef[] = [
  param.select('output', 'Output', ['Flowmap (RG)', 'Input texture, flowing (RGBA)'], 0, {
    description: 'What the node passes on and exports. The preview never is.',
  }),
  param.bool('flipGreen', 'Flip green (DirectX)', false, {
    description: 'Encode +Y as down, as expected by DirectX-convention engines.',
    visibleWhen: (v) => Number(v.output ?? 0) === 0,
  }),
  param.float('flowSpeed', 'Cycle speed', 0.6, 0, 3, {
    group: 'Flow',
    description: 'Flow cycles per second (two blended phases loop).',
  }),
  param.float('flowStrength', 'Strength', 1, 0, 4, {
    group: 'Flow',
    description: 'How far the texture travels along the flow in one cycle.',
  }),
  param.bool('arrows', 'Direction arrows', true, {
    description: 'Display only, over the output while the preview is off (never passed on).',
  }),
  param.int('arrowDensity', 'Arrow grid', 16, 4, 48, {
    visibleWhen: (v) => v.arrows === true,
  }),
  param.toggle(
    'preview',
    'Preview',
    false,
    'Display only (never passed on): the flow applied to a texture, beside the output.',
  ),
  param.select('previewLayout', 'Layout', ['Split with the output', 'Full'], 0, {
    group: 'Preview',
  }),
  param.float('splitPos', 'Split position', 0.5, 0.02, 0.98, {
    group: 'Preview',
    visibleWhen: (v) => Number(v.previewLayout) === 0,
  }),
  param.select('previewPattern', 'Preview texture', PATTERNS, 0, {
    group: 'Preview',
    description: 'Replaced by the Image input when one is connected.',
  }),
  param.float('previewScale', 'Texture scale', 4, 1, 32, { group: 'Preview' }),
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
    'Paint flow directions by dragging (right-drag erases). Outputs the encoded flowmap ' +
    '(RG) or the Image input flowing along it; the preview is display only.',
  animated: true,
  params: PARAMS,
  inputs: INPUTS,
  outputs: [
    {
      key: 'rg',
      label: 'RG',
      description: 'The flow vectors (0.5 = still).',
      color: '#7ee081',
      channel: 5,
    },
    { key: 'r', label: 'R', description: 'Flow along X.', color: '#ff6b6b', channel: 0 },
    { key: 'g', label: 'G', description: 'Flow along Y.', color: '#7ee081', channel: 1 },
  ],
  create: (gpu) =>
    new GridSimulation(gpu, 'flowmap-painter', PARAMS, { seed, step, render, inputs: INPUTS }),
  groups: [
    {
      name: 'Flow',
      icon: 'flow',
      description: 'Motion of the flowing texture (output and preview).',
      summary: (v) => `${Number(v.flowSpeed).toFixed(1)}/s · ×${Number(v.flowStrength).toFixed(1)}`,
    },
    {
      name: 'Preview',
      icon: 'eye',
      description:
        'Display only: the flow applied to the Image input (or a test texture), beside the output. Drag the bar in the viewport to move the split.',
      summary: (v) =>
        `${v.previewLayout === 1 ? 'Full' : 'Split'} · ${PATTERNS[Number(v.previewPattern)] ?? ''}`,
    },
    {
      name: 'Brush',
      icon: 'brush',
      description: 'Drag in the viewport; the stroke direction becomes the flow.',
    },
  ],
  // The preview (layout, texture, arrows) shows on the card only: linked nodes, exports and
  // thumbnails receive the output alone.
  outputOverrides: { preview: false, arrows: false },
  split: {
    key: 'splitPos',
    visible: (v) => v.preview === true && v.previewLayout !== 1,
    labels: ['Output', 'Preview'],
  },
  defaultPost: { colorMode: 0 },
  dataOutput: true,
  presets: [
    {
      name: 'River (lit water)',
      values: {
        initial: 1,
        baseStrength: 0.5,
        baseAngle: 0,
        preview: true,
        previewPattern: 0,
        flowSpeed: 0.6,
      },
    },
    {
      name: 'Whirlpool',
      values: { initial: 2, baseStrength: 0.6, preview: true, previewPattern: 0, previewScale: 5 },
    },
    {
      name: 'Turbulent curl',
      values: {
        initial: 3,
        baseStrength: 0.7,
        preview: true,
        previewPattern: 1,
        flowStrength: 1.4,
      },
    },
    {
      name: 'Debug checker',
      values: { preview: true, previewPattern: 2, previewScale: 8, arrowDensity: 24 },
    },
    { name: 'Paint from scratch', values: { initial: 0, relax: 0.05, brushSize: 0.08 } },
  ],
  featuredPreset: 'Whirlpool',
};
