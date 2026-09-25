import { test, expect } from './fixtures'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()

  // That the *week* tab is the selected one, plus the week summary - whose
  // load total sits behind its info button, so the button is what to find.
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByRole('button', { name: "About the week's load" })).toBeVisible()

})
