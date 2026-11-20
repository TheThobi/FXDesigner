import { readStorage, writeStorage } from '../util/storage';
import { h } from './dom';

export interface SplitterOptions {
  /** CSS custom property on `container` holding the panel width (px). */
  readonly cssVar: string;
  /** Which side the resized panel is on relative to the splitter. */
  readonly side: 'left' | 'right';
  readonly min: number;
  readonly max: number;
  readonly defaultWidth: number;
  readonly storageKey: string;
}

/** Draggable vertical handle that resizes a docked panel; width persists, dblclick resets. */
export function createSplitter(container: HTMLElement, opts: SplitterOptions): HTMLElement {
  const apply = (w: number) => {
    const width = Math.round(Math.min(opts.max, Math.max(opts.min, w)));
    container.style.setProperty(opts.cssVar, `${width}px`);
    return width;
  };
  let width = apply(Number(readStorage(opts.storageKey)) || opts.defaultWidth);

  const handle = h('div', {
    class: `splitter splitter-${opts.side}`,
    role: 'separator',
    'aria-orientation': 'vertical',
    title: 'Drag to resize · double-click to reset',
  });
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      width = apply(opts.side === 'left' ? startW + dx : startW - dx);
      window.dispatchEvent(new Event('resize'));
    };
    const up = () => {
      handle.classList.remove('dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      writeStorage(opts.storageKey, String(width));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  handle.addEventListener('dblclick', () => {
    width = apply(opts.defaultWidth);
    writeStorage(opts.storageKey, String(width));
  });
  return handle;
}
