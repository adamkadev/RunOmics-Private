import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)

const baseURL = process.env.SCREENSHOT_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`

export default defineConfig({
  testDir: './screenshots',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './screenshots/.pw-artifacts',
  use: {
    baseURL,
    ...devices['iPhone 13'],
    defaultBrowserType: 'chromium',
    locale: 'en-US',
    launchOptions: { executablePath },
  },
  ...(process.env.SCREENSHOT_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run e2e:build && npm run e2e:start',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 300_000,
        },
      }),
})
