import { test, expect } from './fixtures'

test('shoes list renders and links into a detail page', async ({ page }) => {
  await page.goto('/shoes')
  await expect(page.getByRole('heading', { name: 'Shoes' })).toBeVisible()

  const firstCard = page.locator('a[href^="/shoes/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/shoes\/[^/]+$/)
  await expect(page.locator('h1')).toBeVisible()
  // The runs section, whichever pair the list happened to open: the rebuilt
  // detail screen titles it for the pair's state rather than calling every one
  // of them "Tracked Activities".
  await expect(page.getByText(/Recent runs|Last runs before retiring/)).toBeVisible()
})
