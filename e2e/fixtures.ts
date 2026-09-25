import { test as base, expect } from '@playwright/test'

/**
 * Every spec imports `test` from here instead of @playwright/test, so every
 * test also fails on an uncaught exception or a console error on the page.
 *
 * The specs used to assert that `[data-nextjs-dialog]` was absent - but that
 * is the development error overlay, and this suite runs a production build,
 * where it never exists. Those checks could not fail; these can.
 *
 * Console errors that are about the test environment rather than the app are
 * ignored by pattern, each with its reason. Anything else fails the test.
 */
const EXPECTED_CONSOLE_NOISE: RegExp[] = [
  // The e2e env points Firebase at a demo project with no network access to
  // it guaranteed, and push is never enabled; a failed Firestore channel is
  // the environment, not the app.
  /firestore\.googleapis\.com|Could not reach Cloud Firestore backend|FirebaseError: \[code=(unavailable|permission-denied)\]/i,
  // NEXT_PUBLIC_MAPTILER_TOKEN is deliberately unset for e2e (see .env.e2e),
  // so tile requests are refused.
  /api\.maptiler\.com/i,
  // Vercel Analytics and Speed Insights load scripts only a Vercel deployment
  // serves; under `next start` they 404.
  /\/_vercel\/(insights|speed-insights)\/script\.js/,
]

export const test = base.extend<{ runtimeErrors: string[] }>({
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
