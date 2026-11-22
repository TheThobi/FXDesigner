import type { PreviewFraming } from '../app/library';
import { h } from './dom';
import { icon } from './icons';

/** Frames of the effect to choose the community preview from (one for static systems). */
export interface PreviewSource {
  readonly frames: readonly HTMLCanvasElement[];
  readonly animated: boolean;
  /** Time between two frames when the animation plays (ms). */
  readonly frameMs: number;
}

/** Images sent with a community version. */
export interface PreviewResult {
  /** Poster image (square). */
  readonly thumb: string;
  /** Hover animation: every frame side by side (animated systems), else null. */
  readonly preview: string | null;
  readonly previewFrames: number;
  readonly framing: PreviewFraming;
}

export const DEFAULT_FRAMING: PreviewFraming = {
  zoom: 1,
  cx: 0.5,
  cy: 0.5,
  frame: 0,
  background: 'checker',
};

const THUMB_SIZE = 256;
const STRIP_FRAME = 128;
const MAX_ZOOM = 6;

function paintBackground(
  ctx: CanvasRenderingContext2D,
  size: number,
  bg: PreviewFraming['background'],
) {
  if (bg === 'black' || bg === 'dark') {
    ctx.fillStyle = bg === 'black' ? '#000' : '#1e1e1e';
    ctx.fillRect(0, 0, size, size);
    return;
  }
  const cell = Math.max(4, Math.round(size / 24));
  for (let y = 0; y < size; y += cell)
    for (let x = 0; x < size; x += cell) {
      ctx.fillStyle = ((x + y) / cell) % 2 === 0 ? '#2a2a2a' : '#363636';
      ctx.fillRect(x, y, cell, cell);
    }
}

/** Draws `frame` framed by `f` into a `size` square at (`ox`, 0) of `ctx`. */
function drawFramed(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  f: PreviewFraming,
  size: number,
  ox = 0,
): void {
  ctx.save();
  ctx.translate(ox, 0);
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  paintBackground(ctx, size, f.background);
  const w = frame.width;
  const hgt = frame.height;
  // The shown window: a square of max(w, h) / zoom source pixels around the center.
  const side = Math.max(w, hgt) / f.zoom;
  const scale = size / side;
  const cx = f.cx * w;
  const cy = f.cy * hgt;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frame, size / 2 - cx * scale, size / 2 - cy * scale, w * scale, hgt * scale);
  ctx.restore();
}

/** Keeps the window inside the image where it can (centered on an axis it overflows). */
function clampFraming(f: PreviewFraming, frame: HTMLCanvasElement): PreviewFraming {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, f.zoom));
  const side = Math.max(frame.width, frame.height) / zoom;
  const axis = (c: number, len: number) => {
    const half = side / 2 / len;
    return half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, c));
  };
  return { ...f, zoom, cx: axis(f.cx, frame.width), cy: axis(f.cy, frame.height) };
}

function toDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

/** The images of a version framed by `framing` (no window: updates reuse the last framing). */
export function composePreview(source: PreviewSource, framing: PreviewFraming): PreviewResult {
  const first = source.frames[0]!;
  const f = clampFraming(
    { ...framing, frame: Math.min(framing.frame, source.frames.length - 1) },
    first,
  );
  const thumb = h('canvas', { width: THUMB_SIZE, height: THUMB_SIZE });
  drawFramed(thumb.getContext('2d')!, source.frames[f.frame] ?? first, f, THUMB_SIZE);
  let preview: string | null = null;
  const n = source.frames.length;
  if (source.animated && n > 1) {
    const strip = h('canvas', { width: STRIP_FRAME * n, height: STRIP_FRAME });
    const ctx = strip.getContext('2d')!;
    source.frames.forEach((frame, i) => drawFramed(ctx, frame, f, STRIP_FRAME, i * STRIP_FRAME));
    preview = toDataUrl(strip, 0.82);
  }
  return {
    thumb: toDataUrl(thumb, 0.9),
    preview,
    previewFrames: preview ? n : 0,
    framing: f,
  };
}

/**
 * Preview editor for a community publication: frame the effect (drag to move, wheel or slider
 * to zoom), pick the poster frame of an animation, the background; the animation plays as it
 * will on hover. Resolves with the images, or null when cancelled.
 */
