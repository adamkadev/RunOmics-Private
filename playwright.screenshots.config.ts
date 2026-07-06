import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Some managed CI/remote environments pre-provision a Chromium whose build
// number differs from the one this @playwright/test version would auto-download
// (downloads are blocked). When a pre-installed binary is present, launch it
// directly; otherwise fall back to Playwright's normal browser resolution.
const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)

/**
 * Standalone config for the light/dark screenshot audit (see screenshots/).
 * Kept separate from playwright.config.ts so it never runs in the normal e2e
 * suite and vice-versa.
 *
 * Mobile-first: the app is designed phone-first, so we capture through an
 * iPhone 13 viewport (390x844 @3x). Like the e2e config it runs against a real
 * production build (`next start`) for deployment-accurate rendering; set
 * `SCREENSHOT_BASE_URL` to point at an already-running server (or a deployed
 * URL) and skip the build entirely.
 */
const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './screenshots',
  // One page can spawn several dozen frames; give each screen room and run a
  // few in parallel without hammering a single dev server.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  timeout: 120_000,
  reporter: [['list']],
  // Screenshots are written straight to screenshots/output by the spec; keep
  // Playwright's own artifacts out of the way.
  outputDir: './screenshots/.pw-artifacts',
  use: {
    baseURL,
    // iPhone 13 metrics (390x844 @3x, mobile UA, touch) but driven by Chromium -
    // the preset defaults to WebKit, and only Chromium is provisioned here.
    ...devices['iPhone 13'],
    defaultBrowserType: 'chromium',
    // Deterministic locale so string-based waits behave regardless of the host.
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
