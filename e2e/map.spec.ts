import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

test('heatmap: Activities on Map, chips, a 560 pt map with its legend and licence on it, the card under it', async ({ page }) => {
  // /map is a deep link to the Map view of Activities (design review, Oct 2026).
  await page.goto('/map')
  await expect(page).toHaveURL(/\/activities\?view=map$/)
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')

  await expect(page.getByText('Rare')).toBeVisible()
  await expect(page.getByText('Frequent')).toBeVisible()
  // The credits sit behind an ⓘ (3.0) and open on a tap.
  await page.getByRole('button', { name: 'Map credits' }).click()
  await expect(page.getByTestId('map-attribution')).toContainText('OpenStreetMap')
  await expect(page.getByRole('button', { name: 'World view' })).toHaveCount(0)

  const map = page.getByRole('img', { name: 'Heatmap' })
  const card = page.getByTestId('territory-card')
  // Runs, km and the median reach the sentence's ring is drawn at.
  await expect(card).toContainText('ring')
  await expect(card).toContainText('Median reach')
  const mapBox = (await map.boundingBox())!
  // 560 pt with its 1 pt border inside.
  expect(Math.round(mapBox.height)).toBe(558)
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

test('heatmap filters open where they can be seen', async ({ page }) => {
  await page.goto('/map')

  const chip = page.getByRole('button', { name: /^Area:/ })
  await chip.click()
  const menu = page.locator(`[id="${await chip.getAttribute('aria-controls')}"]`)
  await expect(menu).toBeVisible()
  expect(await drawnWhereItClaims(menu.getByRole('button').last())).toBe(true)
  await page.keyboard.press('Escape')
  await expect(chip).toHaveAttribute('aria-expanded', 'false')

  // Type and year behind one Filters circle, in a sheet (Heatmap Filters 1b,
  // 1c): nothing changes until "Show N runs", then the badge counts it.
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await expect(sheet).toBeVisible()
  const show = sheet.getByRole('button', { name: /^Show \d+ runs?$/ })
  // Polled: the sheet slides up for 0.42 s.
  await expect.poll(() => drawnWhereItClaims(show)).toBe(true)
  await sheet.getByRole('region', { name: 'Year' }).getByRole('button').nth(1).click()
  await expect(page.getByTestId('heat-filter-badge')).toHaveCount(0)
  await show.click()
  await expect(page.getByRole('button', { name: 'Filters, 1 on' })).toBeVisible()
  await expect(page.getByTestId('heat-filter-badge')).toHaveText('1')
})

// The row ran past an iPhone's width (owner, Oct 2026): the location pill,
// Filters and fullscreen fit 393 pt with any city name, in the page and in
// fullscreen, never scrolled and never cut.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 393, height: 852 } })

  test('the heatmap filter row fits, whatever the city', async ({ page }) => {
    await page.goto('/map')
    const row = page.getByTestId('heat-filter-row')
    const fits = () =>
      row.evaluate((el) => {
        const boxes = [...el.querySelectorAll<HTMLElement>(':scope > *, :scope > * > button')].map((c) => c.getBoundingClientRect())
        return el.scrollWidth <= el.clientWidth && boxes.every((r) => r.left >= 0 && r.right <= innerWidth)
      })
    // A long name, as the geocoder can give: the pill cuts it.
    await row.evaluate((el) => { el.querySelector('span.truncate')!.textContent = 'Kuala Lumpur Federal Territory' })
    expect(await fits()).toBe(true)

    await page.getByRole('button', { name: 'Fullscreen' }).click()
    await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
    await row.evaluate((el) => { el.querySelector('span.truncate')!.textContent = 'Kuala Lumpur Federal Territory' })
    expect(await fits()).toBe(true)
    // It floats over the map, which fills the screen under it.
    const mapBox = (await page.getByRole('img', { name: 'Heatmap' }).boundingBox())!
    expect(mapBox.y).toBeLessThanOrEqual(0)
  })
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
