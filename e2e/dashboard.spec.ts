import { test, expect } from './fixtures'

test('dashboard renders the readiness card and the day', async ({ page }) => {
  await page.goto('/')

  // The readiness card (design review 3.0): the Form dial, then fitness,
  // fatigue and load on their tiles, the whole card a way into Analytics.
  const readiness = page.getByTestId('readiness-card')
  await expect(readiness).toBeVisible()
  await expect(page.getByTestId('form-dial')).toBeVisible()
  for (const label of ['Fitness', 'Fatigue', 'Load']) await expect(readiness.getByText(label, { exact: true })).toBeVisible()
  await expect(page.getByTestId('readiness-card-link')).toHaveAttribute('href', '/analytics')

  // Then the day: the next workout, one link to Plan on its day, and the
  // last run, whichever the data has.
  await expect(page.getByTestId('today-board')).toBeVisible()
  const session = page.getByTestId('session-card')
  if (await session.count()) await expect(session).toHaveAttribute('href', /^\/plan\?date=\d{4}-\d{2}-\d{2}$/)
})
