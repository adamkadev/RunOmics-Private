import { test, expect } from './fixtures'

test('plan week view renders', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()

  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByTestId('phase-line')).toBeVisible()
  await expect(page.getByTestId('day-selector').getByRole('button')).toHaveCount(7)
})

test('plan opens on the day its URL names', async ({ page }) => {
  await page.goto('/plan?date=2026-10-21')
  await expect(page.getByTestId('day-2026-10-21')).toHaveAttribute('aria-pressed', 'true')
})

test('plan month view opens a week on tap', async ({ page }) => {
  await page.goto('/plan?view=month')
  await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('month-week').first().click()
  await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('day-selector')).toBeVisible()
})
