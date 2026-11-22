import { h } from './dom';
import { icon } from './icons';
import { openColorPicker } from './controls/colorPicker';
import { createControl } from './controls';
import type { ParamDef, ParamType, ParamValue } from '../params/types';

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
  readonly nodeKey: string;
  readonly builtIn: readonly ParamDef[];
  readonly onBaseChange: (key: string, edit: BaseEdit | null) => void;
  /** A new parameter named `label` (the app picks a unique uniform key). */
  readonly onAdd: (label: string) => void;
  readonly onChange: (params: readonly EditableParam[]) => void;
}

export interface BaseEdit {
  readonly label: string;
  readonly type: ParamType;
  readonly group: string;
  readonly default: ParamValue;
  readonly min?: number;
  readonly max?: number;
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
  private opts: ParamEditorOptions | null = null;
  private readonly expanded = new Map<string, Set<string>>();

  constructor() {
    this.list = h('div', { class: 'pe-list' });
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
    );
  }

  render(opts: ParamEditorOptions): void {
    let open = this.expanded.get(opts.nodeKey);
    if (!open) this.expanded.set(opts.nodeKey, (open = new Set()));
    this.opts = opts;
    const section = (
      key: string,
      label: string,
      type: string,
      body: HTMLElement,
      remove: () => void,
    ) => {
      const row = h(
        'details',
        { class: 'pe-param', open: open.has(key) },
        h(
          'summary',
          {},
          h('span', { class: 'pe-type-icon', 'data-type': type, title: type }),
          h('span', { text: label }),
          h('code', { class: 'pe-key', text: `u_${key}` }),
        ),
        body,
      );
      const close = h(
        'button',
        {
          type: 'button',
          class: 'icon-btn pe-remove',
          title: 'Remove parameter',
          'aria-label': `Remove parameter ${label}`,
          onclick: remove,
        },
        icon('close', 10),
      );
      row.addEventListener('toggle', () => {
        if (!row.isConnected) return;
        if (row.open) open.add(key);
        else open.delete(key);
      });
      return h('div', { class: 'pe-entry', 'data-param': key }, row, close);
    };
    this.list.replaceChildren(
      ...opts.builtIn.map((def) => {
        const config: BaseEdit = {
          label: def.label,
          type: def.type,
          group: def.group ?? '',
          default: def.default,
          ...('min' in def ? { min: def.min, max: def.max } : {}),
        };
        const patch = (edit: Partial<BaseEdit>) =>
          opts.onBaseChange(def.key, { ...config, ...edit });
        return section(def.key, def.label, def.type, this.fields(config, patch, def), () =>
          opts.onBaseChange(def.key, null),
        );
      }),
      ...opts.params.map((p, i) =>
        section(
          p.key,
          p.label,
          p.type,
          this.fields(p, (patch) => this.update(i, patch as Partial<EditableParam>)),
          () => opts.onChange(opts.params.filter((_, index) => index !== i)),
        ),
      ),
    );
  }

  expand(nodeKey: string, key: string): void {
    const open = this.expanded.get(nodeKey) ?? new Set<string>();
    open.add(key);
    this.expanded.set(nodeKey, open);
  }

  private update(index: number, patch: Partial<EditableParam>): void {
    const opts = this.opts;
    if (!opts) return;
    const params = opts.params.map((p, i) => (i === index ? { ...p, ...patch } : p));
    opts.onChange(params);
  }

  private fields(
    p: BaseEdit,
    update: (patch: Partial<BaseEdit>) => void,
    def?: ParamDef,
  ): HTMLElement {
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
    const number = (value: number, label: string, apply: (v: number) => void) => {
      const input = h('input', {
        type: 'number',
        class: 'pe-input pe-num',
        value: String(value),
        step: p.type === 'int' ? 1 : 'any',
        'aria-label': label,
      });
      input.addEventListener('change', () => {
        const n = Number(input.value);
        if (Number.isFinite(n)) apply(p.type === 'int' ? Math.round(n) : n);
      });
      return input;
    };
    const types: [ParamType, string][] = [...TYPES];
    if (def && !types.some(([value]) => value === p.type)) types.unshift([p.type, p.type]);
    const type = h(
      'select',
      { class: 'pe-input', 'aria-label': 'Type' },
      ...types.map(([v, l]) => h('option', { value: v, text: l, selected: v === p.type })),
    );
    type.addEventListener('change', () => {
      const t = type.value as EditableParam['type'];
      const value = t === 'bool' ? false : t === 'color' ? '#ffffff' : (p.min ?? 0);
      update({ type: t, default: value });
    });
    let defaultCell: HTMLElement;
    if (p.type === 'bool') {
      const box = h('input', {
        type: 'checkbox',
        checked: p.default === true,
        'aria-label': 'Default',
      });
      box.addEventListener('change', () => update({ default: box.checked }));
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
        openColorPicker(swatch, { color, alpha: 1 }, (c) => update({ default: c.color }), {
          alpha: false,
        }),
      );
      defaultCell = swatch;
    } else if (p.type === 'int' || p.type === 'float' || !def) {
      defaultCell = number(Number(p.default) || 0, 'Default', (v) => update({ default: v }));
    } else {
      defaultCell = createControl(def, p.default, (value) => update({ default: value })).element;
    }
    const field = (label: string, control: HTMLElement) =>
      h('label', {}, h('span', { text: label }), control);
    return h(
      'div',
      { class: 'pe-config' },
      h(
        'div',
        { class: 'pe-fields pe-identity' },
        field(
          'Name',
          text(p.label, 'Name', (v) => update({ label: v.trim() || p.label })),
        ),
        field('Type', type),
      ),
      h(
        'div',
        { class: 'pe-fields pe-values' },
        field('Default', defaultCell),
        p.min !== undefined
          ? field(
              'Min',
              number(p.min, 'Min', (v) => update({ min: v })),
            )
          : null,
        p.max !== undefined
          ? field(
              'Max',
              number(p.max, 'Max', (v) => update({ max: v })),
            )
          : null,
      ),
      h(
        'div',
        { class: 'pe-fields' },
        field(
          'Category',
          text(p.group, 'Category', (v) => update({ group: v.trim() })),
        ),
      ),
    );
  }
}
