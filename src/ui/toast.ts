import { h } from './dom';

let container: HTMLElement | null = null;

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export function toast(
  message: string,
  kind: 'info' | 'error' = 'info',
  durationMs = 2800,
  action?: ToastAction,
): void {
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  const el = h('div', { class: `toast toast-${kind}` }, h('span', { text: message }));
  const leave = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  };
  if (action) {
    el.append(
      h('button', {
        class: 'toast-action',
        text: action.label,
        onclick: () => {
          leave();
          action.run();
        },
      }),
    );
  }
  // Above an open modal window (the page under it is not shown in front of it).
  const dialogs = document.querySelectorAll('dialog[open]');
  const host = dialogs[dialogs.length - 1] ?? document.body;
  if (container.parentElement !== host) host.append(container);
  container.append(el);
  setTimeout(leave, durationMs);
}
