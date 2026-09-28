import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

test('heatmap: title, chips, a 540 pt map with its legend and licence on it, the card under it (v4.17)', async ({ page }) => {
  await page.goto('/map')
  await expect(page.getByRole('heading', { name: 'Heatmap', exact: true })).toBeVisible()
  await expect(page.getByText(/runs with GPS/)).toBeVisible()
  // A top-level page on desktop: the sidebar holds it, nothing to go back to.
  await expect(page.getByRole('button', { name: 'Activities' })).toBeHidden()

  await expect(page.getByText('Rare')).toBeVisible()
  await expect(page.getByText('Frequent')).toBeVisible()
  await expect(page.getByTestId('map-attribution')).toContainText('OpenStreetMap')
  await expect(page.getByRole('button', { name: 'World view' })).toHaveCount(0)

  const map = page.getByRole('img', { name: 'Heatmap' })
  const card = page.getByTestId('territory-card')
  // Runs, km and the median reach the sentence's ring is drawn at.
  await expect(card).toContainText('ring')
  await expect(card).toContainText('median reach')
  const mapBox = (await map.boundingBox())!
  // 540 pt with its 1 pt border inside.
  expect(Math.round(mapBox.height)).toBe(538)
  expect((await card.boundingBox())!.y).toBeGreaterThan(mapBox.y + mapBox.height)

  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible()
})

test('heatmap area list switches the selected area', async ({ page }) => {
  await page.goto('/map')

  // By its purpose, not its contents: the chip shows the selected zone's
  // name, which is data.
  const zoneChip = page.getByRole('button', { name: /^Area:/ })
  await zoneChip.click()

  const options = page.locator('ul li button')
  await expect(options.first()).toBeVisible()

  const optionCount = await options.count()
  expect(optionCount).toBeGreaterThan(1)

  // Zones are compared by their selected state, not their label: every cluster in the
  // demo dataset sits near 0,0 and so resolves to the same place name.
  const selectedIndex = async () => {
    for (let i = 0; i < optionCount; i++) {
      if ((await options.nth(i).getAttribute('aria-current')) === 'true') return i
    }
    return -1
  }

  const before = await selectedIndex()
  expect(before).toBeGreaterThanOrEqual(0)

  const target = before === 0 ? 1 : 0
  await options.nth(target).click()

  await zoneChip.click()
  await expect(page.locator('ul li button').nth(target)).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('ul li button').nth(before)).toHaveAttribute('aria-current', 'false')
})

// toBeVisible() and click() both pass on a menu the scrolling chip rail clips:
// the menu still has a box, and click() scrolls it into view first. What a
// person sees is what hit-testing finds at the centre of an option.
async function drawnWhereItClaims(option: Locator): Promise<boolean> {
  return option.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return hit !== null && el.contains(hit)
  })
}

test('heatmap filter menus open where they can be seen', async ({ page }) => {
  await page.goto('/map')

  for (const name of [/^Area:/, 'All types', 'All years']) {
    const chip = page.getByRole('button', { name }).first()
    await chip.click()
    const menu = page.locator(`[id="${await chip.getAttribute('aria-controls')}"]`)

    await expect(menu).toBeVisible()
    expect(await drawnWhereItClaims(menu.getByRole('button').last())).toBe(true)

    await page.keyboard.press('Escape')
    await expect(chip).toHaveAttribute('aria-expanded', 'false')
  }
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
