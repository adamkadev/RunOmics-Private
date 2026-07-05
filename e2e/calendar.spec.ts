import { test, expect } from '@playwright/test'

test('calendar week view renders', async ({ page }) => {
  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
})
