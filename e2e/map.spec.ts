import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

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

  // By its purpose, not its contents: the chip shows the selected zone and its
  // route count, both of which are data, and the count lost its "runs" suffix.
  const zoneChip = page.getByRole('button', { name: /^Zones:/ })
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

  for (const name of [/^Zones:/, 'All types', 'All years']) {
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
