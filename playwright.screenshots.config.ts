import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)

const baseURL = process.env.SCREENSHOT_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`

// The app is used from the home screen, where it has the whole screen - no
// Safari toolbars - so the viewport is the phone's screen rather than the
// preset's in-browser viewport. capture.spec.ts adds the safe areas.
const phone = devices['iPhone 15 Pro']
const PHONE_SCREEN = { width: 393, height: 852 }

export default defineConfig({
  testDir: './screenshots',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './screenshots/.pw-artifacts',
  use: {
    baseURL,
    ...phone,
    viewport: PHONE_SCREEN,
    // Every caption is legible at 2x, with half the pixels of the phone's 3x:
    // tools that read screenshots shrink anything larger anyway.
    deviceScaleFactor: 2,
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
