import { defineConfig, devices } from '@playwright/test'
import type { AppOptions } from './e2e/fixtures'
import { EMULATORS_COMMAND, AUTH_EMULATOR_HOST } from './e2e/owner'

const PORT = process.env.PORT ?? '3000'
const SPARSE_PORT = String(Number(PORT) + 1)
// Chromium at the phone's size: no WebKit and its system libraries to install for a run.
const phone = { ...devices['iPhone 16 Pro'], browserName: 'chromium' as const, serviceWorkers: 'block' as const, reducedMotion: 'reduce' as const }

export default defineConfig<AppOptions>({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '100%' : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'UTC',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /(sparse|a11y)\.spec\.ts/ },
    // The second athlete's deployment: French, a Forerunner 55's sparse data and a run/walk return, at her phone's size.
    {
      name: 'sparse-fr',
      use: { ...phone, baseURL: `http://localhost:${SPARSE_PORT}`, locale: 'fr-FR', appLocale: 'fr' },
      testMatch: /(dashboard|plan|sparse|a11y)\.spec\.ts/,
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
      env: { TZ: 'UTC' },
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
        TZ: 'UTC',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
