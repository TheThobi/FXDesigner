import { hexToRgb, isHexColor, rgbToHex, type RGB } from '../../util/color';
import { clamp01 } from '../../util/math';
import { h } from '../dom';

export interface PickedColor {
  /** `#rrggbb`. */
  readonly color: string;
  /** Opacity 0..1. */
  readonly alpha: number;
}

type HSV = [number, number, number];

export function rgbToHsv([r, g, b]: RGB): HSV {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d + 6) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
  }
  return [hue / 6, max > 0 ? d / max : 0, max];
}

export function hsvToRgb([hh, s, v]: HSV): RGB {
  const f = (n: number) => {
    const k = (n + hh * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

let openPicker: (() => void) | null = null;

/**
 * Floating color picker next to `anchor`: saturation / value square, hue and opacity bars,
 * hex (`#rrggbb` or `#rrggbbaa`), RGB and HSV fields. `onChange` fires live; closes on
 * Escape or a click outside.
 */
export function openColorPicker(
  anchor: HTMLElement,
  initial: PickedColor,
  onChange: (c: PickedColor) => void,
  opts: { readonly alpha?: boolean } = {},
): void {
  openPicker?.();
  const withAlpha = opts.alpha !== false;
  let hsv = rgbToHsv(hexToRgb(initial.color));
  let alpha = withAlpha ? initial.alpha : 1;

  const svKnob = h('div', { class: 'cp-knob' });
  const sv = h('div', { class: 'cp-sv' }, svKnob);
  const hueKnob = h('div', { class: 'cp-bar-knob' });
  const hue = h('div', { class: 'cp-bar cp-hue' }, hueKnob);
  const alphaKnob = h('div', { class: 'cp-bar-knob' });
  const alphaFill = h('div', { class: 'cp-alpha-fill' });
  const alphaBar = h('div', { class: 'cp-bar cp-alpha', hidden: !withAlpha }, alphaFill, alphaKnob);
  const swatch = h('div', { class: 'cp-swatch' });
  const hex = h('input', { class: 'cp-hex', spellcheck: false, 'aria-label': 'Hex color' });
  const field = (label: string, max: number) => {
    const input = h('input', {
      type: 'number',
      class: 'cp-num',
      min: 0,
      max,
      step: 1,
      'aria-label': label,
    });
    return { input, el: h('label', { class: 'cp-field' }, h('span', { text: label }), input) };
  };
  const rgbFields = [field('R', 255), field('G', 255), field('B', 255)];
  const hsvFields = [field('H', 360), field('S', 100), field('V', 100)];
  const aField = field('A', 100);
  aField.el.hidden = !withAlpha;
  const panel = h(
    'div',
    { class: 'color-picker', role: 'dialog', 'aria-label': 'Color picker' },
    sv,
    h('div', { class: 'cp-row' }, h('div', { class: 'cp-bars' }, hue, alphaBar), swatch),
    h('div', { class: 'cp-row' }, h('span', { class: 'cp-label', text: 'Hex' }), hex, aField.el),
    h('div', { class: 'cp-fields' }, ...rgbFields.map((f) => f.el)),
    h('div', { class: 'cp-fields' }, ...hsvFields.map((f) => f.el)),
  );

  const rgb = () => hsvToRgb(hsv);
  const current = (): PickedColor => ({ color: rgbToHex(rgb()), alpha });
  const render = (skip?: HTMLInputElement) => {
    const [r, g, b] = rgb();
    const pure = rgbToHex(hsvToRgb([hsv[0], 1, 1]));
    sv.style.setProperty('--hue', pure);
    svKnob.style.left = `${hsv[1] * 100}%`;
    svKnob.style.top = `${(1 - hsv[2]) * 100}%`;
    hueKnob.style.left = `${hsv[0] * 100}%`;
    alphaKnob.style.left = `${alpha * 100}%`;
    const c = current().color;
    alphaFill.style.background = `linear-gradient(90deg, transparent, ${c})`;
    swatch.style.setProperty('--c', c);
    swatch.style.setProperty('--a', String(alpha));
    const a255 = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    if (skip !== hex) hex.value = withAlpha && alpha < 1 ? `${c}${a255}` : c;
    [r, g, b].forEach((v, i) => {
      if (skip !== rgbFields[i]!.input) rgbFields[i]!.input.value = String(Math.round(v * 255));
    });
    const hv = [hsv[0] * 360, hsv[1] * 100, hsv[2] * 100];
    hv.forEach((v, i) => {
      if (skip !== hsvFields[i]!.input) hsvFields[i]!.input.value = String(Math.round(v));
    });
    if (skip !== aField.input) aField.input.value = String(Math.round(alpha * 100));
  };
  const changed = (skip?: HTMLInputElement) => {
    render(skip);
    onChange(current());
  };

  const dragOn = (el: HTMLElement, apply: (x: number, y: number) => void) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const at = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect();
        apply(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
        changed();
      };
      at(e);
      const up = () => {
        el.removeEventListener('pointermove', at);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', at);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  };
  dragOn(sv, (x, y) => {
    hsv = [hsv[0], x, 1 - y];
  });
  dragOn(hue, (x) => {
    hsv = [Math.min(x, 0.9999), hsv[1], hsv[2]];
  });
  dragOn(alphaBar, (x) => {
    alpha = x;
  });

  hex.addEventListener('input', () => {
    const v = hex.value.trim().replace(/^#?/, '#');
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
    if (!m || !isHexColor(`#${m[1]}`)) return;
    hsv = rgbToHsv(hexToRgb(`#${m[1]}`));
    if (m[2] && withAlpha) alpha = parseInt(m[2], 16) / 255;
    changed(hex);
  });
  const num = (input: HTMLInputElement, max: number) =>
    Math.min(max, Math.max(0, Number(input.value) || 0));
  for (const f of rgbFields) {
    f.input.addEventListener('input', () => {
      const [r, g, b] = rgbFields.map((x) => num(x.input, 255) / 255) as [number, number, number];
      hsv = rgbToHsv([r, g, b]);
      changed(f.input);
    });
  }
  for (const f of hsvFields) {
    f.input.addEventListener('input', () => {
      hsv = [
        Math.min(num(hsvFields[0]!.input, 360) / 360, 0.9999),
        num(hsvFields[1]!.input, 100) / 100,
        num(hsvFields[2]!.input, 100) / 100,
      ];
      changed(f.input);
    });
  }
  aField.input.addEventListener('input', () => {
    alpha = num(aField.input, 100) / 100;
    changed(aField.input);
  });

  const close = () => {
    panel.remove();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', key, true);
    if (openPicker === close) openPicker = null;
  };
  const outside = (e: PointerEvent) => {
    const t = e.target as Node;
    if (!panel.contains(t) && !anchor.contains(t)) close();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && e.target !== hex)) {
      e.stopPropagation();
      close();
    }
  };
  document.body.append(panel);
  render();
  const a = anchor.getBoundingClientRect();
  const w = panel.offsetWidth;
  const hgt = panel.offsetHeight;
  panel.style.left = `${Math.max(8, Math.min(a.left, window.innerWidth - w - 8))}px`;
  const below = a.bottom + 6;
  panel.style.top = `${below + hgt > window.innerHeight - 8 ? Math.max(8, a.top - hgt - 6) : below}px`;
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', key, true);
  openPicker = close;
}
