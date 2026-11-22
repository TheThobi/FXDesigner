import type { Capture, ChainStep, FrameRequest, Renderer } from '../engine/Renderer';

/** One image: a single generator, or a node with the chain of nodes it depends on. */
type ImageRequest = FrameRequest | readonly ChainStep[];
import type { FlipbookOptions } from '../ui/FlipbookDialog';
import { canvasToBlob } from '../util/download';
import { encodeGray16Png } from '../util/png16';

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

/** Edits captured straight RGBA8 pixels in place before encoding (e.g. channel flips). */
export type PixelEdit = (pixels: Uint8ClampedArray) => void;

/** Inverts the red and / or green channel (flowmap conventions differ between engines). */
export function flipChannels(flipRed: boolean, flipGreen: boolean): PixelEdit | undefined {
  if (!flipRed && !flipGreen) return undefined;
  return (pixels) => {
    for (let i = 0; i < pixels.length; i += 4) {
      if (flipRed) pixels[i] = 255 - pixels[i]!;
      if (flipGreen) pixels[i + 1] = 255 - pixels[i + 1]!;
    }
  };
}

/** Renders one `width`×`height` frame and encodes it as PNG. */
export async function renderPng(
  renderer: Renderer,
  req: ImageRequest,
  width: number,
  height: number,
  edit?: PixelEdit,
): Promise<Blob> {
  const capture = renderer.createCapture(width, height);
  try {
    const { canvas, ctx } = canvas2d(width, height);
    const pixels = capture.render(req);
    edit?.(pixels);
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    capture.dispose();
  }
}

/** Renders one frame's red channel as a 16-bit grayscale PNG (height maps). */
export async function renderPng16(
  renderer: Renderer,
  req: ImageRequest,
  width: number,
  height: number,
): Promise<Blob> {
  const capture = renderer.createCapture(width, height);
  try {
    return await encodeGray16Png(capture.renderRed(req), width, height);
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
  frame: readonly [number, number],
  frameAt: (index: number) => ImageRequest,
): Promise<Blob> {
  const { columns, rows } = opts;
  const [fw, fh] = frame;
  const capture = renderer.createCapture(fw, fh);
  try {
    const { canvas, ctx } = canvas2d(columns * fw, rows * fh);
    for (let i = 0; i < columns * rows; i++) {
      const pixels = capture.render(frameAt(i));
      ctx.putImageData(
        new ImageData(pixels, fw, fh),
        (i % columns) * fw,
        Math.floor(i / columns) * fh,
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
export function captureToDataUrl(capture: Capture, req: ImageRequest, edit?: PixelEdit): string {
  const { canvas, ctx } = canvas2d(capture.width, capture.height);
  const pixels = capture.render(req);
  edit?.(pixels);
  ctx.putImageData(new ImageData(pixels, capture.width, capture.height), 0, 0);
  return canvas.toDataURL('image/png');
}
