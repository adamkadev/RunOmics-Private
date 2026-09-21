import { test, expect } from '@playwright/test'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()

  // That the *week* tab is the selected one, plus the week's load total -
  // rather than the "Easy / Hard" label the summary row no longer carries: it
  // prints the split as a ratio now ("81/19 easy"), so there is no fixed
  // string left to match.
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByText('Load', { exact: true })).toBeVisible()

  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
})
