import { h } from './dom';
import { icon } from './icons';

/** The project's public repository (source code, issues). */
export const REPOSITORY_URL = 'https://github.com/TheThobi/FXDesigner';

const link = (href: string, text: string) =>
  h('a', { href, text, target: '_blank', rel: 'noopener noreferrer' });

/** File → About: what FX Designer is, its source code, license and where to report bugs. */
export function openAbout(): void {
  const dialog = h(
    'dialog',
    { class: 'dialog about-dialog', 'aria-label': 'About FX Designer' },
    h(
      'form',
      { method: 'dialog' },
      h('h2', { text: 'FX Designer' }),
      h('p', {
        class: 'dialog-info',
        text:
          'A browser-based designer of procedural effect textures for games: node graphs of ' +
          'generators, operators and simulations, exported as textures, maps and flipbooks.',
      }),
      h(
        'p',
        { class: 'dialog-info' },
        'The source code is on ',
        link(REPOSITORY_URL, 'GitHub'),
        '. Anyone can contribute: ideas, bug reports (',
        link(`${REPOSITORY_URL}/issues`, 'open an issue'),
        '), nodes and fixes, or effects shared in the Community window.',
      ),
      h('h3', { class: 'about-heading', text: 'Made with AI' }),
      h('p', {
        class: 'dialog-info',
        text:
          'Most of the code and documentation was written by AI assistants (Claude and ' +
          'ChatGPT): that is what made a tool of this size possible in a reasonable time for ' +
          'one person, who is also its first user and builds it as a texture production tool ' +
          'for real game work. The author designs the features, tests them in production and ' +
          'decides; the assistants write the code, tests and docs.',
      }),
      h('p', {
        class: 'dialog-info about-license',
        text:
          'License: PolyForm Noncommercial 1.0.0 with the FX Designer Commercial Output ' +
          'Permission. What you make with it (textures, flipbooks, maps) can be used in any ' +
          'project, commercial games included. See LICENSE.md in the repository.',
      }),
      h(
        'div',
        { class: 'dialog-buttons' },
        h(
          'a',
          {
            class: 'btn',
            href: REPOSITORY_URL,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          icon('github', 14),
          'GitHub',
        ),
        h('button', { type: 'submit', class: 'btn btn-primary', text: 'Close' }),
      ),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
