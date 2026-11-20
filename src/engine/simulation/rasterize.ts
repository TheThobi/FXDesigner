/** Rasterizes text white on black, centered and scaled to fit ~80% of the width. */
export function rasterizeText(text: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const content = text.trim() || ' ';
  let fontSize = size * 0.4;
  ctx.font = `bold ${fontSize}px sans-serif`;
  const width = ctx.measureText(content).width;
  if (width > size * 0.8) fontSize *= (size * 0.8) / width;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(content, size / 2, size / 2);
  return canvas;
}
