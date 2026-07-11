import { test, expect } from '@playwright/test'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
})
