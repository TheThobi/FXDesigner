/**
 * Converts post values written in the pre-module format (document v1, and the shorthand used
 * by presets) to the module format: a module is enabled when its main value is set to an
 * "active" value, e.g. `{ posterize: 4 }` -> `{ posterizeOn: true, posterize: 4 }`, and an
 * explicit `gradient` becomes a per-generator ramp override.
 */
export function upgradeLegacyPost(raw: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const post: Record<string, unknown> = { ...raw };
  const num = (k: string) => (typeof post[k] === 'number' ? (post[k] as number) : undefined);

  const enable = (toggle: string, key: string, isOn: (v: number) => boolean) => {
    const v = num(key);
    if (v === undefined || toggle in post) return;
    post[toggle] = isOn(v);
    if (!isOn(v)) delete post[key];
  };
  enable('posterizeOn', 'posterize', (v) => v >= 2);
  enable('halftoneOn', 'halftone', (v) => v > 0);
  enable('pixelateOn', 'pixelate', (v) => v > 0);
  enable('outlineOn', 'outline', (v) => v > 0);
  enable('antialiasOn', 'antialias', (v) => v > 0);
  enable('lightingOn', 'lighting', (v) => v > 0);

  if (!('levelsOn' in post)) {
    const changed =
      (num('brightness') ?? 0) !== 0 ||
      (num('contrast') ?? 1) !== 1 ||
      (num('gamma') ?? 1) !== 1 ||
      post.invert === true;
    if (changed) post.levelsOn = true;
  }
  if (post.gradient !== undefined && !('overrideRamp' in post)) post.overrideRamp = true;

  for (const obsolete of ['paintRadius', 'strokes', 'strokeSize', 'strokeAngle', 'strokeFlow'])
    delete post[obsolete];
  return post;
}
