import { test, expect } from './fixtures'

test('dashboard renders the readiness card and the day', async ({ page }) => {
  await page.goto('/')

  const readiness = page.getByTestId('readiness-card')
  await expect(readiness).toBeVisible()
  for (const id of ['tile-form', 'tile-fitness', 'tile-fatigue']) await expect(page.getByTestId(id)).toBeVisible()
  await expect(page.getByTestId('readiness-card-link')).toHaveAttribute('href', '/analytics')

  await expect(page.getByTestId('today-board')).toBeVisible()
  const session = page.getByTestId('session-card')
  if (await session.count()) await expect(session).toHaveAttribute('href', /^\/plan\?date=\d{4}-\d{2}-\d{2}$/)
  await expect(page.getByTestId('last-run')).toHaveCount(0)

  await expect(page.getByTestId('this-week-link')).toHaveAttribute('href', '/plan?view=week')
  await expect(page.getByTestId('week-bar')).toHaveCount(7)
})
