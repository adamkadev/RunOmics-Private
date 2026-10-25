import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT ?? '3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '100%' : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /layout\.spec\.ts/ },
    // Safari's engine at the athlete's own phone, where the app is used: text past an edge shows there first.
    { name: 'iphone', use: { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }, testMatch: /layout\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run e2e:build && npm run e2e:start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
