import { test, expect } from './fixtures'

test('analytics page renders lifetime stats and switches tabs', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  await expect(page.getByRole('tab', { name: 'Fitness' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Perf.' }).click()
  await expect(page.getByRole('tab', { name: 'Perf.' })).toHaveAttribute('aria-selected', 'true')
})
