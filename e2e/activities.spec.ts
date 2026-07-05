import { test, expect } from '@playwright/test'

test('activities list renders and links into a detail page', async ({ page }) => {
  await page.goto('/activities')
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()

  const firstCard = page.locator('a[href^="/activities/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()

  await expect(page).toHaveURL(/\/activities\/\d+/)
  // The h1 is the activity title (custom description or "<Day> Run"); assert
  // structure rather than exact text since it depends on which activity was
  // clicked.
  await expect(page.locator('h1')).toBeVisible()
})

test('activities list search narrows results', async ({ page }) => {
  await page.goto('/activities')

  await page.getByRole('button', { name: /search/i }).click()
  await page.getByPlaceholder(/search/i).fill('zzz-no-such-activity-zzz')

  await expect(page.getByText(/no activities found|no sessions of this type/i)).toBeVisible()
})
