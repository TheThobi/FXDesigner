import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import type { ParamDef } from '../../params/types';

export const COLOR_MODE = { source: 0, gradient: 1 } as const;
export const ALPHA_MODE = { opaque: 0, luminance: 1, gradient: 2, source: 3 } as const;
export const OUTPUT_MODE = { color: 0, normal: 1 } as const;

/** Post-processing applied to every generator's output (shared UI section "Output"). */
export const POST_PARAMS: readonly ParamDef[] = [
  param.select('colorMode', 'Color mode', ['Source', 'Gradient map'], COLOR_MODE.gradient, {
    group: 'Color',
    description: 'Gradient map remaps luminance through the color ramp.',
  }),
  param.gradient('gradient', 'Color ramp', GRADIENTS.grayscale, { group: 'Color' }),
  param.float('brightness', 'Brightness', 0, -1, 1, { group: 'Levels' }),
  param.float('contrast', 'Contrast', 1, 0, 4, { group: 'Levels' }),
  param.float('gamma', 'Gamma', 1, 0.1, 4, { group: 'Levels' }),
  param.bool('invert', 'Invert', false, { group: 'Levels' }),
  param.select(
    'alphaMode',
    'Alpha',
    ['Opaque', 'From luminance', 'From color ramp', 'From source'],
    0,
    {
      group: 'Alpha',
      description: 'How the exported alpha channel is computed.',
    },
  ),
  param.select('output', 'Output', ['Color', 'Normal map'], OUTPUT_MODE.color, {
    group: 'Output',
    description: 'Normal map derives a tangent-space normal map from luminance (height).',
  }),
  param.float('normalStrength', 'Normal strength', 2, 0, 10, { group: 'Output' }),
  param.bool('normalFlipY', 'Normal: DirectX (flip Y)', false, { group: 'Output' }),
];
