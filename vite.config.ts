import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // The API server (`npm run dev:server`) listens on PORT from .env (3000 by default).
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Relative base so the static build works at any sub-path (e.g. behind a
    // reverse proxy at https://nas.local/textures/).
    base: './',
    // Dev server only: /api goes to the local API server.
    server: {
      proxy: { '/api': `http://localhost:${env.PORT || 3000}` },
    },
    // `vite preview` (e2e) serves the static build alone: no API proxy (its absence is the
    // static deployment case, the app hides accounts).
    preview: {
      proxy: {},
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      // The app is an offline PWA: generators (most of the weight, their GLSL) and every
      // offline tool stay in the main bundle; only network-bound windows load on demand
      // (Community). ~230 kB gzipped.
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
    },
  };
});
