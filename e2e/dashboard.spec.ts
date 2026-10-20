import { test, expect } from './fixtures'

test('dashboard renders the readiness card and the day', async ({ page }) => {
  await page.goto('/')

  // The readiness card (App Fixes 1a): no dial, Form, Fitness and Fatigue on
  // their tiles, the whole card a way into Analytics.
  const readiness = page.getByTestId('readiness-card')
  await expect(readiness).toBeVisible()
  for (const id of ['tile-form', 'tile-fitness', 'tile-fatigue']) await expect(page.getByTestId(id)).toBeVisible()
  await expect(page.getByTestId('readiness-card-link')).toHaveAttribute('href', '/analytics')

  // Then the day: the next workout, one link to Plan on its day (3.0.2: no
  // last-run row - it is the top of Activities).
  await expect(page.getByTestId('today-board')).toBeVisible()
  const session = page.getByTestId('session-card')
  if (await session.count()) await expect(session).toHaveAttribute('href', /^\/plan\?date=\d{4}-\d{2}-\d{2}$/)
  await expect(page.getByTestId('last-run')).toHaveCount(0)

  // One Mon–Sun card for the week (App Fixes 1a v2), opening Plan › Week.
  await expect(page.getByTestId('this-week-link')).toHaveAttribute('href', '/plan?view=week')
  await expect(page.getByTestId('week-bar')).toHaveCount(7)
})
