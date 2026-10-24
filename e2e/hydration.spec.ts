import { test } from './fixtures'

// Stands in for the ISR cache: HTML rendered hours earlier makes clock-based text differ and React throw #418.
const HOURS_SINCE_RENDER = 3

const ROUTES = [
  '/', '/activities', '/plan', '/analytics', '/profile', '/athlete',
  '/settings', '/goals', '/race', '/records', '/shoes', '/milestones', '/consistency', '/all-time',
]

for (const route of ROUTES) {
  test(`${route} hydrates from a page rendered hours earlier`, async ({ page }) => {
    await page.clock.install({ time: Date.now() + HOURS_SINCE_RENDER * 3_600_000 })
    await page.goto(route)
    await page.waitForLoadState('networkidle')
  })
}
