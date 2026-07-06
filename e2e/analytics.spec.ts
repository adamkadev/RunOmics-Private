import { test, expect } from '@playwright/test'

test('analytics page renders lifetime stats and switches tabs', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  // public/data/activities/*.json is real committed data, so the stats row
  // always has at least a Distance figure.
  await expect(page.getByText('Distance').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Performance' }).click()
  await expect(page.getByRole('tab', { name: 'Performance' })).toHaveAttribute('aria-selected', 'true')
})
