import { defineConfig, devices } from '@playwright/test';

/** Set to iterate against a running dev server (e.g. http://localhost:5173) without a build. */
const devUrl = process.env.PW_BASE_URL;

/**
 * End-to-end smoke tests against the production build. Run inside the official Playwright
 * image (see `make e2e`) so browsers and system deps match the @playwright/test version.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // SwiftShader is slow: generous per-test budget (a real GPU is ~10× faster).
  timeout: 240_000,
  reporter: [['list']],
  use: {
    baseURL: devUrl ?? 'http://localhost:4173',
    viewport: { width: 1400, height: 900 },
    launchOptions: {
      // Software WebGL2 (SwiftShader) so tests run on headless machines without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
    },
  ],
  webServer: devUrl
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
