import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// iOS fills the installed app's opaque status bar with the theme-color meta, so the edge sampler's 12 pt must match it.
test.use({ viewport: { width: 393, height: 793 } })

const PAGES = ['/', '/activities', '/activities?view=map', '/plan', '/analytics', '/settings']

/** With `scrimmed`, the difference is from --background under the sheet's scrim. */
async function topEdgeDelta(
  page: Page,
  { scrimmed = false, y = 0, height = 12, skip = [] as [number, number][] } = {},
): Promise<number> {
  const shot = await page.screenshot({ clip: { x: 0, y, width: 393, height } })
  return page.evaluate(async ({ b64, scrimmed, skip }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const g = canvas.getContext('2d')!
    g.drawImage(img, 0, 0)
    const { data } = g.getImageData(0, 0, img.width, img.height)
    const root = getComputedStyle(document.documentElement)
    const bg = root.getPropertyValue('--background').trim()
    // The scrim's alpha, as the browser resolves it (the build may minify it to #0003).
    const probe = document.createElement('i')
    probe.style.color = 'var(--scrim-sheet)'
    document.body.append(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    const [r = 0, g2 = 0, b = 0, a = '1'] = resolved.match(/[\d.]+/g) ?? []
    const alpha = scrimmed ? Number(a) : 0
    const ink = [r, g2, b].map(Number)
    const want = [1, 3, 5].map((i, c) => parseInt(bg.slice(i, i + 2), 16) * (1 - alpha) + (ink[c] ?? 0) * alpha)
    const scale = img.width / 393
    let max = 0
    for (let i = 0; i < data.length; i += 4) {
      const x = ((i / 4) % img.width) / scale
      if (skip.some(([from, to]) => x >= from && x <= to)) continue
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs((data[i + c] ?? 0) - (want[c] ?? 0)))
    }
    return max
  }, { b64: shot.toString('base64'), scrimmed, skip })
}

/** A glass control's 28px drop shadow may darken a row above the control by design. */
async function glassDropSpans(page: Page, scope: string): Promise<[number, number][]> {
  return page.locator(`${scope} .lg`).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return [r.left - 28, r.right + 28] as [number, number]
    }),
  )
}

for (const theme of ['light', 'dark'] as const) {
  test(`the status bar's colour runs on under it, at rest and scrolled (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    for (const url of PAGES) {
      await page.goto(url)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

      const { themeColor, background } = await page.evaluate(() => {
        const meta = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].find(
          (m) => !m.media || matchMedia(m.media).matches,
        )
        return {
          themeColor: meta?.content,
          background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
        }
      })
      expect(themeColor, url).toBe(background)

      await page.waitForTimeout(300)
      expect(await topEdgeDelta(page), `${url} at rest`).toBeLessThanOrEqual(1)
      await page.evaluate(() => window.scrollTo(0, 400))
      await page.waitForTimeout(400)
      expect(await topEdgeDelta(page), `${url} scrolled`).toBeLessThanOrEqual(1)
    }
  })
}

// The sheet's scrim covers the edge sampler, which must not dim itself as well or it reads as a dark band.
for (const theme of ['light', 'dark'] as const) {
  test(`a sheet dims the top edge once, as the rest of the page (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/activities')
    await page.locator('main a[href^="/activities/"]').first().click()
    await expect(page).toHaveURL(/\/activities\/\d+/)
    await page.getByRole('button', { name: 'Share' }).first().click()
    await expect(page.getByTestId('share-sheet')).toBeVisible()
    await page.waitForTimeout(400)
    expect(await topEdgeDelta(page, { scrimmed: true })).toBeLessThanOrEqual(2)
  })
}

// Tiles meeting the edge sampler at full strength draw a hard line 12 pt under the status bar.
for (const theme of ['light', 'dark'] as const) {
  test(`the map hero fades in from the page ground under the edge sampler (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    await page.goto('/activities')
    await page.locator('main a[href^="/activities/"]').first().click()
    await expect(page).toHaveURL(/\/activities\/\d+/)
    const hero = page.getByTestId('run-hero')
    await expect(hero).toBeVisible()
    expect(await hero.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(12)
    expect(await hero.evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(330)
    await page.waitForTimeout(300)
    // The hero's glass controls 12 pt lower cast a drop that reaches this row faintly.
    const skip = await glassDropSpans(page, '[data-testid="run-hero"]')
    expect(skip.length).toBeGreaterThan(0)
    expect(await topEdgeDelta(page, { y: 12, height: 2, skip })).toBeLessThanOrEqual(2)
  })
}
