import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import type { AppOptions } from './e2e/fixtures'
import { AUTH_EMULATOR_HOST, EMULATORS_COMMAND } from './e2e/owner'
import { FIXED_NOW } from './e2e/visual/fixedNow'

const PORT = 3200
const SPARSE_PORT = PORT + 1
const phone = { ...devices['iPhone 15 Pro'], defaultBrowserType: 'chromium' as const, viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 }

const server = (port: number, env: Record<string, string>) => ({
  command: 'npm run e2e:build && npm run e2e:start',
  url: `http://localhost:${port}`,
  reuseExistingServer: !process.env.CI,
  timeout: 300_000,
  env: {
    NODE_OPTIONS: `--import ${path.resolve('e2e/visual/fixedClock.mjs')}`,
    RUNOMICS_FIXED_NOW: FIXED_NOW,
    RUNOMICS_E2E_SUITE: 'visual',
    TZ: 'UTC',
    PORT: String(port),
    ...env,
  },
})

export default defineConfig<AppOptions>({
  testDir: './e2e/visual',
  testMatch: /\.visual\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  outputDir: './test-results/visual',
  // One baseline per screen, made on Linux CI (.github/workflows/visual.yml): another OS draws text differently.
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  updateSnapshots: 'none',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: { ...phone, timezoneId: 'UTC', reducedMotion: 'reduce', serviceWorkers: 'block' },
  projects: [
    { name: 'rich-light', use: { baseURL: `http://localhost:${PORT}`, colorScheme: 'light', locale: 'en-US' } },
    { name: 'rich-dark', use: { baseURL: `http://localhost:${PORT}`, colorScheme: 'dark', locale: 'en-US' } },
    { name: 'sparse-fr-light', use: { baseURL: `http://localhost:${SPARSE_PORT}`, colorScheme: 'light', locale: 'fr-FR', appLocale: 'fr' } },
    { name: 'sparse-fr-dark', use: { baseURL: `http://localhost:${SPARSE_PORT}`, colorScheme: 'dark', locale: 'fr-FR', appLocale: 'fr' } },
  ],
  webServer: [
    // A run page reads its note from Firestore, which .env.e2e points at the emulator.
    {
      command: EMULATORS_COMMAND,
      url: `http://${AUTH_EMULATOR_HOST}`,
      wait: { stdout: /All emulators ready/ },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    server(PORT, { RUNOMICS_DATA_DIR: '.visual-data', NEXT_DIST_DIR: '.next-visual' }),
    server(SPARSE_PORT, {
      RUNOMICS_E2E_PROFILE: 'sparse',
      RUNOMICS_DATA_DIR: '.visual-data-sparse',
      NEXT_DIST_DIR: '.next-visual-sparse',
      NEXT_PUBLIC_LOCALE: 'fr',
    }),
  ],
})
