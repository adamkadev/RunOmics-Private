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

test('heatmap actually initialises a MapLibre canvas', async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_MAPTILER_TOKEN,
    'needs NEXT_PUBLIC_MAPTILER_TOKEN: without it the map components return before constructing a Map'
  )

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const workerRequested = page.waitForRequest(/maplibre-gl-worker/)
  const styleRequested = page.waitForRequest(/api\.maptiler\.com\/maps\/.*style\.json/)

  await page.goto('/map')

  await expect(page.locator('canvas.maplibregl-canvas')).toBeAttached({ timeout: 30_000 })
  await workerRequested
  await styleRequested

  expect(errors).toEqual([])
})
