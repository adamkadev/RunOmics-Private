import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

// The e2e build has no MapTiler or OpenRouteService key, so these walk the DOM paths and mock the routing proxy.
test.use({ viewport: { width: 393, height: 852 } })

test('the layers button switches to Districts, remembers it, and a link opens a quartier', async ({ page }) => {
  await page.goto('/activities?view=map')
  const layers = page.getByTestId('layers-button')
  await expect(layers).toHaveAttribute('aria-pressed', 'false')

  await layers.click()
  await expect(layers).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('districts-legend')).toContainText('Complete')
  await expect(page.getByTestId('territory-card')).toContainText(/\d+ of 7 quartiers complete/)
  await expect(page).toHaveURL(/\/activities\?view=map$/)

  await page.reload()
  await expect(page.getByTestId('layers-button')).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/activities?view=map&layer=districts&quartier=demo-southfield')
  const sheet = page.getByTestId('quartier-sheet')
  await expect(sheet).toContainText('Southfield')
  await expect(sheet).toContainText('Complete at 90%')
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
  await expect(panel.getByTestId('route-footnote')).toHaveText('Tap the map where you’ll start.')
  expect(request).toBeNull()
  await panel.getByRole('button', { name: 'Start inside the quartier' }).click()
  // The labels show while loops load; the mocked climb only once they're in.
  await expect(panel.getByTestId('route-stats')).toContainText('+24 m')
  expect(request).not.toBeNull()
  expect(request!.distanceM).toBe(8000)
  expect(request!.seeds.length).toBeGreaterThan(0)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Download GPX' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^RunOmics-[A-Za-z0-9]+-\d+km\.gpx$/)

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
