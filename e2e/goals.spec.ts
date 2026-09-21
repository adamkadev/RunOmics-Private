import { test, expect } from '@playwright/test'

test('goals page renders the annual target', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()

  await expect(page.getByText(/\d{3,5}/).first()).toBeVisible()
})
