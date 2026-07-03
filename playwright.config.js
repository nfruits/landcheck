import { defineConfig, devices } from '@playwright/test';

const PORT = 8766;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // workers: 1 locally too — under WSL/sandboxed Chromium the worker startup
  // for the first 2-3 tests intermittently times out at browserContext.newPage,
  // independent of test code. Serial runs are ~22s for 53 tests, fast enough.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 5000,
    navigationTimeout: 10000,
    // The production pages ship a strict CSP (script-src 'self', no
    // 'unsafe-eval') — a real security control that stays enforced for users.
    // But Playwright's page.waitForFunction / string-form evaluate rely on
    // eval() in the page context, which that CSP blocks. bypassCSP lets the
    // TEST harness poll while production keeps the strict policy. Added
    // 2026-07-01 alongside the CSP.
    bypassCSP: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: `python -m http.server ${PORT} --bind 0.0.0.0`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
