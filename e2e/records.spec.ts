import { test, expect } from './fixtures'

test('records page renders the personal bests', async ({ page }) => {
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()

  await expect(page.getByText(/\d{1,2}:\d{2}(:\d{2})?/).first()).toBeVisible()
})

test('the Records tabs live in the URL, and /milestones lands on its tab', async ({ page }) => {
  await page.goto('/records')
  await page.getByRole('tab', { name: 'Routes' }).click()
  await expect(page).toHaveURL(/\/records\?tab=routes$/)

  await page.goto('/milestones')
  await expect(page).toHaveURL(/\/records\?tab=milestones$/)
  await expect(page.getByRole('tab', { name: 'Milestones' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Next up')).toBeVisible()
})
