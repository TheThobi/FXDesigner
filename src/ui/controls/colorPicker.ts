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

/** HSL (0..1 each) from RGB. */
export function rgbToHsl(rgb: RGB): [number, number, number] {
  const [hue] = rgbToHsv(rgb);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [hue, clamp01(s), l];
}

export function hslToRgb([hh, s, l]: readonly [number, number, number]): RGB {
  const v = l + s * Math.min(l, 1 - l);
  const sv = v === 0 ? 0 : 2 * (1 - l / v);
  return hsvToRgb([hh, sv, v]);
}

/** CMYK (0..1 each) from RGB. */
export function rgbToCmyk([r, g, b]: RGB): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}

export function cmykToRgb([c, m, y, k]: readonly [number, number, number, number]): RGB {
  return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
}

/** How the channel fields read and write the color. */
interface Mode {
  readonly id: string;
  readonly label: string;
  readonly channels: readonly { readonly label: string; readonly max: number }[];
  /** Decimals shown (floats) or 0. */
  readonly decimals: number;
  readonly read: (rgb: RGB) => number[];
  readonly write: (values: readonly number[]) => RGB;
}

const pct = (x: number) => x * 100;
const MODES: readonly Mode[] = [
  {
    id: 'rgb',
    label: 'RGB',
    channels: [
      { label: 'R', max: 255 },
      { label: 'G', max: 255 },
      { label: 'B', max: 255 },
    ],
    decimals: 0,
    read: (c) => c.map((v) => v * 255),
    write: (v) => [v[0]! / 255, v[1]! / 255, v[2]! / 255],
  },
  {
    id: 'float',
    label: 'RGB 0–1',
    channels: [
      { label: 'R', max: 1 },
      { label: 'G', max: 1 },
      { label: 'B', max: 1 },
    ],
    decimals: 3,
    read: (c) => [...c],
    write: (v) => [v[0]!, v[1]!, v[2]!],
  },
  {
    id: 'hsv',
    label: 'HSV',
    channels: [
      { label: 'H', max: 360 },
      { label: 'S', max: 100 },
      { label: 'V', max: 100 },
    ],
    decimals: 0,
    read: (c) => {
      const [hh, s, v] = rgbToHsv(c);
      return [hh * 360, pct(s), pct(v)];
    },
    write: (v) => hsvToRgb([Math.min(v[0]! / 360, 0.9999), v[1]! / 100, v[2]! / 100]),
  },
  {
    id: 'hsl',
    label: 'HSL',
    channels: [
      { label: 'H', max: 360 },
      { label: 'S', max: 100 },
      { label: 'L', max: 100 },
    ],
    decimals: 0,
    read: (c) => {
      const [hh, s, l] = rgbToHsl(c);
      return [hh * 360, pct(s), pct(l)];
    },
    write: (v) => hslToRgb([Math.min(v[0]! / 360, 0.9999), v[1]! / 100, v[2]! / 100]),
  },
  {
    id: 'cmyk',
    label: 'CMYK',
    channels: [
      { label: 'C', max: 100 },
      { label: 'M', max: 100 },
      { label: 'Y', max: 100 },
      { label: 'K', max: 100 },
    ],
    decimals: 0,
    read: (c) => rgbToCmyk(c).map(pct),
    write: (v) => cmykToRgb([v[0]! / 100, v[1]! / 100, v[2]! / 100, v[3]! / 100]),
  },
];

let openPicker: (() => void) | null = null;
/** Channel mode of the last picker (kept for the next one). */
let lastMode = 'rgb';

