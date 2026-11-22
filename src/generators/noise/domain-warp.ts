import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './domain-warp.glsl?raw';

export const domainWarp: ShaderGenerator = {
  kind: 'shader',
  id: 'domain-warp',
  name: 'Domain Warp',
  category: 'noise',
  description: 'fBm sampled through layers of fBm displacement: marble, smoke, alien surfaces.',
  animated: true,
  fragment,
  params: [
    param.float('scale', 'Scale', 3, 1, 16),
    param.float('warp', 'Warp strength', 2, 0, 6),
    param.int('octaves', 'Octaves', 5, 1, 8),
    param.select('output', 'Output', ['Grayscale', 'Color (internal palette)']),
    param.bool('tileable', 'Seamless', true),
    param.speed(0.2, 2),
  ],
  presets: [
    {
      name: 'Strong warp',
      values: { warp: 3 },
      ramp: GRADIENTS.synthwave,
    },
    { name: 'Smoke wisps', values: { scale: 2, warp: 4, octaves: 6 } },
    { name: 'Liquid marble', values: { scale: 4, warp: 1.5, octaves: 4 } },
    { name: 'Wild', values: { scale: 6, warp: 6, octaves: 7 } },
  ],
  featuredPreset: 'Smoke wisps',
};
