import { test, expect } from './fixtures'

test('dashboard renders the weekly snapshot and recent activities', async ({ page }) => {
  await page.goto('/')

  // The greeting that used to head this page is deliberately gone - it was the
  // largest type on the screen and the only thing on it not about the running.
  // The form/fitness/fatigue trio is the snapshot this test is named for.
  await expect(page.getByText('Form', { exact: true })).toBeVisible()
  await expect(page.getByText('Fitness', { exact: true })).toBeVisible()
  await expect(page.getByText('Fatigue', { exact: true })).toBeVisible()

  const firstActivityLink = page.locator('a[href^="/activities/"]').first()
  await expect(firstActivityLink).toBeVisible()
})
