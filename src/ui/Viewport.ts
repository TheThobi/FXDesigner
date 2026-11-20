import type { SimulationPointer } from '../engine/generator';
import { h } from './dom';

/** Preview area: canvas, error overlay, status line and pointer → texture-uv mapping. */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  private readonly errorBox: HTMLPreElement;
  private readonly status: HTMLElement;
  private readonly hint: HTMLElement;
  private viewTiles = 1;

  constructor(
    readonly element: HTMLElement,
    private readonly onPointer: (pointer: SimulationPointer | null) => void,
  ) {
    this.canvas = h('canvas', { class: 'preview-canvas', width: 512, height: 512 });
    this.errorBox = h('pre', { class: 'error-overlay', hidden: true });
    this.status = h('div', { class: 'status-line' });
    this.hint = h('div', { class: 'viewport-hint', hidden: true });
    const frame = h('div', { class: 'canvas-frame' }, this.canvas, this.errorBox);
    element.append(frame, this.hint, this.status);
    this.bindPointer();
  }

  setViewTiles(n: number): void {
    this.viewTiles = n;
  }

  setError(message: string | null): void {
    this.errorBox.hidden = message === null;
    this.errorBox.textContent = message ?? '';
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setHint(text: string | null): void {
    this.hint.hidden = text === null;
    this.hint.textContent = text ?? '';
  }

  private bindPointer(): void {
    const toPointer = (e: PointerEvent): SimulationPointer => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      const n = this.viewTiles;
      const wrap = (v: number) => (((v * n) % 1) + 1) % 1;
      const erase = e.shiftKey || (e.buttons & 2) !== 0;
      return { uv: [wrap(x), wrap(y)], mode: erase ? 'erase' : 'paint' };
    };
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.onPointer(toPointer(e));
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.buttons !== 0) this.onPointer(toPointer(e));
    });
    const release = () => this.onPointer(null);
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }
}
