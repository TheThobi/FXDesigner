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
import type { FloatParam, GradientParam, ParamValue } from '../../params/types';
import { rgbToHex } from '../../util/color';
import { clamp01 } from '../../util/math';
import { h } from '../dom';
import { icon } from '../icons';
import { openColorPicker } from './colorPicker';
import { gradientPresetMenu } from './gradientMenu';
import { numberControl } from './number';
import type { ChangeHandler, Control } from './types';

const POSITION: FloatParam = {
  type: 'float',
  key: 'stopPosition',
  label: 'Stop position',
  min: 0,
  max: 1,
  step: 0.001,
  default: 0,
};

/**
 * Color ramp editor:
 *  - click the bar to add a stop; drag a stop to move it (drag it far below to delete it);
 *  - Del / Backspace on the selected stop removes it (the node is not deleted);
 *  - the selected stop: color + opacity swatch (opens the color picker), position field
 *    (drag to scrub, click to type), reverse and remove;
 *  - ramp presets.
 */
export function gradientControl(
  def: GradientParam,
  initial: ParamValue,
  onChange: ChangeHandler,
): Control {
  let stops: GradientStop[] = [...(isGradientValue(initial) ? initial : def.default).stops];
  let selected = 0;

  // Two bands: colors (opaque) on top, colors with their opacity over a checkerboard below.
  const colorBand = h('div', { class: 'gradient-band color' });
  const alphaBand = h('div', { class: 'gradient-band alpha' });
  const preview = h('div', { class: 'gradient-preview' }, colorBand, alphaBand);
  const markers = h('div', { class: 'gradient-markers' });
  const bar = h(
    'div',
    { class: 'gradient-bar', title: 'Click to add a stop · drag stops to move them' },
    preview,
    markers,
  );

  const current = (): GradientValue => ({ stops: [...stops] });
  const emit = () => onChange(current());

  const swatch = h('button', {
    type: 'button',
    class: 'gradient-swatch',
    title: 'Stop color and opacity',
    'aria-label': 'Stop color and opacity',
  });
  const swatchLabel = h('span', { class: 'gradient-swatch-label' });
  const position = numberControl(POSITION, 0, (v) => {
    const s = stops[selected];
    if (!s || typeof v !== 'number') return;
    stops[selected] = { ...s, pos: clamp01(v) };
    render();
    emit();
  });
  const removeBtn = h(
    'button',
    { type: 'button', class: 'icon-btn', title: 'Remove stop (Del)', 'aria-label': 'Remove stop' },
    icon('close', 12),
  );
  const reverseBtn = h(
    'button',
    { type: 'button', class: 'icon-btn', title: 'Reverse the ramp', 'aria-label': 'Reverse' },
    icon('swap', 14),
  );
  const presetMenu = gradientPresetMenu(GRADIENT_PRESETS, (value) => {
    stops = [...value.stops];
    selected = 0;
    render();
    emit();
  });

  const removeSelected = () => {
    if (stops.length <= 1) return;
    stops.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    render();
    emit();
  };

  /** Markers are updated in place: replacing them would break a drag in progress. */
  function render() {
    const opaque: GradientValue = { stops: stops.map((s) => ({ ...s, alpha: 1 })) };
    colorBand.style.background = gradientToCss(opaque);
    alphaBand.style.background = `${gradientToCss(current())}, var(--checker)`;
    while (markers.childElementCount > stops.length) markers.lastElementChild?.remove();
    while (markers.childElementCount < stops.length) markers.append(createMarker());
    stops.forEach((s, i) => {
      const m = markers.children[i] as HTMLElement;
      m.dataset.index = String(i);
      m.classList.toggle('selected', i === selected);
      m.title = `${s.color} · opacity ${Math.round(s.alpha * 100)}% @ ${s.pos.toFixed(3)}`;
      m.style.left = `${s.pos * 100}%`;
      m.style.setProperty('--stop-color', s.color);
      m.style.setProperty('--stop-alpha', String(s.alpha));
    });
    const s = stops[selected];
    if (s) {
      swatch.style.setProperty('--c', s.color);
      swatch.style.setProperty('--a', String(s.alpha));
      swatchLabel.textContent = `${s.color.toUpperCase()} · ${Math.round(s.alpha * 100)}%`;
      position.setValue(s.pos);
    }
    removeBtn.disabled = stops.length <= 1;
  }

  function createMarker(): HTMLElement {
    const m = h('div', { class: 'gradient-marker', tabIndex: 0, role: 'slider' });
    m.addEventListener('pointerdown', (e) => startDrag(e, m));
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Handled here: the app-wide Del (delete nodes) must not fire.
        e.preventDefault();
        e.stopPropagation();
        removeSelected();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const st = stops[selected];
        if (!st) return;
        const step = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' ? -1 : 1);
        stops[selected] = { ...st, pos: clamp01(st.pos + step) };
        render();
        emit();
      }
    });
    return m;
  }

  function startDrag(e: PointerEvent, marker: HTMLElement) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    selected = Number(marker.dataset.index ?? 0);
    marker.focus();
    render();
    const rect = bar.getBoundingClientRect();
    const grab = e.clientX - (rect.left + (stops[selected]?.pos ?? 0) * rect.width);
    marker.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const s = stops[selected];
      if (!s) return;
      stops[selected] = { ...s, pos: clamp01((ev.clientX - grab - rect.left) / rect.width) };
      marker.classList.toggle('removing', ev.clientY - rect.bottom > 40 && stops.length > 1);
      render();
      emit();
    };
    const up = (ev: PointerEvent) => {
      marker.removeEventListener('pointermove', move);
      marker.removeEventListener('pointerup', up);
      marker.removeEventListener('pointercancel', up);
      marker.classList.remove('removing');
      // Dragging well below the bar removes the stop.
      if (ev.type === 'pointerup' && ev.clientY - rect.bottom > 40) removeSelected();
    };
    marker.addEventListener('pointermove', move);
    marker.addEventListener('pointerup', up);
    marker.addEventListener('pointercancel', up);
  }

  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.gradient-marker')) return;
    if (stops.length >= MAX_GRADIENT_STOPS) return;
    const rect = bar.getBoundingClientRect();
    const pos = clamp01((e.clientX - rect.left) / rect.width);
    const [r, g, b, a] = sampleGradient(current(), pos);
    stops.push({ pos, color: rgbToHex([r, g, b]), alpha: a });
    selected = stops.length - 1;
    render();
    emit();
    const marker = markers.children[selected] as HTMLElement | undefined;
    if (marker) startDrag(e, marker);
  });

  swatch.addEventListener('click', () => {
    const s = stops[selected];
    if (!s) return;
    const index = selected;
    openColorPicker(swatch, { color: s.color, alpha: s.alpha }, (c) => {
      const st = stops[index];
      if (!st) return;
      stops[index] = { ...st, color: c.color, alpha: c.alpha };
      render();
      emit();
    });
  });
  removeBtn.addEventListener('click', removeSelected);
  reverseBtn.addEventListener('click', () => {
    stops = [...reverseGradient(current()).stops];
    selected = stops.length - 1 - selected;
    render();
    emit();
  });

  render();
  return {
    element: h(
      'div',
      { class: 'control-gradient' },
      bar,
      h(
        'div',
        { class: 'gradient-stop-editor' },
        h('div', { class: 'gradient-swatch-wrap' }, swatch, swatchLabel),
        h(
          'div',
          { class: 'gradient-pos', title: 'Stop position (drag to scrub)' },
          position.element,
        ),
        reverseBtn,
        removeBtn,
      ),
      h('div', { class: 'gradient-actions' }, presetMenu),
    ),
    setValue: (v) => {
      if (!isGradientValue(v)) return;
      stops = [...v.stops];
      selected = Math.min(selected, stops.length - 1);
      render();
    },
  };
}
