import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const USUAL_START_LINE = 'Where most of your runs start · tap the map to move it'

// The e2e build has no MapTiler or OpenRouteService key, so these walk the DOM paths and mock the routing proxy.
test.use({ viewport: { width: 393, height: 852 } })

type LoopRequest = { start: [number, number]; distanceM: number; seeds: number[] }

async function mockLoops(page: Page): Promise<LoopRequest[]> {
  const requests: LoopRequest[] = []
  await page.route('**/api/explore/route', async (route) => {
    const request: LoopRequest = route.request().postDataJSON()
    requests.push(request)
    const [lon, lat] = request.start
    const ring = Array.from({ length: 121 }, (_, k) => {
      const a = (2 * Math.PI * k) / 120
      return [lon + 0.012 * Math.cos(a) - 0.012, lat + 0.008 * Math.sin(a), 20]
    })
    await route.fulfill({
      json: {
        candidates: request.seeds.map((seed) => ({ seed, coordinates: ring, distanceM: 8000, durationS: 2880, ascentM: 24, descentM: 24, waytypes: [[0, 120, 3]] })),
        attribution: '© openrouteservice by HeiGIT | © OpenStreetMap contributors',
      },
    })
  })
  return requests
}

/** A tap at a share of the map's box, repeated until `done` holds: the map takes taps only once its style is in. */
async function tapMap(page: Page, x: number, y: number, done: () => Promise<void>) {
  const canvas = page.locator('[data-map-root] canvas.maplibregl-canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expect(async () => {
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
    await done()
  }).toPass({ timeout: 20_000 })
}

test('the map sheet switches to Districts, opens on Heat again, and a link opens a district', async ({ page }) => {
  await page.goto('/activities?view=map')
  await page.getByTestId('map-menu').click()
  await expect(page.getByTestId('layer-districts')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('map-attribution')).toHaveCount(0)

  await page.getByTestId('layer-districts').click()
  await expect(page.getByTestId('layer-districts')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('districts-legend')).toContainText('Complete')
  await expect(page.getByTestId('territory-card')).toContainText(/is next, \d+% done\./, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/activities\?view=map$/)

  // Heat is where the map opens: Districts only by hand or from a link.
  await page.reload()
  await page.getByTestId('map-menu').click()
  await expect(page.getByTestId('layer-districts')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')

  await page.goto('/activities?view=map&layer=districts&quartier=demo-southfield')
  const sheet = page.getByTestId('quartier-sheet')
  await expect(sheet).toContainText('Southfield')
  await expect(sheet).toContainText('complete at 90%')
})

test('a loop from the routing proxy leaves as a closed GPX 1.1 track', async ({ page }) => {
  let request: { start: [number, number]; distanceM: number; seeds: number[] } | null = null
  await page.route('**/api/explore/route', async (route) => {
    request = route.request().postDataJSON()
    const [lon, lat] = request!.start
    // A ring through the requested start, with a little climb.
    const ring = Array.from({ length: 120 }, (_, k) => {
      const a = (2 * Math.PI * k) / 120
      return [lon + 0.012 * Math.cos(a) - 0.012, lat + 0.008 * Math.sin(a), 20 + 5 * Math.sin(a)]
    })
    ring.push(ring[0]!)
    await route.fulfill({
      json: {
        candidates: request!.seeds.map((seed) => ({
          seed,
          coordinates: ring,
          distanceM: 8000,
          durationS: 2880,
          ascentM: 24,
          descentM: 24,
          waytypes: [[0, ring.length - 1, 3]],
        })),
        attribution: '© openrouteservice by HeiGIT | © OpenStreetMap contributors',
      },
    })
  })

  await page.goto('/activities?view=map&explore=route&km=8')
  const panel = page.getByTestId('route-generator')
  await expect(panel.getByTestId('route-start-line')).toHaveText(USUAL_START_LINE, { timeout: 30_000 })
  // The labels show while loops load; the mocked climb only once they're in.
  await expect(panel.getByTestId('route-stats')).toContainText('+24 m')
  expect(request).not.toBeNull()
  expect(request!.distanceM).toBe(8000)
  expect(request!.seeds.length).toBeGreaterThan(0)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download GPX' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^runomics-[a-z0-9-]+-\d+km\.gpx$/)

  const gpx = readFileSync((await download.path())!, 'utf8')
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const points = [...doc.getElementsByTagName('trkpt')].map((p) => [p.getAttribute('lat'), p.getAttribute('lon')])
    return {
      invalid: doc.getElementsByTagName('parsererror').length > 0,
      namespace: doc.documentElement.namespaceURI,
      name: doc.getElementsByTagName('name')[0]?.textContent ?? '',
      count: points.length,
      first: points[0],
      last: points[points.length - 1],
    }
  }, gpx)
  expect(parsed.invalid).toBe(false)
  expect(parsed.namespace).toBe('http://www.topografix.com/GPX/1/1')
  expect(parsed.name).toContain('RunOmics')
  expect(parsed.count).toBeGreaterThan(50)
  expect(parsed.last).toEqual(parsed.first)

  await expect(panel.getByTestId('route-saved')).toBeVisible()
})

test('a tap on the map moves the loop’s start from the usual one', async ({ page }) => {
  const requests = await mockLoops(page)
  await page.goto('/activities?view=map&explore=route&km=8')
  const panel = page.getByTestId('route-generator')
  await expect(panel.getByTestId('route-stats')).toContainText('+24 m', { timeout: 30_000 })
  const usual = requests.at(-1)!.start

  await tapMap(page, 0.5, 0.3, async () => {
    await expect(panel.getByTestId('route-start-line')).not.toHaveText(USUAL_START_LINE, { timeout: 1_500 })
  })
  await expect.poll(() => requests.at(-1)!.start).not.toEqual(usual)
  const [lon, lat] = requests.at(-1)!.start
  expect(Number.isFinite(lon) && Number.isFinite(lat)).toBe(true)
})

test('a tap on a quartier opens its sheet', async ({ page }) => {
  const tracks = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/map/routes')
  await page.goto('/activities?view=map&layer=districts')
  expect((await tracks).ok()).toBe(true)
  await expect(page.getByTestId('territory-card')).toContainText(/is next, \d+% done\./, { timeout: 30_000 })
  const sheet = page.getByTestId('quartier-sheet')
  await tapMap(page, 0.5, 0.5, async () => {
    await expect(sheet).toBeVisible({ timeout: 1_500 })
  })
  await expect(sheet).toContainText(/complete at 90%/)
})
