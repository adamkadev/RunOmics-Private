import { test, expect } from './fixtures'

test('Progress is one list: the race, then a row per page in three groups, each opening its page', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByTestId('hub-season')).toBeVisible()
  await expect(page.getByTestId('consistency-row')).toHaveAttribute('href', '/consistency')
  await expect(page.getByTestId('explored-row')).toBeVisible()
  await expect(page.getByTestId('all-time-row')).toHaveAttribute('href', '/all-time')
})
