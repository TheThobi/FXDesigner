import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against the production build. Run inside the official Playwright
 * image (see `make e2e`) so browsers and system deps match the @playwright/test version.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
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
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
