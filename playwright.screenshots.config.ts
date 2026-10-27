import fs from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig, devices } from '@playwright/test'
import { EMULATORS_COMMAND, AUTH_EMULATOR_HOST } from './e2e/owner'

const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)

const baseURL = process.env.SCREENSHOT_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`

// The app runs from the home screen with no Safari toolbars, so the viewport is the phone's whole screen.
const phone = devices['iPhone 15 Pro']
const PHONE_SCREEN = { width: 393, height: 852 }

// .env.e2e leaves the MapTiler token unset: borrow .env.local's so the map has tiles.
function localMapTilerToken(): string | undefined {
  if (process.env.NEXT_PUBLIC_MAPTILER_TOKEN) return process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  try {
    return parseEnv(fs.readFileSync('.env.local', 'utf8')).NEXT_PUBLIC_MAPTILER_TOKEN || undefined
  } catch {
    return undefined
  }
}

const mapTilerToken = localMapTilerToken()

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
    // Legible at 2x with half the pixels of the phone's 3x; tools that read screenshots shrink anything larger.
    deviceScaleFactor: 2,
    defaultBrowserType: 'chromium',
    locale: 'en-US',
    launchOptions: { executablePath },
  },
  ...(process.env.SCREENSHOT_BASE_URL
    ? {}
    : {
        webServer: [
          // For the owner Settings capture (e2e/owner.ts).
          {
            command: EMULATORS_COMMAND,
            url: `http://${AUTH_EMULATOR_HOST}`,
            wait: { stdout: /All emulators ready/ },
            reuseExistingServer: true,
            timeout: 120_000,
          },
          {
            command: 'npm run e2e:build && npm run e2e:start',
            url: baseURL,
            reuseExistingServer: true,
            timeout: 300_000,
            // Inlined at build time; dotenv won't override it.
            env: mapTilerToken ? { NEXT_PUBLIC_MAPTILER_TOKEN: mapTilerToken } : {},
          },
        ],
      }),
})
