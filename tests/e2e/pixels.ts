import type { Locator, Page } from '@playwright/test';

export interface PixelProbe {
  /** Luminance (0-255) at fractional image coordinates (x right, y down). */
  lum(x: number, y: number): number;
  /** RGB (0-255) at fractional image coordinates. */
  rgb(x: number, y: number): [number, number, number];
  /** Standard deviation of luminance over a coarse grid (0 = flat image). */
  readonly stdDev: number;
  /** Number of distinct luminance levels (rounded to 4) over the sample grid. */
  readonly distinctTones: number;
  /** Fraction of the sample grid covered by its `n` most frequent levels. */
  dominantShare(n: number): number;
}

/** Screenshots `locator` and decodes it in the page to probe pixel values. */
export async function probe(page: Page, locator: Locator): Promise<PixelProbe> {
  const png = await locator.screenshot();
  const { width, height, data } = await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    return { width: bmp.width, height: bmp.height, data: Array.from(img.data) };
  }, Buffer.from(png).toString('base64'));

  const rgb = (x: number, y: number): [number, number, number] => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))));
    const py = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))));
    const i = (py * width + px) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };
  const lum = (x: number, y: number) => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))));
    const py = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))));
    const i = (py * width + px) * 4;
    return 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
  };
  const samples: number[] = [];
  for (let y = 0.05; y < 1; y += 0.05) for (let x = 0.05; x < 1; x += 0.05) samples.push(lum(x, y));
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const stdDev = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
  const levels = samples.map((v) => Math.round(v / 4));
  const distinctTones = new Set(levels).size;
  const counts = new Map<number, number>();
  for (const l of levels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const sorted = [...counts.values()].sort((a, b) => b - a);
  const dominantShare = (n: number) =>
    sorted.slice(0, n).reduce((a, b) => a + b, 0) / Math.max(1, levels.length);
  return { lum, rgb, stdDev, distinctTones, dominantShare };
}
