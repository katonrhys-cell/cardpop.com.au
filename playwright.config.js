import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run a real Chromium against the production build served by
// `vite preview`. They live in ./e2e and are intentionally separate from the
// vitest unit/integration suites under ./tests.
//
// Chromium is pre-installed in this environment (PLAYWRIGHT_BROWSERS_PATH);
// do not run `playwright install`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Build then serve the real production bundle, exactly as users receive it.
  // Bind to IPv4 explicitly (the default `--host ::` is unsupported in some
  // sandboxes).
  webServer: {
    command: 'npm run build && vite preview --outDir dist --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