export function openPreviewStudio(
  source: PreviewSource,
  initial: PreviewFraming = DEFAULT_FRAMING,
): Promise<PreviewResult | null> {
  return new Promise((resolve) => {
    const first = source.frames[0]!;
    let f = clampFraming(initial, first);
    let playing = source.animated;
    let shown = f.frame;
    let timer: ReturnType<typeof setInterval> | undefined;
    const VIEW = 360;
    const canvas = h('canvas', { class: 'studio-canvas', width: VIEW, height: VIEW });
    const ctx = canvas.getContext('2d')!;
    const draw = () => drawFramed(ctx, source.frames[shown] ?? first, f, VIEW);

    const zoom = h('input', { type: 'range', min: 1, max: MAX_ZOOM, step: 0.05 });
    const frame = h('input', { type: 'range', min: 0, max: source.frames.length - 1, step: 1 });
    const frameLabel = h('span', { class: 'studio-value' });
    const play = h('button', { type: 'button', class: 'btn btn-small' });
    const bgButtons = (['checker', 'black', 'dark'] as const).map((bg) =>
      h('button', {
        type: 'button',
        class: 'btn btn-small',
        text: bg === 'checker' ? 'Transparent' : bg === 'black' ? 'Black' : 'Dark',
        onclick: () => set({ background: bg }),
      }),
    );
    const sync = () => {
      zoom.value = String(f.zoom);
      frame.value = String(f.frame);
      frameLabel.textContent = `${f.frame + 1} / ${source.frames.length}`;
      play.replaceChildren(icon(playing ? 'pause' : 'play', 12), playing ? 'Pause' : 'Play');
      bgButtons.forEach((b, i) =>
        b.classList.toggle('active', ['checker', 'black', 'dark'][i] === f.background),
      );
      draw();
    };
    const set = (patch: Partial<PreviewFraming>) => {
      f = clampFraming({ ...f, ...patch }, first);
      if (patch.frame !== undefined) shown = f.frame;
      sync();
    };
    const animate = () => {
      clearInterval(timer);
      if (!playing) {
        shown = f.frame;
        draw();
        return;
      }
      timer = setInterval(() => {
        shown = (shown + 1) % source.frames.length;
        draw();
      }, source.frameMs);
    };
    play.addEventListener('click', () => {
      playing = !playing;
      animate();
      sync();
    });
    zoom.addEventListener('input', () => set({ zoom: Number(zoom.value) }));
    frame.addEventListener('input', () => {
      playing = false;
      animate();
      set({ frame: Number(frame.value) });
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      set({ zoom: f.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1) });
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      const start = [e.clientX, e.clientY, f.cx, f.cy] as const;
      const rect = canvas.getBoundingClientRect();
      // Screen pixels → source fraction (the window is max(w, h) / zoom source pixels).
      const side = Math.max(first.width, first.height) / f.zoom;
      const kx = side / rect.width / first.width;
      const ky = side / rect.height / first.height;
      const move = (ev: PointerEvent) =>
        set({
          cx: start[2] - (ev.clientX - start[0]) * kx,
          cy: start[3] - (ev.clientY - start[1]) * ky,
        });
      const up = () => {
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
    });

    const dialog = h('dialog', { class: 'dialog studio-dialog' });
    const finish = (result: PreviewResult | null) => {
      clearInterval(timer);
      dialog.close();
      resolve(result);
    };
    const row = (label: string, ...controls: HTMLElement[]) =>
      h(
        'div',
        { class: 'studio-row' },
        h('span', { class: 'studio-label', text: label }),
        ...controls,
      );
    dialog.append(
      h('h2', { text: 'Community preview' }),
      h(
        'div',
        { class: 'studio-body' },
        h(
          'div',
          { class: 'studio-view' },
          canvas,
          h('p', { class: 'studio-hint', text: 'Drag to move · wheel to zoom' }),
        ),
        h(
          'div',
          { class: 'studio-controls' },
          row('Zoom', zoom),
          ...(source.animated
            ? [row('Poster frame', frame, frameLabel), row('Animation', play)]
            : []),
          row('Background', h('div', { class: 'studio-buttons' }, ...bgButtons)),
          h('button', {
            type: 'button',
            class: 'btn btn-small',
            text: 'Reset framing',
            onclick: () => set({ zoom: 1, cx: 0.5, cy: 0.5 }),
          }),
          h('p', {
            class: 'studio-hint',
            text: source.animated
              ? 'The poster shows in the lists; the animation plays on hover.'
              : 'Shown in the community lists.',
          }),
        ),
      ),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => finish(null) }),
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          text: 'Use this preview',
          onclick: () => finish(composePreview(source, f)),
        }),
      ),
    );
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(null);
    });
    dialog.addEventListener('close', () => dialog.remove());
    // Nested above an open modal (Community window).
    const open = document.querySelectorAll('dialog[open]');
    (open[open.length - 1] ?? document.body).append(dialog);
    dialog.showModal();
    sync();
    animate();
  });
}
