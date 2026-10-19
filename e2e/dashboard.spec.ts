import { test, expect } from './fixtures'

test('dashboard renders the readiness card and the day', async ({ page }) => {
  await page.goto('/')

  // The readiness card (design review, Oct 2026): the Form dial, fitness,
  // fatigue, load and Garmin's status, the whole card a way into Analytics.
  const readiness = page.getByTestId('readiness-card')
  await expect(readiness).toBeVisible()
  for (const label of ['Fitness', 'Fatigue', 'Load']) await expect(readiness.getByText(label, { exact: true })).toBeVisible()
  await expect(page.getByTestId('readiness-card-link')).toHaveAttribute('href', '/analytics')

  // Then the day: the session card and the last run, whichever the data has.
  await expect(page.getByTestId('today-board')).toBeVisible()
})
