import { test, expect } from './fixtures'

test('shoes list renders and links into a detail page', async ({ page }) => {
  await page.goto('/shoes')
  await expect(page.getByRole('heading', { name: 'Shoes' })).toBeVisible()

  const firstCard = page.locator('a[href^="/shoes/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/shoes\/[^/]+$/)
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shoes' })).toBeVisible()
  // Titled for the pair's state, whichever pair the list happened to open.
  await expect(page.getByText(/Recent runs|Last runs before retiring/)).toBeVisible()
})
