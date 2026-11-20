import { gradient, type GradientValue } from './gradient';

export interface GradientPreset {
  readonly name: string;
  readonly value: GradientValue;
}

export const GRADIENTS = {
  duskTeal: gradient(
    ['#0b0d17', 0],
    ['#263056', 0.3],
    ['#3f7c96', 0.55],
    ['#b9d9c9', 0.8],
    ['#fbf6e9', 1],
  ),
  linear: gradient(['#000000', 0], ['#ffffff', 1]),
  ember: gradient(
    ['#000000', 0],
    ['#5c0a00', 0.25],
    ['#d1301a', 0.45],
    ['#ff8c1a', 0.65],
    ['#ffd25e', 0.82],
    ['#ffffff', 1],
  ),
  magma: gradient(
    ['#000000', 0],
    ['#3b0f70', 0.2],
    ['#8c2981', 0.4],
    ['#de4968', 0.6],
    ['#fe9f6d', 0.8],
    ['#fcfdbf', 1],
  ),
  glacier: gradient(
    ['#000000', 0],
    ['#06204a', 0.3],
    ['#1d6fb8', 0.55],
    ['#7fd4ff', 0.8],
    ['#ffffff', 1],
  ),
  ultramarine: gradient(
    ['#000000', 0],
    ['#100040', 0.3],
    ['#3a3aff', 0.55],
    ['#9fdcff', 0.85],
    ['#ffffff', 1],
  ),
  amethyst: gradient(
    ['#000000', 0],
    ['#2a0050', 0.3],
    ['#9b30ff', 0.6],
    ['#ff8cff', 0.85],
    ['#ffffff', 1],
  ),
  acid: gradient(
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
  lagoon: gradient(
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
  terracotta: gradient(['#f5e6c8', 0], ['#e8a87c', 0.35], ['#c0392b', 0.6], ['#4a0e0e', 1]),
  hardStep: gradient(['#ffffff', 0], ['#ffffff', 0.45], ['#000000', 0.55], ['#000000', 1]),
  spectrum: gradient(
    ['#ff0000', 0],
    ['#ffff00', 0.17],
    ['#00ff00', 0.33],
    ['#00ffff', 0.5],
    ['#0000ff', 0.67],
    ['#ff00ff', 0.83],
    ['#ff0000', 1],
  ),
  synthwave: gradient(
    ['#12002b', 0],
    ['#5a0fc8', 0.2],
    ['#ff2e88', 0.4],
    ['#ff9e2c', 0.6],
    ['#f6ff4a', 0.8],
    ['#2cf6ff', 1],
  ),
  navySand: gradient(
    ['#0d1b2a', 0],
    ['#1b4965', 0.25],
    ['#f2e8cf', 0.5],
    ['#bc4749', 0.75],
    ['#e9c46a', 1],
  ),
  moss: gradient(
    ['#050a0a', 0],
    ['#0b3d3a', 0.3],
    ['#1fa38a', 0.6],
    ['#c8f560', 0.85],
    ['#ffffe0', 1],
  ),
  redHot: gradient(
    ['#000000', 0, 0],
    ['#111111', 0.2],
    ['#e63322', 0.45],
    ['#ff9b21', 0.7],
    ['#ffe14d', 1],
  ),
  saffron: gradient(
    ['#2b0a00', 0, 0],
    ['#c4260f', 0.3],
    ['#ff7a1a', 0.55],
    ['#ffd23f', 0.8],
    ['#fffbe6', 1],
  ),
  azure: gradient(['#0b3a6e', 0], ['#1565a8', 0.4], ['#43b4e6', 0.75], ['#e8fbff', 1]),
  lavender: gradient(['#2a2440', 0], ['#7b7fb8', 0.35], ['#c9d2f0', 0.65], ['#ffffff', 1]),
  cyanHaze: gradient(
    ['#000814', 0, 0],
    ['#003566', 0.3],
    ['#00b4d8', 0.6],
    ['#90e0ef', 0.8],
    ['#ffffff', 1],
  ),
  whiteFade: gradient(['#ffffff', 0, 0], ['#ffffff', 1, 1]),
} as const satisfies Record<string, GradientValue>;

/**
 * Ramp presets offered by the gradient editor. Names describe colors, never generators, so a
 * preset reads the same whatever it is applied to.
 */
export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { name: 'Linear 0 → 1', value: GRADIENTS.linear },
  { name: 'Dusk teal', value: GRADIENTS.duskTeal },
  { name: 'Firelight', value: GRADIENTS.ember },
  { name: 'Magma', value: GRADIENTS.magma },
  { name: 'Glacier', value: GRADIENTS.glacier },
  { name: 'Ultramarine', value: GRADIENTS.ultramarine },
  { name: 'Amethyst', value: GRADIENTS.amethyst },
  { name: 'Acid green', value: GRADIENTS.acid },
  { name: 'Sunset', value: GRADIENTS.sunset },
  { name: 'Lagoon', value: GRADIENTS.lagoon },
  { name: 'Gold', value: GRADIENTS.gold },
  { name: 'Terracotta', value: GRADIENTS.terracotta },
  { name: 'Hard step', value: GRADIENTS.hardStep },
  { name: 'Spectrum', value: GRADIENTS.spectrum },
  { name: 'Synthwave', value: GRADIENTS.synthwave },
  { name: 'Navy & sand', value: GRADIENTS.navySand },
  { name: 'Moss', value: GRADIENTS.moss },
  { name: 'Red hot', value: GRADIENTS.redHot },
  { name: 'Saffron', value: GRADIENTS.saffron },
  { name: 'Azure', value: GRADIENTS.azure },
  { name: 'Lavender mist', value: GRADIENTS.lavender },
  { name: 'Cyan haze', value: GRADIENTS.cyanHaze },
  { name: 'White, alpha fade', value: GRADIENTS.whiteFade },
];
