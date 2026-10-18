import fs from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig, devices } from '@playwright/test'
import { AUTH_EMULATOR_HOST } from './screenshots/owner'

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
        webServer: [
          // For the owner Settings capture (screenshots/owner.ts).
          {
            command: 'firebase emulators:start --only auth --project runomics-dev',
            url: `http://${AUTH_EMULATOR_HOST}`,
            reuseExistingServer: true,
            timeout: 120_000,
          },
          {
            command: 'npm run e2e:build && npm run e2e:start',
            url: baseURL,
            reuseExistingServer: true,
            timeout: 300_000,
            // Inlined at build time; dotenv won't override them.
            env: {
              NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR_HOST,
              ...(mapTilerToken ? { NEXT_PUBLIC_MAPTILER_TOKEN: mapTilerToken } : {}),
            },
          },
        ],
      }),
})
