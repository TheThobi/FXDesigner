import type { ShaderGenerator } from '../../engine/generator';
import { param } from '../../params/define';
import { GRADIENTS } from '../../params/gradientPresets';
import fragment from './fractal-noise.glsl?raw';

export const fractalNoise: ShaderGenerator = {
  kind: 'shader',
  id: 'fractal-noise',
  name: 'Fractal Noise',
  category: 'noise',
  description:
    'Octave sums (fBm, turbulence, ridged) of Perlin, value, simplex, Worley or Perlin-Worley noise.',
  animated: true,
  fragment,
  // Value noise drifts (not a rotation): it keeps the crossfade.
  nativeLoop: (v) => Number(v.basis) !== 1,
  params: [
    param.select('noiseType', 'Fractal', ['fBm', 'Turbulence', 'Ridged']),
    param.select(
      'basis',
      'Basis',
      ['Perlin', 'Value', 'Simplex (not seamless)', 'Worley', 'Perlin-Worley'],
      0,
      {
        description: 'Noise summed at each octave.',
      },
    ),
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
    {
      name: 'Fine clouds',
      values: { noiseType: 0, octaves: 6 },
      ramp: GRADIENTS.glacier,
    },

    { name: 'Clouds', values: { noiseType: 0, scale: 3, octaves: 7, gain: 0.5 } },
    { name: 'Marble veins', values: { noiseType: 1, scale: 2, octaves: 6, gain: 0.55 } },
    { name: 'Mountains', values: { noiseType: 2, scale: 3, octaves: 8, gain: 0.5 } },
    { name: 'Billow clouds', values: { noiseType: 1, basis: 0, scale: 3, octaves: 6, gain: 0.55 } },
    { name: 'Rocky ridges', values: { noiseType: 2, basis: 4, scale: 5, octaves: 7, gain: 0.55 } },
    { name: 'Cell bubbles', values: { noiseType: 0, basis: 3, scale: 6, octaves: 3, gain: 0.4 } },
    { name: 'Soft value', values: { basis: 1, scale: 8, octaves: 4 } },
  ],
  featuredPreset: 'Rocky ridges',
};
