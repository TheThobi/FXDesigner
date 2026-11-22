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
  container.append(el);
  setTimeout(leave, durationMs);
}
