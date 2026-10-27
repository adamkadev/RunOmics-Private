import { test, expect } from './fixtures'

test('analytics page renders lifetime stats and switches tabs', async ({ page, t }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: t.analytics.title })).toBeVisible()

  await expect(page.getByRole('tab', { name: t.analytics.tabs.fitness })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: t.analytics.tabs.performance }).click()
  await expect(page.getByRole('tab', { name: t.analytics.tabs.performance })).toHaveAttribute('aria-selected', 'true')
})

test('a chart readout stays inside its card, even over the last bars', async ({ page, t }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/analytics')
  await page.getByRole('tab', { name: t.analytics.tabs.volume }).click()
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

test('the period control keeps its place whichever period is picked', async ({ page, t }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/analytics')
  const control = page.getByRole('radiogroup').first()
  const places: { x: number; y: number }[] = []
  for (const period of ['4w', '12w', '1y']) {
    const name = t.analytics.cards.period.words[period]!
    await page.getByRole('radio', { name, exact: true }).click()
    await expect(page.getByRole('radio', { name, exact: true })).toHaveAttribute('aria-checked', 'true')
    places.push(await control.evaluate((el) => ({ x: el.getBoundingClientRect().left + scrollX, y: el.getBoundingClientRect().top + scrollY })))
  }
  for (const place of places.slice(1)) {
    expect(place.y).toBe(places[0]!.y)
    expect(Math.abs(place.x - places[0]!.x)).toBeLessThan(1)
  }
})

test('a link opens the tab and period it names, and Back returns to them', async ({ page, t }) => {
  await page.goto('/analytics?tab=volume&period=1y')
  await expect(page.getByRole('tab', { name: t.analytics.tabs.volume })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('radio', { name: t.analytics.cards.period.words['1y']!, exact: true })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('tab', { name: t.analytics.tabs.performance }).click()
  await expect(page).toHaveURL(/\/analytics\?tab=performance$/)
  await page.goto('/records')
  await page.goBack()
  await expect(page.getByRole('tab', { name: t.analytics.tabs.performance })).toHaveAttribute('aria-selected', 'true')
})
