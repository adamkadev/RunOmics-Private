import { test, expect } from '@playwright/test'

test('analytics page renders lifetime stats and switches tabs', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  // The season totals moved to Progress; Analytics now opens on the group nav
  // and the charts, so the tab strip is what must be there.
  await expect(page.getByRole('tab', { name: 'Fitness' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Performance' }).click()
  await expect(page.getByRole('tab', { name: 'Performance' })).toHaveAttribute('aria-selected', 'true')
})
