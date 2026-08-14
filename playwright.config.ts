import { defineConfig, devices } from '@playwright/test'

// Runs against a real build (`next start`), not `next dev` - ISR/SSG timing
// and cache headers differ enough to matter, and matches what's deployed.
// The server needs Firebase Admin credentials for the runomics-dev project
// (see README > "End-to-end tests") to prerender Firestore-backed pages.
//
// PORT overridable (default 3000): a personal dev server left running on
// 3000 would otherwise collide with this suite's own build/start.
const PORT = process.env.PORT ?? '3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run e2e:build && npm run e2e:start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
