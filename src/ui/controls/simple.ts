import type {
  BoolParam,
  ColorParam,
  ParamValue,
  SelectParam,
  TextParam,
  Vec2,
  Vec2Param,
} from '../../params/types';
import { h } from '../dom';
import { numberControl } from './number';
import type { ChangeHandler, Control } from './types';

export function boolControl(def: BoolParam, initial: ParamValue, onChange: ChangeHandler): Control {
  const input = h('input', { type: 'checkbox', class: 'toggle', 'aria-label': def.label });
  input.checked = initial === true;
  input.addEventListener('change', () => onChange(input.checked));
  return {
    element: input,
    setValue: (v) => {
      input.checked = v === true;
    },
  };
}

export function colorControl(
  def: ColorParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  const input = h('input', { type: 'color', 'aria-label': def.label });
  input.value = typeof initial === 'string' ? initial : def.default;
  input.addEventListener('input', () => onChange(input.value));
  return {
    element: input,
    setValue: (v) => {
      if (typeof v === 'string') input.value = v;
    },
  };
}

export function selectControl(
  def: SelectParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  const select = h(
    'select',
    { 'aria-label': def.label },
    ...def.options.map((o) => h('option', { value: String(o.value), text: o.label })),
  );
  select.value = String(typeof initial === 'number' ? initial : def.default);
  select.addEventListener('change', () => onChange(Number(select.value)));
  return {
    element: select,
    setValue: (v) => {
      if (typeof v === 'number') select.value = String(v);
    },
  };
}

export function textControl(def: TextParam, initial: ParamValue, onChange: ChangeHandler): Control {
  const input = h('input', {
    type: 'text',
    maxLength: def.maxLength ?? 256,
    'aria-label': def.label,
  });
  input.value = typeof initial === 'string' ? initial : def.default;
  // Commit on change (blur/enter) rather than per keystroke: text often triggers resets.
  input.addEventListener('change', () => onChange(input.value));
  return {
    element: input,
    setValue: (v) => {
      if (typeof v === 'string') input.value = v;
    },
  };
}

export function vec2Control(def: Vec2Param, initial: ParamValue, onChange: ChangeHandler): Control {
  let value: Vec2 = Array.isArray(initial) ? (initial as Vec2) : def.default;
  const axis = (i: 0 | 1) =>
    numberControl(
      {
        type: 'float',
        key: `${def.key}${i}`,
        label: `${def.label} ${i ? 'Y' : 'X'}`,
        min: def.min,
        max: def.max,
        step: def.step,
        default: def.default[i],
      },
      value[i],
      (v) => {
        value = i === 0 ? [v as number, value[1]] : [value[0], v as number];
        onChange(value);
      },
    );
  const x = axis(0);
  const y = axis(1);
  return {
    element: h(
      'div',
      { class: 'control-vec2' },
      h('span', { class: 'axis', text: 'X' }),
      x.element,
      h('span', { class: 'axis', text: 'Y' }),
      y.element,
    ),
    setValue: (v) => {
      if (!Array.isArray(v)) return;
      value = v as Vec2;
      x.setValue(value[0]);
      y.setValue(value[1]);
    },
  };
}
