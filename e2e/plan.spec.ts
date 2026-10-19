import { test, expect } from './fixtures'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()

  // That the *week* tab is the selected one, plus the phase under the title.
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByTestId('plan-subtitle')).toBeVisible()

})
