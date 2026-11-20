import {
  GENERATOR_FAMILIES,
  type GeneratorCategory,
  type GeneratorDefinition,
} from '../engine/generator';
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
import { bzReaction } from './simulation/bz-reaction/definition';
import { flowmapPainter } from './simulation/flowmap/definition';
import { cyclicAutomaton } from './simulation/cyclic-automaton/definition';
import { marbling } from './simulation/marbling/definition';
import { physarum } from './simulation/physarum/definition';
import { reactionDiffusion } from './simulation/reaction-diffusion/definition';
import { lenia } from './simulation/lenia/definition';
import { lifeAutomata } from './simulation/life/definition';
import { crystalGrowth } from './simulation/crystal/definition';
import { fluid } from './simulation/fluid/definition';
import { STYLIZED_GENERATORS } from './stylized';
import { MORE_NOISES } from './noise/more';
import { PARTICLES } from './particle';
import { UNDERWORLD_GENERATORS } from './underworld';
import { MORE_PATTERNS } from './pattern/more';

/** All generators, in display order. Add new ones here. */
export const GENERATORS: readonly GeneratorDefinition[] = [
  reactionDiffusion,
  flowmapPainter,
  physarum,
  marbling,
  cyclicAutomaton,
  bzReaction,
  lenia,
  fluid,
  crystalGrowth,
  lifeAutomata,
  ...UNDERWORLD_GENERATORS,
  ...PARTICLES,
  ...STYLIZED_GENERATORS,
  fractalNoise,
  cellular,
  domainWarp,
  caustics,
  ...MORE_NOISES,
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
  ...MORE_PATTERNS,
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

export interface GeneratorFamilyGroup {
  readonly id: string;
  readonly label: string;
  readonly sections: readonly {
    readonly category: GeneratorCategory;
    readonly generators: readonly GeneratorDefinition[];
  }[];
}

/** Generators grouped by family, then category (browser order); empty groups are omitted. */
export function generatorsByFamily(): GeneratorFamilyGroup[] {
  const byCategory = generatorsByCategory();
  return GENERATOR_FAMILIES.map((f) => ({
    id: f.id,
    label: f.label,
    sections: f.categories
      .map((category) => ({ category, generators: byCategory.get(category) ?? [] }))
      .filter((s) => s.generators.length > 0),
  })).filter((f) => f.sections.length > 0);
}
