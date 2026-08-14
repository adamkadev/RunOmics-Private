import { test, expect } from '@playwright/test'


test('records page renders the personal bests', async ({ page }) => {
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()

  // A PB time (m:ss or h:mm:ss), not a specific value - stays valid whether
  // this build is running against real or demo data.
  await expect(page.getByText(/\d{1,2}:\d{2}(:\d{2})?/).first()).toBeVisible()
})
