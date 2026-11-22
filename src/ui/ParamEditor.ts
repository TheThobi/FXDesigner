import { h } from './dom';
import { icon } from './icons';
import { openColorPicker } from './controls/colorPicker';

/** Same shape as app/state.ts CustomParamSpec (the UI doesn't depend on the app layer). */
export interface EditableParam {
  readonly key: string;
  readonly label: string;
  readonly type: 'float' | 'int' | 'bool' | 'color';
  readonly min: number;
  readonly max: number;
  readonly default: number | boolean | string;
  readonly group: string;
}

export interface ParamEditorOptions {
  readonly params: readonly EditableParam[];
  /** Parameters of the generator itself (read-only, listed for reference). */
  readonly builtIn: readonly {
    readonly key: string;
    readonly label: string;
    readonly type: string;
  }[];
  /** A new parameter named `label` (the app picks a unique uniform key). */
  readonly onAdd: (label: string) => void;
  readonly onChange: (params: readonly EditableParam[]) => void;
}

const TYPES: readonly [EditableParam['type'], string][] = [
  ['float', 'Float'],
  ['int', 'Integer'],
  ['bool', 'Toggle'],
  ['color', 'Color'],
];

/**
 * Parameter creation for custom nodes (like material parameters in Unreal): each row is a
 * slider, toggle or color of the node, exposed to the code as `u_<key>`, with its range,
 * default and panel category.
 */
export class ParamEditor {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private readonly builtIn: HTMLElement;
  private opts: ParamEditorOptions | null = null;

  constructor() {
    this.list = h('div', { class: 'pe-list' });
    this.builtIn = h('p', { class: 'pe-builtin' });
    this.element = h(
      'section',
      { class: 'pe' },
      h(
        'div',
        { class: 'pe-head' },
        h('span', { class: 'group-title', text: 'Parameters' }),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small',
            title: 'New parameter (a uniform of this node)',
            onclick: () => this.opts?.onAdd('New parameter'),
          },
          icon('zoomIn', 12),
          'Add',
        ),
      ),
      this.list,
      this.builtIn,
    );
  }

  render(opts: ParamEditorOptions): void {
    this.opts = opts;
    this.builtIn.textContent = opts.builtIn.length
      ? `Generator parameters: ${opts.builtIn.map((p) => `u_${p.key}`).join(', ')}`
      : '';
    this.list.replaceChildren(
      ...(opts.params.length
        ? [
            h(
              'div',
              { class: 'pe-row pe-labels' },
              ...['Name', 'Type', 'Default', 'Min', 'Max', 'Category', ''].map((t) =>
                h('span', { text: t }),
              ),
            ),
          ]
        : [h('p', { class: 'pe-empty', text: 'No parameters yet: Add creates a slider.' })]),
      ...opts.params.map((p, i) => this.row(p, i)),
    );
  }

  private update(index: number, patch: Partial<EditableParam>): void {
    const opts = this.opts;
    if (!opts) return;
    const params = opts.params.map((p, i) => (i === index ? { ...p, ...patch } : p));
    opts.onChange(params);
  }

  private row(p: EditableParam, index: number): HTMLElement {
    const text = (value: string, label: string, apply: (v: string) => void, cls = '') => {
      const input = h('input', {
        type: 'text',
        class: `pe-input ${cls}`,
        value,
        'aria-label': label,
      });
      input.addEventListener('change', () => apply(input.value));
      return input;
    };
    const number = (value: number, label: string, apply: (v: number) => void, disabled = false) => {
      const input = h('input', {
        type: 'number',
        class: 'pe-input pe-num',
        value: String(value),
        step: p.type === 'int' ? 1 : 'any',
        disabled,
        'aria-label': label,
      });
      input.addEventListener('change', () => {
        const n = Number(input.value);
        if (Number.isFinite(n)) apply(p.type === 'int' ? Math.round(n) : n);
      });
      return input;
    };
    const type = h(
      'select',
      { class: 'pe-input', 'aria-label': 'Type' },
      ...TYPES.map(([v, l]) => h('option', { value: v, text: l, selected: v === p.type })),
    );
    type.addEventListener('change', () => {
      const t = type.value as EditableParam['type'];
      const def = t === 'bool' ? false : t === 'color' ? '#ffffff' : p.min;
      this.update(index, { type: t, default: def });
    });
    let defaultCell: HTMLElement;
    if (p.type === 'bool') {
      const box = h('input', {
        type: 'checkbox',
        checked: p.default === true,
        'aria-label': 'Default',
      });
      box.addEventListener('change', () => this.update(index, { default: box.checked }));
      defaultCell = box;
    } else if (p.type === 'color') {
      const color = typeof p.default === 'string' ? p.default : '#ffffff';
      const swatch = h('button', {
        type: 'button',
        class: 'gradient-swatch',
        'aria-label': 'Default color',
      });
      swatch.style.setProperty('--c', color);
      swatch.style.setProperty('--a', '1');
      swatch.addEventListener('click', () =>
        openColorPicker(
          swatch,
          { color, alpha: 1 },
          (c) => this.update(index, { default: c.color }),
          {
            alpha: false,
          },
        ),
      );
      defaultCell = swatch;
    } else {
      defaultCell = number(Number(p.default) || 0, 'Default', (v) =>
        this.update(index, { default: v }),
      );
    }
    const ranged = p.type === 'float' || p.type === 'int';
    return h(
      'div',
      { class: 'pe-row' },
      text(p.label, 'Name', (v) => this.update(index, { label: v.trim() || p.label })),
      type,
      defaultCell,
      number(p.min, 'Min', (v) => this.update(index, { min: v }), !ranged),
      number(p.max, 'Max', (v) => this.update(index, { max: v }), !ranged),
      text(p.group, 'Category', (v) => this.update(index, { group: v.trim() }), 'pe-group'),
      h(
        'span',
        { class: 'pe-tail' },
        h('code', { class: 'pe-key', text: `u_${p.key}`, title: 'Uniform name in the code' }),
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            title: 'Remove parameter',
            'aria-label': 'Remove parameter',
            onclick: () => this.opts?.onChange(this.opts.params.filter((_, i) => i !== index)),
          },
          icon('close', 10),
        ),
      ),
    );
  }
}
