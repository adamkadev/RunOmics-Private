import { test, expect } from '@playwright/test'

// The activities list renders every logged activity in one pass, so hydrating
// it is the slowest on the site and keeps growing with each Garmin sync. Both
// tests below drive React-owned controls, and `goto` only waits for `load` -
// an interaction dispatched before hydration attaches its handlers is simply
// dropped (a typed value gets overwritten by the first React render). Retrying
// the interaction is what makes these deterministic on a loaded CI runner.

test('activities list renders and links into a detail page', async ({ page }) => {
  await page.goto('/activities')
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()

  const firstCard = page.locator('a[href^="/activities/"]').first()
  await expect(firstCard).toBeVisible()

  await expect(async () => {
    // Only click again while still on the list, so a navigation that did commit
    // is never followed by a stray second click.
    if (new URL(page.url()).pathname === '/activities') await firstCard.click()
    await expect(page).toHaveURL(/\/activities\/\d+/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  // The h1 is the activity title (custom description or "<Day> Run"); assert
  // structure rather than exact text since it depends on which activity was
  // clicked.
  await expect(page.locator('h1')).toBeVisible()
})

test('activities list search narrows results', async ({ page }) => {
  await page.goto('/activities')

  // The search input is always visible (no toggle button to reveal it).
  const search = page.getByPlaceholder(/search/i)

  await expect(async () => {
    await search.fill('zzz-no-such-activity-zzz')
    // 300ms debounce plus the query round-trip.
    await expect(page.getByText(/no activities found|no sessions of this type/i)).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
})
