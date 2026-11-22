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

/** Angles in degrees (unit °, or an angle / rotation / direction spanning 90° or more). */
export function isAngle(def: FloatParam | IntParam): boolean {
  if (def.unit === '°') return true;
  return (
    /angle|rotation|direction/i.test(`${def.key} ${def.label}`) &&
    def.max - def.min >= 90 &&
    !def.unit
  );
}

/**
 * Substance-like angle dial: drag around the circle to aim the direction (0° = right,
 * counter-clockwise, y up as in the shaders); Shift snaps to 15°. Ranges of 180° wrap
 * (directions), negative ranges map to -180…180.
 */
function angleDial(def: FloatParam | IntParam, set: (deg: number) => void) {
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-12 -12 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  const ring = document.createElementNS(SVG, 'circle');
  ring.setAttribute('r', '10');
  ring.classList.add('dial-ring');
  const hand = document.createElementNS(SVG, 'line');
  hand.setAttribute('x1', '0');
  hand.setAttribute('y1', '0');
  hand.classList.add('dial-hand');
  const tip = document.createElementNS(SVG, 'circle');
  tip.setAttribute('r', '2');
  tip.classList.add('dial-tip');
  svg.append(ring, hand, tip);
  const element = h('span', {
    class: 'angle-dial',
    title: 'Drag around to set the angle (Shift: 15° steps)',
  });
  element.append(svg);

  const toValue = (deg: number) => {
    let d = ((deg % 360) + 360) % 360;
    if (def.min >= 0 && def.max <= 180) d %= 180;
    else if (def.min < 0 && d > 180) d -= 360;
    return Math.min(def.max, Math.max(def.min, d));
  };
  const pick = (e: PointerEvent) => {
    const r = element.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    set(toValue(deg));
  };
  element.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    element.setPointerCapture(e.pointerId);
    element.classList.add('dragging');
    pick(e);
    const move = (ev: PointerEvent) => pick(ev);
    const up = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.classList.remove('dragging');
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  });
  return {
    element,
    show(deg: number) {
      const a = (deg * Math.PI) / 180;
      const x = Math.cos(a) * 8;
      const y = -Math.sin(a) * 8;
      hand.setAttribute('x2', x.toFixed(2));
      hand.setAttribute('y2', y.toFixed(2));
      tip.setAttribute('cx', x.toFixed(2));
      tip.setAttribute('cy', y.toFixed(2));
    },
  };
}

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

  const dial = isAngle(def) ? angleDial(def, (v) => commit(v)) : null;
  const show = (v: number) => {
    value = v;
    input.value = document.activeElement === input ? format(v) : display(v);
    const t = (v - def.min) / (def.max - def.min || 1);
    box.style.setProperty('--fill', `${Math.min(1, Math.max(0, t)) * 100}%`);
    box.classList.toggle('over-range', v > def.max || v < def.min);
    dial?.show(v);
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
    element: dial ? h('div', { class: 'angle-field' }, dial.element, box) : box,
    setValue: (v) => {
      if (typeof v === 'number') show(v);
    },
  };
}
