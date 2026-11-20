import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works at any sub-path (e.g. behind a
  // reverse proxy at https://nas.local/textures/).
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
