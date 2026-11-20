export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Number of decimals needed to display values quantized to `step`. */
export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || step >= 1) return 0;
  return Math.min(6, Math.ceil(-Math.log10(step) - 1e-9));
}

/** A "round" slider step giving roughly 200-2000 positions over [min, max]. */
export function niceStep(min: number, max: number): number {
  const range = Math.abs(max - min);
  if (range === 0) return 1;
  return Math.pow(10, Math.floor(Math.log10(range / 200)));
}
