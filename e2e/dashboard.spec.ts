import { test, expect } from '@playwright/test'

test('dashboard renders the weekly snapshot and recent activities', async ({ page }) => {
  await page.goto('/')

  // Greeting + weekly stats grid load without a client-side data fetch (SSG).
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()

  // data/activities/*.json always has activities (real or demo), so
  // there is always at least one recent activity card linking into
  // /activities/{id}.
  const firstActivityLink = page.locator('a[href^="/activities/"]').first()
  await expect(firstActivityLink).toBeVisible()
})
