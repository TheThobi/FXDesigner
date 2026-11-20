import {
  gradientToCss,
  isGradientValue,
  MAX_GRADIENT_STOPS,
  reverseGradient,
  sampleGradient,
  type GradientStop,
  type GradientValue,
} from '../../params/gradient';
import { GRADIENT_PRESETS } from '../../params/gradientPresets';
import type { GradientParam, ParamValue } from '../../params/types';
import { rgbToHex } from '../../util/color';
import { clamp01 } from '../../util/math';
import { clear, h } from '../dom';
import type { ChangeHandler, Control } from './types';

/**
 * Color ramp editor:
 *  - click the bar to add a stop, drag markers to move them, drag a marker far below to delete;
 *  - the selected stop's color/alpha/position are edited in the row below;
 *  - presets and reverse.
 */
export function gradientControl(
  def: GradientParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  let stops: GradientStop[] = [...(isGradientValue(initial) ? initial : def.default).stops];
  let selected = 0;

  const preview = h('div', { class: 'gradient-preview' });
  const markers = h('div', { class: 'gradient-markers' });
  const bar = h(
    'div',
    { class: 'gradient-bar', title: 'Click to add a stop, drag stops to move them' },
    preview,
    markers,
  );

  const colorInput = h('input', { type: 'color', 'aria-label': 'Stop color' });
  const alphaInput = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    'aria-label': 'Stop opacity',
    title: 'Opacity',
  });
  const posInput = h('input', {
    type: 'number',
    class: 'num',
    min: 0,
    max: 1,
    step: 0.01,
    'aria-label': 'Stop position',
  });
  const removeBtn = h('button', { class: 'icon-btn', text: '✕', title: 'Remove stop' });
  const presetSelect = h(
    'select',
    { class: 'gradient-presets', 'aria-label': 'Gradient preset' },
    h('option', { value: '', text: 'Presets…' }),
    ...GRADIENT_PRESETS.map((p, i) => h('option', { value: String(i), text: p.name })),
  );
  const reverseBtn = h('button', { class: 'icon-btn', text: '⇄', title: 'Reverse' });

  const current = (): GradientValue => ({ stops: [...stops] });
  const emit = () => onChange(current());

  const updateStop = (patch: Partial<GradientStop>) => {
    const s = stops[selected];
    if (!s) return;
    stops[selected] = { ...s, ...patch };
    render();
    emit();
  };

  function render() {
    preview.style.background = `${gradientToCss(current())}, var(--checker)`;
    clear(markers);
    stops.forEach((s, i) => {
      const m = h('div', {
        class: `gradient-marker${i === selected ? ' selected' : ''}`,
        title: `${s.color} @ ${s.pos.toFixed(2)}`,
      });
      m.style.left = `${s.pos * 100}%`;
      m.style.setProperty('--stop-color', s.color);
      m.addEventListener('pointerdown', (e) => startDrag(e, i));
      markers.append(m);
    });
    const s = stops[selected];
    if (s) {
      colorInput.value = s.color;
      alphaInput.value = String(s.alpha);
      posInput.value = s.pos.toFixed(2);
    }
    removeBtn.disabled = stops.length <= 1;
  }

  function startDrag(e: PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    selected = index;
    render();
    const rect = bar.getBoundingClientRect();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const s = stops[selected];
      if (!s) return;
      stops[selected] = { ...s, pos: clamp01((ev.clientX - rect.left) / rect.width) };
      render();
      emit();
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      // Dragging well below the bar removes the stop.
      if (ev.clientY - rect.bottom > 40 && stops.length > 1) {
        stops.splice(selected, 1);
        selected = Math.max(0, selected - 1);
        render();
        emit();
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  bar.addEventListener('pointerdown', (e) => {
    if (stops.length >= MAX_GRADIENT_STOPS) return;
    const rect = bar.getBoundingClientRect();
    const pos = clamp01((e.clientX - rect.left) / rect.width);
    const [r, g, b, a] = sampleGradient(current(), pos);
    stops.push({ pos, color: rgbToHex([r, g, b]), alpha: a });
    selected = stops.length - 1;
    render();
    emit();
  });

  colorInput.addEventListener('input', () => updateStop({ color: colorInput.value }));
  alphaInput.addEventListener('input', () => updateStop({ alpha: Number(alphaInput.value) }));
  posInput.addEventListener('change', () =>
    updateStop({ pos: clamp01(Number(posInput.value) || 0) }),
  );
  removeBtn.addEventListener('click', () => {
    if (stops.length <= 1) return;
    stops.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    render();
    emit();
  });
  reverseBtn.addEventListener('click', () => {
    stops = [...reverseGradient(current()).stops];
    render();
    emit();
  });
  presetSelect.addEventListener('change', () => {
    const preset = GRADIENT_PRESETS[Number(presetSelect.value)];
    presetSelect.value = '';
    if (!preset) return;
    stops = [...preset.value.stops];
    selected = 0;
    render();
    emit();
  });

  render();
  return {
    element: h(
      'div',
      { class: 'control-gradient' },
      bar,
      h('div', { class: 'gradient-stop-editor' }, colorInput, alphaInput, posInput, removeBtn),
      h('div', { class: 'gradient-actions' }, presetSelect, reverseBtn),
    ),
    setValue: (v) => {
      if (!isGradientValue(v)) return;
      stops = [...v.stops];
      selected = Math.min(selected, stops.length - 1);
      render();
    },
  };
}
