import { test as base, expect } from '@playwright/test'
import { en, type Strings } from '../src/i18n/en'
import { fr } from '../src/i18n/fr'

export interface AppOptions {
  appLocale: 'en' | 'fr'
}

// Specs import `test` from here, not @playwright/test, so every test also fails on a page error or console error.
const EXPECTED_CONSOLE_NOISE: RegExp[] = [
  // The e2e env points Firebase at a demo project with no network access to it guaranteed.
  /firestore\.googleapis\.com|Could not reach Cloud Firestore backend|FirebaseError: \[code=(unavailable|permission-denied)\]/i,
  // NEXT_PUBLIC_MAPTILER_TOKEN is deliberately unset for e2e, so tile requests are refused.
  /api\.maptiler\.com/i,
  // The blank style the e2e build draws its maps on names glyphs that are not there.
  /\/e2e-glyphs\//,
  // The e2e runner may have no route to OpenStreetMap for the Activity header's reverse geocoding.
  /nominatim\.openstreetmap\.org/i,
  // The e2e server has no FIREBASE_PROJECT_ID, so an owner-only route answers 503 to the emulator's owner.
  /status of 503 .*\/api\/athlete\/body/,
  // Firestore's connectivity probe in WebKit, which the app's img-src refuses on a deployment too.
  /www\.google\.com\/images\/cleardot\.gif/,
  // Vercel Analytics and Speed Insights scripts 404 under `next start`.
  /\/_vercel\/(insights|speed-insights)\/script\.js/,
]

export const test = base.extend<AppOptions & { runtimeErrors: string[]; t: Strings }>({
  appLocale: ['en', { option: true }],
  t: async ({ appLocale }, provide) => provide(appLocale === 'fr' ? fr : en),
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = `${message.text()} ${message.location().url ?? ''}`
        if (!EXPECTED_CONSOLE_NOISE.some((pattern) => pattern.test(text))) errors.push(`console: ${text.trim()}`)
      })

      await use(errors)

      expect(errors, 'runtime errors on the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
