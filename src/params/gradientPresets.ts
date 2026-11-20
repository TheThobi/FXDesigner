import { gradient, type GradientValue } from './gradient';

export interface GradientPreset {
  readonly name: string;
  readonly value: GradientValue;
}

export const GRADIENTS = {
  grayscale: gradient(['#000000', 0], ['#ffffff', 1]),
  fire: gradient(
    ['#000000', 0],
    ['#5c0a00', 0.25],
    ['#d1301a', 0.45],
    ['#ff8c1a', 0.65],
    ['#ffd25e', 0.82],
    ['#ffffff', 1],
  ),
  heat: gradient(
    ['#000000', 0],
    ['#3b0f70', 0.2],
    ['#8c2981', 0.4],
    ['#de4968', 0.6],
    ['#fe9f6d', 0.8],
    ['#fcfdbf', 1],
  ),
  ice: gradient(
    ['#000000', 0],
    ['#06204a', 0.3],
    ['#1d6fb8', 0.55],
    ['#7fd4ff', 0.8],
    ['#ffffff', 1],
  ),
  electric: gradient(
    ['#000000', 0],
    ['#100040', 0.3],
    ['#3a3aff', 0.55],
    ['#9fdcff', 0.85],
    ['#ffffff', 1],
  ),
  magic: gradient(
    ['#000000', 0],
    ['#2a0050', 0.3],
    ['#9b30ff', 0.6],
    ['#ff8cff', 0.85],
    ['#ffffff', 1],
  ),
  toxic: gradient(
    ['#000000', 0],
    ['#0b3d0b', 0.3],
    ['#38c172', 0.6],
    ['#d4ff4f', 0.85],
    ['#ffffff', 1],
  ),
  sunset: gradient(
    ['#1a0b2e', 0],
    ['#7a1f5c', 0.35],
    ['#e8505b', 0.6],
    ['#f9a03f', 0.8],
    ['#fff1a8', 1],
  ),
  ocean: gradient(
    ['#001018', 0],
    ['#00384d', 0.35],
    ['#00809a', 0.65],
    ['#7ff0e0', 0.9],
    ['#ffffff', 1],
  ),
  gold: gradient(
    ['#1a1000', 0],
    ['#6b4500', 0.35],
    ['#c99a2e', 0.65],
    ['#ffe9a8', 0.9],
    ['#ffffff', 1],
  ),
  coral: gradient(['#f5e6c8', 0], ['#e8a87c', 0.35], ['#c0392b', 0.6], ['#4a0e0e', 1]),
  zebra: gradient(['#ffffff', 0], ['#ffffff', 0.45], ['#000000', 0.55], ['#000000', 1]),
  rainbow: gradient(
    ['#ff0000', 0],
    ['#ffff00', 0.17],
    ['#00ff00', 0.33],
    ['#00ffff', 0.5],
    ['#0000ff', 0.67],
    ['#ff00ff', 0.83],
    ['#ff0000', 1],
  ),
  whiteFade: gradient(['#ffffff', 0, 0], ['#ffffff', 1, 1]),
} as const satisfies Record<string, GradientValue>;

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { name: 'Grayscale', value: GRADIENTS.grayscale },
  { name: 'Fire', value: GRADIENTS.fire },
  { name: 'Heat', value: GRADIENTS.heat },
  { name: 'Ice', value: GRADIENTS.ice },
  { name: 'Electric', value: GRADIENTS.electric },
  { name: 'Magic', value: GRADIENTS.magic },
  { name: 'Toxic', value: GRADIENTS.toxic },
  { name: 'Sunset', value: GRADIENTS.sunset },
  { name: 'Ocean', value: GRADIENTS.ocean },
  { name: 'Gold', value: GRADIENTS.gold },
  { name: 'Coral', value: GRADIENTS.coral },
  { name: 'Zebra', value: GRADIENTS.zebra },
  { name: 'Rainbow', value: GRADIENTS.rainbow },
  { name: 'White fade (alpha)', value: GRADIENTS.whiteFade },
];
