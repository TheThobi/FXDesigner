export const MAX_SEED = 9999;

export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}
