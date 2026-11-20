import type { GeneratorCategory, GeneratorDefinition } from '../engine/generator';
import { explosion } from './fire/explosion';
import { flame } from './fire/flame';
import { smoke } from './fire/smoke';
import { beam } from './light/beam';
import { flare } from './light/flare';
import { glow } from './light/glow';
import { lightRays } from './light/light-rays';
import { lightning } from './light/lightning';
import { ring } from './light/ring';
import { caustics } from './noise/caustics';
import { cellular } from './noise/cellular';
import { domainWarp } from './noise/domain-warp';
import { fractalNoise } from './noise/fractal-noise';
import { bricks } from './pattern/bricks';
import { gradientGenerator } from './pattern/gradient';
import { magicCircle } from './pattern/magic-circle';
import { polygon } from './pattern/polygon';
import { tiles } from './pattern/tiles';
import { reactionDiffusion } from './reaction-diffusion/definition';

/** All generators, in display order. Add new ones here. */
export const GENERATORS: readonly GeneratorDefinition[] = [
  reactionDiffusion,
  fractalNoise,
  cellular,
  domainWarp,
  caustics,
  glow,
  flare,
  ring,
  lightRays,
  beam,
  lightning,
  flame,
  explosion,
  smoke,
  gradientGenerator,
  tiles,
  polygon,
  magicCircle,
  bricks,
];

const BY_ID = new Map(GENERATORS.map((g) => [g.id, g]));

export const DEFAULT_GENERATOR_ID = reactionDiffusion.id;

export function getGenerator(id: string): GeneratorDefinition | undefined {
  return BY_ID.get(id);
}

export function generatorsByCategory(): Map<GeneratorCategory, GeneratorDefinition[]> {
  const out = new Map<GeneratorCategory, GeneratorDefinition[]>();
  for (const g of GENERATORS) {
    const list = out.get(g.category) ?? [];
    list.push(g);
    out.set(g.category, list);
  }
  return out;
}
