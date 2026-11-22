import { debounce } from '../util/debounce';
import { h } from './dom';

export type MapKind = 'color' | 'normal' | 'height';

export interface ExportMapsOptions {
  readonly maps: Readonly<Record<MapKind, boolean>>;
  /** Post alpha mode for the color map (OUTPUT_PARAMS alphaMode). */
  readonly alphaMode: number;
  readonly heightSource: number;
  readonly normalStrength: number;
  readonly normalFlipY: boolean;
  /** Color map: invert R / G (flowmap X / Y conventions). */
  readonly flipRed: boolean;
  readonly flipGreen: boolean;
  /** Height map as a 16-bit grayscale PNG (no banding when displaced). */
  readonly height16: boolean;
  /** Long side in pixels. */
  readonly resolution: number;
  readonly prefix: string;
  /** One ZIP, or one PNG per map. */
  readonly zip: boolean;
}

export interface ExportMapsCallbacks {
  /** Renders a small preview of `map` with `options` (data URL). */
  readonly preview: (map: MapKind, options: ExportMapsOptions) => string;
  readonly resolutions: readonly number[];
  /** Pixel size label for a resolution (non-square workspaces). */
  readonly dims: (resolution: number) => readonly [number, number];
}

const MAPS: readonly { kind: MapKind; label: string; hint: string }[] = [
  { kind: 'color', label: 'Color', hint: 'The look as in the viewport, with the chosen alpha.' },
  { kind: 'normal', label: 'Normal', hint: 'Tangent-space normal map from the height.' },
  { kind: 'height', label: 'Height', hint: 'Grayscale height (luminance or source alpha).' },
];

/** Export window: pick the maps, tune them with live previews, then export. */
export function askExportMaps(
  initial: ExportMapsOptions,
  callbacks: ExportMapsCallbacks,
): Promise<ExportMapsOptions | null> {
  return new Promise((resolve) => {
    const checks = new Map<MapKind, HTMLInputElement>();
    const previews = new Map<MapKind, HTMLImageElement>();
    const select = (name: string, options: readonly [string, number][], value: number) =>
      h(
        'select',
        { name },
        ...options.map(([label, v]) =>
          h('option', { value: String(v), text: label, selected: v === value }),
        ),
      );
    const alphaMode = select(
      'alphaMode',
      [
        ['Opaque', 0],
        ['From luminance', 1],
        ['From color ramp', 2],
        ['From source', 3],
      ],
      initial.alphaMode,
    );
    const heightSource = select(
      'heightSource',
      [
        ['Luminance', 0],
        ['Source alpha', 1],
      ],
      initial.heightSource,
    );
    const strength = h('input', {
      type: 'number',
      class: 'num',
      min: 0,
      max: 10,
      step: 0.1,
      value: String(initial.normalStrength),
    });
    const flipY = h('input', { type: 'checkbox', checked: initial.normalFlipY });
    const flipRed = h('input', { type: 'checkbox', checked: initial.flipRed });
    const flipGreen = h('input', { type: 'checkbox', checked: initial.flipGreen });
    const height16 = h('input', { type: 'checkbox', checked: initial.height16 });
    const resolution = select(
      'resolution',
      callbacks.resolutions.map((r) => {
        const [w, hgt] = callbacks.dims(r);
        return [`${w} × ${hgt}`, r] as [string, number];
      }),
      initial.resolution,
    );
    const prefix = h('input', { type: 'text', class: 'dialog-text', value: initial.prefix });
    const zip = select(
      'zip',
      [
        ['One ZIP', 1],
        ['Separate PNGs', 0],
      ],
      initial.zip ? 1 : 0,
    );

    const option = (label: string, input: HTMLElement) =>
      h('label', { class: 'export-option' }, h('span', { text: label }), input);
    const extras: Record<MapKind, HTMLElement[]> = {
      color: [
        option('Alpha', alphaMode),
        option('Flip R (flowmap X)', flipRed),
        option('Flip G (flowmap Y)', flipGreen),
      ],
      normal: [option('Strength', strength), option('DirectX (flip Y)', flipY)],
      height: [option('Source', heightSource), option('16-bit PNG', height16)],
    };
    const cards = MAPS.map(({ kind, label, hint }) => {
      const check = h('input', { type: 'checkbox', checked: initial.maps[kind] });
      checks.set(kind, check);
      const img = h('img', { class: 'export-preview', alt: `${label} preview` });
      previews.set(kind, img);
      return h(
        'div',
        { class: 'export-map', 'data-map': kind },
        h('label', { class: 'export-map-title', title: hint }, check, h('span', { text: label })),
        img,
        ...extras[kind],
      );
    });

    const read = (): ExportMapsOptions => ({
      maps: {
        color: checks.get('color')!.checked,
        normal: checks.get('normal')!.checked,
        height: checks.get('height')!.checked,
      },
      alphaMode: Number(alphaMode.value),
      heightSource: Number(heightSource.value),
      normalStrength: Math.max(0, Number(strength.value) || 0),
      normalFlipY: flipY.checked,
      flipRed: flipRed.checked,
      flipGreen: flipGreen.checked,
      height16: height16.checked,
      resolution: Number(resolution.value),
      prefix: prefix.value.trim() || initial.prefix,
      zip: zip.value === '1',
    });

    const exportBtn = h('button', {
      type: 'submit',
      class: 'btn btn-primary',
      value: 'ok',
      text: 'Export',
    });
    const refresh = () => {
      const o = read();
      for (const { kind } of MAPS) {
        previews.get(kind)!.src = callbacks.preview(kind, o);
        cards.find((c) => c.dataset.map === kind)?.classList.toggle('off', !o.maps[kind]);
      }
      exportBtn.disabled = !Object.values(o.maps).some(Boolean);
    };
    const refreshSoon = debounce(refresh, 120);

    const form = h(
      'form',
      { method: 'dialog', class: 'export-form' },
      h('h2', { text: 'Export maps' }),
      h('div', { class: 'export-maps' }, ...cards),
      h(
        'div',
        { class: 'export-global' },
        option('Resolution', resolution),
        option('File prefix', prefix),
        option('Package', zip),
      ),
      h(
        'div',
        { class: 'dialog-buttons' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'Cancel',
          onclick: () => dialog.close('cancel'),
        }),
        exportBtn,
      ),
    );
    const dialog = h('dialog', { class: 'dialog export-dialog' }, form);
    form.addEventListener('input', () => refreshSoon());
    form.addEventListener('change', () => refreshSoon());
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok';
      const o = read();
      dialog.remove();
      resolve(ok ? o : null);
    });
    document.body.append(dialog);
    dialog.showModal();
    refresh();
  });
}
