import { defineConfig, devices } from '@playwright/test'

// Configurable target lets the same suite run against local dev,
// preview URLs, or a staging deployment without editing this file.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list'], ['github']],

  // Global timeouts — set once here rather than scattered inline per-test.
  timeout: 30_000,              // max wall time per test
  expect: { timeout: 8_000 },   // max time for each expect() assertion

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'tablet',        use: { ...devices['iPad (gen 7)'] } },
  ],
  // Only auto-start a dev server when testing against localhost. For staging
  // URLs the webServer block would try to start a local server on top of the
  // remote target — we skip it instead.
  webServer: BASE_URL.startsWith('http://localhost')
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : undefined,
})
