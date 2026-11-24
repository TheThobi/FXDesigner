import { PREVIEW_SHAPES, type Preview3DView } from '../engine/Renderer';
import { clamp } from '../util/math';
import { lookAt, multiply, normalize, perspective, type Vec3 } from '../util/mat4';
import { readStorage, writeStorage } from '../util/storage';
import { param } from '../params/define';
import type { ParamDef, ParamValues } from '../params/types';
import { h } from './dom';
import { createControl } from './controls';

const STORAGE_KEY = 'ptm.preview3d';
/** Rendered size cap (device pixels, long side): the image is read back every change. */
const MAX_SIZE = 640;

interface Settings {
  shape: number;
  additive: boolean;
  tiles: number;
  relief: number;
  /** Light azimuth (degrees). */
  light: number;
}

const DEFAULTS: Settings = { shape: 1, additive: false, tiles: 1, relief: 1, light: 45 };

/** Settings shown under the view (same editor as the Details panel). */
const VIEW_PARAMS: readonly ParamDef[] = [
  param.select('shape', 'Shape', PREVIEW_SHAPES, DEFAULTS.shape, { group: 'View' }),
  param.select('shading', 'Shading', ['Lit material', 'Additive sprite'], 0, { group: 'View' }),
  param.int('tiles', 'Repeats', DEFAULTS.tiles, 1, 4, { group: 'View' }),
  param.float('relief', 'Relief', DEFAULTS.relief, 0, 4, { group: 'View' }),
  param.float('light', 'Light', DEFAULTS.light, 0, 360, {
    group: 'View',
    unit: '°',
    description: 'Light direction',
  }),
];

/**
 * 3D Preview panel: the exported node (Output, else the selection) on a plane, sphere, cube
 * or cylinder, lit with normals from its height, or as an additive sprite. Drag to orbit,
 * wheel to zoom. The app renders it (`view()` / `show()`) only while the panel is visible.
 */
export class Preview3D {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private settings: Settings;
  private yaw = 0.6;
  private pitch = 0.35;
  private distance = 3.6;
  /** Bumped when anything of the view changes (the app redraws on change). */
  version = 0;

  constructor() {
    this.settings = this.load();
    this.canvas = h('canvas', { class: 'preview3d-canvas', width: 1, height: 1 });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;

    // Compact settings (the site's own controls): shape and shading, then the rest.
    const values = this.values();
    const cell = (def: ParamDef) => {
      const control = createControl(def, values[def.key]!, (value) =>
        this.update(() => {
          const s = this.settings;
          const n = Number(value);
          if (def.key === 'shape') s.shape = n;
          else if (def.key === 'shading') s.additive = n === 1;
          else if (def.key === 'tiles') s.tiles = n;
          else if (def.key === 'relief') s.relief = n;
          else if (def.key === 'light') s.light = n;
          lit.forEach((el) => (el.hidden = this.settings.additive));
        }),
      );
      return h(
        'label',
        { class: 'preview3d-field', title: def.description ?? def.label },
        h('span', { class: 'preview3d-label', text: def.label }),
        control.element,
      );
    };
    const [shape, shading, tiles, relief, light] = VIEW_PARAMS.map(cell);
    if (!shape || !shading || !tiles || !relief || !light) throw new Error('View params missing');
    const lit = [relief, light];
    lit.forEach((el) => (el.hidden = this.settings.additive));
    const settings = h(
      'div',
      { class: 'preview3d-settings' },
      h('div', { class: 'preview3d-row' }, shape, shading),
      h('div', { class: 'preview3d-row' }, tiles, relief, light),
    );
    this.element = h(
      'div',
      { class: 'preview3d' },
      h('div', { class: 'preview3d-stage' }, this.canvas),
      settings,
    );
    this.bindPointer();
  }

  /** Drawn on screen (its dock tab is active and the panel shown). */
  get visible(): boolean {
    return this.canvas.isConnected && this.canvas.offsetParent !== null;
  }

  /** Render size in device pixels (stage size, capped). */
  size(): [number, number] {
    const stage = this.canvas.parentElement;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, (stage?.clientWidth ?? 1) * dpr);
    const hgt = Math.max(1, (stage?.clientHeight ?? 1) * dpr);
    const k = Math.min(1, MAX_SIZE / Math.max(w, hgt));
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hgt * k))];
  }

  view(aspect: number): Preview3DView {
    const s = this.settings;
    const cp = Math.cos(this.pitch);
    const eye: Vec3 = [
      this.distance * cp * Math.sin(this.yaw),
      this.distance * Math.sin(this.pitch),
      this.distance * cp * Math.cos(this.yaw),
    ];
    const viewProj = multiply(perspective(0.7, aspect, 0.1, 50), lookAt(eye, [0, 0, 0], [0, 1, 0]));
    const a = (s.light * Math.PI) / 180;
    return {
      shape: s.shape,
      viewProj,
      eye,
      light: normalize([Math.sin(a), 0.8, Math.cos(a)]),
      relief: s.relief,
      tiles: s.tiles,
      additive: s.additive,
    };
  }

  /** Shows a rendered image (straight RGBA8, top-down). */
  show(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  }

  private values(): ParamValues {
    const s = this.settings;
    return {
      shape: s.shape,
      shading: s.additive ? 1 : 0,
      tiles: s.tiles,
      relief: s.relief,
      light: s.light,
    };
  }

  private update(change: () => void): void {
    change();
    this.version++;
    writeStorage(STORAGE_KEY, JSON.stringify(this.settings));
  }

  private bindPointer(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      c.setPointerCapture(e.pointerId);
      let x = e.clientX;
      let y = e.clientY;
      const move = (ev: PointerEvent) => {
        this.yaw -= (ev.clientX - x) * 0.01;
        this.pitch = clamp(this.pitch + (ev.clientY - y) * 0.01, -1.4, 1.4);
        x = ev.clientX;
        y = ev.clientY;
        this.version++;
      };
      const up = () => {
        c.removeEventListener('pointermove', move);
        c.removeEventListener('pointerup', up);
        c.removeEventListener('pointercancel', up);
      };
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.distance = clamp(this.distance * Math.exp(e.deltaY * 0.001), 1.6, 12);
        this.version++;
      },
      { passive: false },
    );
    c.addEventListener('dblclick', () => {
      this.yaw = 0.6;
      this.pitch = 0.35;
      this.distance = 3.6;
      this.version++;
    });
  }

  private load(): Settings {
    try {
      const raw = JSON.parse(readStorage(STORAGE_KEY) ?? '{}') as Partial<Settings>;
      const num = (v: unknown, d: number, min: number, max: number) =>
        typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : d;
      return {
        shape: Math.round(num(raw.shape, DEFAULTS.shape, 0, PREVIEW_SHAPES.length - 1)),
        additive: raw.additive === true,
        tiles: Math.round(num(raw.tiles, DEFAULTS.tiles, 1, 4)),
        relief: num(raw.relief, DEFAULTS.relief, 0, 4),
        light: num(raw.light, DEFAULTS.light, 0, 360),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
