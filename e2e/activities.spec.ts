import { test, expect } from './fixtures'

test('activities list renders and links into a detail page', async ({ page }) => {
  await page.goto('/activities')
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()

  const firstCard = page.locator('a[href^="/activities/"]').first()
  await expect(firstCard).toBeVisible()

  await expect(async () => {
    if (new URL(page.url()).pathname === '/activities') await firstCard.click()
    await expect(page).toHaveURL(/\/activities\/\d+/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  await expect(page.locator('h1')).toBeVisible()
  await expect(page.getByTestId('run-verdict')).toBeAttached()
})

test('activities list search narrows results', async ({ page }) => {
  await page.goto('/activities')

  const search = page.getByPlaceholder(/search/i)

  await expect(async () => {
    await search.fill('zzz-no-such-activity-zzz')
    await expect(page.getByText(/no activities found|no sessions of this type/i)).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
})

test('activities filter sheet picks exact types into one removable chip (3.0)', async ({ page }) => {
  await page.goto('/activities')

  await page.getByRole('button', { name: 'Filter & sort' }).click()
  const sheet = page.getByRole('dialog', { name: 'Filter & sort' })
  await sheet.getByRole('checkbox', { name: /Threshold/ }).click()
  await sheet.getByRole('checkbox', { name: /VO₂ Max/ }).click()
  await sheet.getByRole('button', { name: /^Show \d+ runs?$/ }).click()

  const chip = page.getByRole('button', { name: 'Clear the filter: Threshold, VO₂ Max' })
  await expect(chip).toBeVisible()
  await expect(page).toHaveURL(/types=Threshold(%2C|,)VO2Max/)
  await chip.click()
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
