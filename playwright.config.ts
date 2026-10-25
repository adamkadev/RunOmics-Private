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
    // Safari at the athlete's phone, where text past an edge shows first; reduced motion skips waiting for animations.
    {
      name: 'iphone',
      use: { ...devices['iPhone 16 Pro'], serviceWorkers: 'block', reducedMotion: 'reduce' },
      testMatch: /layout\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run e2e:build && npm run e2e:start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
