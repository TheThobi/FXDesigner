import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import fragment from './fractal-noise.glsl?raw';

export const fractalNoise: ShaderGenerator = {
  kind: 'shader',
  id: 'fractal-noise',
  name: 'Fractal Noise',
  category: 'noise',
  description: 'Perlin-style gradient noise summed over octaves (fBm, turbulence, ridged).',
  animated: true,
  fragment,
  params: [
    param.select('noiseType', 'Type', ['fBm', 'Turbulence', 'Ridged']),
    param.float('scale', 'Scale', 4, 1, 32),
    param.int('octaves', 'Octaves', 5, 1, 10),
    param.float('lacunarity', 'Lacunarity', 2, 1.5, 4, {
      description: 'Frequency multiplier between octaves (rounded when seamless).',
    }),
    param.float('gain', 'Gain', 0.5, 0.1, 0.9, {
      description: 'Amplitude multiplier between octaves.',
    }),
    param.bool('tileable', 'Seamless', true, {
      description: 'Rounds scale/lacunarity so the texture tiles.',
    }),
    param.speed(0),
  ],
  presets: [
    { name: 'Clouds', values: { noiseType: 0, scale: 3, octaves: 7, gain: 0.5 } },
    { name: 'Marble veins', values: { noiseType: 1, scale: 2, octaves: 6, gain: 0.55 } },
    { name: 'Mountains', values: { noiseType: 2, scale: 3, octaves: 8, gain: 0.5 } },
  ],
};
