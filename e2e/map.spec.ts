import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'

test('heatmap: Activities on Map, chips, a 560 pt map with its legend and licence on it, the card under it', async ({ page }) => {
  await page.goto('/map')
  await expect(page).toHaveURL(/\/activities\?view=map$/)
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')

  await expect(page.getByText('Rare')).toBeVisible()
  await expect(page.getByText('Frequent')).toBeVisible()
  await page.getByRole('button', { name: 'Map credits' }).click()
  await expect(page.getByTestId('map-attribution')).toContainText('OpenStreetMap')
  await expect(page.getByRole('button', { name: 'World view' })).toHaveCount(0)

  const map = page.getByRole('img', { name: 'Heatmap' })
  const card = page.getByTestId('territory-card')
  await expect(card).toContainText('ring')
  await expect(card).toContainText('Median reach')
  const mapBox = (await map.boundingBox())!
  expect(Math.round(mapBox.height)).toBe(560)
  expect((await card.boundingBox())!.y).toBeGreaterThan(mapBox.y + mapBox.height)

  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible()
})

test('heatmap area list switches the selected area', async ({ page }) => {
  await page.goto('/map')

  // By its purpose, not its contents: the chip shows the selected zone's name, which is data.
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

// toBeVisible() and click() both pass on a menu the scrolling chip rail clips, so hit-testing decides.
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
    await row.evaluate((el) => { el.querySelector('span.truncate')!.textContent = 'Kuala Lumpur Federal Territory' })
    expect(await fits()).toBe(true)

    await page.getByRole('button', { name: 'Fullscreen' }).click()
    await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
    await row.evaluate((el) => { el.querySelector('span.truncate')!.textContent = 'Kuala Lumpur Federal Territory' })
    expect(await fits()).toBe(true)
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

test('heatmap fullscreen: the top row is live glass in full ink over a soft edge', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/map')
  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()

  const row = page.getByTestId('heat-filter-row')
  const capsule = page.getByRole('button', { name: /^Area:/ })
  expect(await capsule.evaluate((el) => {
    const blur = el.querySelector(':scope > .lg-blur')!
    const cs = getComputedStyle(blur)
    return cs.backdropFilter || cs.getPropertyValue('-webkit-backdrop-filter')
  })).not.toBe('none')

  // No backdrop root above it: no opacity under 1, filter, mask or backdrop-filter.
  const roots = await row.evaluate((el) => {
    const found: string[] = []
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (Number(cs.opacity) < 1 || cs.filter !== 'none' || (cs.maskImage && cs.maskImage !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) {
        found.push(`${a.tagName}.${a.className}`)
      }
    }
    return found
  })
  expect(roots).toEqual([])

  const ink = await page.getByTestId('area-label').evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--foreground)'
    document.body.appendChild(probe)
    const want = getComputedStyle(probe).color
    probe.remove()
    return { got: getComputedStyle(el).color, want }
  })
  expect(ink.got).toBe(ink.want)
  expect(await row.evaluate((el) => [...el.querySelectorAll('*')].every((n) => Number(getComputedStyle(n).opacity) === 1))).toBe(true)

  const edge = page.getByTestId('map-top-edge')
  expect(await edge.evaluate((el, rowEl) => el.parentElement === rowEl!.parentElement, await row.elementHandle())).toBe(true)
  const z = await page.evaluate(() => ({
    edge: Number(getComputedStyle(document.querySelector('[data-testid="map-top-edge"]')!).zIndex),
    row: Number(getComputedStyle(document.querySelector('[data-testid="heat-filter-row"]')!).zIndex),
  }))
  expect(z.edge).toBeLessThan(z.row)
  expect(await edge.evaluate((el) => getComputedStyle(el.children[0]!).backdropFilter)).toContain('blur(12px)')
})

// In fullscreen the edge sampler paints over the row, so a badge reaching above the row loses its top.
test('heatmap fullscreen: the filter badge is whole, clear of the edge sampler', async ({ page }) => {
  await page.goto('/map')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await sheet.getByRole('region', { name: 'Year' }).getByRole('button').nth(1).click()
  await sheet.getByRole('button', { name: /^Show \d+ runs?$/ }).click()
  await expect(sheet).toHaveCount(0)
  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()

  const badge = page.getByTestId('heat-filter-badge')
  await expect(badge).toHaveText('1')
  const { badgeTop, samplerBottom, topHit } = await badge.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const sampler = document.querySelector('[data-testid="map-edge-sampler"]')!.getBoundingClientRect()
    // The hit lands on the circle's 44 pt hit area, which covers its own badge.
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 1)
    return { badgeTop: box.top, samplerBottom: sampler.bottom, topHit: !!hit && el.closest('[data-testid="heat-filter-row"]')!.contains(hit) }
  })
  expect(badgeTop).toBeGreaterThanOrEqual(samplerBottom)
  expect(topHit).toBe(true)
})
