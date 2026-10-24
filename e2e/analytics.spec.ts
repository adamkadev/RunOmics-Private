import { test, expect } from './fixtures'

test('analytics page renders lifetime stats and switches tabs', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  await expect(page.getByRole('tab', { name: 'Load' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Performance' }).click()
  await expect(page.getByRole('tab', { name: 'Performance' })).toHaveAttribute('aria-selected', 'true')
})

test('a chart readout stays inside its card, even over the last bars', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/analytics')
  await page.getByRole('tab', { name: 'Volume' }).click()
  const chart = page.locator('[data-chart-scrub]').first()
  await expect(chart).toBeVisible()
  const box = (await chart.boundingBox())!
  for (const at of [0.97, 0.88, 0.03]) {
    await page.mouse.move(box.x + box.width * at, box.y + box.height / 2)
    const readout = (await chart.getByRole('status').boundingBox())!
    expect(readout.x).toBeGreaterThanOrEqual(box.x - 0.5)
    expect(readout.x + readout.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
  }
})

test('the period control keeps its place whichever period is picked', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/analytics')
  const control = page.getByRole('radiogroup').first()
  const places: { x: number; y: number }[] = []
  for (const name of ['4 weeks', '12 weeks', 'a year']) {
    await page.getByRole('radio', { name }).click()
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true')
    places.push(await control.evaluate((el) => ({ x: el.getBoundingClientRect().left + scrollX, y: el.getBoundingClientRect().top + scrollY })))
  }
  for (const place of places.slice(1)) {
    expect(place.y).toBe(places[0]!.y)
    expect(Math.abs(place.x - places[0]!.x)).toBeLessThan(1)
  }
})
