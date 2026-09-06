import { test, expect } from '@playwright/test'

test('dashboard renders the weekly snapshot and recent activities', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()

  const firstActivityLink = page.locator('a[href^="/activities/"]').first()
  await expect(firstActivityLink).toBeVisible()
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
})
