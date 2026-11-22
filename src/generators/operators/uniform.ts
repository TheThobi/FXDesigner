import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './uniform.glsl?raw';

export const uniform: ShaderGenerator = {
  kind: 'shader',
  id: 'uniform',
  name: 'Uniform',
  category: 'operator',
  description: 'A single float value across the texture.',
  animated: false,
  dataOutput: true,
  defaultPost: { colorMode: 0 },
  fragment,
  params: [param.float('value', 'Value', 0.5, 0, 1, { limit: [0, 1] })],
  outputs: [
    { key: 'value', label: 'Value', description: 'Constant float.', color: '#6bb5ff', channel: 0 },
  ],
  presets: [
    { name: 'Black', values: { value: 0 } },
    { name: 'Mid gray', values: { value: 0.5 } },
    { name: 'White', values: { value: 1 } },
  ],
  featuredPreset: 'Mid gray',
};
