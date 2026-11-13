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

test('the period button keeps its place whichever period is picked from its menu', async ({ page, t }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/analytics')
  const control = page.getByTestId('period-button')
  const places: { x: number; y: number }[] = []
  for (const period of ['4w', '12w', '1y']) {
    const name = t.analytics.cards.period.words[period]!
    await control.click()
    await page.getByTestId('period-menu').getByRole('radio', { name, exact: true }).click()
    await expect(control).toHaveAccessibleName(`${t.analytics.cards.period.short[period]} · ${t.analytics.cards.period.button(name)}`)
    places.push(await control.evaluate((el) => ({ x: el.getBoundingClientRect().right + scrollX, y: el.getBoundingClientRect().top + scrollY })))
  }
  for (const place of places.slice(1)) {
    expect(place.y).toBe(places[0]!.y)
    expect(Math.abs(place.x - places[0]!.x)).toBeLessThan(1)
  }
})

test('a link opens the tab and period it names, and Back returns to them', async ({ page, t }) => {
  await page.goto('/analytics?tab=volume&period=1y')
  await expect(page.getByRole('tab', { name: t.analytics.tabs.volume })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('period-button')).toHaveAccessibleName(`${t.analytics.cards.period.short['1y']} · ${t.analytics.cards.period.button(t.analytics.cards.period.words['1y']!)}`)

  // The period carries over to the next tab.
  await page.getByRole('tab', { name: t.analytics.tabs.performance }).click()
  await expect(page).toHaveURL(/\/analytics\?tab=performance&period=1y$/)
  await page.goto('/records')
  await page.goBack()
  await expect(page.getByRole('tab', { name: t.analytics.tabs.performance })).toHaveAttribute('aria-selected', 'true')
})
