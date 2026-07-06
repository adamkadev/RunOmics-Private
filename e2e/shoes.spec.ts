import { test, expect } from '@playwright/test'

test('shoes list renders and links into a detail page', async ({ page }) => {
  await page.goto('/shoes')
  await expect(page.getByRole('heading', { name: 'Shoes' })).toBeVisible()

  const firstCard = page.locator('a[href^="/shoes/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/shoes\/[^/]+$/)
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.getByText('Tracked Activities')).toBeVisible()
})
