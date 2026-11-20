import type { SimulationPointer } from '../engine/generator';
import { clamp } from '../util/math';
import { h } from './dom';
import { icon } from './icons';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;
const WHEEL_STEP = 1.15;

export interface ViewportCallbacks {
  /** Painting on the texture (simulations); null when released. */
  readonly onPointer: (pointer: SimulationPointer | null) => void;
  /** The split handle was dragged to `pos` (0..1 across the texture). */
  readonly onSplit: (pos: number) => void;
}

/**
 * Preview area: canvas over a checkerboard, floating toolbar slot, stats overlay, error
 * overlay, interaction hint, zoom & pan, optional split handle. Maps pointer positions to
 * texture uv (accounting for zoom, pan and tiling).
 *
 * Navigation: wheel = zoom at cursor; middle-drag, Alt+drag or drag outside the image = pan
 * (plain left-drag also pans when the generator isn't paintable); double-click = fit.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  /** Container for the floating viewport toolbar (filled by Toolbar). */
  readonly toolbarSlot: HTMLElement;
  /** Called when zoom changes (for the zoom readout). */
  onZoomChange: ((percent: number) => void) | null = null;
  private readonly stage: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly errorBox: HTMLPreElement;
  private readonly stats: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly splitHandle: HTMLElement;
  private readonly zoomLabel: HTMLButtonElement;
  private readonly brushCursor: HTMLElement;
  /** Brush radius in texture uv (null = no brush preview). */
  private brushRadius: number | null = null;
  private viewTiles = 1;
  private paintable = false;
  private zoom = 1;
  private pan: [number, number] = [0, 0];

  constructor(
    readonly element: HTMLElement,
    private readonly callbacks: ViewportCallbacks,
  ) {
    this.canvas = h('canvas', { class: 'preview-canvas', width: 512, height: 512 });
    this.errorBox = h('pre', { class: 'error-overlay', hidden: true });
    this.stats = h('div', { class: 'vp-stats' });
    this.hint = h('div', { class: 'vp-hint', hidden: true });
    this.toolbarSlot = h('div', { class: 'vp-toolbar' });
    this.splitHandle = h(
      'div',
      { class: 'split-handle', hidden: true, title: 'Drag to move the split' },
      h('span', { class: 'split-label left' }),
      h('span', { class: 'split-grip' }),
      h('span', { class: 'split-label right' }),
    );
    this.brushCursor = h('div', { class: 'brush-cursor', hidden: true });
    this.frame = h(
      'div',
      { class: 'canvas-frame' },
      this.canvas,
      this.brushCursor,
      this.splitHandle,
    );
    this.stage = h('div', { class: 'vp-stage' }, this.frame);

    this.zoomLabel = h('button', {
      class: 'vp-btn vp-zoom-label',
      title: 'Zoom (100% = one texel per screen pixel). Click: 1:1',
      onclick: () => this.setPixelZoom(1),
    });
    const zoomBar = h(
      'div',
      { class: 'vp-zoom' },
      h(
        'div',
        { class: 'vp-group' },
        h(
          'button',
          { class: 'vp-btn', title: 'Zoom out (−)', onclick: () => this.zoomBy(1 / 1.5) },
          icon('zoomOut', 14),
        ),
        this.zoomLabel,
        h(
          'button',
          { class: 'vp-btn', title: 'Zoom in (+)', onclick: () => this.zoomBy(1.5) },
          icon('zoomIn', 14),
        ),
        h(
          'button',
          { class: 'vp-btn', title: 'Fit (F or double-click)', onclick: () => this.fit() },
          icon('fit', 14),
        ),
      ),
    );
    element.append(this.stage, this.errorBox, this.toolbarSlot, zoomBar, this.stats, this.hint);
    this.bindPointer();
    this.bindNavigation();
    this.bindSplit();
    new ResizeObserver(() => this.layoutFrame()).observe(this.stage);
    this.layoutFrame();
  }

  /** Short visual feedback when the content changes (generator switch). */
  pulse(): void {
    this.frame.classList.remove('pulse');
    void this.frame.offsetWidth; // restart the animation
    this.frame.classList.add('pulse');
  }

  setViewTiles(n: number): void {
    this.viewTiles = n;
  }

  /** Whether left-drag paints (simulations) or pans. */
  setPaintable(paintable: boolean): void {
    this.paintable = paintable;
    this.stage.classList.toggle('pannable', !paintable);
  }

  setError(message: string | null): void {
    this.errorBox.hidden = message === null;
    this.errorBox.textContent = message ?? '';
  }

  setStats(text: string): void {
    this.stats.textContent = text;
  }

  setHint(text: string | null): void {
    this.hint.hidden = text === null;
    this.hint.textContent = text ?? '';
  }

  /** Circle showing the brush footprint under the pointer (radius in texture uv). */
  setBrushRadius(radius: number | null): void {
    this.brushRadius = this.paintable ? radius : null;
    if (this.brushRadius === null) this.brushCursor.hidden = true;
  }

  private moveBrushCursor(e: PointerEvent): void {
    const r = this.brushRadius;
    if (r === null) return;
    const rect = this.canvas.getBoundingClientRect();
    const size = this.frame.offsetWidth; // untransformed: the cursor lives in frame space
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    const d = (2 * r * size) / this.viewTiles;
    this.brushCursor.hidden = false;
    this.brushCursor.style.width = `${d}px`;
    this.brushCursor.style.height = `${d}px`;
    this.brushCursor.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px)`;
    this.brushCursor.classList.toggle('erase', e.shiftKey || (e.buttons & 2) !== 0);
  }

  /** Shows the split handle at `pos` (0..1), or hides it (null). Hidden when tiled. */
  setSplit(pos: number | null, labels?: readonly [string, string]): void {
    const visible = pos !== null && this.viewTiles === 1;
    this.splitHandle.hidden = !visible;
    if (!visible) return;
    this.splitHandle.style.left = `${pos * 100}%`;
    const [left, right] = this.splitHandle.querySelectorAll('.split-label');
    if (left) left.textContent = labels?.[0] ?? '';
    if (right) right.textContent = labels?.[1] ?? '';
  }

  // ---- Zoom & pan ---------------------------------------------------------------------------

  fit(): void {
    this.zoom = 1;
    this.pan = [0, 0];
    this.applyTransform();
  }

  zoomBy(factor: number, clientX?: number, clientY?: number): void {
    const next = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const rect = this.stage.getBoundingClientRect();
    // Keep the point under the cursor (default: stage center) fixed.
    const cx = (clientX ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
    const cy = (clientY ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
    const k = next / this.zoom;
    this.pan = [cx - (cx - this.pan[0]) * k, cy - (cy - this.pan[1]) * k];
    this.zoom = next;
    this.applyTransform();
  }

  /** Zoom so one canvas pixel covers `ratio` CSS pixels (1 = 1:1). */
  setPixelZoom(ratio: number): void {
    const base = this.frame.offsetWidth;
    if (base <= 0) return;
    this.zoomBy((ratio * this.canvas.width) / (base * this.zoom));
  }

  /** Current zoom in percent of one texel per CSS pixel. */
  get pixelZoomPercent(): number {
    const base = this.frame.offsetWidth;
    return base > 0 ? (base * this.zoom * 100) / this.canvas.width : 100;
  }

  /** Re-applies the transform (e.g. after the canvas resolution changed). */
  refreshZoomLabel(): void {
    const pct = this.pixelZoomPercent;
    this.zoomLabel.textContent = `${pct >= 100 ? Math.round(pct) : pct.toFixed(pct < 10 ? 1 : 0)}%`;
    this.frame.classList.toggle('magnified', pct > 140);
    this.onZoomChange?.(pct);
  }

  /** Keeps the image square: the largest square fitting the stage's content box. */
  private layoutFrame(): void {
    const style = getComputedStyle(this.stage);
    const w =
      this.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const h =
      this.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const size = Math.max(64, Math.floor(Math.min(w, h)));
    this.frame.style.width = `${size}px`;
    this.frame.style.height = `${size}px`;
    this.applyTransform();
  }

  private applyTransform(): void {
    // Keep at least a corner of the image reachable.
    const w = this.frame.offsetWidth * this.zoom;
    const rect = this.stage.getBoundingClientRect();
    const limitX = (rect.width + w) / 2 - 32;
    const limitY = (rect.height + w) / 2 - 32;
    this.pan = [clamp(this.pan[0], -limitX, limitX), clamp(this.pan[1], -limitY, limitY)];
    this.frame.style.transform = `translate(${this.pan[0]}px, ${this.pan[1]}px) scale(${this.zoom})`;
    this.refreshZoomLabel();
  }

  private bindNavigation(): void {
    this.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const steps = clamp(-e.deltaY / 100, -4, 4);
        this.zoomBy(WHEEL_STEP ** steps, e.clientX, e.clientY);
      },
      { passive: false },
    );
    this.stage.addEventListener('dblclick', (e) => {
      if (!this.paintable || e.target !== this.canvas) this.fit();
    });
    this.stage.addEventListener('pointerdown', (e) => {
      const onImage = e.target === this.canvas;
      const pan = e.button === 1 || (e.button === 0 && (e.altKey || !onImage || !this.paintable));
      if (!pan) return;
      e.preventDefault();
      e.stopPropagation();
      this.stage.setPointerCapture(e.pointerId);
      this.stage.classList.add('panning');
      let last = [e.clientX, e.clientY];
      const move = (ev: PointerEvent) => {
        this.pan = [this.pan[0] + ev.clientX - last[0]!, this.pan[1] + ev.clientY - last[1]!];
        last = [ev.clientX, ev.clientY];
        this.applyTransform();
      };
      const up = () => {
        this.stage.classList.remove('panning');
        this.stage.removeEventListener('pointermove', move);
        this.stage.removeEventListener('pointerup', up);
        this.stage.removeEventListener('pointercancel', up);
      };
      this.stage.addEventListener('pointermove', move);
      this.stage.addEventListener('pointerup', up);
      this.stage.addEventListener('pointercancel', up);
    });
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') this.fit();
      else if (e.key === '+' || e.key === '=') this.zoomBy(1.5);
      else if (e.key === '-') this.zoomBy(1 / 1.5);
      else if (e.key === '1') this.setPixelZoom(1);
    });
  }

  private bindSplit(): void {
    this.splitHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.splitHandle.setPointerCapture(e.pointerId);
      this.splitHandle.classList.add('dragging');
      const move = (ev: PointerEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        const pos = clamp((ev.clientX - rect.left) / rect.width, 0.02, 0.98);
        this.splitHandle.style.left = `${pos * 100}%`;
        this.callbacks.onSplit(pos);
      };
      const up = () => {
        this.splitHandle.classList.remove('dragging');
        this.splitHandle.removeEventListener('pointermove', move);
        this.splitHandle.removeEventListener('pointerup', up);
      };
      this.splitHandle.addEventListener('pointermove', move);
      this.splitHandle.addEventListener('pointerup', up);
    });
  }

  private bindPointer(): void {
    // Last position (texture uv) and smoothed stroke velocity, for direction-aware brushes.
    let last: [number, number] | null = null;
    let velocity: [number, number] = [0, 0];
    let painting = false;
    const toPointer = (e: PointerEvent): SimulationPointer => {
      // getBoundingClientRect includes the zoom/pan transform.
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      const n = this.viewTiles;
      const wrap = (v: number) => (((v * n) % 1) + 1) % 1;
      const uv: [number, number] = [wrap(x), wrap(y)];
      if (last) {
        const d = (a: number, b: number) => a - b - Math.round(a - b); // wrapped delta
        velocity = [
          velocity[0] * 0.5 + d(uv[0], last[0]) * 0.5,
          velocity[1] * 0.5 + d(uv[1], last[1]) * 0.5,
        ];
      }
      last = uv;
      const erase = e.shiftKey || (e.buttons & 2) !== 0;
      return { uv, mode: erase ? 'erase' : 'paint', velocity };
    };
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.paintable || e.button === 1 || e.altKey) return;
      this.canvas.setPointerCapture(e.pointerId);
      painting = true;
      last = null;
      velocity = [0, 0];
      this.callbacks.onPointer(toPointer(e));
    });
    this.canvas.addEventListener('pointermove', (e) => {
      this.moveBrushCursor(e);
      if (painting && e.buttons !== 0) this.callbacks.onPointer(toPointer(e));
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.brushCursor.hidden = true;
    });
    const release = () => {
      if (!painting) return;
      painting = false;
      this.callbacks.onPointer(null);
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }
}
