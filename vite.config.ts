import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works at any sub-path (e.g. behind a
  // reverse proxy at https://nas.local/textures/).
  base: './',
  // `npm run dev:server` serves the API on :3000; the dev server forwards /api to it.
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
  },
});
