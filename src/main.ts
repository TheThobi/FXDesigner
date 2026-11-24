import './styles/main.css';
import { App } from './app/App';
import { WebGL2UnavailableError } from './engine/gl/GpuContext';

const root = document.getElementById('app');
if (!root) throw new Error('#app element missing');

try {
  new App(root);
} catch (e) {
  console.error(e);
  const message =
    e instanceof WebGL2UnavailableError
      ? 'Your browser or GPU does not support WebGL2, which this application requires.'
      : `Failed to start: ${e instanceof Error ? e.message : String(e)}`;
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = message;
  root.replaceChildren(box);
}

// Offline use and instant reloads (production builds only; tests run without it).
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !new URLSearchParams(window.location.search).has('e2e')
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch((e: unknown) => {
      console.warn('Service worker registration failed', e);
    });
  });
}
