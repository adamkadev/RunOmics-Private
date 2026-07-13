import { test, expect } from '@playwright/test'


test('records page renders the personal bests', async ({ page }) => {
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()

  await expect(page.getByText('20:38')).toBeVisible()
})
