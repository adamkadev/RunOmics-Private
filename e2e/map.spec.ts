import { test, expect } from '@playwright/test'

test('heatmap page renders its shell and toggles world view', async ({ page }) => {
  await page.goto('/map')
  await expect(page.getByRole('heading', { name: 'Running Heatmap' })).toBeVisible()

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

  const zoneChip = page.getByRole('button', { name: /runs?$/ })
  const zoneName = async () => (await zoneChip.innerText()).split('\n')[0] ?? ''
  const before = await zoneName()

  await zoneChip.click()
  const options = page.locator('ul li button')
  await expect(options.first()).toBeVisible()

  const optionCount = await options.count()
  expect(optionCount).toBeGreaterThan(1)
  for (let i = 0; i < optionCount; i++) {
    const text = await options.nth(i).innerText()
    if (!text.startsWith(before)) {
      await options.nth(i).click()
      break
    }
  }

  await expect(async () => expect(await zoneName()).not.toBe(before)).toPass()
})
