import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './cellular.glsl?raw';

export const cellular: ShaderGenerator = {
  kind: 'shader',
  id: 'cellular',
  name: 'Cellular',
  category: 'noise',
  description: 'Worley / Voronoi noise: distances, cell edges, flat cells, stones.',
  animated: true,
  fragment,
  params: [
    param.select('mode', 'Output', ['Distance F1', 'Distance F2', 'Edges', 'Flat cells', 'Stones']),
    param.float('scale', 'Scale', 6, 1, 32),
    param.float('jitter', 'Jitter', 1, 0, 1, {
      description: '0 = regular grid, 1 = fully random.',
    }),
    param.select('metric', 'Metric', ['Euclidean', 'Manhattan', 'Chebyshev']),
    param.float('edgeWidth', 'Edge width', 0.08, 0, 0.5),
    param.bool('tileable', 'Seamless', true),
    param.speed(0, 2),
  ],
  presets: [
    {
      name: 'Stained glass',
      values: { mode: 4, edgeWidth: 0.12 },
      ramp: GRADIENTS.spectrum,
    },
    {
      name: 'Flat cells',
      values: { mode: 3 },
      ramp: GRADIENTS.moss,
    },
    { name: 'Cracked earth', values: { mode: 2, scale: 5, jitter: 0.9, edgeWidth: 0.05 } },
    { name: 'Pebbles', values: { mode: 4, scale: 7, jitter: 1 } },
    { name: 'Chebyshev crystals', values: { mode: 1, metric: 2, scale: 6 } },
    { name: 'Organic cells', values: { mode: 0, scale: 10, jitter: 0.8 } },
  ],
  featuredPreset: 'Pebbles',
};
