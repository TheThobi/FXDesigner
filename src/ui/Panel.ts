import { h } from './dom';
import { icon, type IconName } from './icons';

/** Docked panel with an Unreal-style tab header. Returns the panel and its body element. */
export function dockPanel(
  area: string,
  title: string,
  iconName: IconName,
  tag: 'aside' | 'main' | 'section' = 'section',
  onClose?: () => void,
): { panel: HTMLElement; body: HTMLElement } {
  const body = h('div', { class: 'panel-body' });
  const panel = h(
    tag,
    { class: `panel panel-${area}` },
    h(
      'div',
      { class: 'panel-tabs' },
      h('div', { class: 'panel-tab active' }, icon(iconName, 14), h('span', { text: title })),
    ),
    body,
  );
  if (onClose) addPanelClose(panel, `Hide ${title.toLowerCase()}`, onClose);
  return { panel, body };
}

/** Adds a close (hide) button at the right end of a panel's tab strip. */
export function addPanelClose(panel: HTMLElement, title: string, onClose: () => void): void {
  panel
    .querySelector('.panel-tabs')
    ?.append(
      h(
        'button',
        { class: 'panel-close', title, 'aria-label': title, onclick: onClose },
        icon('close', 12),
      ),
    );
}

export interface PanelTab {
  readonly id: string;
  readonly title: string;
  readonly icon: IconName;
}

export interface TabbedPanel {
  readonly panel: HTMLElement;
  /** Shared area above the tab pages (e.g. a search box). */
  readonly header: HTMLElement;
  readonly pages: Readonly<Record<string, HTMLElement>>;
  select(id: string): void;
  /** Small marker next to a tab title (e.g. count of modified values); null hides it. */
  setBadge(id: string, text: string | null): void;
}

/** Docked panel with several tabs, each owning a scrollable page. */
export function tabbedPanel(
  area: string,
  tabs: readonly PanelTab[],
  tag: 'aside' | 'section' = 'aside',
): TabbedPanel {
  const strip = h('div', { class: 'panel-tabs', role: 'tablist' });
  const header = h('div', { class: 'panel-header' });
  const body = h('div', { class: 'panel-body' }, header);
  const pages: Record<string, HTMLElement> = {};
  const buttons: Record<string, HTMLButtonElement> = {};
  const badges: Record<string, HTMLElement> = {};

  const select = (id: string) => {
    for (const t of tabs) {
      const active = t.id === id;
      buttons[t.id]?.classList.toggle('active', active);
      buttons[t.id]?.setAttribute('aria-selected', String(active));
      if (pages[t.id]) pages[t.id]!.hidden = !active;
    }
  };

  for (const t of tabs) {
    badges[t.id] = h('span', { class: 'tab-badge', hidden: true });
    buttons[t.id] = h(
      'button',
      { class: 'panel-tab', role: 'tab', 'data-tab': t.id, onclick: () => select(t.id) },
      icon(t.icon, 14),
      h('span', { text: t.title }),
      badges[t.id],
    );
    strip.append(buttons[t.id]!);
    pages[t.id] = h('div', { class: 'panel-page', role: 'tabpanel', 'data-page': t.id });
    body.append(pages[t.id]!);
  }
  select(tabs[0]?.id ?? '');

  return {
    panel: h(tag, { class: `panel panel-${area}` }, strip, body),
    header,
    pages,
    select,
    setBadge: (id, text) => {
      const b = badges[id];
      if (!b) return;
      b.hidden = text === null;
      b.textContent = text ?? '';
    },
  };
}
