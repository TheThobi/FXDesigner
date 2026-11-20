import type { Preset } from '../../../params/types';

/**
 * Feed/kill pairs for classic Gray-Scott regimes (Pearson classification, values as used by
 * Karl Sims / mrob's xmorphia with dA:dB = 2:1). The f/k map is scale invariant, so these hold
 * at any resolution; only the pattern size changes with diffusion rates.
 */
/** A pure f/k regime: uniform parameters, isotropic diffusion. */
function regime(name: string, feed: number, kill: number): Preset {
  return { name, values: { feed, kill, mapMode: 0, anisotropy: 0 } };
}

export const RD_PRESETS: readonly Preset[] = [
  regime('Coral growth (Sims default)', 0.055, 0.062),
  regime('Mitosis', 0.0367, 0.0649),
  regime('Spots / solitons', 0.03, 0.062),
  regime('Worms', 0.078, 0.061),
  regime('Maze', 0.029, 0.057),
  regime('Holes', 0.039, 0.058),
  regime('Fingerprint', 0.037, 0.06),
  regime('Chaos', 0.026, 0.051),
  regime('Pulsating', 0.025, 0.06),
  regime('U-Skate world', 0.062, 0.0609),
  {
    name: 'Parameter map (f across X, k across Y)',
    values: {
      feed: 0.055,
      kill: 0.06,
      mapMode: 1,
      anisotropy: 0,
      feedSpread: 0.045,
      killSpread: 0.012,
      seedMode: 2,
    },
  },
  {
    name: 'Radial transition',
    values: {
      feed: 0.045,
      kill: 0.062,
      mapMode: 2,
      anisotropy: 0,
      feedSpread: 0.02,
      killSpread: 0.003,
      seedMode: 2,
    },
  },
  {
    name: 'Swirling stripes (anisotropic)',
    values: { feed: 0.037, kill: 0.06, mapMode: 0, anisotropy: 0.6, directionMode: 1, seedMode: 2 },
  },
];
