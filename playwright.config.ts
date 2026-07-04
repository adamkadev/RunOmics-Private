import { defineConfig, devices } from '@playwright/test'

// Runs against a real build (`next start`), not `next dev` - ISR/SSG timing
// and cache headers differ enough to matter, and matches what's deployed.
// The server needs Firebase Admin credentials for the runomics-dev project
// (see README > "End-to-end tests") to prerender Firestore-backed pages.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run e2e:build && npm run e2e:start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
