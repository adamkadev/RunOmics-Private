import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// F15: the installed app's status bar is opaque (statusBarStyle 'default'),
// iOS fills it with the theme-color meta - the page's --background - and the
// web view starts under it, its safe-area inset 0. The web view's first 12 pt,
// the edge sampler's, must be that same colour, at rest and scrolled, over the
// glow or not, or the status bar reads as a band above the header.
test.use({ viewport: { width: 393, height: 793 } })

const PAGES = ['/', '/activities', '/activities?view=map', '/plan', '/analytics', '/settings']

/** The largest channel difference from --background in the top 12 pt. */
async function topEdgeDelta(page: Page): Promise<number> {
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 393, height: 12 } })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const g = canvas.getContext('2d')!
    g.drawImage(img, 0, 0)
    const { data } = g.getImageData(0, 0, img.width, img.height)
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    const want = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16))
    let max = 0
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs((data[i + c] ?? 0) - (want[c] ?? 0)))
    }
    return max
  }, shot.toString('base64'))
}

for (const theme of ['light', 'dark'] as const) {
  test(`the status bar's colour runs on under it, at rest and scrolled (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    for (const url of PAGES) {
      await page.goto(url)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

      // The meta iOS stores at install is this mode's --background.
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