/**
 * Floating color picker next to `anchor`: saturation / value square, hue and opacity bars,
 * hex (`#rrggbb` or `#rrggbbaa`) and channel fields in RGB (0–255 or 0–1 floats), HSV, HSL
 * or CMYK. `onChange` fires live; closes on Escape or a click outside.
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
  let mode = MODES.find((m) => m.id === lastMode) ?? MODES[0]!;

  const svKnob = h('div', { class: 'cp-knob' });
  const sv = h('div', { class: 'cp-sv' }, svKnob);
  const hueKnob = h('div', { class: 'cp-bar-knob' });
  const hue = h('div', { class: 'cp-bar cp-hue' }, hueKnob);
  const alphaKnob = h('div', { class: 'cp-bar-knob' });
  const alphaFill = h('div', { class: 'cp-alpha-fill' });
  const alphaBar = h('div', { class: 'cp-bar cp-alpha', hidden: !withAlpha }, alphaFill, alphaKnob);
  const swatch = h('div', { class: 'cp-swatch' });
  const hex = h('input', { class: 'cp-hex', spellcheck: false, 'aria-label': 'Hex color' });
  const modeSelect = h(
    'select',
    { class: 'cp-mode', 'aria-label': 'Channels' },
    ...MODES.map((m) => h('option', { value: m.id, text: m.label, selected: m === mode })),
  );
  const fieldsRow = h('div', { class: 'cp-fields' });
  let fields: HTMLInputElement[] = [];
  const alphaInput = h('input', {
    type: 'number',
    class: 'cp-num',
    min: 0,
    'aria-label': 'Opacity',
  });
  const alphaField = h(
    'label',
    { class: 'cp-field', hidden: !withAlpha },
    h('span', { text: 'A' }),
    alphaInput,
  );
  const panel = h(
    'div',
    { class: 'color-picker', role: 'dialog', 'aria-label': 'Color picker' },
    sv,
    h('div', { class: 'cp-row' }, h('div', { class: 'cp-bars' }, hue, alphaBar), swatch),
    h('div', { class: 'cp-row' }, h('span', { class: 'cp-label', text: 'Hex' }), hex, modeSelect),
    fieldsRow,
    alphaField,
  );

  const rgb = () => hsvToRgb(hsv);
  const current = (): PickedColor => ({ color: rgbToHex(rgb()), alpha });
  const fmt = (v: number, decimals: number) =>
    decimals ? String(Number(v.toFixed(decimals))) : String(Math.round(v));

  const buildFields = () => {
    fields = mode.channels.map((ch) =>
      h('input', {
        type: 'number',
        class: 'cp-num',
        min: 0,
        max: ch.max,
        step: mode.decimals ? 10 ** -mode.decimals : 1,
        'aria-label': ch.label,
      }),
    );
    fieldsRow.style.setProperty('--cols', String(fields.length));
    fieldsRow.replaceChildren(
      ...fields.map((input, i) =>
        h('label', { class: 'cp-field' }, h('span', { text: mode.channels[i]!.label }), input),
      ),
    );
    fields.forEach((input) =>
      input.addEventListener('input', () => {
        const values = fields.map((f, i) =>
          Math.min(mode.channels[i]!.max, Math.max(0, Number(f.value) || 0)),
        );
        hsv = rgbToHsv(mode.write(values).map(clamp01) as unknown as RGB);
        changed(input);
      }),
    );
    // Opacity follows the mode's scale (0–1 for floats, else percent).
    alphaInput.max = mode.decimals ? '1' : '100';
    alphaInput.step = mode.decimals ? '0.001' : '1';
  };

  const render = (skip?: HTMLInputElement) => {
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
    mode.read(rgb()).forEach((v, i) => {
      const input = fields[i];
      if (input && input !== skip) input.value = fmt(v, mode.decimals);
    });
    if (skip !== alphaInput)
      alphaInput.value = fmt(mode.decimals ? alpha : alpha * 100, mode.decimals);
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
  modeSelect.addEventListener('change', () => {
    mode = MODES.find((m) => m.id === modeSelect.value) ?? MODES[0]!;
    lastMode = mode.id;
    buildFields();
    render();
  });
  alphaInput.addEventListener('input', () => {
    const n = Number(alphaInput.value) || 0;
    alpha = clamp01(mode.decimals ? n : n / 100);
    changed(alphaInput);
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
  buildFields();
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
