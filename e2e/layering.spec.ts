import { test, expect } from './fixtures'

// The page is one flat colour (neutral surfaces): no background layer between
// <body> and the page. This asks the browser what is on top at the centre of
// every piece of text in the page - it must be the page itself - and that the
// body paints the theme's flat background, with no gradient. It runs after
// the page transition, because the stacking context that animation adds
// while it plays once hid a layering problem.
for (const route of ['/', '/activities', '/plan', '/analytics', '/profile']) {
  test(`${route} draws its text on top, on a flat background`, async ({ page }) => {
    await page.goto(route)
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('main .animate-fade-up')
      return wrapper !== null && wrapper.getAnimations().length === 0
    })

    const covered = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const hidden: string[] = []
      for (const el of main.querySelectorAll('*')) {
        const hasText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (!hasText) continue
        const box = el.getBoundingClientRect()
        const y = box.top + box.height / 2
        // Clear of the fixed top scrim and the tab bar, which sit over the
        // page on purpose while it scrolls.
        if (box.width === 0 || y < 80 || y > innerHeight - 120) continue
        const hit = document.elementFromPoint(box.left + box.width / 2, y)
        if (hit && !main.contains(hit)) hidden.push(el.textContent!.trim().slice(0, 40))
      }
      return hidden
    })
    expect(covered).toEqual([])

    const surface = await page.evaluate(() => {
      const body = getComputedStyle(document.body)
      return {
        image: body.backgroundImage,
        color: body.backgroundColor,
        token: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
        aurora: document.querySelector('.aurora') !== null,
      }
    })
    expect(surface.aurora).toBe(false)
    expect(surface.image).toBe('none')
    expect(surface.token).toMatch(/^#(0b0c0c|f3f4f4)$/)
  })
}

// iOS 26 takes the topmost fixed element touching the top edge as the page's
// bar and blurs content scrolling under a transparent one. So every fixed
// element drawn at the top edge is opaque, at rest and once the page has
// scrolled (the compact title bar appears then): an invisible one, at opacity
// 0, brought the blur back over the status bar.
test.describe('on a phone', () => {
  // The top bars are phone-only (lg:hidden).
  test.use({ viewport: { width: 393, height: 852 } })

  for (const route of ['/', '/plan']) {
    test(`${route} keeps every fixed element at the top edge opaque`, async ({ page }) => {
      await page.goto(route)
      for (const y of [0, 600]) {
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(300)
        const seeThrough = await page.evaluate(() => {
          const alpha = (color: string) => {
            if (color === 'transparent') return 0
            const parts = color.match(/[\d.]+/g) ?? []
            return parts.length === 4 ? Number(parts[3]) : 1
          }
          return [...document.querySelectorAll<HTMLElement>('body *')]
            .filter((el) => {
              const style = getComputedStyle(el)
              const box = el.getBoundingClientRect()
              return style.position === 'fixed' && style.display !== 'none' && box.top <= 0 && box.height > 0
            })
            .filter((el) => {
              const style = getComputedStyle(el)
              return Number(style.opacity) < 1 || alpha(style.backgroundColor) < 1
            })
            .map((el) => el.dataset.testid ?? el.className.slice(0, 60))
        })
        expect(seeThrough, `scrolled to ${y}`).toEqual([])
      }
    })
  }
})
