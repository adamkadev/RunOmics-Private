import { test, expect } from './fixtures'

test('records page renders the personal bests', async ({ page }) => {
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()

  await expect(page.getByText(/\d{1,2}:\d{2}(:\d{2})?/).first()).toBeVisible()
})
