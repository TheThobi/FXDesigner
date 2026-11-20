import { gradientToCss, type GradientValue } from '../../params/gradient';
import type { GradientPreset } from '../../params/gradientPresets';
import { h } from '../dom';
import { icon } from '../icons';
import { attachPopover } from '../popover';

/**
 * "Presets ▾" button opening a popover of ramp swatches (preview + name), so presets can be
 * compared before applying one. Closes on pick, Escape or outside click.
 */
export function gradientPresetMenu(
  presets: readonly GradientPreset[],
  onPick: (value: GradientValue) => void,
): HTMLElement {
  const list = h('div', { class: 'ramp-menu', role: 'menu' });
  const button = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-small ramp-menu-btn',
      title: 'Color ramp presets',
    },
    h('span', { text: 'Presets' }),
    icon('chevronDown', 14),
  );
  const root = h('div', { class: 'ramp-menu-root' }, button, list);

  const popover = attachPopover(root, button, list, () => {
    if (list.childElementCount > 0) return;
    list.append(
      ...presets.map((p) =>
        h(
          'button',
          {
            type: 'button',
            class: 'ramp-item',
            role: 'menuitem',
            title: p.name,
            onclick: () => {
              popover.close();
              onPick(p.value);
            },
          },
          h('span', {
            class: 'ramp-swatch',
            style: `background: ${gradientToCss(p.value)}, var(--checker)`,
          }),
          h('span', { class: 'ramp-name', text: p.name }),
        ),
      ),
    );
  });
  return root;
}
