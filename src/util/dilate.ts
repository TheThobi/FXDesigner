/**
 * Dilation (padding) of straight RGBA8 pixels, in place: transparent pixels take the average
 * color of their solid neighbours, ring after ring, up to `padding` pixels; alpha is kept.
 * Mipmaps of alpha-cutout sprites then blend the sprite's own colors at the edges instead of
 * black or stray colors (same idea as the Dilate node, on exported frames).
 */
export function dilatePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  padding: number,
  /** Alpha above this (0…255) counts as solid. */
  threshold = 2,
): void {
  const n = width * height;
  // 1 = holds a color (solid or already filled).
  let filled = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (pixels[i * 4 + 3]! > threshold) filled[i] = 1;
  for (let ring = 0; ring < padding; ring++) {
    const next = filled.slice();
    let grew = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (filled[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width || (dx === 0 && dy === 0)) continue;
            const j = yy * width + xx;
            if (!filled[j]) continue;
            r += pixels[j * 4]!;
            g += pixels[j * 4 + 1]!;
            b += pixels[j * 4 + 2]!;
            count++;
          }
        }
        if (!count) continue;
        pixels[i * 4] = r / count;
        pixels[i * 4 + 1] = g / count;
        pixels[i * 4 + 2] = b / count;
        next[i] = 1;
        grew = true;
      }
    }
    filled = next;
    if (!grew) break;
  }
}
