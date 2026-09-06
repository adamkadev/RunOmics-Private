import { test, expect } from '@playwright/test'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
  // The week's own stat tiles - present whether or not a coaching block is
  // active, since the Plan renders one week view either way.
  await expect(page.getByText('Easy / Hard', { exact: true })).toBeVisible()
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
})
