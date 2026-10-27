import { defineConfig, devices } from '@playwright/test'
import type { AppOptions } from './e2e/fixtures'
import { EMULATORS_COMMAND, AUTH_EMULATOR_HOST } from './e2e/owner'

const PORT = process.env.PORT ?? '3000'
const SPARSE_PORT = String(Number(PORT) + 1)
const iphone = { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' as const, reducedMotion: 'reduce' as const }

export default defineConfig<AppOptions>({
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /(layout|sparse|a11y)\.spec\.ts/ },
    // Safari at the athlete's phone, where text past an edge shows first; reduced motion skips waiting for animations.
    { name: 'iphone', use: iphone, testMatch: /(layout|swipe)\.spec\.ts/ },
    // The second athlete's deployment: French, a Forerunner 55's sparse data and a run/walk return, on her phone.
    {
      name: 'sparse-fr',
      use: { ...iphone, baseURL: `http://localhost:${SPARSE_PORT}`, locale: 'fr-FR', appLocale: 'fr' },
      testMatch: /(layout|dashboard|plan|analytics|sparse|a11y|swipe)\.spec\.ts/,
    },
  ],
  webServer: [
    // Checked on Auth's port: a Firestore emulator left by a killed run then fails the start rather than being reused.
    {
      command: EMULATORS_COMMAND,
      url: `http://${AUTH_EMULATOR_HOST}`,
      wait: { stdout: /All emulators ready/ },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run e2e:build && npm run e2e:start',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run e2e:build && npm run e2e:start',
      url: `http://localhost:${SPARSE_PORT}`,
      env: {
        RUNOMICS_E2E_PROFILE: 'sparse',
        RUNOMICS_DATA_DIR: '.e2e-data-sparse',
        NEXT_DIST_DIR: '.next-e2e-sparse',
        NEXT_PUBLIC_LOCALE: 'fr',
        PORT: SPARSE_PORT,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
