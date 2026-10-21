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
    // The wrapper drops its class once the animation ends (v4.6), so no
    // wrapper left is as settled as one with no animation running.
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('main .animate-fade-up')
      return wrapper === null || wrapper.getAnimations().length === 0
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
    expect(surface.token).toMatch(/^#(0c0d0d|f3f4f3)$/)
  })
}

// iOS 26 takes the topmost fixed element touching the top edge as the page's
// bar, blurs content under it, and keeps the zone of the tallest one it has
// seen (v4.8). So only the shell's two touch the edge - the opaque status
// strip and the flat bar behind the page, as when a device showed the title
// sharp - and everything else fixed starts under the status bar: the compact
// title bar that shows once the page has scrolled included. A
// desktop browser has no safe area, so the test gives it a 59 pt one, as on a
// 16-series phone.
test.describe('on a phone', () => {
  // The top bars are phone-only (lg:hidden).
  test.use({ viewport: { width: 393, height: 852 } })

  for (const route of ['/', '/plan', '/analytics']) {
    test(`${route} lets only the shell's top bars touch the top edge`, async ({ page }) => {
      await page.goto(route)
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '59px'))
      for (const y of [0, 600]) {
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(300)
        const barShown = await page.evaluate(() => document.documentElement.hasAttribute('data-bar-shown'))
        const atTop = await page.evaluate(() => {
          const alpha = (color: string) => {
            if (color === 'transparent') return 0
            const parts = color.match(/[\d.]+/g) ?? []
            return parts.length === 4 ? Number(parts[3]) : 1
          }
          return [...document.querySelectorAll<HTMLElement>('body *')]
            .filter((el) => {
              const style = getComputedStyle(el)
              const box = el.getBoundingClientRect()
              return style.position === 'fixed' && style.display !== 'none' && box.top <= 0 && box.bottom > 0 && box.height > 0
            })
            .map((el) => {
              const style = getComputedStyle(el)
              return {
                id: el.dataset.testid ?? el.className.slice(0, 60),
                height: Math.round(el.getBoundingClientRect().height),
                opaque: Number(style.opacity) === 1 && alpha(style.backgroundColor) === 1,
              }
            })
        })
        // The strip is the notch zone; solid at rest, frosted glass while the
        // compact bar shows (owner, Oct 2026), so the notch blurs what
        // scrolls under the translucent status bar.
        expect(atTop, `scrolled to ${y}`).toEqual([
          { id: 'status-strip', height: 59, opaque: !barShown },
          { id: 'top-edge-bar', height: 48, opaque: true },
        ])
        if (y === 0) expect(barShown).toBe(false)
      }
      // Scrolled, the compact bar shows - under the strip, not over it, 52 pt
      // tall (design review, Oct 2026).
      if (route === '/analytics') {
        const bar = await page.getByTestId('compact-title-bar').boundingBox()
        expect(bar?.y).toBe(59)
        expect(bar?.height).toBe(52)
      }
    })
  }
})
