import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './lightning.glsl?raw';

export const lightning: ShaderGenerator = {
  kind: 'shader',
  id: 'lightning',
  name: 'Lightning',
  category: 'light',
  description: 'Electric bolts with sharp jumps or smooth motion.',
  animated: true,
  fragment,
  params: [
    param.int('bolts', 'Bolts', 2, 1, 6),
    param.float('amplitude', 'Amplitude', 0.2, 0, 1.5),
    param.float('frequency', 'Frequency', 1, 0.5, 8),
    param.int('octaves', 'Jaggedness', 8, 1, 8),
    param.float('thickness', 'Thickness', 0.01, 0.001, 0.08),
    param.float('glow', 'Glow', 0.4, 0, 0.6),
    param.bool('pinEnds', 'Pin ends', true),
    param.bool('restrike', 'Smooth Movement', true, {
      group: 'Animation',
      invertedCheckbox: true,
      description: 'Use continuous movement between frames.',
    }),
    param.float('strikeRate', 'Strikes / s', 4, 0, 30, {
      group: 'Animation',
      visibleWhen: (values) => values.restrike !== false,
    }),
    param.float('waveSpeed', 'Wave speed', 0.2, 0, 2, {
      group: 'Animation',
      visibleWhen: (values) => values.restrike === false,
    }),
  ],
  defaultPost: { alphaMode: 1 },
  // Defaults = the Arc look (first preset, browser thumbnail).
  presets: [
    {
      name: 'Arc',
      values: { bolts: 2, amplitude: 0.2, frequency: 1, octaves: 8, thickness: 0.01, glow: 0.4 },
    },
    {
      name: 'Single strike',
      values: { bolts: 1, amplitude: 0.4, thickness: 0.02, glow: 0.3, strikeRate: 2 },
    },
    {
      name: 'Storm web',
      values: {
        bolts: 5,
        amplitude: 0.8,
        frequency: 4,
        thickness: 0.006,
        glow: 0.1,
        strikeRate: 12,
      },
    },
  ],
  featuredPreset: 'Arc',
};
