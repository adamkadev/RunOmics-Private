import { test, expect } from './fixtures'

test('goals page renders the annual target', async ({ page }) => {
  await page.goto('/goals')
  // The page's own title, the level-1 heading.
  await expect(page.getByRole('heading', { level: 1, name: /Goals/ })).toBeVisible()

  await expect(page.getByText(/\d{3,5}/).first()).toBeVisible()
})
