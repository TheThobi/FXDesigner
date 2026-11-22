import { h } from './dom';
import { icon } from './icons';
import { attachPopover } from './popover';

export interface AccountState {
  readonly available: boolean;
  readonly discord: boolean;
  readonly registration: boolean;
  readonly user: { readonly pseudo: string; readonly email: string | null } | null;
  readonly status: string | null;
  readonly busy: boolean;
}

export interface AccountActions {
  readonly login: (login: string, password: string) => Promise<void>;
  readonly register: (pseudo: string, email: string, password: string) => Promise<void>;
  readonly discord: () => void;
  readonly logout: () => Promise<void>;
  readonly syncNow: () => Promise<void>;
  readonly openLibrary: () => void;
}

const DISCORD_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2.1a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.5-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.4 8 10.4s2.2 1.1 2.2 2.5S9.2 15.3 8 15.3zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.5 2.2-2.5 2.2 1.1 2.2 2.5-1 2.4-2.2 2.4z"/></svg>';

/**
 * Sign-in window: sign in (pseudo or email + password), create an account (pseudo, email,
 * password) or continue with Discord.
 */
export function openAuthDialog(state: AccountState, actions: AccountActions): void {
  let mode: 'login' | 'register' = 'login';
  const error = h('p', { class: 'auth-error', hidden: true });
  const field = (label: string, input: HTMLInputElement) =>
    h('label', { class: 'auth-field' }, h('span', { text: label }), input);
  const login = h('input', { type: 'text', autocomplete: 'username', required: true });
  const pseudo = h('input', {
    type: 'text',
    autocomplete: 'username',
    pattern: '[A-Za-z0-9_.\\-]{3,24}',
    title: '3 to 24 letters, digits, _ . or -',
  });
  const email = h('input', { type: 'email', autocomplete: 'email' });
  const password = h('input', {
    type: 'password',
    autocomplete: 'current-password',
    required: true,
  });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary auth-submit' });
  const switchLink = h('button', { type: 'button', class: 'auth-switch' });
  const loginFields = h('div', { class: 'auth-fields' }, field('Pseudo or email', login));
  const registerFields = h(
    'div',
    { class: 'auth-fields' },
    field('Pseudo', pseudo),
    field('Email', email),
  );
  const form = h(
    'form',
    { class: 'auth-form' },
    loginFields,
    registerFields,
    field('Password', password),
    error,
    submit,
  );
  const discord = h('button', {
    type: 'button',
    class: 'btn auth-discord',
    onclick: () => actions.discord(),
  });
  discord.innerHTML = `${DISCORD_ICON}<span>Continue with Discord</span>`;
  const title = h('h2');
  const dialog = h(
    'dialog',
    { class: 'dialog auth-dialog' },
    title,
    h(
      'div',
      { class: 'auth-body' },
      state.discord ? discord : null,
      state.discord ? h('div', { class: 'auth-or', text: 'or' }) : null,
      form,
      state.registration ? switchLink : null,
      h('p', {
        class: 'auth-note',
        text: 'Your library is saved to your account and synced on every device.',
      }),
    ),
  );

  const render = () => {
    const reg = mode === 'register';
    title.textContent = reg ? 'Create an account' : 'Sign in';
    loginFields.hidden = reg;
    registerFields.hidden = !reg;
    login.required = !reg;
    pseudo.required = reg;
    email.required = reg;
    password.autocomplete = reg ? 'new-password' : 'current-password';
    password.minLength = reg ? 8 : 0;
    submit.textContent = reg ? 'Create account' : 'Sign in';
    switchLink.textContent = reg ? 'I already have an account' : 'Create an account';
    error.hidden = true;
  };
  switchLink.addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    render();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit.disabled = true;
    const done =
      mode === 'login'
        ? actions.login(login.value.trim(), password.value)
        : actions.register(pseudo.value.trim(), email.value.trim(), password.value);
    done.then(
      () => dialog.close(),
      (err: unknown) => {
        error.textContent = err instanceof Error ? err.message : String(err);
        error.hidden = false;
        submit.disabled = false;
      },
    );
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  render();
  document.body.append(dialog);
  dialog.showModal();
  (state.discord ? discord : login).focus();
}

/**
 * Toolbar account control: "Sign in" when signed out, the pseudo with a menu (sync status,
 * sync now, library, sign out) when signed in. Hidden when the server has no accounts.
 */
export class AccountButton {
  readonly element: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private state: AccountState | null = null;

  constructor(private readonly actions: AccountActions) {
    this.button = h('button', { class: 'tool-btn account-btn' });
    this.panel = h('div', { class: 'menu-panel account-menu', role: 'menu' });
    this.element = h(
      'div',
      { class: 'tool-group menu-root account-root', hidden: true },
      this.button,
      this.panel,
    );
    const popover = attachPopover(this.element, this.button, this.panel, () =>
      this.buildMenu(() => popover.close()),
    );
    // Signed out, the button opens the sign-in window instead of the menu.
    this.button.addEventListener(
      'click',
      (e) => {
        if (this.state?.user) return;
        e.stopImmediatePropagation();
        if (this.state) openAuthDialog(this.state, this.actions);
      },
      { capture: true },
    );
  }

  update(state: AccountState): void {
    this.state = state;
    this.element.hidden = !state.available;
    const user = state.user;
    const dot = state.busy ? ' busy' : state.status?.startsWith('Not') ? ' error' : '';
    this.button.replaceChildren(
      icon('account', 18),
      h('span', { class: 'label', text: user ? user.pseudo : 'Sign in' }),
      ...(user ? [h('span', { class: `sync-dot${dot}` })] : []),
    );
    this.button.title = user
      ? (state.status ?? user.pseudo)
      : 'Sign in to save your library to an account';
  }

  private buildMenu(close: () => void): void {
    const s = this.state;
    if (!s?.user) return;
    const item = (label: string, run: () => void) =>
      h(
        'button',
        {
          class: 'menu-item',
          role: 'menuitem',
          onclick: () => {
            close();
            run();
          },
        },
        h('span', { class: 'menu-check' }),
        h('span', { text: label }),
      );
    this.panel.replaceChildren(
      h(
        'div',
        { class: 'account-head' },
        h('strong', { text: s.user.pseudo }),
        s.user.email ? h('span', { text: s.user.email }) : null,
        h('span', { class: 'account-status', text: s.status ?? '' }),
      ),
      h('div', { class: 'menu-sep' }),
      item('Sync now', () => void this.actions.syncNow()),
      item('Library…', () => this.actions.openLibrary()),
      h('div', { class: 'menu-sep' }),
      item('Sign out', () => void this.actions.logout()),
    );
  }
}
