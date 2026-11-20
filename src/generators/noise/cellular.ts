import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
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
};
