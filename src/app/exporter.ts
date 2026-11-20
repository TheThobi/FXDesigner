import type { Capture, FrameRequest, Renderer } from '../engine/Renderer';
import type { FlipbookOptions } from '../ui/FlipbookDialog';
import { canvasToBlob } from '../util/download';

function canvas2d(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  return { canvas, ctx };
}

/** Renders one frame at `size`² and encodes it as PNG. */
export async function renderPng(
  renderer: Renderer,
  req: FrameRequest,
  size: number,
): Promise<Blob> {
  const capture = renderer.createCapture(size, size);
  try {
    const { canvas, ctx } = canvas2d(size, size);
    ctx.putImageData(new ImageData(capture.render(req), size, size), 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    capture.dispose();
  }
}

/**
 * Renders a sprite sheet, frames laid out left-to-right then top-to-bottom.
 * `frameAt(index)` provides each frame's request (and may advance a simulation).
 */
export async function renderFlipbook(
  renderer: Renderer,
  opts: FlipbookOptions,
  frameAt: (index: number) => FrameRequest,
): Promise<Blob> {
  const { columns, rows, frameSize } = opts;
  const capture = renderer.createCapture(frameSize, frameSize);
  try {
    const { canvas, ctx } = canvas2d(columns * frameSize, rows * frameSize);
    for (let i = 0; i < columns * rows; i++) {
      const pixels = capture.render(frameAt(i));
      ctx.putImageData(
        new ImageData(pixels, frameSize, frameSize),
        (i % columns) * frameSize,
        Math.floor(i / columns) * frameSize,
      );
      // Yield periodically so the UI stays responsive on large sheets.
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }
    return await canvasToBlob(canvas);
  } finally {
    capture.dispose();
  }
}

/** Encodes one frame of an existing capture as a PNG data URL (thumbnails). */
export function captureToDataUrl(capture: Capture, req: FrameRequest): string {
  const { canvas, ctx } = canvas2d(capture.width, capture.height);
  ctx.putImageData(new ImageData(capture.render(req), capture.width, capture.height), 0, 0);
  return canvas.toDataURL('image/png');
}
