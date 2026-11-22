import type { FloatParam, IntParam, ParamValue } from '../../params/types';
import { clamp, decimalsForStep, niceStep } from '../../util/math';
import { numericLimits } from '../../params/values';
import { h } from '../dom';
import type { ChangeHandler, Control } from './types';

export function stepFor(def: FloatParam | IntParam): number {
  if (def.type === 'int') return 1;
  return def.step ?? niceStep(def.min, def.max);
}

const DRAG_THRESHOLD_PX = 3;

/**
 * Unreal-style numeric field: the box shows the value over a fill bar (position in range).
 *  - drag horizontally to scrub (Shift = fine, Ctrl = coarse),
 *  - click without dragging to type a value (Enter commits, Escape cancels),
 *  - arrow up/down while editing nudges by one step.
 */
export function numberControl(
  def: FloatParam | IntParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  const step = stepFor(def);
  const decimals = decimalsForStep(step);
  const [lo, hi] = numericLimits(def);
  /** Scrubbing stays in the slider range; typed values may go up to the limits. */
  const quantize = (v: number, typed = false) => {
    const q = def.type === 'int' ? Math.round(v) : Math.round(v / step) * step;
    const n = Number(q.toFixed(Math.max(decimals, 0) + 2));
    return typed ? clamp(n, lo, hi) : clamp(n, def.min, def.max);
  };
  const unit = def.unit ?? '';
  const format = (v: number) => (def.type === 'int' ? String(Math.round(v)) : v.toFixed(decimals));
  const display = (v: number) => `${format(v)}${unit ? (unit.length > 1 ? ` ${unit}` : unit) : ''}`;

  const input = h('input', {
    type: 'text',
    inputMode: 'decimal',
    class: 'num',
    spellcheck: false,
    'aria-label': def.label,
  });
  const box = h(
    'div',
    {
      class: 'spin',
      title: `Drag to scrub · click to type (up to ${hi}${def.min < 0 ? `, down to ${lo}` : ''})`,
    },
    input,
  );
  let value = typeof initial === 'number' ? initial : def.default;

  const show = (v: number) => {
    value = v;
    input.value = document.activeElement === input ? format(v) : display(v);
    const t = (v - def.min) / (def.max - def.min || 1);
    box.style.setProperty('--fill', `${Math.min(1, Math.max(0, t)) * 100}%`);
    box.classList.toggle('over-range', v > def.max || v < def.min);
  };
  const commit = (v: number, typed = false) => {
    const q = quantize(v, typed);
    show(q);
    onChange(q);
  };

  let drag: { x: number; start: number; moved: boolean; id: number } | null = null;
  box.addEventListener('pointerdown', (e) => {
    if (document.activeElement === input || e.button !== 0) return;
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, start: value, moved: false, id: e.pointerId };
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) box.classList.add('scrubbing');
    drag.moved = true;
    const speed = e.shiftKey ? 0.1 : e.ctrlKey ? 4 : 1;
    const range = def.max - def.min;
    const start = clamp(drag.start, def.min, def.max);
    commit(start + (dx / Math.max(box.clientWidth, 1)) * range * speed);
  });
  const endDrag = () => {
    if (!drag) return;
    const clicked = !drag.moved;
    box.classList.remove('scrubbing');
    drag = null;
    if (clicked) {
      input.focus();
      input.select();
    }
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);

  input.addEventListener('change', () => {
    const n = parseFloat(input.value.replace(',', '.'));
    if (Number.isFinite(n)) commit(n, true);
    else show(value);
  });
  // Edit the bare number; show the unit again when not editing.
  input.addEventListener('focus', () => {
    input.value = format(value);
    input.select();
  });
  input.addEventListener('blur', () => show(value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    else if (e.key === 'Escape') {
      show(value);
      input.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      commit(value + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1), true);
      input.select();
    }
  });

  show(value);
  return {
    element: box,
    setValue: (v) => {
      if (typeof v === 'number') show(v);
    },
  };
}
