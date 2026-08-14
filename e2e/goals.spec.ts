import { test, expect } from '@playwright/test'


test('goals page renders the annual target', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()

  // The annual distance target (a 3-5 digit km figure), not a specific value -
  // stays valid whether this build is running against real or demo data.
  await expect(page.getByText(/\d{3,5}/).first()).toBeVisible()
})
