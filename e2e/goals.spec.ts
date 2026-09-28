import { test, expect } from './fixtures'

test('goals page renders the annual target', async ({ page }) => {
  await page.goto('/goals')
  // The page's own title: "Goals without a date" is a heading too (v4.17).
  await expect(page.getByRole('heading', { level: 1, name: /Goals/ })).toBeVisible()

  await expect(page.getByText(/\d{3,5}/).first()).toBeVisible()
})
