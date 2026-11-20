import type { FloatParam, IntParam, ParamValue } from '../../params/types';
import { clamp, decimalsForStep, niceStep } from '../../util/math';
import { h } from '../dom';
import type { ChangeHandler, Control } from './types';

export function stepFor(def: FloatParam | IntParam): number {
  if (def.type === 'int') return 1;
  return def.step ?? niceStep(def.min, def.max);
}

/** Slider + numeric field. The numeric field accepts values typed precisely. */
export function numberControl(
  def: FloatParam | IntParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  const step = stepFor(def);
  const decimals = decimalsForStep(step);
  const format = (v: number) => (def.type === 'int' ? String(Math.round(v)) : v.toFixed(decimals));
  const parse = (s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return clamp(def.type === 'int' ? Math.round(n) : n, def.min, def.max);
  };

  const range = h('input', {
    type: 'range',
    min: def.min,
    max: def.max,
    step,
    'aria-label': def.label,
  });
  const field = h('input', { type: 'number', class: 'num', min: def.min, max: def.max, step });

  const show = (v: number) => {
    range.value = String(v);
    field.value = format(v);
  };

  range.addEventListener('input', () => {
    const v = parse(range.value);
    if (v === null) return;
    field.value = format(v);
    onChange(v);
  });
  field.addEventListener('change', () => {
    const v = parse(field.value);
    if (v === null) {
      field.value = format(Number(range.value));
      return;
    }
    show(v);
    onChange(v);
  });

  show(typeof initial === 'number' ? initial : def.default);
  return {
    element: h('div', { class: 'control-number' }, range, field),
    setValue: (v) => {
      if (typeof v === 'number') show(v);
    },
  };
}
