import { test } from './fixtures'

// Pages are served from an ISR cache, and the first visit after a quiet spell
// hydrates HTML rendered hours before the browser's own clock. Text worked out
// from the server's clock - "synced 56m ago" - then differs from the browser's
// first render and React throws #418, which the runtime-error fixture fails
// on. A fresh build hides that; running the browser's clock hours ahead of the
// render stands in for the cache.
const HOURS_SINCE_RENDER = 3

const ROUTES = [
  '/', '/activities', '/plan', '/analytics', '/profile', '/athlete',
  '/settings', '/goals', '/records', '/shoes', '/milestones',
]

for (const route of ROUTES) {
  test(`${route} hydrates from a page rendered hours earlier`, async ({ page }) => {
    await page.clock.install({ time: Date.now() + HOURS_SINCE_RENDER * 3_600_000 })
    await page.goto(route)
    await page.waitForLoadState('networkidle')
  })
}
