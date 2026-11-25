import type { Capture, ChainStep, FrameRequest, Renderer } from '../engine/Renderer';

/** One image: a single generator, or a node with the chain of nodes it depends on. */
type ImageRequest = FrameRequest | readonly ChainStep[];
import type { FlipbookOptions } from '../ui/FlipbookDialog';
import { canvasToBlob } from '../util/download';
import { encodeGif } from '../util/gif';
import { flowIntensity, opticalFlow } from '../util/opticalFlow';
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
  /** Receives every frame's pixels (motion vectors need them). */
  keep?: Uint8ClampedArray[],
): Promise<Blob> {
  const { columns, rows } = opts;
  const [fw, fh] = frame;
  const capture = renderer.createCapture(fw, fh);
  try {
    const { canvas, ctx } = canvas2d(columns * fw, rows * fh);
    for (let i = 0; i < columns * rows; i++) {
      const pixels = capture.render(frameAt(i));
      keep?.push(pixels);
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

/**
 * Motion vector sheet of a flipbook (same layout): for each frame, the optical flow to the next
 * one (the last to the first when `loop`), in frame UV units with Y up, stored as
 * RG = 0.5 + vector / (2 × strength). `strength` (the largest component) goes to the material.
 */
export async function renderMotionVectors(
  frames: readonly Uint8ClampedArray[],
  frame: readonly [number, number],
  columns: number,
  loop: boolean,
): Promise<{ blob: Blob; strength: number }> {
  const [fw, fh] = frame;
  const rows = Math.ceil(frames.length / columns);
  const count = fw * fh;
  const intensity = frames.map((f) => flowIntensity(f, count));
  const flows: { u: Float32Array; v: Float32Array }[] = [];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? i + 1 : loop ? 0 : -1;
    flows.push(
      next >= 0
        ? opticalFlow(intensity[i]!, intensity[next]!, fw, fh)
        : (flows.at(-1) ?? { u: new Float32Array(count), v: new Float32Array(count) }),
    );
    await new Promise((r) => setTimeout(r, 0));
  }
  let strength = 0;
  for (const { u, v } of flows)
    for (let p = 0; p < count; p++)
      strength = Math.max(strength, Math.abs(u[p]! / fw), Math.abs(v[p]! / fh));
  strength = Math.max(0.001, Math.ceil(strength * 1000) / 1000);
  const { canvas, ctx } = canvas2d(columns * fw, rows * fh);
  flows.forEach(({ u, v }, i) => {
    const px = new Uint8ClampedArray(count * 4);
    for (let p = 0; p < count; p++) {
      px[p * 4] = Math.round((0.5 + u[p]! / fw / (2 * strength)) * 255);
      px[p * 4 + 1] = Math.round((0.5 - v[p]! / fh / (2 * strength)) * 255);
      px[p * 4 + 3] = 255;
    }
    ctx.putImageData(new ImageData(px, fw, fh), (i % columns) * fw, Math.floor(i / columns) * fh);
  });
  return { blob: await canvasToBlob(canvas), strength };
}

/** Video formats tried in order (WebM where supported, MP4 on Safari). */
const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

/** True when this browser can record a canvas to a video file. */
export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    VIDEO_TYPES.some((t) => MediaRecorder.isTypeSupported(t)) &&
    'captureStream' in HTMLCanvasElement.prototype
  );
}

/**
 * Records `count` frames as a video. MediaRecorder timestamps frames with the wall clock, so
 * frames are pushed in real time at `fps` (rendering must keep up; previews do).
 */
export async function recordVideo(
  renderer: Renderer,
  frame: readonly [number, number],
  count: number,
  fps: number,
  frameAt: (index: number) => ImageRequest,
): Promise<Blob> {
  const [fw, fh] = frame;
  const type = VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('Video recording is not supported by this browser');
  const capture = renderer.createCapture(fw, fh);
  const { canvas, ctx } = canvas2d(fw, fh);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const recorder = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: Math.round(fw * fh * fps * 0.25),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  try {
    recorder.start();
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      ctx.putImageData(new ImageData(capture.render(frameAt(i)), fw, fh), 0, 0);
      track?.requestFrame();
      const wait = start + ((i + 1) * 1000) / fps - performance.now();
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    capture.dispose();
  }
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return new Blob(chunks, { type: type.split(';')[0] });
}

/** Renders `count` frames offline and encodes them as a looping GIF at `fps`. */
export async function renderGif(
  renderer: Renderer,
  frame: readonly [number, number],
  count: number,
  fps: number,
  frameAt: (index: number) => ImageRequest,
): Promise<Blob> {
  const [fw, fh] = frame;
  const capture = renderer.createCapture(fw, fh);
  try {
    const frames: Uint8ClampedArray[] = [];
    for (let i = 0; i < count; i++) {
      frames.push(capture.render(frameAt(i)));
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    const bytes = encodeGif(frames, fw, fh, Math.max(2, Math.round(100 / fps)));
    return new Blob([bytes], { type: 'image/gif' });
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
