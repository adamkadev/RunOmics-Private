import { test, expect } from '@playwright/test'

// NEXT_PUBLIC_MAPTILER_TOKEN is deliberately unset for e2e (see .env.e2e) - the
// map canvas itself never renders, but the shell (zone list, filters, legend,
// world view) is plain React state and renders regardless, so it's still worth
// covering.
test('heatmap page renders its shell and toggles world view', async ({ page }) => {
  await page.goto('/map')
  await expect(page.getByRole('heading', { name: 'Running Heatmap' })).toBeVisible()

  // Intensity legend is the default bottom chip while no run is selected.
  await expect(page.getByText('Rare')).toBeVisible()
  await expect(page.getByText('Frequent')).toBeVisible()

  const worldViewButton = page.getByRole('button', { name: 'World view' })
  await worldViewButton.click()
  await expect(worldViewButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Tap a zone to explore it')).toBeVisible()
  await expect(page.getByText('Rare')).toBeHidden()

  await page.getByRole('button', { name: 'Exit world view' }).click()
  await expect(page.getByText('Rare')).toBeVisible()
})

test('heatmap zone dropdown switches the selected zone', async ({ page }) => {
  await page.goto('/map')

  // The collapsed chip and the dropdown's list rows format differently (the
  // list also shows total km), so compare only the zone-name first line.
  const zoneChip = page.getByRole('button', { name: /runs?$/ })
  const zoneName = async () => (await zoneChip.innerText()).split('\n')[0] ?? ''
  const before = await zoneName()

  await zoneChip.click()
  const options = page.locator('ul li button')
  await expect(options.first()).toBeVisible()

  // Pick whichever option isn't already selected, so the test doesn't depend
  // on which zone happens to be the default.
  const optionCount = await options.count()
  for (let i = 0; i < optionCount; i++) {
    const text = await options.nth(i).innerText()
    if (!text.startsWith(before)) {
      await options.nth(i).click()
      break
    }
  }

  await expect(async () => expect(await zoneName()).not.toBe(before)).toPass()
})
