import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
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
};
